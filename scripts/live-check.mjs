import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const base = `http://127.0.0.1:${process.env.PORT || 4100}/api`;
const origin = process.env.APP_BASE_URL;
let createdId;
async function login(email) {
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email, password: process.env.DEMO_SEED_PASSWORD }),
  });
  assert.equal(r.status, 201, 'login');
  const cookie = r.headers.get('set-cookie');
  assert.ok(cookie?.includes('HttpOnly'));
  return cookie.split(';')[0];
}
async function request(cookie, path, method = 'GET', data) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(data ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
try {
  const finance = await login('finance@northstar.demo');
  const employee = await login('employee@northstar.demo');
  const manager = await login('manager@northstar.demo');
  const other = await login('admin@seabrook.demo');
  assert.equal((await request(finance, '/expenses/EXP-9999')).status, 404);
  assert.equal((await request(other, '/expenses/EXP-1042')).status, 404);
  console.log('PASS: login cookies and cross-organization isolation');
  assert.equal((await request(employee, '/dashboard?month=2026-10')).status, 403);
  assert.equal(
    (await request(manager, '/expenses?month=2026-10&department=engineering')).status,
    403,
  );
  const own = await request(employee, '/expenses?month=2026-10');
  assert.ok(own.body.every((e) => e.employeeId === 'emp-20'));
  console.log('PASS: employee and department role restrictions');
  const summary = await request(finance, '/dashboard?month=2026-10');
  assert.equal(summary.status, 200);
  assert.equal(summary.body.expenditure, '1862500.00');
  assert.equal(summary.body.net, '587500.00');
  console.log('PASS: PostgreSQL financial totals');
  const expense = await request(employee, '/expenses', 'POST', {
    departmentId: 'people',
    amount: '1200.50',
    category: 'Travel',
    merchant: 'QA Synthetic Travel',
    date: '2026-10-10',
    description: 'Synthetic integration verification',
  });
  assert.equal(expense.status, 201);
  createdId = expense.body.id;
  assert.equal(
    (await request(employee, `/expenses/${createdId}`, 'PATCH', { status: 'APPROVED' })).status,
    403,
  );
  assert.equal(
    (await request(finance, `/expenses/${createdId}`, 'PATCH', { status: 'APPROVED' })).status,
    200,
  );
  console.log('PASS: validated submissions and authorized human approval');
  for (const question of [
    'Which departments exceeded their budget in 2026-10?',
    'Why was EXP-1042 flagged?',
    'What is our travel reimbursement policy?',
    'Compare marketing expenditure in 2026-10 with the previous month.',
  ]) {
    const response = await request(finance, '/copilot', 'POST', { question });
    assert.equal(response.status, 201);
    assert.ok(response.body.citations.length > 0);
    assert.ok(!response.body.warnings.some((w) => /unavailable|NVIDIA request failed/.test(w)));
    console.log(
      JSON.stringify({
        scenario: response.body.answerType,
        verified: response.body.verified,
        sources: response.body.citations.length,
        answerCharacters: response.body.answer.length,
        warnings: response.body.warnings,
      }),
    );
    assert.ok(response.body.answer.length > 80, 'real generated answer');
  }
  console.log('Live API verification complete.');
} finally {
  if (createdId) await db.expense.delete({ where: { id: createdId } });
  await db.$disconnect();
}
