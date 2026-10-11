'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  ArrowUp,
  Plus,
  MessageSquare,
  ArrowUpRight,
  BookOpen,
  Copy,
  Trash2,
  Square,
  ShieldCheck,
  Paperclip,
  Database,
  ChevronRight,
  PanelRightOpen,
  LoaderCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, preview } from '@/lib/data';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { BudgetVarianceChart } from './charts';
import { EmptyState } from './common';
type Source = {
  id: string;
  title: string;
  passage: string;
  page?: number;
  documentId?: string;
  expenseId?: string;
};
type Message = {
  role: string;
  content?: string;
  answer?: string;
  messageId?: string;
  citations?: Source[];
  warnings?: string[];
  table?: Record<string, string | number>[];
  chart?: { rows: any[] };
  followups?: string[];
  verified?: boolean;
};
const suggestions = [
  {
    icon: Database,
    title: 'Find the budget outliers',
    text: 'Which departments exceeded their budget this month?',
    color: 'cyan',
  },
  {
    icon: ShieldCheck,
    title: 'Follow the evidence',
    text: 'Why was EXP-1042 flagged?',
    color: 'purple',
  },
  {
    icon: BookOpen,
    title: 'Make policy crystal clear',
    text: 'What is our travel reimbursement policy?',
    color: 'green',
  },
  {
    icon: Sparkles,
    title: 'See the bigger picture',
    text: 'Compare marketing expenditure with the previous month.',
    color: 'amber',
  },
];
export function EvidenceDrawer({
  source,
  onClose,
}: {
  source: Source | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!source}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Supporting evidence"
      drawer
    >
      {source && (
        <div className="evidence-content">
          <span className="evidence-type">
            <BookOpen size={16} />
            SOURCE REFERENCE
          </span>
          <h2>{source.title}</h2>
          {source.page && <p className="muted">Page {source.page}</p>}
          <blockquote>{source.passage}</blockquote>
          <div className="evidence-metadata">
            <span>Source ID</span>
            <code>{source.id}</code>
          </div>
          {source.expenseId && (
            <a className="btn btn-outline" href={`/expenses/${source.expenseId}`}>
              Open expense
              <ArrowUpRight size={15} />
            </a>
          )}
          {source.documentId && !preview && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const r = await api<{ url: string }>(`/documents/${source.documentId}/preview`);
                  window.open(r.url, '_blank', 'noopener,noreferrer');
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Preview original document
              <ArrowUpRight size={15} />
            </Button>
          )}
          <p className="muted">
            {preview
              ? 'Synthetic demonstration evidence.'
              : 'Evidence access respects your organization and permissions.'}
          </p>
        </div>
      )}
    </Dialog>
  );
}
export function Copilot() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const employee = profile.data?.role === 'EMPLOYEE';
  const availableSuggestions = employee
    ? [
        suggestions[2],
        {
          icon: BookOpen,
          title: 'Prepare your claim',
          text: 'What documentation is required for expense reimbursement?',
          color: 'cyan',
        },
      ]
    : suggestions;
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const initialQuestion = useRef<string | null>(null);
  const chats = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<{ id: string; title: string }[]>('/conversations'),
  });
  useEffect(() => {
    if (!profile.data) return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && initialQuestion.current !== q) {
      initialQuestion.current = q;
      void send(q);
    }
  }, [profile.data]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);
  async function send(text = question) {
    if (!text.trim() || busy) return;
    setQuestion('');
    setError('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    controller.current = new AbortController();
    try {
      const answer = await api<Message & { conversationId: string }>('/copilot', {
        method: 'POST',
        body: JSON.stringify({ question: text, conversationId }),
        signal: controller.current.signal,
      });
      setConversationId(answer.conversationId);
      setMessages((m) => [...m, { ...answer, role: 'assistant' }]);
      chats.refetch();
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Response cancelled.');
      else {
        setError((e as Error).message);
        setQuestion(text);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="copilot-workspace">
      <aside className="conversation-sidebar">
        <Button
          variant="outline"
          onClick={() => {
            setConversationId(undefined);
            setMessages([]);
            setError('');
          }}
        >
          <Plus size={16} />
          New conversation
        </Button>
        <span className="nav-label">RECENT CONVERSATIONS</span>
        <div className="conversation-links">
          {chats.data?.length ? (
            chats.data.map((c) => (
              <div
                key={c.id}
                className={`conversation-row ${conversationId === c.id ? 'selected' : ''}`}
              >
                <button
                  onClick={async () => {
                    if (busy) return;
                    try {
                      setMessages(await api(`/conversations/${c.id}`));
                      setConversationId(c.id);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <MessageSquare size={15} />
                  <span>{c.title}</span>
                </button>
                <button
                  aria-label={`Delete ${c.title}`}
                  onClick={async () => {
                    try {
                      await api(`/conversations/${c.id}`, { method: 'DELETE' });
                      chats.refetch();
                      if (conversationId === c.id) {
                        setConversationId(undefined);
                        setMessages([]);
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted small-text">Your conversations will appear here.</p>
          )}
        </div>
        <div className="copilot-privacy">
          <ShieldCheck size={19} />
          <strong>Your data stays yours.</strong>
          <p>Answers follow your workspace permissions.</p>
        </div>
      </aside>
      <section className="chat-main">
        <header className="chat-header">
          <span className="chat-brand">
            <span className="spark-icon">
              <Sparkles size={18} />
            </span>
            <strong>FinSight Copilot</strong>
            <span className="badge badge-cyan">AI</span>
          </span>
          <span className="muted small-text">
            {preview ? 'Demo · NVIDIA not connected' : 'Evidence-led intelligence'}
          </span>
        </header>
        <div className="chat-mobile-history">
          <select
            aria-label="Recent conversations"
            disabled={busy}
            value={conversationId || ''}
            onChange={async (e) => {
              if (!e.target.value) return;
              try {
                setMessages(await api(`/conversations/${e.target.value}`));
                setConversationId(e.target.value);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <option value="">Recent conversations</option>
            {chats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button
            size="icon"
            variant="outline"
            aria-label="New conversation"
            disabled={busy}
            onClick={() => {
              setConversationId(undefined);
              setMessages([]);
              setError('');
            }}
          >
            <Plus size={15} />
          </Button>
          {conversationId && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Delete current conversation"
              disabled={busy}
              onClick={async () => {
                try {
                  await api(`/conversations/${conversationId}`, { method: 'DELETE' });
                  setConversationId(undefined);
                  setMessages([]);
                  chats.refetch();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
        <div className="chat-scroll">
          {!messages.length ? (
            <div className="copilot-welcome">
              <div className="welcome-orb">
                <Sparkles size={34} />
              </div>
              <span className="eyebrow">YOUR INTELLIGENT FINANCE PARTNER</span>
              <h1>Clarity starts with a question.</h1>
              <p>
                Understand your numbers, explore your policies,
                <br className="desktop-break" /> and connect the dots. All in one conversation.
              </p>
              <div className="suggestion-grid">
                {availableSuggestions.map((s) => (
                  <button className="suggestion-card" key={s.title} onClick={() => send(s.text)}>
                    <span className={`suggestion-icon ${s.color}`}>
                      <s.icon size={20} />
                    </span>
                    <strong>{s.title}</strong>
                    <p>{s.text}</p>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
              <div className="copilot-capabilities">
                <span>
                  <Database size={14} />
                  Financial analytics
                </span>
                <span>
                  <BookOpen size={14} />
                  Policy intelligence
                </span>
                <span>
                  <ShieldCheck size={14} />
                  Cited evidence
                </span>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m, i) => (
                <article key={m.messageId || i} className={`message message-${m.role}`}>
                  <span className={m.role === 'user' ? 'avatar' : 'assistant-avatar'}>
                    {m.role === 'user' ? 'PS' : <Sparkles size={18} />}
                  </span>
                  <div className="message-body">
                    <div className="message-byline">
                      {m.role === 'user' ? 'You' : 'FinSight Copilot'}
                      {m.role !== 'user' && (
                        <span className={m.verified ? 'green' : 'muted'}>
                          {m.verified
                            ? 'Evidence verified'
                            : preview
                              ? 'Synthetic demonstration'
                              : 'Evidence available'}
                        </span>
                      )}
                    </div>
                    {m.role === 'user' ? (
                      <p>{m.content}</p>
                    ) : (
                      <>
                        <div className="markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => {
                                const cited = m.citations?.find((s) => href === `#source-${s.id}`);
                                return cited ? (
                                  <button
                                    className="inline-citation"
                                    onClick={() => setSource(cited)}
                                    aria-label={`Evidence: ${cited.title}`}
                                  >
                                    {children}
                                  </button>
                                ) : (
                                  <a href={href} target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                );
                              },
                            }}
                          >
                            {(m.answer || m.content || '').replace(
                              /\[source:([^\]]+)\]/g,
                              (_, id) => {
                                const index = m.citations?.findIndex((s) => s.id === id) ?? -1;
                                return index >= 0
                                  ? `[${index + 1}](#source-${id})`
                                  : '[unverified source]';
                              },
                            )}
                          </ReactMarkdown>
                        </div>
                        {m.table?.length && (
                          <div className="table-scroll ai-table">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  {Object.keys(m.table[0]).map((k) => (
                                    <th key={k}>{k}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {m.table.map((r, j) => (
                                  <tr key={j}>
                                    {Object.values(r).map((v, k) => (
                                      <td key={k}>
                                        {typeof v === 'number' ? v.toLocaleString('en-IN') : v}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {m.chart && (
                          <div className="panel response-chart">
                            <BudgetVarianceChart data={m.chart.rows} />
                          </div>
                        )}
                        {!!m.citations?.length && (
                          <div className="source-citations">
                            <span>Supporting sources</span>
                            {m.citations.map((s, j) => (
                              <button key={s.id} onClick={() => setSource(s)}>
                                <span>{j + 1}</span>
                                <BookOpen size={13} />
                                {s.title}
                                <ArrowUpRight size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                        {m.warnings?.map((w) => (
                          <p className="response-warning" key={w}>
                            {w}
                          </p>
                        ))}
                        <div className="message-actions">
                          <button
                            aria-label="Copy answer"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(m.answer || '')
                                .then(() => toast.success('Answer copied'))
                                .catch(() => toast.error('Clipboard unavailable'));
                            }}
                          >
                            <Copy size={14} />
                            Copy
                          </button>
                          <button
                            onClick={() => setSource(m.citations?.[0] || null)}
                            disabled={!m.citations?.length}
                          >
                            <PanelRightOpen size={14} />
                            Evidence
                          </button>
                        </div>
                        {m.followups && (
                          <div className="followups">
                            {m.followups.map((q) => (
                              <button disabled={busy} key={q} onClick={() => send(q)}>
                                {q}
                                <ArrowUpRight size={13} />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))}
              {busy && (
                <div className="thinking">
                  <Sparkles size={17} />
                  <span>Gathering evidence and checking your records</span>
                  <LoaderCircle size={15} className="spin" />
                </div>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
        <div className="composer-container">
          {error && (
            <div className="chat-error" role="alert">
              {error}
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              aria-label="Message FinSight Copilot"
              placeholder="Ask anything about your finances…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                <ShieldCheck size={13} />
                Your workspace. Your permissions.
              </span>
              {busy ? (
                <Button
                  size="icon"
                  aria-label="Cancel response"
                  onClick={() => controller.current?.abort()}
                  type="button"
                >
                  <Square size={15} />
                </Button>
              ) : (
                <Button size="icon" aria-label="Send message" disabled={!question.trim()}>
                  <ArrowUp size={18} />
                </Button>
              )}
            </div>
          </form>
          <p className="composer-disclaimer">
            FinSight supports your judgment. Verify evidence before making financial decisions.
          </p>
        </div>
      </section>
      <EvidenceDrawer source={source} onClose={() => setSource(null)} />
    </div>
  );
}
