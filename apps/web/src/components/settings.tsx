'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Building2,
  ShieldCheck,
  Plug,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, preview } from '@/lib/data';
import { PageHeading, Badge } from './common';
import { Button } from './ui/button';
import { AdminSettings } from './admin-settings';
export function Settings() {
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const [tab, setTab] = useState('Profile');
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE, YOUR WAY"
        title="Settings"
        description="Manage your profile, organization, and connected services."
      />
      <div className="settings-tabs">
        {['Profile', 'Organization', 'Integrations'].map((t) => (
          <button key={t} className={t === tab ? 'selected' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <section className="panel settings-panel">
        {tab === 'Profile' ? (
          <>
            <div className="panel-header">
              <h2>Your profile</h2>
              <User size={19} className="cyan" />
            </div>
            <form
              className="form settings-form"
              key={query.data?.name}
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                const form = new FormData(e.currentTarget);
                try {
                  await api('/settings/profile', {
                    method: 'PATCH',
                    body: JSON.stringify({ name: form.get('name') }),
                  });
                  query.refetch();
                  toast.success('Profile updated');
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <span className="avatar large-avatar">
                {query.data?.name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2) || '…'}
              </span>
              <label>
                Full name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={query.data?.name || ''}
                />
              </label>
              <label>
                Email address
                <input type="email" value={query.data?.email || ''} readOnly />
              </label>
              <label>
                Workspace role
                <input value={query.data?.role || 'Finance Manager'} readOnly />
              </label>
              <Button disabled={saving || !query.data}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </>
        ) : tab === 'Organization' ? (
          <>
            <div className="panel-header">
              <h2>Organization details</h2>
              <Building2 size={20} className="cyan" />
            </div>
            <dl className="detail-list">
              <div>
                <dt>Organization</dt>
                <dd>{query.data?.organization || 'Northstar Digital Solutions'}</dd>
              </div>
              <div>
                <dt>Base currency</dt>
                <dd>INR — Indian Rupee</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Organization and department scoped</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{preview ? 'Synthetic preview' : 'Private'}</dd>
              </div>
            </dl>
            <p className="settings-note muted">
              Administrators add members and assign departments below. Your role and department
              determine the records you can access.
            </p>
          </>
        ) : (
          <>
            <div className="panel-header">
              <h2>Connected services</h2>
              <Plug size={20} className="cyan" />
            </div>
            {[
              {
                name: 'Supabase',
                description: 'PostgreSQL, private document storage, and vector retrieval',
              },
              {
                name: 'NVIDIA NIM',
                description: 'Hosted language generation and document embeddings',
              },
            ].map((s) => (
              <div className="integration-row" key={s.name}>
                <span className="insight-icon cyan">
                  <Plug size={20} />
                </span>
                <div>
                  <strong>{s.name}</strong>
                  <p>{s.description}</p>
                </div>
                <Badge kind={preview ? 'Pending' : 'cyan'}>
                  {preview ? 'Not connected' : 'Server configured'}
                </Badge>
              </div>
            ))}
            <p className="settings-note muted">
              Integration keys are configured on the server. Secrets are never stored in your
              browser. Live connectivity must be verified with server health checks.
            </p>
          </>
        )}
      </section>
      {tab === 'Organization' && query.data?.role === 'ADMIN' && <AdminSettings />}
    </>
  );
}
