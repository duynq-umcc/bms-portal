# UPDATE_PLAN_2026-06-07 — BMS Portal Phase Roadmap
**Date:** 2026-06-07
**Baseline:** 86% coverage (↑42pp from 44% baseline audit 2026-06-06)
**Remaining gaps:** 24 (across 13 modules + infrastructure)
**Priority:** P2 (Medium) — close remaining quality gaps and minor features

---

## Overview

The codebase is now significantly more mature than the 2026-06-06 audit indicated. Many "critical" findings were false positives — the code already had fixes that weren't visible at the time of the baseline audit. This plan focuses on closing the remaining 24 real gaps.

**Phase structure:**
- **Phase 1 (P1)** — Critical remaining bugs and security (1 session)
- **Phase 2 (P2)** — Code quality, engine refinements, performance (2 sessions)
- **Phase 3 (P3)** — Minor features and polish (1 session)

---

## Phase 1 — Critical Remaining Bugs (P1)

### P1.1 — Remove `as any` casts (8 locations)

Type-unsafe casts that bypass TypeScript's type checking. All should be replaced with proper typing or safe fallbacks.

| File | Line | Issue |
|------|------|-------|
| `AssetsPage.tsx` | 228 | `as any` cast on staff data |
| `WarehousePage.tsx` | 732 | `as any` on batch transactions |
| `OrgPage.tsx` | 168 | `as any` cast |
| `FiveSPage.tsx` | 177 | `as any` for listenStaff callback |
| `PatrolPage.tsx` | 126, 337 | `as any` for patrolDate / listenStaff |
| `TrainingPage.tsx` | 131, 306 | `as any` for Timestamp / listenStaff |
| `ReportsPage.tsx` | 124 | `as any` for kpiData computation |
| `PmScheduleManager.tsx` | multiple | `as any` for pmSchedule, pmWorkOrder, etc. |
| `MaintenancePage.tsx` | multiple | `as any` scattered |
| `PmExecutionModal.tsx` | multiple | `as any` for Firestore fields |
| `WwtpDashboard.tsx` | multiple | `as any` for wwtpLogs |

**Fix approach:** Add proper type guards or extend Firestore type definitions to include all fields currently being cast. The `as any` casts typically occur because Firestore documents have extra fields not in the TypeScript type — add those fields to the relevant types in `firestore.ts`.

### P1.2 — `checkContractRenewals` N+1 query fix

**File:** `src/hooks/useAlertEngine.ts:250`

**Current:** Fetches ALL vendors from `vendors` collection, then iterates client-side to check `contracts.endDate`.

**Fix:** Add a Firestore composite index on `vendorContracts(endDate)` and query directly:
```typescript
// Replace: getDocs(collection(db, 'vendors'))
// With: query(collectionGroup(db, 'vendorContracts'), where('endDate', '<=', thresholdDate))
```
This moves the date filtering to the Firestore query engine instead of client-side iteration.

### P1.3 — FIFO engine `totalAvailable` mismatch

**File:** `src/utils/fifoEngine.ts:117-118`

**Issue:** `getExportBatchPreview` uses `totalAvailable` aggregate from `getBatchesFIFO` but the UI `WarehousePage.tsx:433` uses `currentBatchQty` for `overQuota` check. These are inconsistent.

**Fix:** `getExportBatchPreview` should validate each batch's quantity individually, not use the aggregate `totalAvailable`:
```typescript
// For each batch: available = batch.quantity - batch.reservedQuantity
// Check requestedQty against individual batch.available, not aggregate total
```
This ensures `getExportBatchPreview` returns the same validation result as the UI-level check.

### P1.4 — InfraPage hardcoded lift/energy fallback

**File:** `src/modules/infra/InfraPage.tsx:504-508` (liftData) and lines 540-545, 562-567 (energy/water charts)

**Issue:** When Firestore data is empty, hardcoded fake data is shown. Acceptable for demo but should show "No data" state instead.

**Fix:** Replace hardcoded fallbacks with empty state UI (text + icon) so operators know data is missing rather than seeing fake numbers.

---

## Phase 2 — Code Quality & Performance (P2)

### P2.1 — `collectionGroup` query optimization

**File:** `src/hooks/useAlertEngine.ts:345`

**Issue:** Uses `collectionGroup` for import doc audit check, which requires a separate index and is expensive.

**Fix:** If the import documents have a known collection path (e.g., `importDocuments/{id}`), query that collection directly instead of using `collectionGroup`. If `collectionGroup` is genuinely needed, add a comment documenting the required index and create the index in Firestore console.

### P2.2 — WwtpDashboard lowercase `h4` tag

**File:** `src/modules/environment/components/WwtpDashboard.tsx:198`

**Issue:** `<h4>` tag with lowercase `h` — likely a JSX typo.

**Fix:** Replace `<h4>` with proper capitalized `<h4>` (React JSX requires uppercase for custom components; lowercase HTML tags are valid but `h4` should match other headings for consistency).

### P2.3 — PmHistoryModal unused `sched` prop

**File:** `src/modules/maintenance/PmScheduleManager.tsx:232`

**Issue:** `PmHistoryModal` function receives `sched` prop but `handleViewHistory` calls it with `null` when no schedule is selected. The modal's internal logic returns `null` when `!sched`.

**Fix:** Either remove the `sched` prop if not needed, or use it to filter history to only that schedule's executions. The current behavior (shows nothing if `sched` is null) seems intentional but could be confusing.

### P2.4 — TrainingPage date parsing edge case

**File:** `src/modules/training/TrainingPage.tsx:136-139`

**Issue:** `endTime.split(':').map(Number)` could throw if `endTime` is malformed.

