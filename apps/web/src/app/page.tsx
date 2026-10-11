import Link from 'next/link';
import {
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Database,
  BookOpen,
  Check,
  ChartNoAxesCombined,
} from 'lucide-react';
import { Brand } from '@/components/shell';
import { LandingHeader } from '@/components/landing-header';
const capabilities = [
  'Financial analytics',
  'Budget intelligence',
  'Expense management',
  'Policy knowledge',
  'Audit insights',
];
export default function Landing() {
  return (
    <div className="landing editorial-landing">
      <LandingHeader />
      <main>
        <section className="editorial-hero">
          <div className="contours contours-left" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} style={{ width: 60 + i * 10, animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
          <div className="contours contours-right" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} style={{ width: 60 + i * 10, animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
          <div className="contours contours-top" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ height: 30 + i * 9, animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
          <div className="hero-content">
            <div
              className="capability-ticker"
              aria-label="Finance analytics, budgets, expenses, policies, and audits"
            >
              <div className="capability-track" aria-hidden="true">
                {Array.from({ length: 4 }, (_, i) =>
                  capabilities.map((c) => <span key={`${i}-${c}`}>{c}</span>),
                )}
              </div>
            </div>
            <h1>
              Your finances.
              <br />A clearer <em>perspective.</em>
            </h1>
            <p>
              Intelligent finance for teams who want to understand every number—and the story behind
              it.
            </p>
            <div className="editorial-hero-actions">
              <Link className="hero-primary" href="/dashboard">
                Explore workspace
                <ArrowUpRight size={17} />
              </Link>
              <Link className="hero-chat" href="/copilot">
                <span className="hero-chat-icon">
                  <Sparkles size={21} />
                </span>
                <span>
                  <strong>Meet your finance Copilot</strong>
                  <small>
                    <i />
                    Ask a question. Find clarity.
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <span className="editorial-hero-note">
              <ShieldCheck size={14} />
              Your data. Your evidence. Your decisions.
            </span>
          </div>
          <div className="hero-bottom-fade" />
        </section>
        <section className="editorial-capabilities">
          <p>
            A complete picture,
            <br />
            from every angle.
          </p>
          <div className="capability-logo-marquee">
            <div className="capability-logo-track">
              {Array.from({ length: 2 }, (_, i) =>
                [
                  { name: 'Overview', icon: ChartNoAxesCombined },
                  { name: 'Copilot', icon: Sparkles },
                  { name: 'Budgets', icon: Database },
                  { name: 'Knowledge', icon: BookOpen },
                  { name: 'Audit', icon: ShieldCheck },
                ].map((c) => (
                  <span key={`${i}-${c.name}`}>
                    <c.icon size={19} />
                    {c.name}
                  </span>
                )),
              )}
            </div>
          </div>
        </section>
        <section className="landing-feature-section" id="intelligence">
          <span className="eyebrow">LESS NOISE. MORE PERSPECTIVE.</span>
          <h2>
            Know your numbers.
            <br />
            <em>Trust your next move.</em>
          </h2>
          <div className="landing-feature-grid">
            {[
              {
                icon: ChartNoAxesCombined,
                title: 'A clear overview.',
                text: 'Cash flow, departmental budgets, and expenditure. Together, in one focused workspace.',
                href: '/dashboard',
              },
              {
                icon: Sparkles,
                title: 'A better conversation.',
                text: 'Ask questions in your own words. Explore your records with precise figures and clear context.',
                href: '/copilot',
              },
              {
                icon: BookOpen,
                title: 'Evidence you can see.',
                text: 'Trace answers to policies, transactions, and audit findings. Every insight has somewhere to start.',
                href: '/knowledge',
              },
            ].map((f, i) => (
              <article key={f.title}>
                <div className="feature-topline">
                  <span>0{i + 1}</span>
                  <f.icon size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <Link href={f.href}>
                  Take a closer look
                  <ArrowUpRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-trust" id="trust">
          <div>
            <span className="eyebrow">BUILT ON SOMETHING SOLID.</span>
            <h2>
              Intelligence with
              <br />
              <em>accountability.</em>
            </h2>
            <p>
              Your records provide the numbers. Your Copilot provides the context. You make the
              decision.
            </p>
          </div>
          <div className="trust-list">
            {[
              'Exact figures from approved financial queries',
              'Organization and department access controls',
              'Private documents and traceable citations',
              'Transparent risk rules, with human review',
            ].map((t) => (
              <span key={t}>
                <Check size={17} />
                {t}
              </span>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">A FRESH PERSPECTIVE IS ONE QUESTION AWAY.</span>
          <h2>
            Let’s make <em>sense of it.</em>
          </h2>
          <Link className="hero-primary" href="/copilot">
            Start a conversation
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>© 2026 FinSight AI. Finance, in focus.</span>
        <Link href="/login">
          Sign in
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
