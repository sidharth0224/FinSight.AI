import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Database } from './database';
import {
  Context,
  departmentScope,
  expenseScope,
  monthRange,
  financeRole,
  requireRoles,
} from './security';
import { evaluateRisk } from './risk';
@Injectable()
export class FinanceService {
  constructor(@Inject(Database) private db: Database) {}
  async log(c: Context, action: string, target: string, metadata?: Prisma.InputJsonValue) {
    return this.db.auditLog.create({
      data: { organizationId: c.organizationId, actorId: c.userId, action, target, metadata },
    });
  }
  async departments(c: Context) {
    return this.db.department.findMany({
      where: {
        organizationId: c.organizationId,
        ...(departmentScope(c) ? { id: departmentScope(c) } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }
  mapExpense(e: any) {
    return {
      id: e.id,
      employee: e.employee.name,
      employeeId: e.employeeId,
      department: e.department.name,
      departmentId: e.departmentId,
      amount: e.amount.toFixed(2),
      currency: e.currency,
      category: e.category,
      merchant: e.merchant,
      date: e.date.toISOString().slice(0, 10),
      description: e.description,
      status: e.status,
      receipt: e.receipt,
      risk: e.flags.some((f: any) => f.severity === 'High')
        ? 'High'
        : e.flags.length
          ? 'Medium'
          : 'None',
      rules: e.flags.map((f: any) => f.rule),
      comments: e.comments || [],
    };
  }
  async expenses(c: Context, month: string, department?: string) {
    const records = await this.db.expense.findMany({
      where: { ...expenseScope(c, department), date: monthRange(month) },
      include: { employee: true, department: true, flags: true },
      orderBy: { date: 'desc' },
    });
    return records.map((e) => this.mapExpense(e));
  }
  async detail(c: Context, id: string) {
    const expense = await this.db.expense.findFirst({
      where: { ...expenseScope(c), id },
      include: {
        employee: true,
        department: true,
        flags: true,
        comments: { orderBy: { createdAt: 'asc' } },
        approvals: true,
        attachments: true,
      },
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    const category = await this.db.expenseCategory.findUnique({
      where: { organizationId_name: { organizationId: c.organizationId, name: expense.category } },
    });
    return {
      ...this.mapExpense(expense),
      riskSignals: expense.flags,
      history: expense.approvals,
      policyThreshold: category?.threshold.toFixed(2) || null,
      attachments: expense.attachments.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
    };
  }
  async budgets(c: Context, month: string, department?: string) {
    financeRole(c);
    const scoped = departmentScope(c, department);
    const date = monthRange(month);
    const result = await this.db.$queryRaw<any[]>(Prisma.sql`
 SELECT d.id,d.name,d.color,(b.id IS NOT NULL) AS "allocationRecorded",COALESCE(b.amount,0)::text AS budget,
 COALESCE(e.actual,0)::text AS actual,
 (COALESCE(e.actual,0)-COALESCE(b.amount,0))::text AS variance,
 CASE WHEN b.amount>0 THEN ROUND(COALESCE(e.actual,0)/b.amount*100,2)::text ELSE NULL END AS utilization
 FROM departments d LEFT JOIN budgets b ON b."departmentId"=d.id AND b."organizationId"=${c.organizationId} AND b.month=${month} AND b.category='ALL'
 LEFT JOIN (SELECT "departmentId",SUM(amount) AS actual FROM expenses WHERE "organizationId"=${c.organizationId} AND status='APPROVED' AND date>=${date.gte} AND date<${date.lt} ${c.role === 'MANAGER' ? Prisma.sql`AND category<>'Salary'` : Prisma.empty} GROUP BY "departmentId") e ON e."departmentId"=d.id
 WHERE d."organizationId"=${c.organizationId} ${scoped ? Prisma.sql`AND d.id=${scoped}` : Prisma.empty} ORDER BY d.name`);
    return result;
  }
  async budgetAnalysis(c: Context, months: string[], department?: string) {
    financeRole(c);
    if (!months.length || months.length > 24)
      throw new BadRequestException('Choose between 1 and 24 months.');
    const periods = [];
    const missingMonths: string[] = [];
    for (const month of months) {
      const rows = await this.budgets(c, month, department);
      const budget = rows.reduce((sum, r) => sum.plus(r.budget), new Prisma.Decimal(0));
      const actual = rows.reduce((sum, r) => sum.plus(r.actual), new Prisma.Decimal(0));
      const recorded = rows.filter((r) => r.allocationRecorded !== false).length;
      if (recorded < rows.length || !rows.length) missingMonths.push(month);
      periods.push({
        month,
        budget: budget.toFixed(2),
        actual: actual.toFixed(2),
        variance: actual.minus(budget).toFixed(2),
        utilization: budget.gt(0) ? actual.div(budget).times(100).toFixed(2) : null,
        allocationCoverage: `${recorded}/${rows.length} departments`,
        departments: rows,
      });
    }
    const allocated = periods.reduce((sum, r) => sum.plus(r.budget), new Prisma.Decimal(0));
    const spent = periods.reduce((sum, r) => sum.plus(r.actual), new Prisma.Decimal(0));
    return {
      periods,
      missingMonths,
      totals: {
        allocated: allocated.toFixed(2),
        expenditure: spent.toFixed(2),
        variance: spent.minus(allocated).toFixed(2),
        remaining: allocated.minus(spent).toFixed(2),
        utilization: allocated.gt(0) ? spent.div(allocated).times(100).toFixed(2) : null,
      },
    };
  }
  async dashboard(c: Context, month: string, department?: string) {
    financeRole(c);
    const depts = await this.budgets(c, month, department);
    const date = monthRange(month);
    const scoped = departmentScope(c, department);
    const [incomeResult, counts, expenses] = await Promise.all([
      scoped
        ? Promise.resolve({ _sum: { amount: null } })
        : this.db.financialTransaction.aggregate({
            where: { organizationId: c.organizationId, kind: 'INCOME', date },
            _sum: { amount: true },
          }),
      this.db.expense.findMany({
        where: { ...expenseScope(c, department), date },
        select: { status: true, flags: { select: { id: true } } },
      }),
      this.expenses(c, month, department),
    ]);
    const expenditure = depts.reduce((s, d) => s.plus(d.actual), new Prisma.Decimal(0));
    const budget = depts.reduce((s, d) => s.plus(d.budget), new Prisma.Decimal(0));
    const income = new Prisma.Decimal(incomeResult._sum.amount || 0);
    const trend = [];
    const current = new Date(date.gte);
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - i, 1));
      const range = monthRange(dt.toISOString().slice(0, 7));
      const [exp, inc] = await Promise.all([
        this.db.expense.aggregate({
          where: { ...expenseScope(c, department), status: 'APPROVED', date: range },
          _sum: { amount: true },
        }),
        scoped
          ? Promise.resolve({ _sum: { amount: null } })
          : this.db.financialTransaction.aggregate({
              where: { organizationId: c.organizationId, kind: 'INCOME', date: range },
              _sum: { amount: true },
            }),
      ]);
      trend.push({
        month: dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
        expenditure: exp._sum.amount?.toFixed(2) || '0.00',
        income: inc._sum.amount?.toFixed(2) || '0.00',
      });
    }
    return {
      income: income.toFixed(2),
      expenditure: expenditure.toFixed(2),
      net: income.minus(expenditure).toFixed(2),
      budget: budget.toFixed(2),
      utilization: budget.gt(0) ? expenditure.div(budget).times(100).toFixed(2) : '0',
      departments: depts,
      trend,
      pending: counts.filter((e) => e.status === 'PENDING').length,
      flagged: counts.filter((e) => e.flags.length).length,
      expenses: expenses.slice(0, 5),
    };
  }
  async allocate(
    c: Context,
    input: { departmentId: string; month: string; amount: string; category?: string },
  ) {
    requireRoles(c, ['ADMIN', 'FINANCE']);
    const dep = await this.db.department.findFirst({
      where: { id: input.departmentId, organizationId: c.organizationId },
    });
    if (!dep) throw new NotFoundException('Department not found.');
    const category = input.category || 'ALL';
    const result = await this.db.$transaction(async (tx) => {
      const b = await tx.budget.upsert({
        where: {
          organizationId_departmentId_month_category: {
            organizationId: c.organizationId,
            departmentId: dep.id,
            month: input.month,
            category,
          },
        },
        create: {
          organizationId: c.organizationId,
          departmentId: dep.id,
          month: input.month,
          amount: input.amount,
          category,
        },
        update: { amount: input.amount },
      });
      await tx.budgetPeriod.create({
        data: { budgetId: b.id, amount: b.amount, actorId: c.userId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: c.organizationId,
          actorId: c.userId,
          action: 'BUDGET_ALLOCATED',
          target: b.id,
        },
      });
      return b;
    });
    return result;
  }
  async submit(
    c: Context,
    input: {
      departmentId: string;
      amount: string;
      category: string;
      merchant: string;
      date: string;
      description: string;
    },
  ) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE']);
    const department = departmentScope(c, input.departmentId);
    const employee = await this.db.employee.findFirst({
      where: {
        organizationId: c.organizationId,
        userId: c.userId,
        departmentId: department || input.departmentId,
      },
    });
    if (!employee)
      throw new ForbiddenException(
        'You can submit only for your own assigned employee and department.',
      );
    const date = new Date(input.date);
    if (date > new Date(Date.now() + 86400000))
      throw new BadRequestException('Expense date cannot be in the future.');
    const [threshold, duplicate, avg, budget, used] = await Promise.all([
      this.db.expenseCategory.findUnique({
        where: { organizationId_name: { organizationId: c.organizationId, name: input.category } },
      }),
      this.db.expense.findFirst({
        where: {
          organizationId: c.organizationId,
          employeeId: employee.id,
          merchant: input.merchant,
          date,
          amount: input.amount,
          status: { not: 'REJECTED' },
        },
      }),
      this.db.expense.aggregate({
        where: {
          organizationId: c.organizationId,
          category: input.category,
          status: 'APPROVED',
          date: { lt: date },
        },
        _avg: { amount: true },
      }),
      this.db.budget.findUnique({
        where: {
          organizationId_departmentId_month_category: {
            organizationId: c.organizationId,
            departmentId: employee.departmentId,
            month: input.date.slice(0, 7),
            category: 'ALL',
          },
        },
      }),
      this.db.expense.aggregate({
        where: {
          organizationId: c.organizationId,
          departmentId: employee.departmentId,
          status: 'APPROVED',
          date: monthRange(input.date.slice(0, 7)),
        },
        _sum: { amount: true },
      }),
    ]);
    const flags = evaluateRisk({
      amount: input.amount,
      receipt: false,
      threshold: threshold?.threshold.toFixed(2),
      duplicate: !!duplicate,
      historicalMean: avg._avg.amount?.toFixed(2),
      remaining: budget?.amount.minus(used._sum.amount || 0).toFixed(2),
    });
    const result = await this.db.expense.create({
      data: {
        ...input,
        date,
        employeeId: employee.id,
        organizationId: c.organizationId,
        flags: { create: flags },
      },
      include: { employee: true, department: true, flags: true },
    });
    await this.log(c, 'EXPENSE_SUBMITTED', result.id);
    return this.mapExpense(result);
  }
  async review(c: Context, id: string, status: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER']);
    const expense = await this.detail(c, id);
    if (expense.employeeId === c.employeeId)
      throw new ForbiddenException('You cannot approve or reject your own claim.');
    if (expense.status !== 'PENDING')
      throw new BadRequestException('Only pending claims can be reviewed.');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.expense.updateMany({
        where: { id, ...expenseScope(c), status: 'PENDING' },
        data: { status },
      });
      if (!updated.count) throw new BadRequestException('Claim was already reviewed.');
      await tx.expenseApproval.create({ data: { expenseId: id, actorId: c.userId, status } });
      await tx.auditLog.create({
        data: {
          organizationId: c.organizationId,
          actorId: c.userId,
          action: `EXPENSE_${status}`,
          target: id,
        },
      });
    });
    return this.detail(c, id);
  }
  async comment(c: Context, id: string, text: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR']);
    await this.detail(c, id);
    await this.db.reviewComment.create({ data: { expenseId: id, actor: c.name, text } });
    await this.log(c, 'EXPENSE_COMMENT', id);
    return { ok: true };
  }
  async findings(c: Context) {
    financeRole(c);
    const accessible = await this.db.expense.findMany({
      where: expenseScope(c),
      select: { id: true },
    });
    return (
      await this.db.auditFinding.findMany({
        where: { organizationId: c.organizationId, expenseId: { in: accessible.map((e) => e.id) } },
        orderBy: { createdAt: 'desc' },
      })
    ).map((f) => ({ ...f, date: f.createdAt.toISOString().slice(0, 10) }));
  }
  async updateFinding(c: Context, id: string, status: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'AUDITOR']);
    if (!(await this.findings(c)).some((f) => f.id === id))
      throw new NotFoundException('Finding not found.');
    await this.db.auditFinding.update({ where: { id }, data: { status } });
    await this.log(c, 'AUDIT_STATUS_UPDATED', id);
    return { ok: true };
  }
  async ledger(
    c: Context,
    input: {
      description: string;
      date: string;
      lines: { accountId: string; debit: string; credit: string }[];
    },
  ) {
    requireRoles(c, ['ADMIN', 'FINANCE']);
    const debit = input.lines.reduce((s, l) => s.plus(l.debit), new Prisma.Decimal(0));
    const credit = input.lines.reduce((s, l) => s.plus(l.credit), new Prisma.Decimal(0));
    if (
      !debit.eq(credit) ||
      debit.lte(0) ||
      input.lines.some(
        (l) => new Prisma.Decimal(l.debit).gt(0) && new Prisma.Decimal(l.credit).gt(0),
      )
    )
      throw new BadRequestException(
        'Journal entries must balance and each line must be debit or credit.',
      );
    const accounts = await this.db.account.findMany({
      where: { organizationId: c.organizationId, id: { in: input.lines.map((l) => l.accountId) } },
    });
    if (input.lines.some((l) => !accounts.some((a) => a.id === l.accountId)))
      throw new ForbiddenException('Account access denied.');
    const entry = await this.db.journalEntry.create({
      data: {
        organizationId: c.organizationId,
        description: input.description,
        date: new Date(input.date),
        lines: { create: input.lines },
      },
    });
    await this.log(c, 'JOURNAL_CREATED', entry.id);
    return entry;
  }
}
