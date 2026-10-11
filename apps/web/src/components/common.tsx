'use client';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { Button } from './ui/button';
import { money } from '@/lib/utils';
import { toast } from 'sonner';
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  description = 'Your workspace is ready when you are.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <CheckCircle2 size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state">
      <AlertCircle size={22} />
      <h3>We couldn’t load this view</h3>
      <p>{message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div aria-label="Loading" className="loading-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function Badge({ children, kind }: { children: React.ReactNode; kind?: string }) {
  return (
    <span
      className={`badge badge-${(kind || String(children)).toLowerCase().replaceAll('_', '-')}`}
    >
      {children}
    </span>
  );
}
export function Filters({
  month,
  department,
  onMonth,
  onDepartment,
  departments,
}: {
  month: string;
  department: string;
  onMonth: (s: string) => void;
  onDepartment: (s: string) => void;
  departments: { id: string; name: string }[];
}) {
  return (
    <div className="filter-group">
      <select
        aria-label="Filter by department"
        value={department}
        onChange={(e) => onDepartment(e.target.value)}
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <input
        type="month"
        aria-label="Filter by month"
        value={month}
        onChange={(e) => onMonth(e.target.value)}
      />
    </div>
  );
}
export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.info('There are no records to export.');
    return;
  }
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const blob = new Blob(
    [
      keys.map(escape).join(',') +
        '\n' +
        rows.map((r) => keys.map((k) => escape(r[k])).join(',')).join('\n'),
    ],
    { type: 'text/csv;charset=utf-8;' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Your export is ready.');
}
export function ExportButton({
  rows,
  name = 'finsight-export.csv',
}: {
  rows: Record<string, unknown>[];
  name?: string;
}) {
  return (
    <Button variant="outline" onClick={() => downloadCSV(name, rows)}>
      <Download size={15} />
      Export report
    </Button>
  );
}
