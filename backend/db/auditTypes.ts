export interface AuditRecord {
  id: string;
  event: string;
  donorId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}