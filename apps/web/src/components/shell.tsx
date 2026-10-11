'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Sparkles,
  Wallet,
  ReceiptText,
  BookOpen,
  ShieldCheck,
  Settings,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
  Search,
  Command,
  PanelLeftClose,
  Orbit,
  Building2,
} from 'lucide-react';
import { api, preview } from '@/lib/data';
import { toast } from 'sonner';
const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/copilot', label: 'AI Copilot', icon: Sparkles },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/expenses', label: 'Expenses', icon: ReceiptText },
  { href: '/knowledge', label: 'Knowledge base', icon: BookOpen },
  { href: '/audit', label: 'Audit & insights', icon: ShieldCheck },
];
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Orbit size={25} />
      </span>
      <span>
        FinSight<span className="brand-ai">AI</span>
      </span>
    </span>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const userName = profile.data?.name || (preview ? 'Priya Sharma' : 'Your profile');
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('');
  const role = profile.data?.role || 'FINANCE';
  const roleLabel: Record<string, string> = {
    ADMIN: 'Organization Admin',
    FINANCE: 'Finance Manager',
    MANAGER: 'Department Manager',
    AUDITOR: 'Auditor',
    EMPLOYEE: 'Employee',
  };
  const visibleNav =
    role === 'EMPLOYEE'
      ? nav.filter((n) => ['/expenses', '/knowledge', '/copilot'].includes(n.href))
      : nav;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = sidebar.current?.querySelectorAll<HTMLElement>('a,button');
    items?.[1]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', trap);
    };
  }, [open]);
  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside ref={sidebar} className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link
          href={role === 'EMPLOYEE' ? '/expenses' : '/dashboard'}
          className="brand-link"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <button
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={22} />
        </button>
        <div className="org-switch">
          <span className="org-icon">
            <Building2 size={18} />
          </span>
          <span>
            <strong>
              {profile.data?.organization?.replace(' Solutions', '') || 'Northstar Digital'}
            </strong>
            <small>Organization workspace</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {visibleNav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`nav-item ${pathname.startsWith(n.href) ? 'active' : ''}`}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.href === '/copilot' && <span className="new-badge">NEW</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <span className="promo-orb">
              <Sparkles size={19} />
            </span>
            <strong>A little clarity. A big difference.</strong>
            <p>Your next financial insight is one question away.</p>
            <Link href="/copilot">
              Ask FinSight <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link className={`nav-item ${pathname === '/settings' ? 'active' : ''}`} href="/settings">
            <Settings size={19} />
            Settings
          </Link>
          <button className="profile-button" onClick={() => router.push('/settings')}>
            <span className="avatar">{initials}</span>
            <span>
              <strong>{userName}</strong>
              <small>{roleLabel[role]}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> {preview ? 'Synthetic preview' : 'Organization workspace'}
          <button
            aria-label="Log out"
            onClick={async () => {
              try {
                await api('/auth/logout', { method: 'POST' });
                client.clear();
                router.push('/login');
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
      <div className="app-body" inert={open || undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <PanelLeftClose className="desktop-icon" size={17} />
            <span className="breadcrumb-slash">/</span>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{nav.find((n) => pathname.startsWith(n.href))?.label || 'Settings'}</strong>
          </div>
          <div className="top-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(!searchOpen)}>
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <span className="env-tag">
              <span className="status-dot" />
              {preview ? 'Demo workspace' : 'Private workspace'}
            </span>
            <Link href="/settings" className="avatar avatar-small" aria-label="Open profile">
              {initials}
            </Link>
          </div>
        </header>
        {searchOpen && (
          <div className="workspace-search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search pages: budgets, expenses, copilot…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false);
              }}
            />
            {visibleNav
              .filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
              .map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearch('');
                  }}
                >
                  {n.label}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
          </div>
        )}
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>© 2026 FinSight AI</span>
          <span>
            <ShieldCheck size={13} />{' '}
            {preview
              ? 'Fictional data. Real possibilities.'
              : 'Private, permission-aware financial intelligence'}
          </span>
        </footer>
      </div>
    </div>
  );
}
