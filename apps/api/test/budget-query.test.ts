import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetPeriod } from '../src/budget-query';
import { FinanceService } from '../src/finance';
import { classify, Context } from '../src/security';
import { CopilotService } from '../src/copilot';
const now = new Date('2026-10-10T09:00:00Z');
const context: Context = {
  organizationId: 'org-a',
  userId: 'user-a',
  name: 'Finance',
  role: 'FINANCE',
  departmentId: null,
  employeeId: null,
};
test('total budget and historical analysis are distinct from over-budget questions', () => {
  assert.equal(classify('Total budget this month'), 'BUDGET_SUMMARY');
  assert.equal(classify('Total Budget Analysis in last three months'), 'BUDGET_SUMMARY');
  assert.equal(classify('Which departments exceeded budget?'), 'BUDGET_COMPARISON');
});
test('rolling windows include current month explicitly and completed windows exclude it', () => {
  assert.deepEqual(budgetPeriod('Total budget this month', now).months, ['2026-10']);
  const rolling = budgetPeriod('Total Budget Analysis in last three months', now);
  assert.deepEqual(rolling.months, ['2026-08', '2026-09', '2026-10']);
  assert.match(rolling.assumption!, /includes the current month/);
  assert.deepEqual(budgetPeriod('Budget for the last 3 completed months', now).months, [
    '2026-07',
    '2026-08',
    '2026-09',
  ]);
  assert.deepEqual(budgetPeriod('Budget last month', now).months, ['2026-09']);
});
test('periods handle named months, explicit ranges, year boundaries, and excessive ranges', () => {
  assert.deepEqual(budgetPeriod('Budget in September 2026', now).months, ['2026-09']);
  assert.deepEqual(budgetPeriod('Budget from 2026-08 to 2026-10', now).months, [
    '2026-08',
    '2026-09',
    '2026-10',
  ]);
  assert.deepEqual(
    budgetPeriod('Budget last three months', new Date('2027-01-10T00:00:00Z')).months,
    ['2026-11', '2026-12', '2027-01'],
  );
  assert.throws(() => budgetPeriod('Budget last 25 months', now));
  assert.throws(() => budgetPeriod('Budget from 2024-01 to 2026-10', now));
  assert.throws(() => budgetPeriod('Budget 2026-13', now));
});
test('multi-month totals use exact decimals and preserve department scope', async () => {
  const service = new FinanceService({} as any);
  service.budgets = async (c, month, department) => {
    assert.equal(c.organizationId, 'org-a');
    assert.equal(department, 'marketing');
    return [{ name: 'Marketing', budget: '100.10', actual: '90.05', allocationRecorded: true }];
  };
  const result = await service.budgetAnalysis(
    context,
    ['2026-08', '2026-09', '2026-10'],
    'marketing',
  );
  assert.equal(result.totals.allocated, '300.30');
  assert.equal(result.totals.expenditure, '270.15');
  assert.equal(result.totals.remaining, '30.15');
  assert.equal(result.periods.length, 3);
  await assert.rejects(() =>
    new FinanceService({} as any).budgetAnalysis({ ...context, role: 'EMPLOYEE' }, ['2026-10']),
  );
});
test('missing allocations are disclosed instead of invented from another month', async () => {
  const service = new FinanceService({} as any);
  service.budgets = async () => [{ budget: '0', actual: '25', allocationRecorded: false }];
  const result = await service.budgetAnalysis(context, ['2026-11']);
  assert.deepEqual(result.missingMonths, ['2026-11']);
  assert.equal(result.periods[0].allocationCoverage, '0/1 departments');
  assert.equal(result.totals.utilization, null);
});
test('Copilot leads with the requested exact total and supplies monthly evidence to NVIDIA', async () => {
  const db = {
    conversation: { create: async () => ({ id: 'c' }) },
    message: { create: async () => ({}) },
  };
  const finance = new FinanceService({} as any);
  finance.departments = async () => [];
  finance.budgets = async () => [
    { name: 'Sales', budget: '100.10', actual: '90.05', allocationRecorded: true },
  ];
  let supplied: any;
  const service = new CopilotService(
    db as any,
    finance,
    {} as any,
    {
      explain: async (_question: string, evidence: any) => {
        supplied = evidence;
        return 'The authorized monthly allocations are shown below. [source:budget-query]';
      },
    } as any,
  );
  const result = await service.ask(context, 'Total budget analysis in last three months');
  assert.equal(result.metrics.allocated, '300.30');
  assert.equal(result.table?.length, 3);
  assert.equal(supplied.periods.length, 3);
  assert.match(result.answer, /₹300.30/);
  assert.equal(result.verified, true);
  assert.ok(!result.answer.includes('Three departments are above'));
});
