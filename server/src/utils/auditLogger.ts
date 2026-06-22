import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';

interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

const AUDIT_FIELDS_LEAD = ['name', 'email', 'phone', 'status', 'score', 'company', 'position', 'notes', 'assignedTo'];
const AUDIT_FIELDS_DEAL = ['name', 'value', 'stage', 'notes', 'expectedCloseDate', 'probability'];

export async function createAuditLog(params: {
  tenantId: string;
  entityType: 'lead' | 'deal';
  entityId: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}): Promise<void> {
  const changes: AuditChange[] = [];

  if (params.oldData && params.newData) {
    const fields = params.entityType === 'lead' ? AUDIT_FIELDS_LEAD : AUDIT_FIELDS_DEAL;
    for (const field of fields) {
      const oldVal = params.oldData[field];
      const newVal = params.newData[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field, oldValue: oldVal ?? null, newValue: newVal ?? null });
      }
    }
    if (changes.length === 0) return; // skip no-op updates
  }

  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      action: params.action,
      changes: changes as unknown as Prisma.InputJsonValue,
    },
  }).catch(() => {}); // silent fail — audit must never block the main flow
}