**Fix:** Add guard: `if (!endTime.match(/^\d{2}:\d{2}$/)) return` before parsing. Or use the native `Date` constructor with validation.

### P2.5 — Extend Firestore composite indexes

Create composite indexes for the most common query patterns:

```json
// firestore.indexes.json
{
  "indexes": [
    { "collectionGroup": "workOrders", "fields": [{ "fieldPath": "status", "order": "ASC" }, { "fieldPath": "priority", "order": "DESC" }] },
    { "collectionGroup": "pmWorkOrders", "fields": [{ "fieldPath": "status", "order": "ASC" }, { "fieldPath": "dueDate", "order": "ASC" }] },
    { "collectionGroup": "operationLogs", "fields": [{ "fieldPath": "date", "order": "DESC" }, { "fieldPath": "shift", "order": "ASC" }] },
    { "collectionGroup": "vendorContracts", "fields": [{ "fieldPath": "endDate", "order": "ASC" }, { "fieldPath": "status", "order": "ASC" }] },
    { "collectionGroup": "pcccInspections", "fields": [{ "fieldPath": "inspectionDate", "order": "DESC" }, { "fieldPath": "status", "order": "ASC" }] },
    { "collectionGroup": "energyReadings", "fields": [{ "fieldPath": "year", "order": "ASC" }, { "fieldPath": "month", "order": "ASC" }, { "fieldPath": "readingDate", "order": "DESC" }] }
  ]
}
```

### P2.6 — `useSystemKpis` hardcoded constants review

**File:** `src/hooks/useSystemKpis.ts:95-96`

**Issue:** `inventoryAccuracy: 99` and `complianceRate: 100` are hardcoded. `fireIncidents: totalIncidents === 0 ? 100 : 0` is also a simple boolean-to-score mapping.

**Fix:** These KPIs should be computed from actual Firestore data:
- `inventoryAccuracy`: Compare `inventory` document counts vs `inventoryTransactions` reconciliation records
- `complianceRate`: Count compliant items in `compliance` collection / total items
- `fireIncidents`: Use actual incident data but with a proper scoring formula (e.g., days since last incident weighted by recency)

**Priority:** MEDIUM — the hook is already wired up, just needs real computation.

---

## Phase 3 — Minor Polish & Features (P3)

### P3.1 — Storage rules consistency

**File:** `storage.rules:57-62`

**Issue:** Council doc deletion requires `admin` but creation only requires `manager`. This means managers can create but cannot delete council documents.

**Fix:** Either allow manager to delete (`request.auth.uid == userId || isPrivileged()`) or restrict creation to admin only. Recommend: allow manager to delete their own uploads.

### P3.2 — PmScheduleManager dead button

**File:** `src/modules/maintenance/PmScheduleManager.tsx:539`

**Issue:** `<button>` element without `onClick` at line 539 — likely a placeholder.

**Fix:** Either remove the dead button or wire it to the appropriate action.

### P3.3 — `listenStaff` type alignment

**Files:** `FiveSPage.tsx`, `PatrolPage.tsx`, `TrainingPage.tsx`

**Issue:** All three pages use `setStaff as (docs: any[]) => void` cast because `listenStaff` returns `StaffMember[]` but the callback signature differs.

**Fix:** Standardize the `listenStaff` signature in `db.ts` to accept `(docs: DocumentData[])` or create a typed wrapper that maps the raw docs to `StaffMember[]` before passing to the callback.

### P3.4 — Batch export quality improvements

**Issue:** Export workflow in WarehousePage is functional but could improve:
- Add CSV/Excel export for batch inventory reports
- Add batch expiry date highlighting in the batch picker
- Add "expiring in 30 days" filter on the stock tab

**Priority:** LOW — core FIFO functionality works.

### P3.5 — Disposal workflow UI polish

**Files:** `AssetsPage.tsx`, `DisposalRequestModal.tsx`, `DisposalCouncilModal.tsx`

**Issue:** Disposal workflow is functional (4-step) but:
- Vote tracking could show individual votes more clearly
- The council voting could show quorum status
- BGĐ biên bản generation could be enhanced with printable format

**Priority:** LOW — core workflow works.

---

## Quick Wins Summary

| ID | Task | Effort | Impact |
|----|------|--------|--------|
| QW-1 | PmScheduleManager dead button | 5 min | LOW |
| QW-2 | WwtpDashboard `<h4>` tag | 1 min | LOW |
| QW-3 | PmHistoryModal unused prop | 5 min | LOW |
| QW-4 | InfraPage empty-state instead of fake data | 10 min | MEDIUM |
| QW-5 | FIFO totalAvailable mismatch | 15 min | MEDIUM |
| QW-6 | Storage rules manager delete | 5 min | MEDIUM |
| QW-7 | Type alignment across 9 files | 2 sessions | HIGH |

---

## Priority Order

```
Session 1 (P1): QW-4, QW-5, P1.2, P1.3, P1.4
Session 2 (P2): P1.1 (type fixes), P2.1, P2.2, P2.3, P2.4
Session 3 (P3): P2.5 (indexes), P2.6 (useSystemKpis real data), QW-1, QW-2, QW-3, QW-6
Session 4 (P3 cont): P3.1, P3.3, P3.4, P3.5
```

---

## Out of Scope

These items were considered but deferred due to complexity vs. benefit:

- **Offline/PWA support** — would require significant architecture change (ServiceWorker, IndexedDB)
- **Real-time collaboration** — multi-user editing conflicts not currently handled
- **Automated email/SMS notifications** — requires backend trigger function
- **Barcode/QR scanning** — hardware-dependent, not part of spec
- **Multi-facility support** — current system assumes single facility

---

*Plan generated: 2026-06-07 | Auditor: Claude Code | Round 2*
