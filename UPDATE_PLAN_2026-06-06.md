# UPDATE_PLAN_2026-06-06 — BMS Portal
**Generated:** 2026-06-06
**Audit score:** ~71% (↑27pp vs baseline 44%)
**Gaps remaining:** 48 (↓23 vs baseline 71)
**Sessions estimated:** 5–6

---

## Quick Wins (< 1 session — do first)

### QW-1 · Fix Reports period tab — KPI không filter theo period
**File:** `src/modules/reports/ReportsPage.tsx`
**Mô tả:** `kpiData` dùng `latest.kpis.*` thay vì filter theo `periodBounds`.
**Thay đổi:**
- [ ] Tạo `periodReports = reports.filter(r => inPeriod(r.createdAt))` trước `periodWos`
- [ ] Đổi `kpiData` computation: `const periodReport = periodReports[0]` thay vì `latest`
- [ ] Đổi `const kpiData = periodReport ? [ ... periodReport.kpis.* ... ]` thay vì `latest.kpis.*`

```typescript
// Before (line ~264)
const kpiData = latest ? [
  { label: 'Uptime hệ thống kỹ thuật', actual: latest.kpis.uptime, ... }
]

// After
const periodReports = reports.filter(r => r.createdAt && inPeriod(r.createdAt))
const periodReport = periodReports[0]
const kpiData = periodReport ? [
  { label: 'Uptime hệ thống kỹ thuật', actual: periodReport.kpis.uptime, ... }
]
```

### QW-2 · Fix duplicate tab rendering in WarehousePage
**File:** `src/modules/warehouse/WarehousePage.tsx`
**Mô tả:** `activeTab === 'import'` checked 2 lần liên tiếp, second block always renders.
**Thay đổi:**
- [ ] Xóa duplicate block tại line ~1346
- [ ] Hoặc thêm `else` — chỉ render khi first check fails

### QW-3 · Add role guard cho Reports nav item
**File:** `src/layouts/AppShell.tsx`
**Mô tả:** ReportsPage visible cho technician dù `rolePermissions['technician'].reports = 'none'`.
**Thay đổi:**
- [ ] Import `getModulePermission` từ `rolePermissions.ts`
- [ ] Filter nav items dựa trên `user.role`

```typescript
// Before
{ to: '/reports', icon: BarChart3, label: 'Báo cáo & KPI' }

// After
const canSeeReports = getModulePermission(user?.role, 'reports') !== 'none'
// ...
{ to: '/reports', icon: BarChart3, label: 'Báo cáo & KPI', show: canSeeReports }
```

### QW-4 · Remove artificial delay in PmWorkOrderList
**File:** `src/modules/maintenance/PmWorkOrderList.tsx`
**Thay đổi:**
- [ ] Xóa `const timer = setTimeout(() => setLoading(false), 800)` (line 330)
- [ ] Dùng `loading` state từ listener

### QW-5 · Add `useMemo` for councils dependency in AssetsPage
**File:** `src/modules/assets/AssetsPage.tsx` line ~884
**Thay đổi:**
```typescript
// Before
}, [councils.map((c) => c.id).join(',')])

// After
}, [councils.length])
// Hoặc dùng useMemo:
const councilIds = useMemo(() => councils.map((c) => c.id).join(','), [councils])
// ...
}, [councilIds])
```

### QW-6 · Fix `handleOrder` naming mismatch
**File:** `src/modules/warehouse/WarehousePage.tsx` line ~1231
**Thay đổi:**
- [ ] Đổi tên function thành `handleExport` hoặc `handleRequestExport`
- [ ] Hoặc xóa function nếu không cần

---

## Phase 1 · Critical (Session 1)

### P1.1 · Tighten Firestore read rules — technician over-access
**File:** `firestore.rules`
**Issue:** `canReadAll()` cấp quyền đọc cho technician trên KPI, reports, WO của người khác.
**Thay đổi:**
- [ ] Thêm helper function `isOwnerOrPrivileged(resource)`:
```javascript
function isOwnerOrPrivileged() {
  return isPrivileged() ||
    resource.data.uid == request.auth.uid ||
    resource.data.assignedTo == request.auth.uid ||
    resource.data.createdBy == request.auth.uid;
}
```
- [ ] Áp dụng cho: `technicianKpi` (chỉ own KPI), `workOrders` (own + assigned), `reports` (chỉ admin/manager)
- [ ] Thêm comment QW-6 ghi rõ rationale

