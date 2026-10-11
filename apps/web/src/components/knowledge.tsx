'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  Search,
  BookOpen,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, Doc, preview } from '@/lib/data';
import { PageHeading, LoadingSkeleton, ErrorState, EmptyState, Badge } from './common';
import { Button } from './ui/button';
import { EvidenceDrawer } from './copilot';
export function Knowledge() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/auth/me') });
  const canManage =
    preview || ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR'].includes(profile.data?.role);
  const employee = profile.data?.role === 'EMPLOYEE';
  const canUpload = canManage || employee;
  const query = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<Doc[]>('/documents'),
    refetchInterval: (query) =>
      query.state.data?.some((d) => ['QUEUED', 'PROCESSING', 'PENDING_REVIEW'].includes(d.status))
        ? 3000
        : false,
  });
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState<any>(null);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  async function upload(file?: File) {
    if (!file || !canUpload) return;
    if (employee && file.name.toLowerCase().endsWith('.csv')) {
      toast.error(
        'Submit your expenses from Expenses. Knowledge uploads support PDF, DOCX and TXT.',
      );
      return;
    }
    if (!/\.(pdf|docx|txt|csv)$/i.test(file.name)) {
      toast.error('Choose a text-based PDF, DOCX, TXT, or CSV file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('The file must be smaller than 10 MB.');
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const result = await api<{ imported: number }>('/imports/expenses', {
          method: 'POST',
          body: form,
        });
        toast.success(`${result.imported} expenses imported for review`);
        return;
      }
      await api('/documents', { method: 'POST', body: form });
      await query.refetch();
      toast.success(
        preview
          ? 'File added to the local preview'
          : employee
            ? 'Document uploaded for reviewer approval'
            : 'Document uploaded and queued for indexing',
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="A SOURCE OF CONFIDENCE"
        title="Knowledge base"
        description="Give your Copilot the context behind your company’s numbers."
      >
        {canUpload && (
          <Button onClick={() => input.current?.click()} disabled={uploading}>
            <Upload size={16} />
            {uploading ? 'Uploading…' : 'Upload document'}
          </Button>
        )}
      </PageHeading>
      <input
        type="file"
        className="sr-only"
        ref={input}
        aria-label="Upload company document"
        accept={employee ? '.pdf,.docx,.txt' : '.pdf,.docx,.txt,.csv'}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {canUpload && (
        <div
          className={`upload-zone ${drag ? 'drag-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!uploading) upload(e.dataTransfer.files[0]);
          }}
        >
          <span className="upload-icon">
            <CloudUpload size={26} />
          </span>
          <div>
            <h3>
              {uploading
                ? 'Uploading your document…'
                : employee
                  ? 'Share documents with your reviewer.'
                  : 'Your policies. Connected to your answers.'}
            </h3>
            <p>
              Drag a document here or{' '}
              <button disabled={uploading} onClick={() => input.current?.click()}>
                browse files
              </button>
            </p>
            <small>
              Text-based PDF, DOCX, TXT{!employee && ', CSV'} · Up to 10 MB · Private storage
            </small>
            {employee && (
              <p>
                Your uploads stay in your department and require approval before Copilot uses them.
              </p>
            )}
          </div>
          {uploading && <div className="upload-progress" />}
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <div>
            <h2>
              Company documents{' '}
              <span className="muted small-text">({query.data?.length || 0})</span>
            </h2>
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Search documents…"
              aria-label="Search documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.error ? (
          <ErrorState message={query.error.message} />
        ) : (
          <div className="document-list">
            {query.data
              ?.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
              .map((d) => (
                <article className="document-row" key={d.id}>
                  <span className={`document-icon doc-${d.type.toLowerCase()}`}>
                    <FileText size={24} />
                    <small>{d.type}</small>
                  </span>
                  <div className="document-info">
                    <strong>{d.title}</strong>
                    <p>
                      {d.size} <span>·</span> Added {d.date} <span>·</span> {d.chunks} indexed
                      chunks
                    </p>
                    {d.error && <small className="amber">{d.error}</small>}
                    {d.status === 'PENDING_REVIEW' && (
                      <small className="muted">
                        Awaiting reviewer approval. Copilot does not use this document yet.
                      </small>
                    )}
                  </div>
                  <Badge
                    kind={
                      d.status === 'INDEXED'
                        ? 'Approved'
                        : d.status === 'FAILED'
                          ? 'High'
                          : 'Pending'
                    }
                  >
                    {d.status.replaceAll('_', ' ').toLowerCase()}
                  </Badge>
                  <div className="document-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Preview ${d.title}`}
                      onClick={async () => {
                        try {
                          const s = await api<any>(`/documents/${d.id}`);
                          setSource({
                            id: d.id,
                            title: d.title,
                            passage: s.passage || 'No extracted text available yet.',
                            documentId: d.id,
                          });
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <ArrowUpRight size={17} />
                    </Button>
                    {canManage && (
                      <>
                        {d.status === 'PENDING_REVIEW' ? (
                          <Button
                            variant="outline"
                            aria-label={`Approve ${d.title}`}
                            onClick={async () => {
                              try {
                                await api(`/documents/${d.id}/approve`, { method: 'POST' });
                                query.refetch();
                                toast.success('Approved and queued for indexing');
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            Approve upload
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Reindex ${d.title}`}
                            onClick={async () => {
                              try {
                                await api(`/documents/${d.id}/reindex`, { method: 'POST' });
                                query.refetch();
                                toast.success('Reindexing queued');
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <RefreshCw size={16} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${d.title}`}
                          onClick={async () => {
                            try {
                              await api(`/documents/${d.id}`, { method: 'DELETE' });
                              query.refetch();
                              toast.success('Document deleted');
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            {!query.data?.length && (
              <EmptyState
                title="Build your knowledge base"
                description="Upload a policy document to start answering questions with evidence."
              />
            )}
          </div>
        )}
      </section>
      <div className="knowledge-note">
        <ShieldSafe />
        Your documents are private and retrieved only within authorized workspace access.
      </div>
      <EvidenceDrawer source={source} onClose={() => setSource(null)} />
    </>
  );
}
function ShieldSafe() {
  return <CheckCircle2 size={15} />;
}
