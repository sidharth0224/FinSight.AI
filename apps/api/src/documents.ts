import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'node:crypto';
import { Database } from './database';
import { NvidiaService } from './nvidia';
import { Context, documentScope, requireRoles, departmentScope, expenseScope } from './security';
export function chunkText(text: string) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 240) {
    const chunk = words.slice(i, i + 280).join(' ');
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
@Injectable()
export class DocumentsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private storage: SupabaseClient;
  constructor(
    @Inject(Database) private db: Database,
    @Inject(NvidiaService) private nvidia: NvidiaService,
  ) {
    this.storage = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.work();
    }, 3000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async list(c: Context) {
    return (
      await this.db.document.findMany({
        where: documentScope(c),
        include: { _count: { select: { chunks: true } } },
        orderBy: { createdAt: 'desc' },
      })
    ).map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      size: d.size,
      status: d.status,
      error: d.error,
      chunks: d._count.chunks,
      date: d.createdAt.toISOString().slice(0, 10),
      departmentId: d.departmentId,
      model: d.model,
      dimensions: d.dimensions,
      uploadedById: d.uploadedById,
    }));
  }
  async get(c: Context, id: string) {
    const doc = await this.db.document.findFirst({
      where: { ...documentScope(c), id },
      include: { chunks: { take: 3 } },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    return doc;
  }
  async upload(c: Context, file: Express.Multer.File, requestedDepartment?: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR', 'EMPLOYEE']);
    if (!file || file.size > 10 * 1024 * 1024)
      throw new BadRequestException('A document under 10 MB is required.');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'txt', 'csv'].includes(ext))
      throw new BadRequestException('Supported files: PDF, DOCX, TXT, CSV.');
    if (ext === 'pdf' && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw new BadRequestException('Invalid PDF.');
    if (ext === 'docx' && file.buffer.subarray(0, 2).toString() !== 'PK')
      throw new BadRequestException('Invalid DOCX.');
    if (['txt', 'csv'].includes(ext) && file.buffer.includes(0))
      throw new BadRequestException('Binary data is not accepted as text.');
    if (ext === 'csv')
      throw new BadRequestException(
        'Use /api/imports/expenses for structured financial CSV imports; CSV data is not embedded as policy text.',
      );
    const dep = departmentScope(c, requestedDepartment);
    if (
      dep &&
      !(await this.db.department.findFirst({
        where: { id: dep, organizationId: c.organizationId },
      }))
    )
      throw new BadRequestException('Invalid department.');
    const path = `${c.organizationId}/${randomUUID()}.${ext}`;
    const { error } = await this.storage.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error)
      throw new ServiceUnavailableException(
        'Private storage upload failed. Verify the bucket and server credentials.',
      );
    try {
      return await this.db.document.create({
        data: {
          organizationId: c.organizationId,
          departmentId: dep || null,
          title: file.originalname.slice(0, 150),
          type: ext.toUpperCase(),
          size: `${Math.ceil(file.size / 1024)} KB`,
          storagePath: path,
          uploadedById: c.userId,
          status: c.role === 'EMPLOYEE' ? 'PENDING_REVIEW' : 'QUEUED',
        },
      });
    } catch (err) {
      await this.storage.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove([path]);
      throw err;
    }
  }
  async preview(c: Context, id: string) {
    const doc = await this.get(c, id);
    if (!doc.storagePath)
      throw new BadRequestException(
        'Seeded text has no original file. Use the extracted source preview.',
      );
    const { data, error } = await this.storage.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .createSignedUrl(doc.storagePath, 60, { download: true });
    if (error) throw new ServiceUnavailableException('Could not create a secure preview link.');
    return { url: data!.signedUrl };
  }
  async receipt(c: Context, id: string, file: Express.Multer.File, kind = 'RECEIPT') {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE']);
    const expense = await this.db.expense.findFirst({ where: { ...expenseScope(c), id } });
    if (!expense) throw new NotFoundException('Expense not found.');
    if (expense.status !== 'PENDING')
      throw new BadRequestException('Receipts can be added to pending claims.');
    if (!file || file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Upload a receipt under 5 MB.');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const supporting = kind === 'SUPPORTING';
    const valid =
      ext === 'pdf'
        ? file.buffer.subarray(0, 5).toString() === '%PDF-'
        : ext === 'png'
          ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : supporting && ext === 'docx'
            ? file.buffer.subarray(0, 2).toString() === 'PK'
            : supporting && ext === 'txt'
              ? !file.buffer.includes(0)
              : ['jpg', 'jpeg'].includes(ext || '')
                ? file.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
                : false;
    if (!valid)
      throw new BadRequestException(
        supporting
          ? 'Upload a valid PDF, PNG, JPEG, DOCX or TXT supporting document.'
          : 'Upload a valid PDF, PNG or JPEG receipt.',
      );
    const path = `${c.organizationId}/receipts/${randomUUID()}.${ext}`;
    const { error } = await this.storage.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (error) throw new ServiceUnavailableException('Receipt upload failed.');
    await this.db.$transaction(async (tx) => {
      await tx.expenseAttachment.create({
        data: { expenseId: id, path, name: file.originalname.slice(0, 150), kind },
      });
      if (!supporting) {
        await tx.expense.update({ where: { id }, data: { receipt: true } });
        await tx.riskFlag.deleteMany({ where: { expenseId: id, rule: 'MISSING_RECEIPT' } });
      }
      await tx.auditLog.create({
        data: {
          organizationId: c.organizationId,
          actorId: c.userId,
          action: supporting ? 'SUPPORTING_DOCUMENT_ATTACHED' : 'RECEIPT_ATTACHED',
          target: id,
        },
      });
    });
    return { ok: true };
  }
  async receipts(c: Context, id: string) {
    const expense = await this.db.expense.findFirst({
      where: { ...expenseScope(c), id },
      include: { attachments: true },
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    return Promise.all(
      expense.attachments
        .filter((a) => a.kind === 'RECEIPT')
        .map(async (a) => {
          const { data, error } = await this.storage.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .createSignedUrl(a.path, 60, { download: true });
          if (error) throw new ServiceUnavailableException('Receipt link unavailable.');
          return { id: a.id, name: a.name, url: data!.signedUrl };
        }),
    );
  }
  async attachments(c: Context, id: string) {
    const expense = await this.db.expense.findFirst({
      where: { ...expenseScope(c), id },
      include: { attachments: true },
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    return Promise.all(
      expense.attachments.map(async (a) => {
        const { data, error } = await this.storage.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET!)
          .createSignedUrl(a.path, 60, { download: true });
        if (error) throw new ServiceUnavailableException('Attachment link unavailable.');
        return { id: a.id, name: a.name, kind: a.kind, url: data!.signedUrl };
      }),
    );
  }
  async approve(c: Context, id: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR']);
    const doc = await this.get(c, id);
    if (doc.status !== 'PENDING_REVIEW')
      throw new BadRequestException('Document is not awaiting review.');
    if (doc.uploadedById === c.userId)
      throw new ForbiddenException('Another reviewer must approve this upload.');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.document.updateMany({
        where: { id, status: 'PENDING_REVIEW' },
        data: { status: 'QUEUED', reviewedById: c.userId },
      });
      if (!updated.count) throw new BadRequestException('Document was already reviewed.');
      await tx.auditLog.create({
        data: {
          organizationId: c.organizationId,
          actorId: c.userId,
          action: 'DOCUMENT_APPROVED',
          target: id,
        },
      });
    });
    return { ok: true };
  }
  async remove(c: Context, id: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR']);
    const doc = await this.get(c, id);
    if (doc.status === 'PROCESSING')
      throw new BadRequestException('Wait until indexing completes before deleting.');
    if (doc.storagePath) {
      const { error } = await this.storage.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET!)
        .remove([doc.storagePath]);
      if (error) throw new ServiceUnavailableException('Storage deletion failed.');
    }
    await this.db.document.delete({ where: { id } });
    await this.db.auditLog.create({
      data: {
        organizationId: c.organizationId,
        actorId: c.userId,
        action: 'DOCUMENT_DELETED',
        target: id,
      },
    });
    return { ok: true };
  }
  async reindex(c: Context, id: string) {
    requireRoles(c, ['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR']);
    const doc = await this.get(c, id);
    if (doc.status === 'PENDING_REVIEW')
      throw new BadRequestException('Approve this employee upload before indexing.');
    if (doc.status === 'PROCESSING') throw new BadRequestException('Already processing.');
    await this.db.document.update({ where: { id }, data: { status: 'QUEUED', error: null } });
    return { ok: true };
  }
  async work() {
    if (this.running) return;
    this.running = true;
    let id: string | undefined;
    try {
      const doc = await this.db.document.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!doc) return;
      id = doc.id;
      const claim = await this.db.document.updateMany({
        where: { id, status: 'QUEUED' },
        data: { status: 'PROCESSING' },
      });
      if (!claim.count) return;
      let pages: { text: string; page?: number }[] = [];
      if (doc.storagePath) {
        const { data, error } = await this.storage.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET!)
          .download(doc.storagePath);
        if (error || !data) throw Error('Private document download failed.');
        const buffer = Buffer.from(await data.arrayBuffer());
        if (doc.type === 'PDF') {
          await pdf(buffer, {
            pagerender: async (page: any) => {
              const content = await page.getTextContent();
              const text = content.items.map((i: any) => i.str).join(' ');
              pages.push({ text, page: page.pageIndex + 1 });
              return text;
            },
          });
        } else if (doc.type === 'DOCX') {
          pages = [{ text: (await mammoth.extractRawText({ buffer })).value }];
        } else pages = [{ text: buffer.toString('utf8') }];
      } else pages = [{ text: doc.content || '' }];
      if (pages.reduce((s, p) => s + p.text.trim().length, 0) < 30)
        throw Error('No readable text was found. Scanned PDFs require an external OCR service.');
      const chunks = pages.flatMap((p) =>
        chunkText(p.text).map((content) => ({ content, page: p.page })),
      );
      if (chunks.length > 2000)
        throw Error('Document exceeds the indexing limit. Split it into smaller files.');
      const indexed: { id: string; content: string; page?: number; embedding: number[] }[] = [];
      for (let i = 0; i < chunks.length; i += 8) {
        const batch = chunks.slice(i, i + 8);
        const vectors = await this.nvidia.embed(
          batch.map((c) => c.content),
          'passage',
        );
        batch.forEach((chunk, j) =>
          indexed.push({ id: randomUUID(), ...chunk, embedding: vectors[j] }),
        );
      }
      await this.db.$transaction(
        async (tx) => {
          await tx.documentChunk.deleteMany({ where: { documentId: id } });
          for (const c of indexed) {
            await tx.$executeRaw(
              Prisma.sql`INSERT INTO document_chunks(id,"documentId",content,page,embedding) VALUES(${c.id},${id},${c.content},${c.page ?? null},${JSON.stringify(c.embedding)}::extensions.vector)`,
            );
          }
          await tx.document.update({
            where: { id },
            data: {
              status: 'INDEXED',
              error: null,
              model: process.env.NVIDIA_EMBEDDING_MODEL,
              dimensions: 1024,
            },
          });
        },
        { timeout: 60000 },
      );
    } catch (err) {
      if (id)
        await this.db.document
          .update({
            where: { id },
            data: {
              status: 'FAILED',
              error: err instanceof Error ? err.message.slice(0, 350) : 'Indexing failed',
            },
          })
          .catch(() => {});
    } finally {
      this.running = false;
    }
  }
  async retrieve(c: Context, question: string) {
    const docs = await this.db.document.findMany({
      where: {
        ...documentScope(c),
        status: 'INDEXED',
        model: process.env.NVIDIA_EMBEDDING_MODEL,
        dimensions: 1024,
      },
      select: { id: true },
    });
    if (!docs.length) return [];
    const [vector] = await this.nvidia.embed([question], 'query');
    const results = await this.db.$queryRaw<any[]>(
      Prisma.sql`SELECT ch.id,ch.content,ch.page,d.title,d.id AS "documentId",(1-(ch.embedding <=> ${JSON.stringify(vector)}::extensions.vector)) AS similarity FROM document_chunks ch JOIN documents d ON d.id=ch."documentId" WHERE d.id IN (${Prisma.join(docs.map((d) => d.id))}) AND d."organizationId"=${c.organizationId} AND ch.embedding IS NOT NULL AND 1-(ch.embedding <=> ${JSON.stringify(vector)}::extensions.vector)>0.65 ORDER BY ch.embedding <=> ${JSON.stringify(vector)}::extensions.vector LIMIT 5`,
    );
    const terms =
      question
        .toLowerCase()
        .match(
          /\b(travel|reimbursement|expense|audit|receipt|lodging|threshold|policy|guidelines)\b/g,
        ) || [];
    if (terms.length) {
      const search = [...new Set(terms)].join(' OR ');
      const lexical = await this.db.$queryRaw<any[]>(
        Prisma.sql`SELECT ch.id,ch.content,ch.page,d.title,d.id AS "documentId",ts_rank_cd(to_tsvector('english',d.title||' '||ch.content),websearch_to_tsquery('english',${search})) AS rank FROM document_chunks ch JOIN documents d ON d.id=ch."documentId" WHERE d.id IN (${Prisma.join(docs.map((d) => d.id))}) AND d."organizationId"=${c.organizationId} AND to_tsvector('english',d.title||' '||ch.content) @@ websearch_to_tsquery('english',${search}) AND ts_rank_cd(to_tsvector('english',d.title||' '||ch.content),websearch_to_tsquery('english',${search}))>0.025 ORDER BY rank DESC LIMIT 5`,
      );
      for (const r of lexical) if (!results.some((v) => v.id === r.id)) results.push(r);
    }
    results.splice(5);
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      passage: r.content,
      ...(r.page ? { page: r.page } : {}),
      documentId: r.documentId,
    }));
  }
}
