import { randomUUID } from 'node:crypto';
import { MongoAuditRepository } from './db/MongoAuditRepository';
import type { AuditRecord } from './db/auditTypes';

const MAX_AUDIT_RECORDS = 5000;

export { AuditRecord };

export class AuditService {
  constructor(
    private readonly repository: MongoAuditRepository,
  ) {}

  async record(
    event: string,
    donorId?: string,
    meta?: Record<string, unknown>,
    now = new Date(),
  ): Promise<AuditRecord> {
    const record: AuditRecord = {
      id: `AUD-${randomUUID()}`,
      event,
      ...(donorId ? { donorId } : {}),
      ...(meta ? { meta } : {}),
      createdAt: now.toISOString(),
    };

    await this.repository.insert(record);

    const records = await this.repository.list();

    if (records.length > MAX_AUDIT_RECORDS) {
      const recordsToDelete = records.slice(MAX_AUDIT_RECORDS);

      await this.repository.deleteByIds(
        recordsToDelete.map((item) => item.id),
      );
    }

    return record;
  }

  async list(): Promise<AuditRecord[]> {
    return this.repository.list();
  }
}