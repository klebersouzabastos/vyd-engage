# QA Gate Review: Deal & Account Management (RETRO-DEAL)

**Reviewer:** Quinn (@qa)
**Date:** 2026-03-18
**Story ID:** RETRO-DEAL
**Verdict:** CONCERNS

---

## Score Summary

| Criteria | Score (1-5) | Notes |
|----------|-------------|-------|
| 1. Functionality | 4 | Complete CRUD, pipeline board, stats, drag-and-drop stage changes |
| 2. Security | 4 | Auth + tenant middleware on all routes; Zod validation on all inputs |
| 3. Error Handling | 3 | Backend solid; frontend swallows some errors silently |
| 4. Performance | 3 | Stats loads all deals into memory; pipeline board re-renders |
| 5. Code Quality | 4 | Clean TypeScript, proper types, consistent patterns |
| 6. Accessibility | 2 | Missing ARIA labels on interactive elements, no keyboard D&D |
| 7. Mobile/Responsive | 3 | Responsive toolbar but kanban columns not mobile-friendly |

**Average Score: 3.3 / 5**

---

## Issues Found

### CRITICAL

*None*

### MAJOR

#### M1. Stats endpoint loads all deals into memory
- **File:** `server/src/services/dealService.ts:212-275`
- **Issue:** `getStats()` fetches ALL deals for the tenant with `findMany()` and performs aggregations in JS. For tenants with thousands of deals, this causes unnecessary memory pressure and slow responses.
- **Recommendation:** Use Prisma `groupBy` and `aggregate` for stage-based counts and sums. Calculate `avgCycleTime` with a raw SQL query or a filtered aggregate.

#### M2. Delete operation does not verify tenant ownership atomically
- **File:** `server/src/services/dealService.ts:206-209`
- **Issue:** `delete()` calls `findById()` (which checks tenantId), then calls `prisma.deal.delete({ where: { id } })` without tenantId in the where clause. A race condition could theoretically allow deletion of another tenant's deal if IDs are guessed between the check and the delete.
- **Recommendation:** Use `deleteMany({ where: { id, tenantId } })` or add tenantId to the where clause for atomic tenant-scoped deletion.

#### M3. Update operation uses `prisma.deal.update({ where: { id } })` without tenantId
- **File:** `server/src/services/dealService.ts:186-193`
- **Issue:** Same TOCTOU pattern as M2. The `findById` checks tenant, but the subsequent `update` uses only `id`. Under concurrent requests, this is a cross-tenant write risk.
- **Recommendation:** Use `updateMany({ where: { id, tenantId }, data: ... })` or verify the returned record.

#### M4. Lead status update silently swallowed on error
- **File:** `server/src/services/dealService.ts:196-201`
- **Issue:** When a deal is WON, the lead status update uses `.catch(() => {})`. If the lead update fails (e.g., lead was deleted), the deal is marked WON but the lead remains in a stale status with no logging or notification.
- **Recommendation:** At minimum, log the error. Consider whether this should be transactional.

### MINOR

#### m1. DealForm loads up to 100 leads on every open
- **File:** `src/components/deals/DealForm.tsx:59-61`
- **Issue:** `apiClient.getLeads({ limit: 100 })` fires every time the dialog opens. For tenants with many leads, 100 may not be enough, and there is no search/typeahead.
- **Recommendation:** Use a debounced search input or a paginated combobox for lead selection.

#### m2. `formatCurrency` utility duplicated across 4 files
- **Files:** `src/pages/Deals.tsx:52`, `src/pages/DealDetail.tsx:93`, `src/components/deals/DealPipelineBoard.tsx:12`, `src/components/deals/DealCard.tsx:4`
- **Issue:** Same function copied in 4 places. Any locale change requires updating all.
- **Recommendation:** Extract to a shared utility (e.g., `src/utils/format.ts`).

#### m3. `customFields` accepts `z.record(z.any())` without depth limit
- **File:** `server/src/routes/deals.ts:23`
- **Issue:** A malicious client can send deeply nested or very large JSON objects. No size constraint on custom fields.
- **Recommendation:** Add a max depth or byte-size check on `customFields`.

#### m4. Pipeline board drag-and-drop has no error feedback
- **File:** `src/components/deals/DealPipelineBoard.tsx:40-48`
- **Issue:** `handleDrop` calls `onStageChange` (which calls `updateDeal`) but does not show any error toast if the API call fails. The card stays in the old column visually but the state may be inconsistent.
- **Recommendation:** Add try/catch with toast on error, or implement optimistic UI with rollback.

#### m5. DealDetail fetches interactions via undocumented endpoint
- **File:** `src/pages/DealDetail.tsx:129`
- **Issue:** `apiClient.getDealInteractions(id)` and `apiClient.createInteraction()` are called but these endpoints are not in the deals routes file. If they rely on a different route (interactions route), this coupling is not documented.
- **Recommendation:** Document the interaction endpoints used by the Deal detail page.

### SUGGESTION

#### S1. Add keyboard support for drag-and-drop in kanban board
- **File:** `src/components/deals/DealPipelineBoard.tsx`
- **Issue:** Drag-and-drop is mouse-only. Keyboard users cannot move deals between stages.
- **Recommendation:** Add stage-change buttons or keyboard shortcuts as an alternative to D&D.

#### S2. Add aria-label to icon-only buttons
- **Files:** `src/pages/Deals.tsx:164-177` (view toggle), `src/pages/Deals.tsx:257-269` (edit/delete row buttons)
- **Issue:** Icon-only buttons have `title` but no `aria-label`. Screen readers may not convey the action.
- **Recommendation:** Add `aria-label` matching the `title` text.

#### S3. Consider adding database index on Deal.closedAt
- **File:** `server/prisma/schema.prisma:385`
- **Issue:** `closedAt` is used in stats calculations for cycle time but has no index. As deal volume grows, queries filtering by closedAt will be slow.
- **Recommendation:** Add `@@index([tenantId, closedAt])` to the Deal model.

#### S4. Consider pagination or virtualization for pipeline board
- **File:** `src/components/deals/DealPipelineBoard.tsx`
- **Issue:** All deals for all stages are rendered at once. With hundreds of deals per stage, this will be slow.
- **Recommendation:** Limit visible cards per column (e.g., 20) with a "load more" action.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `server/src/routes/deals.ts` | 143 | Reviewed |
| `server/src/services/dealService.ts` | 277 | Reviewed |
| `src/pages/Deals.tsx` | 337 | Reviewed |
| `src/pages/DealDetail.tsx` | 376 | Reviewed |
| `src/components/deals/DealPipelineBoard.tsx` | 112 | Reviewed |
| `src/components/deals/DealForm.tsx` | 255 | Reviewed |
| `src/components/deals/DealCard.tsx` | 64 | Reviewed |
| `src/components/deals/DealStageBadge.tsx` | 26 | Reviewed |
| `src/hooks/useDeals.ts` | 118 | Reviewed |
| `server/prisma/schema.prisma` (Deal model) | 28 | Reviewed |

---

## Follow-up Backlog Items

1. **[PERF]** Refactor `dealService.getStats()` to use database-level aggregation instead of in-memory computation
2. **[SEC]** Add tenantId to `update()` and `delete()` where clauses for atomic tenant-scoped operations
3. **[UX]** Add keyboard-accessible stage changes as D&D alternative
4. **[A11Y]** Add `aria-label` attributes to all icon-only buttons across Deal pages
5. **[DX]** Extract `formatCurrency` and `formatDate` to shared utility module
6. **[PERF]** Add pagination/virtualization to pipeline board columns
7. **[SEC]** Add size/depth limit to `customFields` JSON validation
