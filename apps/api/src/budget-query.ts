import { BadRequestException } from '@nestjs/common';

const words: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const names = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
function shift(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function budgetPeriod(question: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const current = `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
  const explicit = [...question.matchAll(/\b(\d{4}-\d{2})\b/g)].map((m) => m[1]);
  if (explicit.some((m) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)))
    throw new BadRequestException('Use a valid month, for example 2026-10.');
  const named = [
    ...question.toLowerCase().matchAll(new RegExp(`\\b(${names.join('|')})\\s+(\\d{4})\\b`, 'g')),
  ].map((m) => `${m[2]}-${String(names.indexOf(m[1]) + 1).padStart(2, '0')}`);
  const anchors = explicit.length ? explicit : named;
  const rolling = question.match(
    /\b(?:last|past|previous|recent)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:(?:completed|full)\s+)?months?\b/i,
  );
  let months: string[];
  let assumption: string | undefined;
  if (rolling) {
    const count = words[rolling[1].toLowerCase()] || Number(rolling[1]);
    if (count < 1 || count > 24)
      throw new BadRequestException('Choose a period between 1 and 24 months.');
    const completed = /completed|full months|excluding (?:the )?current/i.test(question);
    const end = anchors.at(-1) || shift(current, completed ? -1 : 0);
    months = Array.from({ length: count }, (_, i) => shift(end, i - count + 1));
    if (!anchors.length)
      assumption = completed
        ? 'The period covers completed months and excludes the current month.'
        : 'The period includes the current month and the preceding months.';
  } else if (anchors.length > 1 && /\bfrom|\bbetween|\bto\b|through|until/i.test(question)) {
    const start = anchors[0],
      end = anchors.at(-1)!;
    if (start > end) throw new BadRequestException('The start month must precede the end month.');
    months = [start];
    while (months.at(-1)! < end && months.length <= 24) months.push(shift(months.at(-1)!, 1));
    if (months.length > 24) throw new BadRequestException('Choose a period of at most 24 months.');
  } else if (anchors.length) {
    months = [...new Set(anchors)].sort();
    if (months.length > 24) throw new BadRequestException('Choose at most 24 months.');
  } else {
    months = [shift(current, /\b(?:last|previous) month\b/i.test(question) ? -1 : 0)];
  }
  return { months, assumption };
}
