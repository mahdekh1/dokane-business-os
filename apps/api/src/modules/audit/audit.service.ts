import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditRecordInput {
  businessId?: string | null;
  actorUserId?: string | null;
  actorType: 'USER' | 'PLATFORM_ADMIN' | 'SYSTEM';
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'card',
  'pan',
  'cvv',
]);

/**
 * Append-only audit log. Deliberately exposes only `record` — there is no
 * update or delete path from application code.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: input.businessId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata
          ? (this.redact(input.metadata) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  private redact(meta: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    return out;
  }
}
