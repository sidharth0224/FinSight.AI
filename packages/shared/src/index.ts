export type Role = 'ADMIN' | 'FINANCE' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE';
export type Citation = {
  id: string;
  title: string;
  passage: string;
  page?: number;
  documentId?: string;
  expenseId?: string;
};
export type CopilotAnswer = {
  conversationId: string;
  messageId: string;
  answer: string;
  answerType: string;
  citations: Citation[];
  metrics: Record<string, string>;
  chart?: { type: 'bar'; rows: Record<string, string | number>[] };
  table?: Record<string, string | number>[];
  followups: string[];
  warnings: string[];
  verified: boolean;
};
