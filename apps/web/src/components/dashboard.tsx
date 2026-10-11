'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Wallet,
  TrendingUp,
  ChartNoAxesCombined,
  Sparkles,
  ChevronRight,
  ReceiptText,
  ShieldAlert,
  CalendarDays,
  MoreHorizontal,
  Check,
  ArrowDownRight,
} from 'lucide-react';
import { api, Department, Expense, preview } from '@/lib/data';
import { money } from '@/lib/utils';
import { PageHeading, Filters, ExportButton, LoadingSkeleton, ErrorState, Badge } from './common';
import { Button } from './ui/button';
import { SpendingTrendChart } from './charts';
import { ExpenseTable } from './expenses';
type DashboardData = {
  income: string;
  expenditure: string;
  net: string;
  budget: string;
  utilization: number;
  departments: Department[];
  trend: any[];
  pending: number;
  flagged: number;
  expenses: Expense[];
};
export function FinanceStatCard({
  label,
  value,
  icon: Icon,
  note,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  note: string;
  color: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-note">
        <span className={color}>
          <span className="mini-dot" />
        </span>
        {note}
      </div>
    </section>
  );
}
export function Dashboard() {
  const [month, setMonth] = useState('2026-10');
  const [department, setDepartment] = useState('');
  const query = useQuery({
    queryKey: ['dashboard', month, department],
    queryFn: () => api<DashboardData>(`/dashboard?month=${month}&department=${department}`),
  });
  const depts = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Department[]>('/departments'),
  });
  const d = query.data;
  return (
    <>
      <PageHeading
        eyebrow="YOUR FINANCES, IN FOCUS"
        title="Financial overview"
        description="A clear picture of where your business stands."
      >
        <ExportButton rows={d?.departments || []} />
        <Link className="btn btn-primary" href="/copilot">
          <Sparkles size={16} />
          Ask Copilot
        </Link>
      </PageHeading>
      <div className="overview-controls">
        <div className="period-heading">
          <span className="period-dot" />{' '}
          {new Date(`${month}-02`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          <span className="muted-divider">/</span>
          <span className="muted">
            {preview ? 'Synthetic financial data' : 'Approved financial records'}
          </span>
        </div>
        <Filters
          month={month}
          department={department}
          onMonth={setMonth}
          onDepartment={setDepartment}
          departments={depts.data || []}
        />
      </div>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => query.refetch()} />
      ) : (
        d && (
          <>
            <div className="stats-grid">
              <FinanceStatCard
                label="Total income"
                value={money(d.income, true)}
                icon={ArrowDownLeft}
                note="Recognized income this month"
                color="cyan"
              />
              <FinanceStatCard
                label="Total expenditure"
                value={money(d.expenditure, true)}
                icon={ArrowUpRight}
                note="Across all approved expenses"
                color="purple"
              />
              <FinanceStatCard
                label="Net income"
                value={money(d.net, true)}
                icon={TrendingUp}
                note={`${Number(d.net) >= 0 ? 'Positive' : 'Negative'} operating balance`}
                color="green"
              />
              <FinanceStatCard
                label="Budget utilization"
                value={`${Number(d.utilization).toFixed(1)}%`}
                icon={ChartNoAxesCombined}
                note={`${money(d.budget, true)} total allocated budget`}
                color="amber"
              />
            </div>
            <div className="dashboard-main-grid">
              <section className="panel trend-panel">
                <div className="panel-header">
                  <div>
                    <h2>Cash flow overview</h2>
                    <p>Income and expenditure across six months</p>
                  </div>
                  <div className="chart-legends">
                    <span>
                      <i className="cyan-bg" />
                      Income
                    </span>
                    <span>
                      <i className="purple-bg" />
                      Expenditure
                    </span>
                  </div>
                </div>
                <div className="trend-summary">
                  <strong>
                    {money(d.net)}
                    <small>net income this month</small>
                  </strong>
                  <span className="badge badge-approved">
                    <TrendingUp size={12} />
                    Financial performance
                  </span>
                </div>
                <SpendingTrendChart data={d.trend} />
                <div className="panel-footnote">
                  <CalendarDays size={13} /> May – October 2026<span>Currency: INR</span>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Department budgets</h2>
                    <p>Spending against allocation</p>
                  </div>
                  <Link href="/budgets" className="icon-link" aria-label="View all budgets">
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
                <div className="department-list">
                  {d.departments.map((dep) => (
                    <div key={dep.id} className="department-item">
                      <div className="department-title">
                        <span>
                          <i style={{ background: dep.color }} />
                          {dep.name}
                        </span>
                        <b className={dep.actual > dep.budget ? 'rose' : 'muted'}>
                          {dep.budget ? ((dep.actual / dep.budget) * 100).toFixed(0) : '—'}%
                        </b>
                      </div>
                      <div className="progress-track">
                        <div
                          style={{
                            width: `${Math.min(dep.budget ? (dep.actual / dep.budget) * 100 : 0, 100)}%`,
                            background: dep.actual > dep.budget ? '#fb7185' : dep.color,
                          }}
                        />
                      </div>
                      <div className="department-amounts">
                        <span>
                          {money(dep.actual, true)} <em>of {money(dep.budget, true)}</em>
                        </span>
                        {dep.actual > dep.budget && (
                          <span className="over-budget">Over budget</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/budgets" className="panel-bottom-link">
                  Explore budget intelligence
                  <ArrowRight size={15} />
                </Link>
              </section>
            </div>
            <div className="copilot-banner">
              <span className="banner-spark">
                <Sparkles size={23} />
              </span>
              <div>
                <div className="banner-label">
                  FINANCE MEETS INTELLIGENCE <span>FinSight Copilot</span>
                </div>
                <h3>Your numbers tell a story. Let’s make sense of it.</h3>
                <p>
                  Explore spending, investigate expenses, and get answers with supporting evidence.
                </p>
              </div>
              <Link href="/copilot" className="btn btn-outline">
                Start a conversation
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="dashboard-bottom-grid">
              <section className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <h2>Recent expenses</h2>
                    <p>The latest activity across your organization</p>
                  </div>
                  <Link href="/expenses" className="text-link">
                    View all
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
                <ExpenseTable expenses={d.expenses} compact />
              </section>
              <section className="panel insights-panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      <Sparkles size={17} className="cyan" /> Worth your attention
                    </h2>
                    <p>Signals from your financial records</p>
                  </div>
                  <span className="insight-pill">{preview ? 'DEMO' : 'DATA'}</span>
                </div>
                <Link href="/budgets" className="insight">
                  <span className="insight-icon amber">
                    <Wallet size={18} />
                  </span>
                  <div>
                    <strong>
                      {d.departments.filter((dep) => dep.actual > dep.budget).length} departments
                      over budget
                    </strong>
                    <p>Review spending variance before your next allocation.</p>
                    <span>
                      Review budgets <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
                <Link href="/expenses?status=PENDING" className="insight">
                  <span className="insight-icon purple">
                    <ReceiptText size={18} />
                  </span>
                  <div>
                    <strong>{d.pending} reimbursements awaiting review</strong>
                    <p>Keep your team moving with timely approvals.</p>
                    <span>
                      Review expenses <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
                <Link href="/audit" className="insight">
                  <span className="insight-icon rose">
                    <ShieldAlert size={18} />
                  </span>
                  <div>
                    <strong>{d.flagged} expenses need a closer look</strong>
                    <p>Risk indicators need human review and evidence.</p>
                    <span>
                      Open audit workspace <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
