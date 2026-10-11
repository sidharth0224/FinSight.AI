import { createDemoExpenses, demoDepartments } from '../../../../packages/shared/src/demo';
export type Expense = ReturnType<typeof createDemoExpenses>[number];
export type Department = (typeof demoDepartments)[number];
export type Doc = {
  uploadedById?: string | null;
  id: string;
  title: string;
  type: string;
  status: string;
  size: string;
  date: string;
  chunks: number;
  departmentId: string | null;
  error?: string;
};
export type Finding = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  expenseId: string;
  date: string;
};
export const preview = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const all = createDemoExpenses();
const initialDocs: Doc[] = [
  {
    id: 'travel-policy',
    title: 'Travel & reimbursement policy',
    type: 'PDF',
    status: 'INDEXED',
    size: '248 KB',
    date: '2026-10-02',
    chunks: 12,
    departmentId: null,
  },
  {
    id: 'expense-policy',
    title: 'Employee expense guidelines',
    type: 'DOCX',
    status: 'INDEXED',
    size: '86 KB',
    date: '2026-10-01',
    chunks: 8,
    departmentId: null,
  },
  {
    id: 'audit-guidelines',
    title: 'Internal audit framework',
    type: 'TXT',
    status: 'INDEXED',
    size: '24 KB',
    date: '2026-09-28',
    chunks: 6,
    departmentId: null,
  },
];
export const policyText =
  'Travel reimbursements require an itemized receipt and a business purpose. Domestic lodging is capped at ₹10,000 per night. Travel claims exceeding ₹25,000 require Finance Manager review. Claims must be submitted within 30 days. Automated risk indicators require human review.';