### P1.2 · PM Schedule Manager — implement real history + WO creation
**File:** `src/modules/maintenance/PmScheduleManager.tsx`
**Issue:** "Xem lịch sử BT" và "Tạo WO ngay" chỉ show toast, không có chức năng.
**Thay đổi:**
- [ ] `onViewHistory`: mở modal hiển thị `pmExecutionLog` entries cho schedule đó
- [ ] `onCreateWO`: gọi `checkAndCreatePmWorkOrders()` cho schedule cụ thể (hoặc tạo trực tiếp)
- [ ] Import `pmExecutionLog` listener từ `db.ts`

```typescript
const handleCreateWO = async (sched: PMSchedule & { id: string }) => {
  try {
    // Tạo WO trực tiếp cho schedule này
    const tasks: PMWorkOrderTask[] = sched.tasks.map(...)
    await addDoc(collection(db, 'pmWorkOrders'), { ... })
    toast.success('Đã tạo Work Order')
  } catch {
    toast.error('Tạo thất bại')
  }
}
```

### P1.3 · Replace hardcoded service history in InfraPage modals
**File:** `src/modules/infra/InfraPage.tsx`
**Issue:** HvacDetailModal và LiftDetailModal dùng hardcoded 2024 dates.
**Thay đổi:**
- [ ] Query `serviceRecords` collection với `where('assetId', '==', assetId)` + `orderBy('date', 'desc')`
- [ ] Hoặc query Firestore `infraSystems/{id}/serviceHistory` subcollection nếu tồn tại
- [ ] Nếu không có data, hiển thị empty state "Chưa có lịch sử bảo trì"

```typescript
// Trong HvacDetailModal / LiftDetailModal
const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([])

useEffect(() => {
  const q = query(
    collection(db, 'serviceRecords'),
    where('assetId', '==', assetId),
    orderBy('date', 'desc'),
    limit(10)
  )
  const unsub = onSnapshot(q, (snap) => {
    setServiceHistory(snap.docs.map(d => d.data() as ServiceRecord))
  })
  return unsub
}, [assetId])
```

---

## Phase 2 · Important (Sessions 2–3)

### P2.1 · BGDReportModal — auto-fill từ system data
**File:** `src/modules/reports/components/BGDReportModal.tsx`
**Issue:** KPI default values hardcoded, not auto-filled from system.
**Thay đổi:**
- [ ] Add `useGetSystemKpis(month, year)` hook — aggregate từ `workOrders`, `incidents`, `energyReadings`
- [ ] Pre-fill KPI section từ actual data khi modal mở
- [ ] Pre-fill cost section từ `reports` collection nếu đã có

```typescript
const { systemKpis } = useGetSystemKpis(month, year)

useEffect(() => {
  if (systemKpis) {
    setKpis({
      uptime: systemKpis.uptime ?? 99,
      workOrderCompletion: systemKpis.woCompletionRate ?? 95,
      // ...
    })
  }
}, [systemKpis])
```

### P2.2 · BGDReportModal — add print/export PDF
**File:** `src/modules/reports/components/BGDReportModal.tsx`
**Issue:** Có button Print icon nhưng không có handler.
**Thay đổi:**
- [ ] Implement print layout với `@media print` CSS
- [ ] Hoặc dùng `window.print()` với print-specific styles

### P2.3 · Role-based nav visibility
**File:** `src/layouts/AppShell.tsx`
**Issue:** Tất cả nav items visible cho mọi user.
**Thay đổi:**
- [ ] Import `getModulePermission` từ `rolePermissions.ts`
- [ ] Filter sidebar sections dựa trên `user?.role`
- [ ] `technician`: Dashboard, Maintenance, Infra (readonly), Warehouse (readonly) — NO Reports, Admin

### P2.4 · Vendor radar chart — fetch real evaluation data
**File:** `src/modules/vendors/VendorsPage.tsx`
**Issue:** Radar chart fallback là hardcoded array `[80,60,70,90,75]`.
**Thay đổi:**
- [ ] Query `vendorEvaluations` collection khi vendor selected
- [ ] Nếu empty, show empty state thay vì fake data

### P2.5 · Storage rules — add missing paths
**File:** `storage.rules`
**Issue:** `radiation/`, `calibration/certs/` paths chưa có rules.
**Thay đổi:**
- [ ] Thêm `match /radiation/permits/{permitId}/{filename}` từ `uploadRadiationPermitDoc` path
- [ ] Thêm `match /calibration/certs/{scheduleId}/{filename}` từ `uploadCalibrationCert` path

```javascript
match /radiation/permits/{permitId}/{filename} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.resource.size < 15 * 1024 * 1024
    && request.resource.contentType.matches('application/pdf|image/.*');
  allow delete: if request.auth != null
    && firestore.get(
         /databases/(default)/documents/users/$(request.auth.uid)
       ).data.role in ['admin', 'manager'];
}

match /calibration/certs/{scheduleId}/{filename} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches('application/pdf|image/.*');
  allow delete: if request.auth != null
    && firestore.get(
         /databases/(default)/documents/users/$(request.auth.uid)
       ).data.role in ['admin', 'manager'];
}
```

