'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowLeft,
  ReceiptText,
  ShieldAlert,
  FileText,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, Expense, Department, preview } from '@/lib/data';
import { money } from '@/lib/utils';
import {
  Badge,
  EmptyState,
  ErrorState,
  ExportButton,
  Filters,
  LoadingSkeleton,
  PageHeading,
} from './common';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
export function ExpenseTable({
  expenses,
  compact = false,
}: {
  expenses: Expense[];
  compact?: boolean;
}) {
  return expenses.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Employee / expense</th>
            {!compact && <th className="department-column">Department</th>}
            <th className="category-column">Category</th>
            <th>Amount</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>
                <Link className="employee-cell" href={`/expenses/${e.id}`}>
                  <span className={`employee-avatar avatar-${e.departmentId}`}>
                    {e.employee
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <span>
                    <strong>{e.employee}</strong>
                    <small>
                      {e.id} ·{' '}
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </small>
                  </span>
                </Link>
              </td>
              {!compact && <td className="department-column">{e.department}</td>}
              <td className="category-column">
                <span className="category-label">{e.category}</span>
              </td>
              <td className="amount-cell">{money(e.amount)}</td>
              <td>
                <Badge kind={e.status}>{e.status[0] + e.status.slice(1).toLowerCase()}</Badge>
              </td>
              <td>
                <Link href={`/expenses/${e.id}`} className="icon-link" aria-label={`Open ${e.id}`}>
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No expenses found"
      description="Try a different filter or submit your first expense."
    />
  );
}
const expenseSchema = z.object({
  departmentId: z.string().min(1, 'Select a department'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places')
    .refine((v) => Number(v) > 0 && Number(v) <= 100000000, 'Enter a valid positive amount'),
  category: z.string().min(1),
  merchant: z.string().min(2, 'Enter a merchant'),
  date: z.string().min(1, 'Select a date'),
  description: z.string().min(5, 'Add a short business purpose'),
});
export function Expenses() {
  const router = useRouter();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const canSubmit =
    preview ||
    (['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'].includes(profile.data?.role) &&
      !!profile.data?.employeeId);
  const [month, setMonth] = useState('2026-10');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const client = useQueryClient();
  const expenses = useQuery({
    queryKey: ['expenses', month, department],
    queryFn: () => api<Expense[]>(`/expenses?month=${month}&department=${department}`),
  });
  const depts = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Department[]>('/departments'),
  });
  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      departmentId: '',
      amount: '',
      category: 'Travel',
      merchant: '',
      date: '2026-10-10',
      description: '',
    },
  });
  useEffect(() => {
    if (depts.data?.length === 1 && !form.getValues('departmentId'))
      form.setValue('departmentId', depts.data[0].id);
  }, [depts.data, form]);
  const filtered = (expenses.data || []).filter(
    (e) =>
      (!status || e.status === status) &&
      `${e.id} ${e.employee} ${e.merchant}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="EVERY EXPENSE, ACCOUNTED FOR"
        title="Employee expenses"
        description="Submit, review, and understand your team’s spending."
      >
        <ExportButton rows={filtered} />
        {canSubmit && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Submit expense
          </Button>
        )}
      </PageHeading>
      <div className="summary-strip">
        <div>
          <span>Total submissions</span>
          <strong>{expenses.data?.length || 0}</strong>
        </div>
        <div>
          <span>Awaiting approval</span>
          <strong className="amber">
            {expenses.data?.filter((e) => e.status === 'PENDING').length || 0}
          </strong>
        </div>
        <div>
          <span>Require review</span>
          <strong className="rose">
            {expenses.data?.filter((e) => e.risk !== 'None').length || 0}
          </strong>
        </div>
        <div>
          <span>Approved amount</span>
          <strong>
            {money(
              (expenses.data || [])
                .filter((e) => e.status === 'APPROVED')
                .reduce((s, e) => s + Number(e.amount), 0),
              true,
            )}
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search expenses"
              placeholder="Search employee, merchant, or expense ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Approval status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Filters
            month={month}
            department={department}
            onMonth={(v) => {
              setMonth(v);
              setPage(0);
            }}
            onDepartment={(v) => {
              setDepartment(v);
              setPage(0);
            }}
            departments={depts.data || []}
          />
        </div>
        {expenses.isPending ? (
          <LoadingSkeleton />
        ) : expenses.error ? (
          <ErrorState message={expenses.error.message} />
        ) : (
          <ExpenseTable expenses={filtered.slice(page * 10, page * 10 + 10)} />
        )}
        <div className="table-pagination">
          <span>
            {filtered.length
              ? `${page * 10 + 1}–${Math.min(page * 10 + 10, filtered.length)} of ${filtered.length} expenses`
              : '0 expenses'}
          </span>
          <div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next page"
              disabled={(page + 1) * 10 >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (form.formState.isSubmitting) return;
          setOpen(value);
          if (!value) {
            setReceiptFile(null);
            setSupportingFiles([]);
          }
        }}
        title="Submit an expense"
      >
        <form
          className="form-grid"
          onSubmit={form.handleSubmit(async (values) => {
            let createdId: string | undefined;
            try {
              const files = [receiptFile, ...supportingFiles].filter((f): f is File => !!f);
              if (supportingFiles.length > 5 || files.some((f) => f.size > 5 * 1024 * 1024)) {
                toast.error('Choose up to five supporting files, each under 5 MB.');
                return;
              }
              const created = await api<Expense>('/expenses', {
                method: 'POST',
                body: JSON.stringify(values),
              });
              createdId = created.id;
              for (const file of files) {
                const upload = new FormData();
                upload.append('file', file);
                await api(
                  `/expenses/${createdId}/${file === receiptFile ? 'receipt' : 'attachments'}`,
                  {
                    method: 'POST',
                    body: upload,
                  },
                );
              }
              client.invalidateQueries();
              toast.success('Expense submitted for review');
              setOpen(false);
              form.reset();
              setReceiptFile(null);
              setSupportingFiles([]);
              router.push(`/expenses/${createdId}`);
            } catch (e) {
              if (createdId) {
                client.invalidateQueries();
                setOpen(false);
                form.reset();
                setReceiptFile(null);
                setSupportingFiles([]);
                toast.error(
                  `Claim saved. A file could not be uploaded: ${(e as Error).message}. Attach the remaining files from this claim.`,
                );
                router.push(`/expenses/${createdId}`);
              } else toast.error((e as Error).message);
            }
          })}
        >
          <label>
            Department
            <select aria-label="Department" {...form.register('departmentId')}>
              <option value="">Select department</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (INR)
            <input {...form.register('amount')} inputMode="decimal" placeholder="0.00" />
          </label>
          <label>
            Category
            <select aria-label="Category" {...form.register('category')}>
              {['Travel', 'Software', 'Operations', 'Marketing', 'Salary'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Expense date
            <input type="date" {...form.register('date')} />
          </label>
          <label className="full-width">
            Merchant
            <input {...form.register('merchant')} placeholder="Where was this expense made?" />
          </label>
          <label className="full-width">
            Business purpose
            <textarea
              {...form.register('description')}
              placeholder="Add context for your reviewer"
              rows={3}
            />
          </label>
          <label className="full-width">
            Receipt or invoice
            <input
              type="file"
              aria-label="Receipt or invoice"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
            <small className="muted">
              PDF, PNG or JPEG · Up to 5 MB. Without a receipt, your reviewer will request one.
            </small>
          </label>
          <label className="full-width">
            Supporting documents
            <input
              type="file"
              aria-label="Supporting documents"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
              onChange={(e) => setSupportingFiles(Array.from(e.target.files || []))}
            />
            <small className="muted">
              Approval letters, travel itineraries or other evidence · Up to five files, 5 MB each.
              Supporting documents do not replace a receipt.
            </small>
          </label>
          {Object.values(form.formState.errors).map((e, i) => (
            <p className="form-error full-width" key={i}>
              {e.message}
            </p>
          ))}
          <Button className="full-width" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['expense', id],
    queryFn: () =>
      api<
        Expense & { comments?: { text: string; actor: string }[]; policyThreshold?: string | null }
      >(`/expenses/${id}`),
  });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);
  const supportingInput = useRef<HTMLInputElement>(null);
  const attachments = useQuery({
    queryKey: ['expense-attachments', id],
    queryFn: () =>
      api<{ id: string; name: string; kind: string; url: string }[]>(`/expenses/${id}/attachments`),
    enabled: !preview && !!query.data,
  });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const e = query.data;
  const canReview =
    ['ADMIN', 'FINANCE', 'MANAGER'].includes(profile.data?.role) &&
    e?.employeeId !== profile.data?.employeeId;
  const canAttach = ['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'].includes(profile.data?.role);
  const canComment = ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR'].includes(profile.data?.role);
  async function review(status: string) {
    setBusy(true);
    try {
      await api(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await query.refetch();
      toast.success(`Expense ${status.toLowerCase()}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/expenses" className="back-link">
        <ArrowLeft size={15} />
        All expenses
      </Link>
      <PageHeading title={id} description="An evidence-led view of this expense submission.">
        {e && <Badge kind={e.status}>{e.status}</Badge>}
      </PageHeading>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} />
      ) : (
        e && (
          <div className="detail-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Expense details</h2>
                <ReceiptText size={20} className="cyan" />
              </div>
              <div className="expense-hero-amount">
                {money(e.amount)}
                <small>{e.merchant}</small>
              </div>
              <dl className="detail-list">
                {Object.entries({
                  Employee: e.employee,
                  Department: e.department,
                  Category: e.category,
                  Date: e.date,
                  Currency: e.currency,
                  'Business purpose': e.description,
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="receipt-box">
                <FileText size={25} />
                <span>
                  <strong>{e.receipt ? 'Receipt recorded' : 'No receipt attached'}</strong>
                  <small>
                    {e.receipt
                      ? 'Documentation is available to authorized reviewers.'
                      : 'Request documentation before completing your review.'}
                  </small>
                </span>
              </div>
              <input
                ref={receiptInput}
                type="file"
                className="sr-only"
                aria-label="Attach supporting receipt"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  const form = new FormData();
                  form.append('file', file);
                  try {
                    await api(`/expenses/${id}/receipt`, { method: 'POST', body: form });
                    query.refetch();
                    attachments.refetch();
                    toast.success('Receipt attached');
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(false);
                    if (receiptInput.current) receiptInput.current.value = '';
                  }
                }}
              />
              <input
                ref={supportingInput}
                type="file"
                className="sr-only"
                aria-label="Attach expense supporting document"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  const upload = new FormData();
                  upload.append('file', file);
                  try {
                    await api(`/expenses/${id}/attachments`, { method: 'POST', body: upload });
                    await attachments.refetch();
                    toast.success('Supporting document attached');
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(false);
                    if (supportingInput.current) supportingInput.current.value = '';
                  }
                }}
              />
              <div className="receipt-actions">
                {e.status === 'PENDING' && canAttach && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => receiptInput.current?.click()}
                  >
                    <FileText size={15} />
                    Attach receipt
                  </Button>
                )}
                {e.status === 'PENDING' && canAttach && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => supportingInput.current?.click()}
                  >
                    <Plus size={15} />
                    Attach supporting document
                  </Button>
                )}
                {e.receipt && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const files = await api<{ url: string }[]>(`/expenses/${id}/receipts`);
                        if (files[0]) window.open(files[0].url, '_blank', 'noopener,noreferrer');
                        else toast.info('Seeded receipt indicator has no original file.');
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    View supporting receipt
                    <ArrowUpRight size={14} />
                  </Button>
                )}
              </div>
              {!!attachments.data?.length && (
                <div className="attachment-list">
                  <h3>Attached evidence ({attachments.data.length})</h3>
                  {attachments.data.map((file) => (
                    <Button
                      key={file.id}
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const fresh = await api<{ id: string; url: string }[]>(
                            `/expenses/${id}/attachments`,
                          );
                          const selected = fresh.find((f) => f.id === file.id);
                          if (selected) window.open(selected.url, '_blank', 'noopener,noreferrer');
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      <FileText size={15} />
                      {file.name}
                      <small>{file.kind === 'RECEIPT' ? 'Receipt' : 'Supporting document'}</small>
                    </Button>
                  ))}
                </div>
              )}
              {e.status === 'PENDING' && canReview && (
                <div className="review-actions">
                  <Button variant="outline" disabled={busy} onClick={() => review('REJECTED')}>
                    <X size={16} />
                    Reject expense
                  </Button>
                  <Button disabled={busy} onClick={() => review('APPROVED')}>
                    <Check size={16} />
                    Approve expense
                  </Button>
                </div>
              )}
            </section>
            <div className="stack">
              <section className="panel">
                <div className="panel-header">
                  <h2>Risk assessment</h2>
                  <Badge kind={e.risk}>{e.risk === 'None' ? 'No flags' : e.risk + ' risk'}</Badge>
                </div>
                <div className="risk-panel">
                  {e.rules.length ? (
                    e.rules.map((r) => (
                      <div key={r} className="risk-rule">
                        <ShieldAlert size={19} className="amber" />
                        <div>
                          <strong>{r.toLowerCase().replaceAll('_', ' ')}</strong>
                          <p>
                            {{
                              MISSING_RECEIPT:
                                'No supporting receipt was provided. Request an itemized receipt.',
                              POLICY_THRESHOLD: e.policyThreshold
                                ? `This ${money(e.amount)} claim exceeds the ${money(e.policyThreshold)} category threshold and requires review.`
                                : 'This expense exceeds the category policy threshold and requires review.',
                              POTENTIAL_DUPLICATE:
                                'Another claim has the same employee, merchant, amount, and date. Confirm whether these are separate expenses.',
                              UNUSUAL_AMOUNT:
                                'The amount is unusually high compared with historical category spending. Request business context.',
                              DEPARTMENT_LIMIT:
                                'The expense exceeds the department’s remaining allocation.',
                            }[r] || 'Review the available evidence before making a decision.'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No deterministic risk rules were triggered.</p>
                  )}
                  <p className="risk-disclaimer">
                    Automated risk indicators require human review. They do not establish
                    misconduct.
                  </p>
                  <Link
                    className="btn btn-secondary"
                    href={`/copilot?q=${encodeURIComponent(`Why was ${id} flagged?`)}`}
                  >
                    Investigate with Copilot
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h2>Review notes</h2>
                </div>
                <div className="notes-panel">
                  {e.comments?.map((c, i) => (
                    <div className="review-comment" key={i}>
                      <strong>{c.actor}</strong>
                      <p>{c.text}</p>
                    </div>
                  ))}
                  {canComment && (
                    <>
                      <textarea
                        aria-label="Review comment"
                        placeholder="Add context or an investigation note…"
                        value={comment}
                        onChange={(ev) => setComment(ev.target.value)}
                        rows={3}
                      />
                      <Button
                        variant="outline"
                        disabled={!comment.trim()}
                        onClick={async () => {
                          try {
                            await api(`/expenses/${id}/comments`, {
                              method: 'POST',
                              body: JSON.stringify({ text: comment }),
                            });
                            setComment('');
                            query.refetch();
                            toast.success('Review note added');
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Add note
                      </Button>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        )
      )}
    </>
  );
}
