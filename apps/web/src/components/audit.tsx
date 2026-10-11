'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowUpRight, Search, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, Finding, preview } from '@/lib/data';
import {
  PageHeading,
  ExportButton,
  Badge,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from './common';
export function Audit() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const canUpdate = preview || ['ADMIN', 'FINANCE', 'AUDITOR'].includes(profile.data?.role);
  const [status, setStatus] = useState('');
  const query = useQuery({ queryKey: ['audit'], queryFn: () => api<Finding[]>('/audit') });
  const rows = (query.data || []).filter((f) => !status || f.status === status);
  return (
    <>
      <PageHeading
        eyebrow="CONFIDENCE THROUGH EVIDENCE"
        title="Audit & insights"
        description="Investigate the signals. Document your judgment."
      >
        <ExportButton rows={rows} name="finsight-audit-findings.csv" />
      </PageHeading>
      <div className="audit-notice">
        <ShieldCheck size={22} />
        <div>
          <strong>Human judgment stays at the center.</strong>
          <p>
            Automated indicators guide investigation. They do not establish misconduct or make
            approval decisions.
          </p>
        </div>
      </div>
      <div className="overview-controls">
        <h2>
          Findings <span className="muted">{rows.length}</span>
        </h2>
        <select
          aria-label="Filter audit status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All findings</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} />
      ) : rows.length ? (
        <div className="audit-cards">
          {rows.map((f) => (
            <article className="panel audit-card" key={f.id}>
              <div className="audit-card-top">
                <span className="insight-icon rose">
                  <ShieldAlert size={23} />
                </span>
                <Badge kind={f.severity}>{f.severity} priority</Badge>
                <span className="muted small-text">{f.id}</span>
              </div>
              <h2>{f.title}</h2>
              <p>{f.description}</p>
              <div className="audit-meta">
                <Link href={`/expenses/${f.expenseId}`}>
                  {f.expenseId}
                  <ArrowUpRight size={13} />
                </Link>
                <span>{f.date}</span>
              </div>
              <div className="audit-card-bottom">
                <select
                  aria-label={`Status for ${f.id}`}
                  value={f.status}
                  disabled={!canUpdate}
                  onChange={async (e) => {
                    try {
                      await api(`/audit/${f.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      query.refetch();
                      toast.success('Investigation status updated');
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                <Link href={`/expenses/${f.expenseId}`} className="text-link">
                  Investigate
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No findings in this view"
          description="Try a different investigation status."
        />
      )}
    </>
  );
}
