'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, Department } from '@/lib/data';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Badge, ErrorState, LoadingSkeleton } from './common';
export function AdminSettings() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depName, setDepName] = useState('');
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api<{ id: string; role: string; user: { name: string; email: string } }[]>('/users'),
  });
  const depts = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Department[]>('/departments'),
  });
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>
            <Users size={18} className="cyan" />
            Workspace members
          </h2>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus size={14} />
            Add member
          </Button>
        </div>
        {users.isPending ? (
          <LoadingSkeleton />
        ) : users.error ? (
          <ErrorState message={users.error.message} />
        ) : (
          <div className="member-list">
            {users.data?.map((m) => (
              <div className="integration-row" key={m.id}>
                <span className="avatar">
                  {m.user.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <strong>{m.user.name}</strong>
                  <p>{m.user.email}</p>
                </div>
                <Badge>{m.role.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <h2>
            <Building2 size={18} className="cyan" />
            Departments
          </h2>
        </div>
        <div className="settings-form form">
          <form
            className="department-create"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/departments', {
                  method: 'POST',
                  body: JSON.stringify({ name: depName }),
                });
                depts.refetch();
                setDepName('');
                toast.success('Department created');
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <input
              aria-label="New department name"
              value={depName}
              onChange={(e) => setDepName(e.target.value)}
              placeholder="New department name"
              required
              minLength={2}
            />
            <Button variant="outline">Add department</Button>
          </form>
          {depts.data?.map((d) => (
            <p className="muted" key={d.id}>
              {d.name}
            </p>
          ))}
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen} title="Add workspace member">
        <form
          className="form stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const data = new FormData(e.currentTarget);
            const departmentId = String(data.get('departmentId') || '');
            try {
              await api('/users', {
                method: 'POST',
                body: JSON.stringify({
                  name: data.get('name'),
                  email: data.get('email'),
                  password: data.get('password'),
                  role: data.get('role'),
                  ...(departmentId ? { departmentId } : {}),
                }),
              });
              users.refetch();
              setOpen(false);
              toast.success('Member created');
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Full name
            <input name="name" required minLength={2} />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Initial password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <label>
            Role
            <select name="role" aria-label="Role">
              {['EMPLOYEE', 'MANAGER', 'FINANCE', 'AUDITOR', 'ADMIN'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select name="departmentId" aria-label="Department">
              <option value="">Organization-wide role</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small-text">
            A department is required for employees and department managers. Share access details
            through your approved channel.
          </p>
          <Button disabled={saving}>{saving ? 'Creating…' : 'Create member'}</Button>
        </form>
      </Dialog>
    </>
  );
}
