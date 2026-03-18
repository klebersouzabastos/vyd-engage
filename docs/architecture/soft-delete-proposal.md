# Soft Delete Proposal

## Status: PROPOSAL (not implemented)

## Context

Currently, all DELETE operations in VYD Engage perform hard deletes (permanent removal from the database). This is problematic for user-facing data that may need recovery, audit trails, or compliance with data retention regulations.

## Current State

No models in `server/prisma/schema.prisma` have a `deletedAt` field. All deletes are permanent.

## Recommendation

### Models that SHOULD support soft delete

These contain user-created business data that has recovery value:

| Model | Rationale |
|-------|-----------|
| **Lead** | Core CRM data; accidental deletion is high-risk. Needed for audit trails and LGPD compliance. |
| **Deal** | Financial pipeline data; deletion should be reversible. Historical reporting depends on it. |
| **Task** | User productivity data; often deleted by mistake. Low storage cost to retain. |
| **Interaction** | Communication history; append-only by design, should never truly be deleted. |
| **Automation** | Complex configuration that is expensive to recreate. |
| **Tag** | Shared across leads; deleting can have cascading effects. |
| **Report** | Analytical artifacts that may be needed for historical comparison. |
| **Contact/CustomField** | Tenant-specific schema; deletion can break lead data integrity. |

### Models that should NOT support soft delete

These are ephemeral, system-generated, or short-lived:

| Model | Rationale |
|-------|-----------|
| **RefreshToken** | Session tokens; expired tokens should be permanently removed. |
| **Notification** | Ephemeral alerts; archiving is already handled via `NotificationStatus.ARCHIVED`. |
| **WebhookLog** | High-volume operational logs; retention policy handles cleanup. |
| **AutomationLog** | High-volume execution logs; same as WebhookLog. |
| **Payment** | Should NEVER be deleted (hard or soft) for financial audit. Add `cancelled` status instead. |
| **Invitation** | Short-lived tokens; expire naturally. |

### Models where soft delete is OPTIONAL (low priority)

| Model | Rationale |
|-------|-----------|
| **Funnel / FunnelColumn** | Could be useful but rarely deleted. |
| **ScoreRule** | Configuration data; `active: false` already serves as logical delete. |
| **ApiKey** | `active: false` already serves as logical delete. |
| **Webhook** | `active: false` already serves as logical delete. |
| **EmailConfig** | Rarely deleted; low priority. |
| **WhatsAppConnection** | Rarely deleted; low priority. |

## Implementation Plan (when approved)

### Phase 1: Schema Changes

Add `deletedAt DateTime?` to each soft-delete model:

```prisma
model Lead {
  // ... existing fields
  deletedAt DateTime?

  @@index([tenantId, deletedAt])
}
```

### Phase 2: Prisma Middleware

Use Prisma middleware or `$extends` to automatically:
1. Convert `delete()` calls to `update({ deletedAt: new Date() })`
2. Add `where: { deletedAt: null }` to all `findMany`/`findFirst`/`findUnique` queries
3. Provide an explicit `includeDeleted` escape hatch for admin queries

```typescript
// server/src/config/prisma-soft-delete.ts
const prismaWithSoftDelete = prisma.$extends({
  query: {
    lead: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async delete({ args, query }) {
        return prisma.lead.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
    },
    // ... repeat for Deal, Task, etc.
  },
});
```

### Phase 3: Admin Restore API

Add endpoints for tenant admins to restore soft-deleted records:

```
POST /api/v1/leads/:id/restore
GET  /api/v1/leads/deleted  (list soft-deleted items)
DELETE /api/v1/leads/:id/permanent  (hard delete, admin only)
```

### Phase 4: Cleanup Job

Background job to permanently delete records where `deletedAt` is older than the retention period (e.g., 90 days):

```typescript
// server/src/jobs/softDeleteCleanup.ts
async function cleanupSoftDeleted() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await prisma.lead.deleteMany({
    where: { deletedAt: { lt: cutoff } },
  });
  // ... repeat for other models
}
```

## Migration Strategy

1. Add `deletedAt` column (nullable, no default) -- non-breaking
2. Deploy Prisma middleware -- all existing queries automatically filter
3. Add restore endpoints -- new functionality
4. Add cleanup job -- background maintenance
5. Update frontend delete confirmations to mention "Trash" / 90-day retention

## Risks

- **Index bloat:** Soft-deleted rows remain in indexes. Mitigated by composite index on `(tenantId, deletedAt)` and periodic cleanup.
- **Unique constraints:** If `Lead` has `@@unique([tenantId, email])`, soft-deleted leads could block re-creation. Solution: change unique constraint to partial index excluding deleted rows, or use Prisma `@@unique` with a filter.
- **Query performance:** Negligible for the first year; cleanup job prevents unbounded growth.

## Decision Required

This proposal does NOT modify any code or schema. Approval is needed before proceeding with Phase 1.