const initialFindings: Finding[] = [
  {
    id: 'AUD-001',
    title: 'Missing supporting documentation',
    description:
      'EXP-1042 has no receipt. Request supporting documentation before completing the review.',
    severity: 'High',
    status: 'OPEN',
    expenseId: 'EXP-1042',
    date: '2026-10-08',
  },
  {
    id: 'AUD-002',
    title: 'Travel policy threshold exceeded',
    description: 'An expense requires a policy exception and finance review.',
    severity: 'Medium',
    status: 'IN_REVIEW',
    expenseId: 'EXP-1051',
    date: '2026-10-09',
  },
];
function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(`finsight-${key}`) || 'null') || fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(`finsight-${key}`, JSON.stringify(value));
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  if (preview) return demoApi(path, options) as Promise<T>;
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const result = await response
    .json()
    .catch(() => ({ message: 'The service could not be reached.' }));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/'))
      window.location.assign('/login');
    throw new Error(
      Array.isArray(result.message)
        ? result.message.join(', ')
        : result.message || 'Request failed',
    );
  }
  if (path.startsWith('/budgets') && Array.isArray(result))
    return result.map((d: any) => ({
      ...d,
      budget: Number(d.budget),
      actual: Number(d.actual),
    })) as T;
  if (path.startsWith('/dashboard') && result.departments)
    result.departments = result.departments.map((d: any) => ({
      ...d,
      budget: Number(d.budget),
      actual: Number(d.actual),
    }));
  return result;
}
async function demoApi(path: string, options: RequestInit): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 180));
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = new URL(path, 'http://preview');
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  let expenses = read<Expense[]>('expenses', all);
  let departments = read<Department[]>('departments', demoDepartments);
  let docs = read<Doc[]>('docs', initialDocs);
  let findings = read<Finding[]>('findings', initialFindings);
  const allocations = read<Record<string, number>>('allocations', {});
  const month = url.searchParams.get('month') || '2026-10';
  departments = departments.map((d) => ({
    ...d,
    budget: allocations[`${month}:${d.id}`] ?? d.budget,
  }));
  const filtered = expenses.filter(
    (e) =>
      (!url.searchParams.get('department') ||
        e.departmentId === url.searchParams.get('department')) &&
      e.date.startsWith(url.searchParams.get('month') || '2026-10'),
  );
  if (path === '/auth/login')
    return {
      name: 'Priya Sharma',
      role: 'FINANCE',
      email: body.email,
      organization: 'Northstar Digital Solutions',
    };
  if (path === '/auth/logout') return { ok: true };
  if (path === '/auth/me')
    return read('profile', {
      name: 'Priya Sharma',
      email: 'finance@northstar.demo',
      role: 'FINANCE',
      organization: 'Northstar Digital Solutions',
    });
  if (path === '/settings/profile') {
    const profile = { ...((await demoApi('/auth/me', {})) as object), ...body };
    save('profile', profile);
    return profile;
  }
  if (url.pathname === '/departments') return departments;
  if (url.pathname === '/dashboard') {
    const selectedMonth = Number((url.searchParams.get('month') || '2026-10').split('-')[1]);
    const depts = departments
      .filter(
        (d) => !url.searchParams.get('department') || d.id === url.searchParams.get('department'),
      )
      .map((d) => ({
        ...d,
        actual: filtered
          .filter((e) => e.departmentId === d.id && e.status === 'APPROVED')
          .reduce((s, e) => s + Number(e.amount), 0),
      }));
    const expenditure = depts.reduce((s, d) => s + d.actual, 0);
    const budget = depts.reduce((s, d) => s + d.budget, 0);
    const income = url.searchParams.get('department') ? 0 : 2450000 - (10 - selectedMonth) * 45000;
    return {
      income: String(income),
      expenditure: String(expenditure),
      net: String(income - expenditure),
      budget: String(budget),
      utilization: budget ? (expenditure / budget) * 100 : 0,
      departments: depts,
      trend: Array.from({ length: 6 }, (_, i) => {
        const m = 5 + i;
        const month = `2026-${String(m).padStart(2, '0')}`;
        return {
          month: new Date(`${month}-02`).toLocaleString('en', { month: 'short' }),
          income: url.searchParams.get('department') ? 0 : 2450000 - (10 - m) * 45000,
          expenditure: expenses
            .filter(
              (e) =>
                e.status === 'APPROVED' &&
                e.date.startsWith(month) &&
                (!url.searchParams.get('department') ||
                  e.departmentId === url.searchParams.get('department')),
            )
            .reduce((s, e) => s + Number(e.amount), 0),
        };
      }),
      pending: filtered.filter((e) => e.status === 'PENDING').length,
      flagged: filtered.filter((e) => e.risk !== 'None').length,
      expenses: filtered
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    };
  }
  if (url.pathname === '/expenses' && options.method === 'POST') {
    const d = departments.find((d) => d.id === body.departmentId) || departments[0];
    const e = {
      ...body,
      id: `EXP-${Date.now().toString().slice(-6)}`,
      employee: 'Priya Sharma',
      employeeId: 'emp-5',
      department: d.name,
      currency: 'INR',
      status: 'PENDING',
      risk: body.receipt ? 'None' : 'Medium',
      rules: body.receipt ? [] : ['MISSING_RECEIPT'],
    };
    expenses.push(e);
    save('expenses', expenses);
    return e;
  }
  if (url.pathname === '/expenses') return filtered;
  if (url.pathname.match(/^\/expenses\/.+/)) {
    const id = url.pathname.split('/')[2];
    const e = expenses.find((e) => e.id === id);
    if (!e) throw Error('Expense not found');
    if (url.pathname.endsWith('/comments') && options.method === 'POST') {
      const comments = read<any[]>(`comments-${id}`, []);
      comments.push({ text: body.text, actor: 'Priya Sharma' });
      save(`comments-${id}`, comments);
      return { ok: true };
    }
    if (url.pathname.endsWith('/receipt') && options.method === 'POST') {
      e.receipt = true;
      e.rules = e.rules.filter((r) => r !== 'MISSING_RECEIPT');
      e.risk = e.rules.length ? 'Medium' : 'None';
      save('expenses', expenses);
      return { ok: true };
    }
    if (options.method === 'PATCH') {
      Object.assign(e, body);
      save('expenses', expenses);
    }
    return { ...e, comments: read(`comments-${id}`, []) };
  }
  if (url.pathname.startsWith('/budgets') && options.method === 'POST') {
    allocations[`${body.month}:${body.departmentId}`] = Number(body.amount);
    save('allocations', allocations);
    return { ok: true };
  }
  if (url.pathname === '/budgets') {
    return ((await demoApi(`/dashboard${url.search}`, {})) as { departments: Department[] })
      .departments;
  }
  if (url.pathname === '/documents' && options.method === 'POST') {
    const form = options.body as FormData;
    const file = form.get('file') as File;
    const doc = {
      id: `doc-${Date.now()}`,
      title: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || 'TXT',
      status: 'NOT_INDEXED',
      size: `${Math.ceil(file.size / 1024)} KB`,
      date: '2026-10-10',
      chunks: 0,
      departmentId: null,
      error: 'Preview upload saved locally. NVIDIA embeddings require the connected backend.',
    };
    docs.push(doc);
    save('docs', docs);
    return doc;
  }
  if (url.pathname === '/documents') return docs;
  if (url.pathname.match(/^\/documents\/.+/)) {
    const id = url.pathname.split('/')[2];
    if (options.method === 'DELETE') {
      save(
        'docs',
        docs.filter((d) => d.id !== id),
      );
      return { ok: true };
    }
    if (url.pathname.endsWith('reindex'))
      throw Error('Reindexing requires Supabase and NVIDIA credentials.');
    return { title: docs.find((d) => d.id === id)?.title, passage: policyText };
  }
  if (url.pathname === '/audit') return findings;
  if (url.pathname.startsWith('/audit/') && options.method === 'PATCH') {
    findings = findings.map((f) => (f.id === url.pathname.split('/')[2] ? { ...f, ...body } : f));
    save('findings', findings);
    return { ok: true };
  }
  if (url.pathname === '/conversations') return read('conversations', []);
  if (url.pathname.startsWith('/conversations/') && options.method === 'DELETE') {
    save(
      'conversations',
      read<any[]>('conversations', []).filter((c) => c.id !== url.pathname.split('/')[2]),
    );
    return { ok: true };
  }
  if (url.pathname.startsWith('/conversations/'))
    return read(`messages-${url.pathname.split('/')[2]}`, []);
  if (url.pathname === '/copilot') {
    const budget =
      /budget/i.test(body.question) &&
      /exceed|over.?budget|outlier/i.test(body.question) &&
      !/last|past|total|analysis|\d{4}-\d{2}/i.test(body.question);
    const investigation = /EXP-/i.test(body.question);
    const policy = /policy|reimbursement|travel/i.test(body.question) && !investigation;
    const depts = departments.filter((d) => d.actual > d.budget);
    const expense = expenses.find((e) => e.id === body.question.match(/EXP-\d+/i)?.[0]);
    const answer = budget
      ? `### Three departments are above their October budget\n\n${depts.map((d) => `- **${d.name}** spent ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(d.actual)}, exceeding its allocation by **₹${(d.actual - d.budget).toLocaleString('en-IN')}**.`).join('\n')}\n\nReview discretionary spending and confirm whether any approved exceptions apply.`
      : investigation && expense
        ? `### ${expense.id} requires human review\n\nThe claim of **₹${Number(expense.amount).toLocaleString('en-IN')}** is flagged for **${expense.rules.join(', ').toLowerCase().replaceAll('_', ' ')}**. Missing documentation is a confirmed gap; this indicator does not establish misconduct. Request the receipt and review the applicable policy.`
        : policy
          ? `### Travel reimbursement, explained\n\n${policyText}`
          : '### This question needs the connected Copilot\n\nThe synthetic preview supports only the supplied October budget-outlier example, EXP-1042 investigation, and travel policy. Budget totals and historical analysis require the connected Supabase and NVIDIA service. Sign in to the live workspace to query your financial records.';
    const result = {
      conversationId: body.conversationId || `chat-${Date.now()}`,
      messageId: `msg-${Date.now()}`,
      answer,
      answerType: budget
        ? 'BUDGET_COMPARISON'
        : investigation
          ? 'EXPENSE_INVESTIGATION'
          : policy
            ? 'POLICY_QUESTION'
            : 'UNSUPPORTED',
      citations: budget
        ? [
            {
              id: 'budget-oct',
              title: 'October department budgets',
              passage:
                'Synthetic preview records. Approved expenditure is compared with the October allocation.',
            },
          ]
        : policy || (investigation && expense)
          ? [
              {
                id: 'travel-policy',
                title: 'Travel & reimbursement policy',
                passage: policyText,
                documentId: 'travel-policy',
              },
            ]
          : [],
      table: budget
        ? depts.map((d) => ({
            Department: d.name,
            Budget: d.budget,
            Actual: d.actual,
            Variance: d.actual - d.budget,
          }))
        : undefined,
      chart: budget
        ? {
            type: 'bar',
            rows: departments.map((d) => ({ name: d.name, budget: d.budget, actual: d.actual })),
          }
        : undefined,
      followups: ['Why was EXP-1042 flagged?', 'What is our travel reimbursement policy?'],
      warnings: [
        'Synthetic preview • This is a deterministic demonstration, not a live NVIDIA response.',
      ],
      verified: false,
      metrics: {},
    };
    const chats = read<any[]>('conversations', []);
    if (!chats.some((c) => c.id === result.conversationId)) {
      chats.unshift({ id: result.conversationId, title: body.question });
      save('conversations', chats);
    }
    const messages = read<any[]>(`messages-${result.conversationId}`, []);
    messages.push({ role: 'user', content: body.question }, { role: 'assistant', ...result });
    save(`messages-${result.conversationId}`, messages);
    return result;
  }
  throw Error('This action requires the connected backend.');
}
