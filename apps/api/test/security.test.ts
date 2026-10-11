import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  departmentScope,
  expenseScope,
  documentScope,
  monthRange,
  expenseSchema,
  classify,
  safeCitationIds,
  requireRoles,
  Context,
  expenseReference,
} from '../src/security';
import { evaluateRisk } from '../src/risk';
import { chunkText } from '../src/documents';
import { createDemoExpenses, demoDepartments } from '../../../packages/shared/src/demo';
import { FinanceService } from '../src/finance';
import { CopilotService } from '../src/copilot';
import { NvidiaService } from '../src/nvidia';
const finance: Context = {
  organizationId: 'org-a',
  userId: 'user-a',
  role: 'FINANCE',
  employeeId: 'emp-a',
  departmentId: 'dep-a',
  name: 'Test',
};
test('employee query isolation binds organization, department and own employee', () => {
  const result = expenseScope({ ...finance, role: 'EMPLOYEE' });
  assert.equal(result.organizationId, 'org-a');
  assert.equal(result.employeeId, 'emp-a');
  assert.equal(result.departmentId, 'dep-a');
});
test('manager cannot request another department and salary is excluded', () => {
  assert.throws(() => departmentScope({ ...finance, role: 'MANAGER' }, 'dep-b'));
  assert.deepEqual(expenseScope({ ...finance, role: 'MANAGER' }).category, { not: 'Salary' });
});
test('document retrieval limits restricted roles to global or own department documents', () => {
  assert.deepEqual(documentScope({ ...finance, role: 'EMPLOYEE' }), {
    organizationId: 'org-a',
    OR: [{ departmentId: null }, { departmentId: 'dep-a' }],
    AND: [{ OR: [{ status: 'INDEXED' }, { uploadedById: 'user-a' }] }],
  });
});
test('employee cannot allocate budgets or inspect organization summaries', () => {
  assert.throws(() => requireRoles({ ...finance, role: 'EMPLOYEE' }, ['ADMIN', 'FINANCE']));
});
test('monetary input rejects negatives, fractional cents and organization injection', () => {
  const base = {
    departmentId: 'd',
    amount: '1.25',
    category: 'Travel',
    merchant: 'Airline',
    date: '2026-10-09',
    description: 'Business travel',
  };
  assert.ok(expenseSchema.safeParse(base).success);
  for (const amount of ['-1', '1.234', 'NaN'])
    assert.ok(!expenseSchema.safeParse({ ...base, amount }).success);
  assert.ok(!expenseSchema.safeParse({ ...base, organizationId: 'other-org' }).success);
});
test('date windows handle year boundaries', () => {
  const range = monthRange('2026-12');
  assert.equal(range.lt.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.throws(() => monthRange('2026-13'));
});
test('risk rules are transparent and boundary amounts do not trigger threshold', () => {
  assert.deepEqual(evaluateRisk({ amount: '25000.00', receipt: true, threshold: '25000.00' }), []);
  const r = evaluateRisk({
    amount: '25000.01',
    receipt: false,
    threshold: '25000.00',
    duplicate: true,
    historicalMean: '1000.00',
    remaining: '500.00',
  });
  assert.equal(r.length, 5);
  assert.ok(r.every((v) => v.explanation && !/fraud/i.test(v.explanation)));
});
test('router selects supported tools and rejects unrelated requests', () => {
  assert.equal(classify('Why was EXP-1042 flagged?'), 'EXPENSE_INVESTIGATION');
  assert.equal(classify('Which departments exceeded budget?'), 'BUDGET_COMPARISON');
  assert.equal(classify('What is the travel policy?'), 'POLICY_QUESTION');
  assert.equal(classify('What is the employee expense reimbursement policy?'), 'POLICY_QUESTION');
  assert.equal(classify('Write a poem'), 'UNSUPPORTED');
});
test('investigation supports seeded references and newly submitted claim IDs', () => {
  const id = 'cmv287trd000ocnl4bpn3vjry';
  assert.equal(expenseReference(`Why was ${id} flagged?`), id);
  assert.equal(classify(`Why was ${id} flagged?`), 'EXPENSE_INVESTIGATION');
  assert.equal(expenseReference('Why was exp-1042 flagged?'), 'EXP-1042');
  assert.equal(expenseReference('Why was this expense flagged?'), undefined);
});
test('citation integrity rejects unknown and missing references', () => {
  assert.ok(safeCitationIds('Evidence [source:a]', [{ id: 'a' }]).valid);
  assert.ok(!safeCitationIds('Evidence [source:secret]', [{ id: 'a' }]).valid);
  assert.ok(!safeCitationIds('Unsupported claim', [{ id: 'a' }]).valid);
});
test('seed is exact and budgets have three overages', () => {
  const rows = createDemoExpenses().filter(
    (e) => e.date.startsWith('2026-10') && e.status === 'APPROVED',
  );
  const amount = rows.reduce((s, e) => s.plus(e.amount), new Prisma.Decimal(0));
  assert.equal(amount.toFixed(2), '1862500.00');
  assert.equal(demoDepartments.filter((d) => d.actual > d.budget).length, 3);
  assert.equal(new Prisma.Decimal('2450000').minus(amount).toFixed(2), '587500.00');
});
test('chunking retains overlap and no fabricated page metadata', () => {
  const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
  const chunks = chunkText(words);
  assert.equal(chunks.length, 3);
  assert.ok(chunks[0].includes('word240') && chunks[1].startsWith('word240'));
});
test('cross-organization expense detail cannot be accessed', async () => {
  const db = {
    expense: {
      findFirst: async (args: any) => {
        assert.equal(args.where.organizationId, 'org-a');
        return null;
      },
    },
  };
  const service = new FinanceService(db as any);
  await assert.rejects(() => service.detail(finance, 'other-organization-id'), /not found/);
});
test('budget SQL is parameterized and computes variance in PostgreSQL', async () => {
  let captured: any;
  const service = new FinanceService({
    $queryRaw: async (sql: any) => {
      captured = sql;
      return [];
    },
  } as any);
  await service.budgets(finance, '2026-10', 'dep-a');
  assert.ok(captured.values.includes('org-a'));
  assert.ok(captured.values.includes('dep-a'));
  assert.ok(captured.sql.includes('ROUND('));
  assert.ok(!captured.sql.includes('org-a'));
});
test('mocked NVIDIA failure returns evidence without marking response verified', async () => {
  const db = {
    conversation: { create: async () => ({ id: 'c' }) },
    message: { create: async () => ({ id: 'm' }) },
  };
  const fs = {
    departments: async () => [],
    budgets: async () => [
      {
        name: 'Marketing',
        budget: '100.00',
        actual: '110.00',
        variance: '10.00',
        utilization: '110',
      },
    ],
  };
  const provider = {
    explain: async () => {
      throw Error('NVIDIA unavailable');
    },
  };
  const service = new CopilotService(db as any, fs as any, {} as any, provider as any);
  const response = await service.ask(finance, 'Which departments exceeded budget?');
  assert.equal(response.verified, false);
  assert.equal(response.table?.[0].Actual, '110.00');
  assert.ok(response.warnings.includes('NVIDIA unavailable'));
});
test('mocked NVIDIA valid source is verified and fake citations are rejected', async () => {
  const db = {
    conversation: { create: async () => ({ id: 'c' }) },
    message: { create: async () => ({ id: 'm' }) },
  };
  const fs = {
    departments: async () => [],
    budgets: async () => [
      { name: 'Sales', budget: '100', actual: '110', variance: '10', utilization: '110' },
    ],
  };
  for (const [answer, verified] of [
    ['Sales over budget [source:budget-query]', true],
    ['Secret record [source:other-org]', false],
  ] as const) {
    const service = new CopilotService(
      db as any,
      fs as any,
      {} as any,
      { explain: async () => answer } as any,
    );
    assert.equal((await service.ask(finance, 'Budget comparison')).verified, verified);
  }
});
