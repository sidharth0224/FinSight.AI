import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createDemoExpenses, demoDepartments, employeeNames } from '../packages/shared/src/demo';
const db = new PrismaClient();
async function seed() {
  if (process.env.DEMO_MODE !== 'true')
    throw Error('Seeding is restricted to DEMO_MODE=true. Use a dedicated synthetic database.');
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw Error(
      'Set DEMO_SEED_PASSWORD to a development-only password with at least 12 characters.',
    );
  const passwordHash = await hash(password, 12);
  const org = await db.organization.upsert({
    where: { id: 'northstar' },
    create: { id: 'northstar', name: 'Northstar Digital Solutions' },
    update: {},
  });
  await db.organization.upsert({
    where: { id: 'isolation-test' },
    create: { id: 'isolation-test', name: 'Seabrook Labs (isolation test)' },
    update: {},
  });
  for (const d of demoDepartments) {
    await db.department.upsert({
      where: { id: d.id },
      create: { id: d.id, name: d.name, organizationId: org.id, color: d.color },
      update: {},
    });
    for (let m = 5; m <= 10; m++)
      await db.budget.upsert({
        where: {
          organizationId_departmentId_month_category: {
            organizationId: org.id,
            departmentId: d.id,
            month: `2026-${String(m).padStart(2, '0')}`,
            category: 'ALL',
          },
        },
        create: {
          organizationId: org.id,
          departmentId: d.id,
          month: `2026-${String(m).padStart(2, '0')}`,
          amount: String(d.budget),
        },
        update: { amount: String(d.budget) },
      });
  }
  for (let i = 0; i < 25; i++)
    await db.employee.upsert({
      where: { id: `emp-${i}` },
      create: {
        id: `emp-${i}`,
        organizationId: org.id,
        departmentId: demoDepartments[Math.floor(i / 5)].id,
        name: employeeNames[i],
      },
      update: {},
    });
  for (const [role, employeeIndex] of [
    ['ADMIN', 0],
    ['FINANCE', 5],
    ['MANAGER', 10],
    ['AUDITOR', 15],
    ['EMPLOYEE', 20],
  ] as const) {
    const user = await db.user.upsert({
      where: { email: `${role.toLowerCase()}@northstar.demo` },
      create: {
        id: `user-${role}`,
        email: `${role.toLowerCase()}@northstar.demo`,
        name: employeeNames[employeeIndex],
        passwordHash,
      },
      update: { passwordHash },
    });
    await db.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: {
        organizationId: org.id,
        userId: user.id,
        role,
        departmentId: demoDepartments[Math.floor(employeeIndex / 5)].id,
      },
      update: {},
    });
    await db.employee.update({ where: { id: `emp-${employeeIndex}` }, data: { userId: user.id } });
  }
  const isolatedUser = await db.user.upsert({
    where: { email: 'admin@seabrook.demo' },
    create: { email: 'admin@seabrook.demo', name: 'Maya Example', passwordHash },
    update: { passwordHash },
  });
  await db.membership.upsert({
    where: { organizationId_userId: { organizationId: 'isolation-test', userId: isolatedUser.id } },
    create: { organizationId: 'isolation-test', userId: isolatedUser.id, role: 'ADMIN' },
    update: {},
  });
  await db.department.upsert({
    where: { id: 'isolated-department' },
    create: { id: 'isolated-department', organizationId: 'isolation-test', name: 'Research' },
    update: {},
  });
  await db.employee.upsert({
    where: { id: 'isolated-employee' },
    create: {
      id: 'isolated-employee',
      organizationId: 'isolation-test',
      departmentId: 'isolated-department',
      name: 'Private Test Employee',
    },
    update: {},
  });
  await db.expense.upsert({
    where: { id: 'EXP-9999' },
    create: {
      id: 'EXP-9999',
      organizationId: 'isolation-test',
      departmentId: 'isolated-department',
      employeeId: 'isolated-employee',
      amount: '999999.00',
      category: 'Operations',
      merchant: 'Private vendor',
      date: new Date('2026-10-05'),
      description: 'Isolation sentinel',
      status: 'APPROVED',
    },
    update: {},
  });
  for (const [name, threshold] of Object.entries({
    Travel: '25000.00',
    Software: '100000.00',
    Operations: '100000.00',
    Marketing: '100000.00',
    Salary: '100000.00',
  }))
    await db.expenseCategory.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      create: { organizationId: org.id, name, threshold },
      update: { threshold },
    });
  for (const row of createDemoExpenses()) {
    const data = {
      organizationId: org.id,
      employeeId: row.employeeId,
      departmentId: row.departmentId,
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      merchant: row.merchant,
      date: new Date(row.date),
      description: row.description,
      status: row.status,
      receipt: row.receipt,
    };
    await db.expense.upsert({
      where: { id: row.id },
      create: { id: row.id, ...data },
      update: data,
    });
    await db.riskFlag.deleteMany({ where: { expenseId: row.id } });
    for (const rule of row.rules)
      await db.riskFlag.create({
        data: {
          expenseId: row.id,
          rule,
          severity: row.risk,
          explanation:
            rule === 'MISSING_RECEIPT'
              ? 'Supporting documentation is missing.'
              : rule === 'POLICY_THRESHOLD'
                ? 'Travel claim exceeds the INR 25,000 review threshold.'
                : rule === 'POTENTIAL_DUPLICATE'
                  ? 'Same employee, merchant, date, and amount appear on another claim.'
                  : 'Amount exceeds three times the historical category average.',
        },
      });
  }
  for (let m = 5; m <= 10; m++)
    await db.financialTransaction.upsert({
      where: { id: `income-${m}` },
      create: {
        id: `income-${m}`,
        organizationId: org.id,
        kind: 'INCOME',
        amount: String(2450000 - (10 - m) * 45000),
        date: new Date(`2026-${String(m).padStart(2, '0')}-10`),
        description: 'Fictional client services revenue',
      },
      update: {},
    });
  const text =
    'Travel reimbursements require an itemized receipt and a business purpose. Domestic lodging is capped at INR 10,000 per night. Travel claims exceeding INR 25,000 require Finance Manager review. Claims must be submitted within 30 days. Automated risk indicators require human review.';
  for (const [id, title, content] of [
    ['travel-policy', 'Travel & reimbursement policy', text],
    [
      'expense-policy',
      'Employee expense guidelines',
      'Submit an itemized receipt with every expense claim. Explain the business purpose. Do not submit the same receipt twice. Finance review is required for policy exceptions. Incomplete documentation requires follow-up and is not proof of misconduct.',
    ],
    [
      'audit-guidelines',
      'Internal audit framework',
      'Record the evidence, the reviewer, and the outcome for each audit finding. Separate confirmed facts from potential duplicate claims and unusual patterns. Final approval and rejection decisions must be made by authorized humans.',
    ],
  ])
    await db.document.upsert({
      where: { id },
      create: {
        id,
        organizationId: org.id,
        title,
        type: 'TXT',
        size: '1 KB',
        content,
        status: 'QUEUED',
      },
      update: { content, status: 'QUEUED' },
    });
  for (const finding of [
    {
      id: 'AUD-001',
      expenseId: 'EXP-1042',
      title: 'Missing supporting documentation',
      description:
        'EXP-1042 has no receipt. Request supporting documentation before completing the review.',
      severity: 'High',
      status: 'OPEN',
    },
    {
      id: 'AUD-002',
      expenseId: 'EXP-1051',
      title: 'Incomplete travel claim',
      description: 'Supporting documentation is needed before a reimbursement decision.',
      severity: 'Medium',
      status: 'IN_REVIEW',
    },
  ])
    await db.auditFinding.upsert({
      where: { id: finding.id },
      create: { ...finding, organizationId: org.id },
      update: {},
    });
  for (const [code, name, kind] of [
    ['1000', 'Cash', 'ASSET'],
    ['4000', 'Service revenue', 'INCOME'],
    ['5000', 'Operating expense', 'EXPENSE'],
  ])
    await db.account.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      create: { organizationId: org.id, code, name, kind },
      update: {},
    });
  const rows = await db.$queryRaw<
    { actual: string }[]
  >`SELECT SUM(amount)::text AS actual FROM expenses WHERE "organizationId"='northstar' AND status='APPROVED' AND date>='2026-10-01' AND date<'2026-11-01'`;
  if (!new Prisma.Decimal(rows[0].actual).eq('1862500.00'))
    throw Error('Seed totals do not match expected expenditure.');
  console.log(
    'Synthetic seed verified: October income 2,450,000; expenditure 1,862,500; net 587,500; allocation 1,800,000. Five Northstar roles plus an isolation-test account created. Documents are queued for real NVIDIA embeddings.',
  );
}
seed()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
