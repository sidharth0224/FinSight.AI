import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Database } from './database';
import { FinanceService } from './finance';
import { DocumentsService } from './documents';
import { NvidiaService } from './nvidia';
import { budgetPeriod } from './budget-query';
import {
  Context,
  classify,
  safeCitationIds,
  financeRole,
  expenseScope,
  monthRange,
  expenseReference,
} from './security';
type Source = {
  id: string;
  title: string;
  passage: string;
  documentId?: string;
  expenseId?: string;
  page?: number;
};
@Injectable()
export class CopilotService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(DocumentsService) private documents: DocumentsService,
    @Inject(NvidiaService) private nvidia: NvidiaService,
  ) {}
  async conversations(c: Context) {
    return this.db.conversation.findMany({
      where: { organizationId: c.organizationId, userId: c.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    });
  }
  async messages(c: Context, id: string) {
    const conversation = await this.db.conversation.findFirst({
      where: { id, organizationId: c.organizationId, userId: c.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation.messages.map((m) =>
      m.payload ? { ...(m.payload as object), role: m.role } : { role: m.role, content: m.content },
    );
  }
  async remove(c: Context, id: string) {
    await this.messages(c, id);
    await this.db.conversation.delete({ where: { id } });
    return { ok: true };
  }
  async ask(c: Context, question: string, conversationId?: string) {
    const intent = classify(question);
    const sources: Source[] = [];
    let table: any[] | undefined;
    let chart: any;
    let evidence: any = {};
    let metrics: Record<string, unknown> = {};
    let budgetLead = '';
    const warnings: string[] = [];
    const explicitMonth = question.match(/\b(\d{4}-(?:0[1-9]|1[0-2]))\b/)?.[1];
    const month = explicitMonth || new Date().toISOString().slice(0, 7);
    if (conversationId) await this.messages(c, conversationId);
    if (['BUDGET_COMPARISON', 'BUDGET_SUMMARY'].includes(intent)) {
      const period = budgetPeriod(question);
      const deps = await this.finance.departments(c);
      const department = deps.find((d) =>
        question.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]),
      );
      const scope =
        department?.name || (c.role === 'MANAGER' ? deps[0]?.name : 'All authorized departments');
      if (intent === 'BUDGET_SUMMARY' || period.months.length > 1) {
        const analysis = await this.finance.budgetAnalysis(c, period.months, department?.id);
        table = analysis.periods.map((r) => ({
          Month: r.month,
          Budget: r.allocationCoverage.startsWith('0/') ? 'No recorded allocation' : r.budget,
          Expenditure: r.actual,
          Variance: r.variance,
          Utilization: r.utilization || 'No allocation',
          'Allocation coverage': r.allocationCoverage,
        }));
        chart = {
          type: 'bar',
          rows: analysis.periods.map((r) => ({
            name: r.month,
            budget: r.allocationCoverage.startsWith('0/') ? null : r.budget,
            actual: r.actual,
          })),
        };
        evidence = {
          requestedMetric: 'Total allocated budget and expenditure for the requested period',
          scope,
          months: period.months,
          periodAssumption: period.assumption,
          ...analysis,
        };
        metrics = { ...analysis.totals, months: period.months, scope };
        const periodLabel =
          period.months.length === 1
            ? period.months[0]
            : `${period.months[0]} to ${period.months.at(-1)}`;
        const format = (value: string) =>
          new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(value));
        const anyAllocation = analysis.periods.some((p) =>
          p.departments.some((d) => d.allocationRecorded !== false),
        );
        budgetLead = anyAllocation
          ? `### Total budget · ${periodLabel}\n\n**Recorded allocation: ${format(analysis.totals.allocated)}**. Approved expenditure: **${format(analysis.totals.expenditure)}**. Scope: ${scope}. [source:budget-query]\n\n`
          : `### Budget analysis · ${periodLabel}\n\nNo budget allocations were found for this period and scope. Approved expenditure: **${format(analysis.totals.expenditure)}**. [source:budget-query]\n\n`;
        if (period.assumption) budgetLead += `${period.assumption}\n\n`;
        if (analysis.missingMonths.length)
          warnings.push(
            `Allocation records are incomplete for ${analysis.missingMonths.join(', ')}. Totals include recorded allocations only; missing allocations are not assumed to be zero.`,
          );
      } else {
        const rows = await this.finance.budgets(c, period.months[0], department?.id);
        const exceededOnly = /exceed|over.?budget|outlier/i.test(question);
        const selected = exceededOnly
          ? rows.filter(
              (r) => r.allocationRecorded !== false && new Prisma.Decimal(r.actual).gt(r.budget),
            )
          : rows;
        table = selected.map((r) => ({
          Department: r.name,
          Budget: r.budget,
          Actual: r.actual,
          Variance: r.variance,
          Utilization: r.utilization || 'No allocation',
        }));
        chart = {
          type: 'bar',
          rows: rows.map((r) => ({ name: r.name, budget: r.budget, actual: r.actual })),
        };
        evidence = {
          month: period.months[0],
          scope,
          requestedMetric: exceededOnly
            ? 'Departments over budget'
            : 'Department budget comparison',
          departments: table,
        };
      }
      sources.push({
        id: 'budget-query',
        title: `Budget records · ${period.months.join(', ')}`,
        passage: JSON.stringify(evidence),
      });
    } else if (intent === 'EXPENSE_INVESTIGATION') {
      const id = expenseReference(question);
      if (!id) throw new BadRequestException('Include a valid expense reference.');
      const expense = await this.finance.detail(c, id);
      evidence = { expense };
      sources.push({
        id: 'expense-record',
        title: id,
        passage: JSON.stringify(expense),
        expenseId: id,
      });
      sources.push(
        ...(await this.documents.retrieve(
          c,
          `${expense.category} expense reimbursement policy receipt threshold`,
        )),
      );
      warnings.push('Automated risk indicators require human review.');
    } else if (intent === 'POLICY_QUESTION')
      sources.push(...(await this.documents.retrieve(c, question)));
    else if (intent === 'AUDIT_SUMMARY') {
      const findings = await this.finance.findings(c);
      table = findings.map((f) => ({
        Reference: f.id,
        Finding: f.title,
        Status: f.status,
        Severity: f.severity,
      }));
      evidence = { findings };
      sources.push({
        id: 'audit-query',
        title: 'Authorized audit findings',
        passage: JSON.stringify(table),
      });
      warnings.push('Automated risk indicators require human review.');
    } else if (['FINANCIAL_ANALYTICS', 'HYBRID_QUESTION'].includes(intent)) {
      financeRole(c);
      const deps = await this.finance.departments(c);
      const department = deps.find((d) =>
        question.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]),
      );
      const summary = await this.finance.dashboard(c, month, department?.id);
      evidence = { month, summary };
      if (/compare|previous|last month/i.test(question)) {
        const prev = new Date(month + '-01T00:00:00Z');
        prev.setUTCMonth(prev.getUTCMonth() - 1);
        const previous = await this.finance.dashboard(
          c,
          prev.toISOString().slice(0, 7),
          department?.id,
        );
        const currentAmount = new Prisma.Decimal(summary.expenditure);
        const previousAmount = new Prisma.Decimal(previous.expenditure);
        evidence.comparison = {
          current: currentAmount.toFixed(2),
          previous: previousAmount.toFixed(2),
          change: currentAmount.minus(previousAmount).toFixed(2),
          percentChange: previousAmount.gt(0)
            ? currentAmount.minus(previousAmount).div(previousAmount).times(100).toFixed(2)
            : null,
        };
        table = [
          { Period: prev.toISOString().slice(0, 7), Expenditure: previous.expenditure },
          { Period: month, Expenditure: summary.expenditure },
        ];
      }
      if (/categor/i.test(question)) {
        const categories = await this.db.expense.groupBy({
          by: ['category'],
          where: {
            ...expenseScope(c, department?.id),
            status: 'APPROVED',
            date: monthRange(month),
          },
          _sum: { amount: true },
        });
        table = categories.map((r) => ({
          Category: r.category,
          Expenditure: r._sum.amount?.toFixed(2) || '0.00',
        }));
        evidence.categories = table;
      }
      sources.push({
        id: 'finance-query',
        title: `Financial records · ${month}`,
        passage: JSON.stringify(evidence),
      });
      if (intent === 'HYBRID_QUESTION')
        sources.push(...(await this.documents.retrieve(c, question)));
    }
    let answer: string;
    let verified = false;
    if (intent === 'UNSUPPORTED') {
      answer =
        'I can help with financial analytics, budgets, expense investigations, policies, and audit findings. Try asking about department spending or your travel policy.';
    } else if (
      !sources.length ||
      (Object.keys(evidence).length === 0 && intent !== 'POLICY_QUESTION')
    ) {
      answer =
        'I couldn’t find sufficient authorized evidence to answer this question. Try another period or add and index the relevant documents.';
      warnings.push('Insufficient evidence.');
    } else {
      try {
        answer = await this.nvidia.explain(question, { ...evidence, sources });
        const validation = safeCitationIds(answer, sources);
        verified = validation.valid;
        if (!verified)
          warnings.push(
            'The response did not provide valid source references. Review the supplied evidence before relying on it.',
          );
        else {
          const referenced = new Set(validation.ids);
          for (let i = sources.length - 1; i >= 0; i--)
            if (!referenced.has(sources[i].id)) sources.splice(i, 1);
        }
      } catch (err) {
        answer =
          'The AI explanation service is unavailable. Your authorized financial results and evidence remain available below.';
        warnings.push(err instanceof Error ? err.message : 'NVIDIA unavailable.');
      }
    }
    if (budgetLead) answer = budgetLead + answer;
    const conversation = conversationId
      ? { id: conversationId }
      : await this.db.conversation.create({
          data: {
            organizationId: c.organizationId,
            userId: c.userId,
            title: question.slice(0, 80),
          },
        });
    await this.db.message.create({
      data: { conversationId: conversation.id, role: 'user', content: question },
    });
    const messageId = crypto.randomUUID();
    const payload = {
      conversationId: conversation.id,
      messageId,
      answer,
      answerType: intent,
      citations: sources,
      metrics,
      ...(table ? { table } : {}),
      ...(chart ? { chart } : {}),
      followups: [
        'Which departments exceeded their budget this month?',
        'What is our travel reimbursement policy?',
      ],
      warnings,
      verified,
    };
    await this.db.message.create({
      data: {
        id: messageId,
        conversationId: conversation.id,
        role: 'assistant',
        content: answer,
        payload: payload as Prisma.InputJsonValue,
        sources: {
          create: sources.map((s) => ({ sourceId: s.id, metadata: s as Prisma.InputJsonValue })),
        },
      },
    });
    return payload;
  }
}