---

## Phase 3 · Enhancement (Sessions 4–5)

### P3.1 · Firestore composite indexes documentation
**Files:** Tạo `FIRESTORE_INDEXES.md` tại repo root
**Issue:** Các composite queries cần index nhưng chưa ghi nhận.
**Thay đổi:**
```markdown
## Required Composite Indexes

### pmWorkOrders
- Fields: status ASC, dueDate ASC

### inventoryTransactions
- Fields: itemId ASC, type ASC, importDate ASC

### technicianKpi
- Fields: period ASC, score DESC

### expiryAlerts
- Fields: alertLevel ASC, isRead ASC
```

### P3.2 · PM engine deduplication — prevent double-click duplicate WOs
**File:** `src/utils/pmEngine.ts`
**Issue:** Rapid clicks on "Chạy engine ngay" có thể tạo duplicate.
**Thay đổi:**
- [ ] Thêm `idempotencyKey = ${schedId}_${sched.nextDueDate.toMillis()}` vào pmExecutionLog
- [ ] Check duplicate trước khi tạo WO

### P3.3 · Alert engine — separate intervals for critical vs non-critical checks
**File:** `src/hooks/useAlertEngine.ts`
**Thay đổi:**
- [ ] Stale work orders (>48h): check every 15 minutes
- [ ] Low stock alerts: check every 30 minutes
- [ ] Document expiry: check every 60 minutes

```typescript
const STALE_CHECK_MS = 15 * 60 * 1000   // 15 min
const STOCK_CHECK_MS = 30 * 60 * 1000    // 30 min
const DEFAULT_MS = 60 * 60 * 1000        // 60 min
```

### P3.4 · 5S checklist module
**Module mới:** `src/modules/fiveS/FiveSPage.tsx`
**Issue:** Không có 5S checklist theo yêu cầu nghiệp vụ Tổ trưởng Bảo trì.
**Gồm:** 5S areas (Sort, Set, Shine, Standardize, Sustain), checklist items, photos, sign-off

### P3.5 · Civil patrol log module
**Module mới:** `src/modules/civil/PatrolLogPage.tsx`
**Issue:** Không có patrol log theo yêu cầu Tổ trưởng Bảo trì.
**Gồm:** Patrol checklist, finding notes, photo upload, daily log

### P3.6 · Training records module
**Module mới:** `src/modules/training/TrainingPage.tsx`
**Issue:** Không có training records theo yêu cầu nghiệp vụ Trưởng phòng.
**Gồm:** Training sessions, attendance, certifications, schedule

### P3.7 · Asset depreciation tracking
**File:** `src/modules/assets/AssetsPage.tsx`
**Issue:** Không có depreciation tracking.
**Thay đổi:**
- [ ] Add `purchaseDate`, `purchasePrice`, `usefulLifeYears` fields to Asset type
- [ ] Add depreciation chart (straight-line) in asset detail view
- [ ] Add `currentValue = purchasePrice - (purchasePrice * age / usefulLifeYears)`

### P3.8 · SLA alert for contract renewals
**File:** `src/hooks/useAlertEngine.ts` — add Check 8
**Issue:** Không có cảnh báo gia hạn hợp đồng SLA.
**Thay đổi:**
```typescript
async function checkContractRenewals(uid: string): Promise<void> {
  const cutoff = thirtyDaysFromNow()
  const snap = await getDocs(
    query(contracts, where('endDate', '<=', Timestamp.fromDate(cutoff)))
  )
  // Create notification cho mỗi contract sắp hết hạn
}
```

---

## Phase 4 · Future Scope (Beyond current audit)

### Not in current sprint
- Firebase Messaging push notification deep integration
- Offline-first with service worker
- PDF generation với Vietnamese government templates (biên bản)
- Mobile app (React Native wrapper)
- Advanced analytics / ML-based predictive maintenance
- Multi-tenant / multi-hospital support
- Audit log cho compliance (ai sửa gì, khi nào)

---

## Rollback Notes

Nếu PM auto-trigger hoặc PCCC monthly form cần rollback:
- `usePmAutoRunner`: xóa hook import trong `AppShell.tsx`
- `usePcccInspections`: không dùng trong `FireSafetyPage` — xóa hook và form

---

*Plan generated: 2026-06-06 | Quick wins: 6 items | Phases 1–3: 16 items | Future: 6 items*
*Priority: P1 = Security + Period tab bug | P2 = PM history + Hardcoded data + RBAC | P3 = Auto-fill + Polish*
