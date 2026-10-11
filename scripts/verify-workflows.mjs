import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3000';
const db = new PrismaClient();
const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const browser = await chromium.launch();
const run = `workflow-${Date.now()}`;
const password = randomUUID() + 'Aa1!';
const userEmail = `${run}@example.invalid`;
const contexts = [];
const conversations = new Set();
const errors = [];
let departmentId, userId, documentId, employeeDocumentId, findingId;
const expenses = new Set();

async function newPage(width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
}
async function login(page, email, supplied = process.env.DEMO_SEED_PASSWORD, role = 'FINANCE') {
  await page.goto(base + '/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(supplied);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await page.waitForURL(`**/${role === 'EMPLOYEE' ? 'expenses' : 'dashboard'}`);
  await expect.poll(async () => (await request(page, '/auth/me')).body.role).toBe(role);
}
async function request(page, path, method = 'GET', data) {
  const response = await page.request.fetch(base + '/api' + path, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  return { status: response.status(), body: await response.json() };
}
async function ask(page, question) {
  const pending = page.waitForResponse(
    (r) => r.url().endsWith('/api/copilot') && r.request().method() === 'POST',
    { timeout: 120000 },
  );
  await page.getByLabel('Message FinSight Copilot').fill(question);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 201, question);
  const result = await response.json();
  conversations.add(result.conversationId);
  assert.ok(result.answer.length > 80 && result.citations.length, question);
  assert.ok(result.verified, 'Valid source references: ' + question);
  assert.ok(!result.warnings.some((w) => /NVIDIA|unavailable/i.test(w)), question);
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
  return result;
}
async function waitResponse(page, path, action, method = 'POST') {
  const pending = page.waitForResponse(
    (r) => r.url().includes('/api' + path) && r.request().method() === method,
  );
  await action();
  const response = await pending;
  assert.ok(response.ok(), `${method} ${path}: ${response.status()}`);
  return response.json();
}
const finance = await newPage();
const admin = await newPage();
try {
  await finance.goto(base + '/login');
  await finance.getByLabel('Email address').fill('finance@northstar.demo');
  await finance.getByLabel('Password', { exact: true }).fill('Incorrect-password-123!');
  await finance.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(finance.locator('.form-error[role="alert"]')).toContainText('incorrect');
  await login(finance, 'finance@northstar.demo');
  console.log('PASS: invalid password rejected and valid connected login succeeds');

  for (const [path, title] of [
    ['/dashboard', 'Financial overview'],
    ['/budgets', 'Budget intelligence'],
    ['/expenses', 'Employee expenses'],
    ['/knowledge', 'Knowledge base'],
    ['/audit', 'Audit & insights'],
    ['/settings', 'Settings'],
    ['/copilot', 'Clarity starts with a question.'],
  ]) {
    await finance.goto(base + path);
    await expect(finance.getByRole('heading', { name: title, exact: false }).first()).toBeVisible();
    await expect(finance.locator('.error-state')).toHaveCount(0);
    await expect(finance.locator('.loading-grid')).toHaveCount(0);
    assert.equal(
      await finance.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      path,
    );
  }
  console.log('PASS: all seven connected workspace screens load');
  const expected = await db.budget.aggregate({
    where: { organizationId: 'northstar', month: '2026-10', category: 'ALL' },
    _sum: { amount: true },
  });
  const expectedThree = await db.budget.aggregate({
    where: {
      organizationId: 'northstar',
      month: { in: ['2026-08', '2026-09', '2026-10'] },
      category: 'ALL',
    },
    _sum: { amount: true },
  });
  const total = await ask(finance, 'Total budget this month');
  assert.equal(total.metrics.allocated, expected._sum.amount.toFixed(2));
  assert.deepEqual(total.metrics.months, ['2026-10']);
  const historical = await ask(finance, 'Total Budget Analysis in last three months');
  assert.equal(historical.metrics.allocated, expectedThree._sum.amount.toFixed(2));
  assert.deepEqual(
    historical.table.map((r) => r.Month),
    ['2026-08', '2026-09', '2026-10'],
  );
  assert.ok(!historical.answer.startsWith('### Three departments are above'));
  await finance.locator('.source-citations button').last().click();
  await expect(finance.getByRole('dialog')).toBeVisible();
  await finance.getByRole('button', { name: 'Close', exact: true }).click();
  console.log(
    JSON.stringify({
      test: 'live budget questions',
      monthlyAllocation: total.metrics.allocated,
      threeMonthAllocation: historical.metrics.allocated,
      months: historical.metrics.months,
    }),
  );

  await finance.goto(base + '/expenses/EXP-1042');
  const flagged = await request(finance, '/expenses/EXP-1042');
  assert.equal(flagged.body.amount, '42500.00');
  assert.equal(flagged.body.policyThreshold, '25000.00');
  assert.ok(flagged.body.rules.includes('MISSING_RECEIPT'));
  assert.ok(flagged.body.rules.includes('POLICY_THRESHOLD'));
  const flaggedPending = finance.waitForResponse(
    (r) => r.url().endsWith('/api/copilot') && r.request().method() === 'POST',
    { timeout: 120000 },
  );
  await finance.getByRole('link', { name: 'Investigate with Copilot' }).click();
  const flaggedResponse = await flaggedPending;
  assert.equal(flaggedResponse.status(), 201);
  const flaggedAnswer = await flaggedResponse.json();
  conversations.add(flaggedAnswer.conversationId);
  assert.equal(flaggedAnswer.answerType, 'EXPENSE_INVESTIGATION');
  assert.ok(flaggedAnswer.citations.some((s) => s.expenseId === 'EXP-1042'));
  assert.match(flaggedAnswer.answer, /42[, ]?500/);
  assert.match(flaggedAnswer.answer, /25[, ]?000/);
  assert.match(flaggedAnswer.answer, /receipt/i);
  await expect(finance.locator('.message-assistant')).toContainText('receipt');
  await finance.screenshot({ path: `artifacts/${run}-investigation.png`, fullPage: true });
  console.log('PASS: EXP-1042 investigation explains its missing receipt and policy threshold');

  await finance.goto(base + '/dashboard');
  await finance.getByLabel('Filter by department').selectOption('marketing');
  await expect(finance.getByText('₹4.3L', { exact: true }).first()).toBeVisible();
  const downloadPending = finance.waitForEvent('download');
  await finance.getByRole('button', { name: 'Export report' }).click();
  const download = await downloadPending;
  assert.ok(download.suggestedFilename().endsWith('.csv'));
  assert.equal(await download.failure(), null);
  console.log('PASS: department filtering and CSV export');

  await login(admin, 'admin@northstar.demo', undefined, 'ADMIN');
  await admin.goto(base + '/settings');
  await admin.getByRole('button', { name: 'Organization', exact: true }).click();
  await admin.getByLabel('New department name').fill(run);
  const dep = await waitResponse(admin, '/departments', () =>
    admin.getByRole('button', { name: 'Add department', exact: true }).click(),
  );
  departmentId = dep.id;
  await admin.getByRole('button', { name: 'Add member', exact: true }).click();
  const member = admin.getByRole('dialog');
  await member.getByLabel('Full name', { exact: true }).fill('Workflow Test Employee');
  await member.getByLabel('Email', { exact: true }).fill(userEmail);
  await member.getByLabel('Initial password').fill(password);
  await member.getByLabel('Role', { exact: true }).selectOption('EMPLOYEE');
  await member.getByLabel('Department', { exact: true }).selectOption(departmentId);
  const user = await waitResponse(admin, '/users', () =>
    member.getByRole('button', { name: 'Create member' }).click(),
  );
  userId = user.id;
  await expect(member).not.toBeVisible();
  console.log('PASS: administrator creates a department and employee account');

  await finance.goto(base + '/budgets');
  await finance.getByRole('button', { name: 'Allocate budget' }).click();
  const allocation = finance.getByRole('dialog');
  await allocation.getByLabel('Department', { exact: true }).selectOption(departmentId);
  await allocation.getByLabel('Allocation (INR)').fill('1000.00');
  await waitResponse(finance, '/budgets', () =>
    allocation.getByRole('button', { name: 'Save allocation' }).click(),
  );
  await expect(allocation).not.toBeVisible();
  const allocated = await request(finance, '/budgets?month=2026-10&department=' + departmentId);
  assert.equal(allocated.body[0].budget, '1000.00');
  console.log('PASS: budget allocation persists in PostgreSQL');

  // Reuse an authenticated browser to verify that changing users clears cached data.
  await admin.getByRole('button', { name: 'Log out', exact: true }).click();
  await admin.waitForURL('**/login');
  await login(admin, userEmail, password, 'EMPLOYEE');
  await expect(
    admin
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveCount(0);
  await expect(admin.getByRole('button', { name: 'Submit expense', exact: true })).toBeVisible();
  assert.equal((await request(admin, '/dashboard')).status, 403);
  assert.equal((await request(admin, '/expenses/EXP-1042')).status, 404);
  await admin.getByRole('button', { name: 'Submit expense', exact: true }).click();
  const claim = admin.getByRole('dialog');
  await expect(claim.getByLabel('Department', { exact: true })).toHaveValue(departmentId);
  await claim.getByLabel('Amount (INR)').fill('123.45');
  await claim.getByLabel('Category', { exact: true }).selectOption('Software');
  await claim.getByLabel('Merchant', { exact: true }).fill(run);
  await claim
    .getByLabel('Business purpose')
    .fill('Synthetic workflow verification, remove after testing.');
  await claim.getByLabel('Supporting documents', { exact: true }).setInputFiles({
    name: run + '-approval.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Approved business purpose for this synthetic test claim.'),
  });
  const created = await waitResponse(admin, '/expenses', () =>
    claim.getByRole('button', { name: 'Submit for approval' }).click(),
  );
  expenses.add(created.id);
  await expect(claim).not.toBeVisible();
  assert.equal(created.status, 'PENDING');
  await admin.waitForURL('**/expenses/' + created.id);
  const supporting = await request(admin, '/expenses/' + created.id + '/attachments');
  assert.equal(supporting.body.length, 1);
  assert.equal(supporting.body[0].kind, 'SUPPORTING');
  assert.equal((await request(admin, '/expenses/' + created.id)).body.receipt, false);
  await admin.goto(base + '/expenses/' + created.id);
  await expect(admin.locator('.expense-hero-amount')).toContainText('₹123.45');
  const investigationPending = admin.waitForResponse(
    (r) => r.url().endsWith('/api/copilot') && r.request().method() === 'POST',
    { timeout: 120000 },
  );
  await admin.getByRole('link', { name: 'Investigate with Copilot' }).click();
  const investigationResponse = await investigationPending;
  assert.equal(investigationResponse.status(), 201);
  const investigation = await investigationResponse.json();
  conversations.add(investigation.conversationId);
  assert.equal(investigation.answerType, 'EXPENSE_INVESTIGATION');
  assert.ok(investigation.citations.some((s) => s.expenseId === created.id));
  assert.match(investigation.answer, /receipt/i);
  console.log('PASS: Investigate automatically explains flags on a newly submitted claim');
  await admin.goto(base + '/expenses/' + created.id);
  await expect(admin.getByRole('button', { name: 'Approve expense' })).toHaveCount(0);
  assert.equal(
    (await request(admin, '/expenses/' + created.id, 'PATCH', { status: 'APPROVED' })).status,
    403,
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSaMAAAAASUVORK5CYII=',
    'base64',
  );
  await waitResponse(admin, '/expenses/' + created.id + '/receipt', () =>
    admin
      .getByLabel('Attach supporting receipt')
      .setInputFiles({ name: run + '.png', mimeType: 'image/png', buffer: png }),
  );
  await expect(admin.getByText('Receipt recorded', { exact: true })).toBeVisible();
  const receipt = await request(admin, '/expenses/' + created.id + '/receipts');
  assert.equal(receipt.body.length, 1);
  assert.equal((await admin.request.get(receipt.body[0].url)).status(), 200);
  const withReceipt = await request(admin, '/expenses/' + created.id);
  assert.equal(withReceipt.body.receipt, true);
  assert.ok(!withReceipt.body.rules.includes('MISSING_RECEIPT'));
  console.log(
    'PASS: employee login, own-department submission, receipt upload, and access restrictions',
  );

  await admin.goto(base + '/expenses');
  await admin.getByRole('button', { name: 'Submit expense', exact: true }).click();
  const receiptedForm = admin.getByRole('dialog');
  await receiptedForm.getByLabel('Amount (INR)').fill('40.00');
  await receiptedForm.getByLabel('Category', { exact: true }).selectOption('Software');
  await receiptedForm.getByLabel('Merchant', { exact: true }).fill(run + '-with-receipt');
  await receiptedForm
    .getByLabel('Business purpose')
    .fill('Synthetic receipt-at-submission verification');
  await receiptedForm.getByLabel('Receipt or invoice', { exact: true }).setInputFiles({
    name: run + '-invoice.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await admin.screenshot({ path: `artifacts/${run}-employee-form.png`, fullPage: true });
  const receipted = await waitResponse(admin, '/expenses', () =>
    receiptedForm.getByRole('button', { name: 'Submit for approval' }).click(),
  );
  expenses.add(receipted.id);
  await expect(receiptedForm).not.toBeVisible();
  await admin.waitForURL('**/expenses/' + receipted.id);
  const receiptedDetail = await request(admin, '/expenses/' + receipted.id);
  assert.equal(receiptedDetail.body.receipt, true);
  assert.ok(!receiptedDetail.body.rules.includes('MISSING_RECEIPT'));
  await expect(admin.getByText('Receipt recorded', { exact: true })).toBeVisible();
  console.log('PASS: employee attaches invoice during submission without a missing-receipt flag');

  await admin.goto(base + '/knowledge');
  await expect(admin.getByText('Travel & reimbursement policy', { exact: true })).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Upload document', exact: true })).toBeVisible();
  const employeeDoc = await waitResponse(admin, '/documents', () =>
    admin.getByLabel('Upload company document').setInputFiles({
      name: run + '-employee.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Synthetic employee-provided reimbursement guidance requiring review before publication. This file is removed after testing.',
      ),
    }),
  );
  employeeDocumentId = employeeDoc.id;
  assert.equal(employeeDoc.status, 'PENDING_REVIEW');
  assert.equal(employeeDoc.departmentId, departmentId);
  await expect(
    admin.locator('.document-row').filter({ hasText: run + '-employee.txt' }),
  ).toContainText('pending review');
  assert.equal((await request(admin, '/documents/' + employeeDoc.id, 'GET')).body.passage, '');
  assert.equal(
    (await request(admin, '/documents/' + employeeDoc.id + '/approve', 'POST')).status,
    403,
  );
  assert.equal(
    (await request(admin, '/documents/' + employeeDoc.id + '/reindex', 'POST')).status,
    403,
  );
  assert.equal(
    (await request(finance, '/documents/' + employeeDoc.id + '/reindex', 'POST')).status,
    400,
  );
  await finance.goto(base + '/knowledge');
  await waitResponse(finance, '/documents/' + employeeDoc.id + '/approve', () =>
    finance.getByRole('button', { name: 'Approve ' + run + '-employee.txt', exact: true }).click(),
  );
  await expect
    .poll(async () => (await request(admin, '/documents/' + employeeDoc.id)).body.status, {
      timeout: 120000,
      intervals: [1500, 3000],
    })
    .toBe('INDEXED');
  assert.equal(
    (await db.document.findUnique({ where: { id: employeeDoc.id } })).reviewedById,
    (await request(finance, '/auth/me')).body.id,
  );
  console.log(
    'PASS: employee Knowledge upload, department scope, review gate and approved indexing',
  );
  await admin.goto(base + '/copilot');
  await expect(admin.getByRole('button', { name: /Find the budget outliers/ })).toHaveCount(0);
  await admin
    .getByLabel('Message FinSight Copilot')
    .fill('What is the employee expense reimbursement policy?');
  const policyResponse = admin.waitForResponse(
    (r) => r.url().endsWith('/api/copilot') && r.request().method() === 'POST',
    { timeout: 120000 },
  );
  await admin.getByRole('button', { name: 'Send message', exact: true }).click();
  const policy = await policyResponse;
  assert.equal(policy.status(), 201);
  const policyBody = await policy.json();
  conversations.add(policyBody.conversationId);
  assert.ok(
    policyBody.citations.length && !policyBody.warnings.some((w) => /unavailable|NVIDIA/i.test(w)),
  );
  console.log('PASS: employee policy access and live policy Copilot');

  await finance.goto(base + '/expenses/' + created.id);
  await finance.getByLabel('Review comment').fill(run + ' supporting receipt verified');
  await waitResponse(finance, '/expenses/' + created.id + '/comments', () =>
    finance.getByRole('button', { name: 'Add note', exact: true }).click(),
  );
  await waitResponse(
    finance,
    '/expenses/' + created.id,
    () => finance.getByRole('button', { name: 'Approve expense', exact: true }).click(),
    'PATCH',
  );
  await expect(finance.getByText('APPROVED', { exact: true })).toBeVisible();
  const approved = await request(admin, '/expenses/' + created.id);
  assert.equal(approved.body.status, 'APPROVED');
  assert.equal(approved.body.comments[0].text, run + ' supporting receipt verified');
  console.log('PASS: finance reviewer adds notes, approves, and employee sees status');

  await finance.goto(base + '/knowledge');
  await expect(finance.getByRole('button', { name: 'Upload document', exact: true })).toBeVisible();
  await expect(finance.getByText('Travel & reimbursement policy', { exact: true })).toBeVisible();
  const uploaded = await waitResponse(finance, '/documents', () =>
    finance.getByLabel('Upload company document').setInputFiles({
      name: run + '.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Workflow verification policy: employees must include itemized receipts and business purpose with reimbursement claims. This synthetic policy is removed after the verification run.',
      ),
    }),
  );
  documentId = uploaded.id;
  await expect
    .poll(async () => (await request(finance, '/documents/' + documentId)).body.status, {
      timeout: 120000,
      intervals: [1500, 3000],
    })
    .toBe('INDEXED');
  await expect(finance.locator('.document-row').filter({ hasText: run + '.txt' })).toContainText(
    'indexed',
  );
  await finance.getByRole('button', { name: 'Preview ' + run + '.txt', exact: true }).click();
  await expect(finance.getByRole('dialog')).toContainText('itemized receipts');
  await finance.getByRole('button', { name: 'Close', exact: true }).click();
  const preview = await request(finance, '/documents/' + documentId + '/preview');
  assert.equal((await finance.request.get(preview.body.url)).status(), 200);
  await waitResponse(finance, '/documents/' + documentId + '/reindex', () =>
    finance.getByRole('button', { name: 'Reindex ' + run + '.txt', exact: true }).click(),
  );
  await expect
    .poll(async () => (await request(finance, '/documents/' + documentId)).body.status, {
      timeout: 120000,
      intervals: [1500, 3000],
    })
    .toBe('INDEXED');
  await expect(finance.locator('.document-row').filter({ hasText: run + '.txt' })).toContainText(
    'indexed',
  );
  await waitResponse(
    finance,
    '/documents/' + documentId,
    () => finance.getByRole('button', { name: 'Delete ' + run + '.txt', exact: true }).click(),
    'DELETE',
  );
  documentId = undefined;
  console.log(
    'PASS: private document upload, real embedding/indexing, preview, reindex, and delete',
  );

  const own = await request(admin, '/auth/me');
  const csvMerchant = run + '-csv';
  const csv = `departmentId,employeeId,amount,category,merchant,date,description\n${departmentId},${own.body.employeeId},99.95,Operations,${csvMerchant},2026-10-10,Synthetic CSV workflow verification\n`;
  const imported = await waitResponse(finance, '/imports/expenses', () =>
    finance
      .getByLabel('Upload company document')
      .setInputFiles({ name: run + '.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }),
  );
  assert.equal(imported.imported, 1);
  const importedRows = await db.expense.findMany({
    where: { organizationId: 'northstar', merchant: csvMerchant },
  });
  importedRows.forEach((e) => expenses.add(e.id));
  assert.equal(importedRows.length, 1);
  await finance.goto(base + '/expenses/' + importedRows[0].id);
  await waitResponse(
    finance,
    '/expenses/' + importedRows[0].id,
    () => finance.getByRole('button', { name: 'Reject expense', exact: true }).click(),
    'PATCH',
  );
  console.log('PASS: structured CSV import and rejection workflow');

  const finding = await db.auditFinding.create({
    data: {
      organizationId: 'northstar',
      expenseId: created.id,
      title: run,
      description: 'Owned synthetic audit test fixture',
      severity: 'Medium',
      status: 'OPEN',
    },
  });
  findingId = finding.id;
  await finance.goto(base + '/audit');
  const card = finance.locator('.audit-card').filter({ hasText: run });
  await waitResponse(
    finance,
    '/audit/' + findingId,
    () => card.getByRole('combobox').selectOption('RESOLVED'),
    'PATCH',
  );
  assert.equal((await db.auditFinding.findUnique({ where: { id: findingId } })).status, 'RESOLVED');
  await finance.goto(base + '/settings');
  await expect(finance.getByLabel('Full name', { exact: true })).toHaveValue(
    (await request(finance, '/auth/me')).body.name,
  );
  await expect(finance.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await waitResponse(
    finance,
    '/settings/profile',
    () => finance.getByRole('button', { name: 'Save changes' }).click(),
    'PATCH',
  );
  console.log('PASS: audit status persistence and profile settings');

  const manager = await newPage(390);
  await login(manager, 'manager@northstar.demo', undefined, 'MANAGER');
  await manager.goto(base + '/budgets');
  await expect(manager.getByRole('button', { name: 'Allocate budget' })).toHaveCount(0);
  const managerRows = await request(manager, '/expenses?month=2026-10');
  const managerProfile = await request(manager, '/auth/me');
  assert.ok(
    managerRows.body.every(
      (e) => e.departmentId === managerProfile.body.departmentId && e.category !== 'Salary',
    ),
  );
  assert.equal(
    (await request(manager, '/expenses?month=2026-10&department=engineering')).status,
    403,
  );
  await manager.goto(base + '/expenses');
  assert.equal(
    await manager.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await manager.screenshot({ path: `artifacts/${run}-mobile.png`, fullPage: true });
  const auditor = await newPage();
  await login(auditor, 'auditor@northstar.demo', undefined, 'AUDITOR');
  await auditor.goto(base + '/expenses/' + importedRows[0].id);
  await expect(auditor.getByRole('button', { name: 'Approve expense' })).toHaveCount(0);
  await auditor.goto(base + '/expenses');
  await expect(auditor.getByRole('button', { name: 'Submit expense', exact: true })).toHaveCount(0);
  console.log(
    'PASS: manager department/salary restrictions, auditor permissions, and mobile layout',
  );
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('CONNECTED WORKFLOWS PASSED: ' + base);
} finally {
  // Delete only the uniquely identified fixtures created by this run.
  for (const ownedDocumentId of [documentId, employeeDocumentId].filter(Boolean)) {
    const doc = await db.document.findUnique({ where: { id: ownedDocumentId } });
    if (doc?.storagePath)
      await storage.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([doc.storagePath]);
    await db.document.deleteMany({ where: { id: ownedDocumentId } });
  }
  if (findingId) await db.auditFinding.deleteMany({ where: { id: findingId } });
  if (departmentId) {
    const records = await db.expense.findMany({
      where: { organizationId: 'northstar', departmentId },
      include: { attachments: true },
    });
    const paths = records.flatMap((e) => e.attachments.map((a) => a.path));
    if (paths.length) await storage.storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove(paths);
    await db.expense.deleteMany({ where: { organizationId: 'northstar', departmentId } });
    await db.budget.deleteMany({ where: { organizationId: 'northstar', departmentId } });
  }
  for (const id of conversations) await db.conversation.deleteMany({ where: { id } });
  if (userId) {
    await db.session.deleteMany({ where: { userId } });
    await db.membership.deleteMany({ where: { userId } });
    await db.employee.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  }
  if (departmentId)
    await db.department.deleteMany({ where: { id: departmentId, organizationId: 'northstar' } });
  await db.auditLog.deleteMany({
    where: {
      target: {
        in: [
          ...expenses,
          ...(userId ? [userId] : []),
          ...(documentId ? [documentId] : []),
          ...(employeeDocumentId ? [employeeDocumentId] : []),
          ...(findingId ? [findingId] : []),
        ],
      },
    },
  });
  for (const context of contexts) {
    await context.request.post(base + '/api/auth/logout', { headers: { Origin: base } });
    await context.close();
  }
  await browser.close();
  await db.$disconnect();
  console.log('Owned workflow fixtures cleaned up.');
}
