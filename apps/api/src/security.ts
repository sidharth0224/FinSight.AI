import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
export type Context = {
  userId: string;
  organizationId: string;
  role: string;
  departmentId: string | null;
  employeeId: string | null;
  name: string;
};
export function requireRoles(c: Context, roles: string[]) {
  if (!roles.includes(c.role))
    throw new ForbiddenException('Your role cannot perform this action.');
}
export function departmentScope(c: Context, requested?: string) {
  if (c.role === 'MANAGER' || c.role === 'EMPLOYEE') {
    if (!c.departmentId) throw new ForbiddenException('No department access is assigned.');
    if (requested && requested !== c.departmentId)
      throw new ForbiddenException('Department access denied.');
    return c.departmentId;
  }
  return requested || undefined;
}
export function expenseScope(c: Context, department?: string): Prisma.ExpenseWhereInput {
  return {
    organizationId: c.organizationId,
    ...(departmentScope(c, department) ? { departmentId: departmentScope(c, department) } : {}),
    ...(c.role === 'EMPLOYEE' ? { employeeId: c.employeeId || '__no_employee__' } : {}),
    ...(c.role === 'MANAGER' ? { category: { not: 'Salary' } } : {}),
  };
}
export function documentScope(c: Context): Prisma.DocumentWhereInput {
  const restricted = ['MANAGER', 'EMPLOYEE'].includes(c.role);
  return {
    organizationId: c.organizationId,
    ...(restricted
      ? { OR: [{ departmentId: null }, { departmentId: c.departmentId || '__none__' }] }
      : {}),
    ...(c.role === 'EMPLOYEE'
      ? { AND: [{ OR: [{ status: 'INDEXED' }, { uploadedById: c.userId }] }] }
      : {}),
  };
}
export function financeRole(c: Context) {
  requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR']);
}
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export function monthRange(month: string) {
  const value = monthSchema.parse(month);
  const [year, m] = value.split('-').map(Number);
  return { gte: new Date(Date.UTC(year, m - 1, 1)), lt: new Date(Date.UTC(year, m, 1)) };
}
export const moneySchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .refine((v) => new Prisma.Decimal(v).gt(0), 'Amount must be positive');
export const expenseSchema = z
  .object({
    departmentId: z.string().min(1),
    amount: moneySchema,
    category: z.enum(['Travel', 'Software', 'Operations', 'Marketing', 'Salary']),
    merchant: z.string().min(2).max(150),
    date: z.iso.date(),
    description: z.string().min(5).max(2000),
  })
  .strict();
export function safeCitationIds(answer: string, sources: { id: string }[]) {
  const allowed = new Set(sources.map((s) => s.id));
  const refs = [...answer.matchAll(/\[source:([^\]]+)\]/g)].map((m) => m[1]);
  return {
    valid: refs.length > 0 && refs.every((r) => allowed.has(r)),
    ids: [...new Set(refs.filter((r) => allowed.has(r)))],
  };
}
export function classify(question: string) {
  if (
    /EXP-\d+|flagged|investigat.*(?:expense|claim)/i.test(question) ||
    (expenseReference(question) && /expense|claim/i.test(question))
  )
    return 'EXPENSE_INVESTIGATION';
  if (/audit|finding/i.test(question)) return 'AUDIT_SUMMARY';
  if (/budget/i.test(question))
    return /total|overall|how much|analysis|summary|trend|last\s+(?:\d+|three)|past\s+(?:\d+|three)/i.test(
      question,
    )
      ? 'BUDGET_SUMMARY'
      : 'BUDGET_COMPARISON';
  if (
    /policy|guideline|reimburse|travel/i.test(question) &&
    /spend|spent|compare|total|how much|exceeded/i.test(question)
  )
    return 'HYBRID_QUESTION';
  if (/policy|guideline|reimburse|travel/i.test(question)) return 'POLICY_QUESTION';
  if (/spend|expense|income|financial|marketing|department|categor/i.test(question))
    return 'FINANCIAL_ANALYTICS';
  return 'UNSUPPORTED';
}
export function expenseReference(question: string) {
  const match = question.match(/\b(?:EXP-\d+|c[a-z0-9]{24})\b/i)?.[0];
  return match?.startsWith('EXP-') || match?.startsWith('exp-')
    ? match.toUpperCase()
    : match?.toLowerCase();
}
