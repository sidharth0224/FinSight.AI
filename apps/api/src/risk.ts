import { Prisma } from '@prisma/client';
export type Risk = { rule: string; severity: string; explanation: string };
export function evaluateRisk(input: {
  amount: string;
  receipt: boolean;
  threshold?: string;
  duplicate?: boolean;
  historicalMean?: string;
  remaining?: string;
}): Risk[] {
  const out: Risk[] = [];
  const amount = new Prisma.Decimal(input.amount);
  if (!input.receipt)
    out.push({
      rule: 'MISSING_RECEIPT',
      severity: 'Medium',
      explanation: 'No supporting receipt was attached.',
    });
  if (input.threshold && amount.gt(input.threshold))
    out.push({
      rule: 'POLICY_THRESHOLD',
      severity: 'High',
      explanation: `Amount exceeds the category policy threshold of INR ${input.threshold}.`,
    });
  if (input.duplicate)
    out.push({
      rule: 'POTENTIAL_DUPLICATE',
      severity: 'High',
      explanation:
        'Another claim has the same employee, merchant, date, and amount. Confirm whether they refer to the same expense.',
    });
  if (
    input.historicalMean &&
    new Prisma.Decimal(input.historicalMean).gt(0) &&
    amount.gt(new Prisma.Decimal(input.historicalMean).times(3))
  )
    out.push({
      rule: 'UNUSUAL_AMOUNT',
      severity: 'Medium',
      explanation: 'The claim is more than three times the historical category average.',
    });
  if (input.remaining && amount.gt(input.remaining))
    out.push({
      rule: 'DEPARTMENT_LIMIT',
      severity: 'Medium',
      explanation: 'This claim exceeds the remaining department budget.',
    });
  return out;
}
