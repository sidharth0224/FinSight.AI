'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, Department, preview } from '@/lib/data';
import { money } from '@/lib/utils';
import {
  PageHeading,
  Filters,
  ExportButton,
  LoadingSkeleton,
  ErrorState,
  Badge,
  EmptyState,
} from './common';
import { BudgetVarianceChart } from './charts';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
export function Budgets() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const canAllocate = preview || ['ADMIN', 'FINANCE'].includes(profile.data?.role);
  const [month, setMonth] = useState('2026-10');
  const [department, setDepartment] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['budgets', month, department],
    queryFn: () => api<Department[]>(`/budgets?month=${month}&department=${department}`),
  });
  const deps = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Department[]>('/departments'),
  });
  const rows = query.data || [];
  const allocated = rows.reduce((s, d) => s + Number(d.budget), 0);
  const actual = rows.reduce((s, d) => s + Number(d.actual), 0);
  return (
    <>
      <PageHeading
        eyebrow="SPEND WITH INTENTION"
        title="Budget intelligence"
        description="Keep every department’s ambitions aligned with its allocation."
      >
        <ExportButton rows={rows} />
        {canAllocate && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Allocate budget
          </Button>
        )}
      </PageHeading>
      <div className="overview-controls">
        <span className="muted">Monthly department allocations</span>
        <Filters
          month={month}
          department={department}
          onMonth={setMonth}
          onDepartment={setDepartment}
          departments={deps.data || []}
        />
      </div>
      <div className="summary-strip">
        <div>
          <span>Total allocated</span>
          <strong>{money(allocated, true)}</strong>
        </div>
        <div>
          <span>Actual expenditure</span>
          <strong>{money(actual, true)}</strong>
        </div>
        <div>
          <span>Budget variance</span>
          <strong className={actual > allocated ? 'rose' : 'green'}>
            {money(actual - allocated, true)}
          </strong>
        </div>
        <div>
          <span>Over budget</span>
          <strong className="amber">
            {rows.filter((d) => d.actual > d.budget).length} departments
          </strong>
        </div>
      </div>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} />
      ) : rows.length ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Allocation vs. actual</h2>
                <p>Compare approved expenditure against department budgets</p>
              </div>
              <div className="chart-legends">
                <span>
                  <i style={{ background: '#33445d' }} />
                  Allocated
                </span>
                <span>
                  <i className="cyan-bg" />
                  Actual
                </span>
              </div>
            </div>
            <BudgetVarianceChart data={rows} />
          </section>
          <div className="budget-cards">
            {rows.map((d) => (
              <section className="panel budget-card" key={d.id}>
                <div className="budget-title">
                  <span
                    className="insight-icon"
                    style={{ color: d.color, background: d.color + '12' }}
                  >
                    <Wallet size={20} />
                  </span>
                  <h2>{d.name}</h2>
                  <Badge kind={d.actual > d.budget ? 'High' : 'Approved'}>
                    {d.actual > d.budget ? 'Over budget' : 'On track'}
                  </Badge>
                </div>
                <strong className="budget-actual">
                  {money(d.actual)}
                  <small>of {money(d.budget)} allocated</small>
                </strong>
                <div className="progress-track">
                  <div
                    style={{
                      width: `${Math.min(Number(d.budget) ? (Number(d.actual) / Number(d.budget)) * 100 : 0, 100)}%`,
                      background: d.actual > d.budget ? '#fb7185' : d.color,
                    }}
                  />
                </div>
                <div className="budget-card-footer">
                  <span>{d.budget ? ((d.actual / d.budget) * 100).toFixed(1) : '—'}% utilized</span>
                  <span className={d.actual > d.budget ? 'rose' : 'green'}>
                    {money(Math.abs(d.budget - d.actual))}{' '}
                    {d.actual > d.budget ? 'over' : 'remaining'}
                  </span>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No budgets for this period"
          description="Allocate a department budget to start tracking variance."
        />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Allocate department budget">
        <form
          className="stack form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const form = new FormData(e.currentTarget);
            try {
              await api('/budgets', {
                method: 'POST',
                body: JSON.stringify({
                  departmentId: form.get('departmentId'),
                  amount: form.get('amount'),
                  month,
                }),
              });
              client.invalidateQueries();
              toast.success('Budget allocation saved');
              setOpen(false);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Department
            <select name="departmentId" aria-label="Department" required>
              <option value="">Select a department</option>
              {deps.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Allocation (INR)
            <input name="amount" type="number" min="0" step="0.01" required placeholder="0.00" />
          </label>
          <label>
            Period
            <input value={month} readOnly />
          </label>
          <p className="muted">
            Saving updates this department’s allocation for the selected month. Changes are recorded
            in the connected workspace audit log.
          </p>
          <Button disabled={saving}>{saving ? 'Saving…' : 'Save allocation'}</Button>
        </form>
      </Dialog>
    </>
  );
}
