'use client';
import Link from 'next/link';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronUp, ArrowUpRight, X } from 'lucide-react';
import { Brand } from './shell';
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <nav className="editorial-nav">
        <Link href="/" aria-label="FinSight home">
          <Brand />
        </Link>
        <Dialog.Trigger asChild>
          <button className="menu-pill">
            Menu
            <ChevronUp size={16} />
          </button>
        </Dialog.Trigger>
      </nav>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="menu-surface">
          <Dialog.Title className="sr-only">FinSight navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Explore the finance workspace.
          </Dialog.Description>
          <div className="menu-top">
            <Link href="/" onClick={() => setOpen(false)}>
              <Brand />
            </Link>
            <Dialog.Close className="menu-pill">
              Close
              <X size={16} />
            </Dialog.Close>
          </div>
          <nav className="menu-links" aria-label="Explore FinSight">
            {[
              { href: '/dashboard', label: 'Overview' },
              { href: '/copilot', label: 'AI Copilot' },
              { href: '/budgets', label: 'Budgets' },
              { href: '/expenses', label: 'Expenses' },
              { href: '/knowledge', label: 'Knowledge' },
              { href: '/login', label: 'Get started' },
            ].map((link, i) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                <span className="menu-link-index">0{i + 1}</span>
                {link.label}
                <ArrowUpRight size={30} />
              </Link>
            ))}
          </nav>
          <div className="menu-footer">
            <span>Financial intelligence. A clearer perspective.</span>
            <span>© 2026 FinSight AI</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
