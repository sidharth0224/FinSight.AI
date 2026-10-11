import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentsService } from '../src/documents';
import { Context } from '../src/security';
const employee: Context = {
  organizationId: 'org',
  userId: 'employee',
  role: 'EMPLOYEE',
  departmentId: 'dep',
  employeeId: 'emp',
  name: 'Employee',
};
test('supporting evidence does not mark a missing receipt as provided', async () => {
  const writes: string[] = [];
  const tx = {
    expenseAttachment: {
      create: async ({ data }: any) => {
        writes.push(data.kind);
      },
    },
    expense: {
      update: async () => {
        writes.push('receipt');
      },
    },
    riskFlag: {
      deleteMany: async () => {
        writes.push('clear-flag');
      },
    },
    auditLog: { create: async () => {} },
  };
  const db: any = {
    expense: { findFirst: async () => ({ status: 'PENDING' }) },
    $transaction: async (fn: any) => fn(tx),
  };
  const docs = new DocumentsService(db, {} as any);
  (docs as any).storage = { storage: { from: () => ({ upload: async () => ({ error: null }) }) } };
  await docs.receipt(
    employee,
    'claim',
    {
      originalname: 'approval.txt',
      size: 12,
      mimetype: 'text/plain',
      buffer: Buffer.from('Approval note'),
    } as any,
    'SUPPORTING',
  );
  assert.deepEqual(writes, ['SUPPORTING']);
});
test('employees cannot approve uploads or bypass approval with reindex', async () => {
  const docs = new DocumentsService({} as any, {} as any);
  docs.get = async () => ({ status: 'PENDING_REVIEW', uploadedById: 'employee' }) as any;
  await assert.rejects(docs.approve(employee, 'doc'), /role cannot/);
  await assert.rejects(docs.reindex(employee, 'doc'), /role cannot/);
  await assert.rejects(
    docs.reindex({ ...employee, role: 'FINANCE', userId: 'reviewer' }, 'doc'),
    /Approve/,
  );
  await assert.rejects(docs.approve({ ...employee, role: 'FINANCE' }, 'doc'), /Another reviewer/);
});
