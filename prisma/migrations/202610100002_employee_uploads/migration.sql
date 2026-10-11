ALTER TABLE expense_attachments ADD COLUMN kind TEXT NOT NULL DEFAULT 'RECEIPT';
ALTER TABLE documents ADD COLUMN "uploadedById" TEXT;
ALTER TABLE documents ADD COLUMN "reviewedById" TEXT;
