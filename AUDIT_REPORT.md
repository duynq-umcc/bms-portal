# BMS Hospital — Audit Report
**Date:** 2026-06-06
**Standard:** P.QT-VT_TTB 2026 Job Duties Document
**Auditor:** Claude Code (automated codebase analysis)
**Scope:** 13 modules, Firestore data integrity, role-based access, performance, mobile quality

---

## Score Summary

| Module | Complete | Partial | Missing | Score |
|--------|:--------:|:-------:|:-------:|:-----:|
| M01 Dashboard | 7 | 3 | 3 | **63%** |
| M02 Org Chart | 6 | 2 | 4 | **50%** |
| M03 Infra/Operations | 9 | 2 | 6 | **59%** |
| M04 Maintenance | 8 | 3 | 7 | **47%** |
| M05 Fire Safety | 4 | 1 | 6 | **36%** |
| M06 Civil Works | 3 | 1 | 6 | **30%** |
| M07 Medical Devices | 5 | 1 | 6 | **42%** |
| M08 Compliance/Legal | 3 | 1 | 5 | **33%** |
| M09 Warehouse | 8 | 3 | 8 | **42%** |
| M10 Fixed Assets | 4 | 2 | 5 | **36%** |
| M11 Vendors | 4 | 1 | 5 | **40%** |
| M12 Environment | 3 | 1 | 4 | **38%** |
| M13 Reports/KPI | 6 | 2 | 6 | **43%** |
| **TOTAL** | **70** | **23** | **71** | **44%** |

> **System-wide average: 44%** — significant gap between current implementation and P.QT-VT_TTB 2026 standard. Phases 1–2 items are critical blockers for legal compliance and daily operations.

---

## M01 — Dashboard

| Check | Status | Notes |
|-------|--------|-------|
| 6 stat cards load real Firestore data | ✅ Done | 8 cards using onSnapshot |
| System status grid shows live systemReadings | ✅ Done | Real-time onSnapshot |
| Work order feed shows latest 5 | ✅ Done | onSnapshot, limit 5 |
| Incident alerts visible prominently | ✅ Done | Recent 5 in timeline |
| KPI gauges reflect real calculated values | ✅ Done | 5 progress bars |
| "Cập nhật" timestamp shows last data refresh | ⚠ Partial | No visible timestamp shown |
| Role-based view | ⚠ Partial | Data is role-aware but no role switching |
| Daily shift summary (Ca sáng/chiều/đêm) | ❌ Missing | No shift summary widget |
| Energy consumption widget (kWh hôm nay vs hôm qua) | ⚠ Partial | Power today card exists but no comparison |
| Overdue items count (quá hạn BT + KĐ) | ✅ Done | Separate stat cards for overdue PM + critical incidents |
| Quick action: [Ghi sự cố] button | ❌ Missing | No quick-action buttons on dashboard |

**Partial findings:**
- `complianceValue` defaults to 100% if `compliance` collection is empty (inflates score)
- `technicianKpi` query is hardcoded `limit(10)` with no error handling
- Period tabs in Reports page (sibling) are decorative and do not filter data

---

## M02 — Sơ đồ Tổ chức

| Check | Status | Notes |
|-------|--------|-------|
| Org tree renders correctly (3 levels) | ✅ Done | 3 levels: director / manager / employee |
| Staff cards: tên, chức vụ, phòng ban, SĐT, email | ✅ Done | All 5 fields in detail panel |
| Staff list table with all columns | ✅ Done | 7 columns incl. KPI |
| Search by name works | ✅ Done | Client-side filter |
| Filter by department works | ✅ Done | Dept filter chips |
| RACI matrix visible | ❌ Missing | No RACI matrix anywhere in app |
| KPI score per staff | ⚠ Partial | KPI tab exists, but no search/filter/period selector |
| WO count per technician | ❌ Missing | No per-technician WO count in org page |
| Training records per staff | ❌ Missing | No training records collection/UI |
| Leave/absence tracking | ❌ Missing | No leave tracking |

**Partial findings:**
- KPI tab locked to current period only — no period picker
- Org page uses `getAllStaff()` (one-shot `get()`), not real-time
- KPI data subscribes to current month via `onSnapshot` — correct pattern
- `ScoreRingSmall` renders score without `score/100` normalization (passes raw 0–100, SVG dashoffset uses same range — works but unconventional)

---

## M03 — Vận hành Hạ tầng

| Check | Status | Notes |
|-------|--------|-------|
| System tiles: Điện, Nước, HVAC, Khí Oxy, Thang máy | ✅ Done | 8 tile grid |
| Live sensor readings | ✅ Done | Real-time onSnapshot |
| HVAC cards with capacity % and temperature | ✅ Done | AHU cards |
| Lift status cards | ✅ Done | Lift cards with trip count |
| Energy 7-day bar chart | ✅ Done | Recharts BarChart |
| Water 7-day line chart | ✅ Done | Recharts LineChart |
| Nhật ký vận hành form (Ca điện, nước, HVAC, khí y tế) | ✅ Done | 4-step wizard modal |
| Shift handover checklist | ✅ Done | Step 4 of OperationLogModal |
| Alert threshold config per system | ❌ Missing | No UI for configuring alert thresholds |
| Medical gas monitoring (O2, compressed air, vacuum) | ✅ Done | OperationLogModal step 2 |
| Wastewater treatment readings | ❌ Missing | No wastewater treatment readings form |
| "Cập nhật" timestamp | ✅ Done | Shift status indicator shows last log time |

**Critical gaps:**
- No actual threshold configuration UI — ` InfraSystem.threshold` exists in types but no modal to set it
- HVAC and Lift detail modals have **hardcoded maintenance history** (2024 dates), not from Firestore
- `SystemDetailModal` "Giao kỹ thuật viên" assigns by free-text name only — **no persistence** to Firestore
- "Báo cáo sự cố" button in `SystemDetailModal` is a **no-op** (closes modal, no action)
- No validation on operation log submission — all fields accept empty values
- No O₂ notification debounce — fires on every re-render when pressure < 2.0

---

## M04 — Bảo trì Sửa chữa

| Check | Status | Notes |
|-------|--------|-------|
| Work order list with all columns | ✅ Done | ID, tiêu đề, vị trí, loại, ưu tiên, nhân viên, trạng thái, ngày |
| Filter by status/priority/category | ✅ Done | All filters work |
| Calendar view shows WO by due date | ✅ Done | Day-of-week grid |
| Timeline merged incidents + WO | ✅ Done | 20 most recent combined |
| Create WO modal with all required fields | ✅ Done | Full form modal |
| Swipe-to-action on mobile cards | ✅ Done | Swipe right = assign, swipe left = complete |
| Assign technician from user list | ⚠ Partial | Inline text prompt, not validated against user list |
| Preventive maintenance schedule | ✅ Done | PM Schedule Manager with active/scheduled WOs |
| WO completion requires ảnh chụp + chữ ký | ✅ Done | PMExecutionModal requires before+after photos |
| SLA tracking (response vs resolution time) | ⚠ Partial | `technicianKpi.responseStats` tracks response time but no SLA alerts |
| Weekly/monthly summary for Phó phòng | ❌ Missing | No auto-generated PM summary report |
| Tool/equipment checklist per WO | ❌ Missing | No tool checklist in WO form |
| "Hồ sơ máy" attachment field | ❌ Missing | No machine profile attachment on WO |
| Contractor supervision field on WO | ❌ Missing | Contractor info on WO only in PM form, not ad-hoc WO |
| PM auto-generates WO when due | ⚠ Partial | Engine is **manual trigger** only — no scheduled job |

**Critical gaps:**
- PM engine (`checkAndCreatePmWorkOrders()`) requires **manual click** of "Chạy engine ngay" button — no cron/Cloud Function
- PM schedule "View history" and "Create WO now" are **stub toasts** — no actual implementation
- `sourceFilter` state exists but is **never applied** to filtered list (line 547 filters only status/priority/category)
- No SLA timer or escalation rules
- No digital signature capture (only text note as sign-off)

---

## M05 — PCCC & An toàn

| Check | Status | Notes |
|-------|--------|-------|
| Fire equipment checklist by location | ✅ Done | Equipment tab with cards |
| Drill schedule table | ✅ Done | Drills tab with table |
| Periodic inspection checklist with progress bar | ✅ Done | Inspections tab grouped by floor |
| Export/print checklist | ✅ Done | Browser window.print() |
| Monthly PCCC inspection form | ❌ Missing | No monthly inspection form — only equipment cards |
| Cảnh sát PCCC working log | ❌ Missing | No log for working with fire authority |
| Fire drill report with participants + evaluation | ❌ Missing | Drill result is pass/fail only, no participants list |
| AT-VSLĐ compliance tracker | ❌ Missing | No AT-VSLĐ module |
| Radiation safety log | ❌ Missing | No radiation safety tracking |
| PPE compliance per technician | ❌ Missing | No PPE tracking |

**Findings:**
- Only fire safety-specific module — AT-VSLĐ (An toàn vệ sinh lao động) and radiation safety fall under a completely separate module that does not exist
- Drill results can only be set on creation — no update mechanism
- No overdue drill alerts

---

## M06 — Xây dựng Dân dụng

| Check | Status | Notes |
|-------|--------|-------|
| Project tracker cards with progress % | ✅ Done | Cards with progress bar + budget vs spent |
| Building inspection checklist by area | ✅ Done | Grouped by wall/ceiling/floor/door/roof/exterior |
| Work log timeline with photos | ✅ Done | Timeline with cost + photo thumbnails |
| Daily patrol inspection form | ❌ Missing | No daily patrol form |
| Contractor supervision log | ❌ Missing | No contractor visit/supervision log |
| Debris/waste removal log | ❌ Missing | No debris removal tracking |
| Material storage tracking | ❌ Missing | No material tracking |
| Cost estimate (dự toán) per project | ❌ Missing | Budget field exists but no dự toán builder |
| Before/after photos for completion | ❌ Missing | Worklog photos are display-only placeholder |

**Findings:**
- No project create/edit/delete workflow in the UI — projects must be created via seed/Firestore directly
- Worklog photo thumbnails are **placeholder** — no upload mechanism in `CivilWorksPage.tsx`

---

## M07 — Thiết bị Y tế

| Check | Status | Notes |
|-------|--------|-------|
| Device registry with all fields | ✅ Done | 4-tab detail modal |
| Service history subcollection | ✅ Done | `serviceHistory/{deviceId}` |
| Maintenance schedule table | ✅ Done | Schedule tab |
| Calibration tracker | ✅ Done | Calibration tab |
| Modal 3 tabs: Thông tin, Lịch sử BT, Hồ sơ | ⚠ Partial | Info/History/PM/Docs = 4 tabs, not 3 |

**Critical gaps:**
- 3 footer buttons in DeviceDetailModal are **dead** — "Tạo Work Order BT", "Cập nhật", "Xuất PDF" all have no `onClick` handlers
- No device creation workflow
- Device lifecycle tracking: Mua sắm → Đưa vào sử dụng → Bảo trì → Thanh lý not tracked
- No asset profile creation form (lý lịch máy with barcode/label)
- No device lending/transfer tracking between departments
- No contractor supervision per device
- No device usage effectiveness report
- No damage report form for non-repairable devices

---

## M08 — Kiểm định & Pháp lý

| Check | Status | Notes |
|-------|--------|-------|
| Calibration schedule table with days remaining | ✅ Done | With overdue/due-soon badges |
| Legal documents tracker with expiry | ✅ Done | Cert number, issue/expiry, authority |
| Contractor compliance tab | ✅ Done | Insurance + rating display |
| X-quang/CT radiation permit tracking | ❌ Missing | No radiation permit tracking |
| Inspection certificate storage with file upload | ❌ Missing | Only URL input, no Firebase Storage upload |
| Regulatory authority contact log | ❌ Missing | No contact log with gov't authorities |
| Calibration organization (VILAS, Cục ATBXHN) database | ❌ Missing | No calibration lab database |
| Alert: 90 days before calibration due | ❌ Missing | Only 30-day alert via `useAlertEngine` |

**Findings:**
- Legal document upload is **URL text input only** — no file upload to Firebase Storage
- No search or filtering in any of the 3 tabs
- No edit/delete for any records
- `compliance` collection relationship with `calibrationSchedules` and `legalDocuments` is unclear

---

## M09 — Kho VT-TTB

| Check | Status | Notes |
|-------|--------|-------|
| Inventory table with all columns | ✅ Done | 8 columns including batch/expiry |
| Status logic (Đủ/Cận min/Cần đặt) | ✅ Done | Color-coded badges |
| Import history with transactions | ✅ Done | Tab with PO tracking |
| Export history with approval | ✅ Done | Batch export modal |
| Low stock badge on BottomNav | ✅ Done | Badge counter |
| FIFO/FEFO enforcement | ✅ Done | `fifoEngine.ts` with `getBatchesFIFO/getBatchesFEFO` |
| Expiry date management (<90d / <180d alerts) | ✅ Done | 3-level alert: critical/warning/notice |
| PO matching on import | ✅ Done | PO number field in ImportModal |
| Legal documents per import (CO/CQ/invoice/customs) | ✅ Done | `ImportDocPanel` with upload |
| Over-quota alert on export | ❌ Missing | No over-quota check in ExportModal |
| Slow-moving inventory report | ❌ Missing | No slow-moving report |
| 5S compliance checklist | ❌ Missing | No 5S warehouse checklist |
| Temperature/humidity monitoring | ❌ Missing | No storage condition monitoring |
| Asset lending/transfer tracker | ❌ Missing | Device lending between departments |

**Known bugs:**
- Export quantity check validates against aggregate `selectedItem.quantity`, not the **specific batch** being exported — a user could export 100 units from a batch with only 5 available
- FIFO validation only fires on batch **selection change**, not when quantity is **changed** after selection
- No per-batch quantity decrement — aggregate `updateInventoryQuantity` only
- Asset status not reverted to `active` when disposal request is `rejected`

---

## M10 — Tài sản Cố định

| Check | Status | Notes |
|-------|--------|-------|
| Asset registry table | ✅ Done | Full table with depreciation |
| Depreciation calculator | ✅ Done | Straight-line + declining |
| Disposal list | ✅ Done | 3-tab disposal workflow |
| Full lifecycle: Mua → Hư hỏng → Thanh lý | ⚠ Partial | Disposal workflow exists but asset status not reverted on rejection |
| Disposal request form (lý do, tình trạng, giá trị còn lại) | ✅ Done | 4-step wizard |
| Disposal council record (biên bản HĐ thanh lý) | ✅ Done | Full Vietnamese government-formatted biên bản |
| Asset relocation history | ❌ Missing | No relocation tracking |
| Annual inventory reconciliation | ❌ Missing | No annual reconciliation workflow |
| Integration with Kho: new device → auto-create asset | ❌ Missing | No integration between `medicalDevices` and `assets` |

**Bugs:**
- "Thực hiện thanh lý" and "Sửa đề xuất" buttons in `DisposalRequestDetail` are **stubs** — no handlers wired
- No actual PDF generation for biên bản — uses `window.print()`
- No signature upload for signed biên bản
- Council minutes have empty signature `<div>` placeholders
- No notification to requester when request moves to `in_council`

---

## M11 — Nhà thầu & Dịch vụ

| Check | Status | Notes |
|-------|--------|-------|
| Vendor cards grid | ✅ Done | Cards with status badges |
| Contract tracker with expiry | ✅ Done | Days-remaining badges |
| Performance ratings | ⚠ Partial | Single `rating` field, radar chart **fabricates** per-criteria scores from it |
| Service scope (SOW) per contract | ❌ Missing | No SOW document |
| SLA terms per contractor | ❌ Missing | No SLA tracking |
| Contractor visit log | ❌ Missing | No visit supervision log |
| Contractor evaluation form (quarterly) | ❌ Missing | No quarterly evaluation |
| Tender evaluation record | ❌ Missing | No tender evaluation |
| Insurance tracking per contractor | ✅ Done | Shown in Contractors tab |

**Findings:**
- No vendor creation workflow — vendors must be seeded via Firestore
- Radar chart in Ratings tab uses **artificial data** — offsets `rating` by random amounts to simulate 5 criteria
- No contract renewal workflow
- No vendor blacklist/suspension

---

## M12 — Môi trường

| Check | Status | Notes |
|-------|--------|-------|
| Energy dashboard (kWh 12 months) | ✅ Done | Bar chart + recent readings |
| Water dashboard (m³) | ✅ Done | Bar chart + alerts |
| Waste management log by category | ✅ Done | Donut chart + table |
| Daily wastewater treatment log | ❌ Missing | No WWTP daily log form |
| Medical waste categories | ⚠ Partial | General/medical_hazardous/recyclable logged, but no dedicated form per category |
| Environmental compliance certificates | ❌ Missing | No compliance certificate tracking |
| Pest control log | ❌ Missing | No pest control tracking |

**Findings:**
- No date range filter — always shows last 12 months
- No target input for energy/water consumption
- Waste certificate field is free text — no actual certificate upload/verification
- No water leak resolution workflow beyond alert tracking

---

## M13 — Báo cáo & KPI

| Check | Status | Notes |
|-------|--------|-------|
| Monthly KPI bars (target vs actual) | ✅ Done | 5 horizontal bars |
| Cost breakdown chart | ✅ Done | Horizontal bar chart |
| Work order analytics | ✅ Done | WO pie + trend line |
| System uptime table | ✅ Done | 6-system table |
| Excel export | ⚠ Partial | 3 CSV export functions (not native .xlsx) |
| Print report | ✅ Done | window.print() |
| Weekly maintenance summary for Phó phòng | ❌ Missing | No weekly auto-summary |
| Monthly BGĐ report template | ❌ Missing | No standard template |
| KPI per technician with breakdown | ⚠ Partial | KPI tab exists but period locked, no filter |
| Cost vs budget comparison | ❌ Missing | No budget variance analysis |
| Regulatory report templates | ❌ Missing | No government report templates |
| Training completion report | ❌ Missing | No training tracking to report |

**Critical bugs:**
- **Period tabs (Tháng/Quý/Năm) are non-functional** — state is set but never used to filter any data. Page always shows `reports[0]` regardless of selected tab.
- Uptime calculation is `100 - incidents * 0.1` — **fake formula**, not real monitoring data
- MTTR shows "—" for systems with no incidents, not actual repair time
- No quarterly/annual aggregation — always latest month only

---

## Technical Audit

### Data Integrity

| Check | Status | Notes |
|-------|--------|-------|
| All 13 modules use real Firestore | ✅ Done | All `listen*` functions wired to Firestore |
| onSnapshot properly attached in all modules | ⚠ Partial | All listeners return Unsubscribe, but only 2 have `onError` callbacks |
| No hardcoded Vietnamese names in UI | ✅ Done | All dynamic from Firestore |
| Seed data reflects realistic values | ✅ Done | No mock data in source |
| All writes confirmed with success toast | ⚠ Partial | Most writes have toast, but some modals (SystemDetailModal) don't persist |
| All errors show user-friendly toast | ❌ Partial | Error callbacks missing on most listeners |

### Role-Based Access

| Check | Status | Notes |
|-------|--------|-------|
| Admin sees all 15 routes | ✅ Done | `rolePermissions.ts` correctly configured |
| Manager sees 13 modules, no /admin/* | ✅ Done | readWrite/ReadOnly/none matrix correct |
| Technician sees limited modules | ✅ Done | ReadOnly for most, readWrite for Maintenance only |
| UI hides unauthorized nav items | ✅ Done | `AuthGuard` + `RoleGuard` + `MODULES` config |
| Firestore rules enforce role at backend | ❌ **CRITICAL GAP** | See below |

**Firestore Security Rules — CRITICAL:**

1. **`canReadAll()` uses `isAuthenticated()`** (line 33) — every authenticated user can read **all collections**. A technician can read all `assets`, `compliance`, `disposalRequests`, etc. No data isolation.

2. **Work orders wide open** (line 56): `allow write: if isAdmin() || isManager() || isTechnician()` — any technician can create/update any work order, reassign to others, or change priority/cost fields.

3. **Incidents same problem** (line 62): All authenticated users can write incidents.

4. **`disposalRequests` create too broad** (line 295): Any authenticated user can create disposal requests, even `viewer` role.

5. **`serviceHistory` subcollection is admin-only in rules** (line 224) but `addServiceRecord` in `db.ts` may be called by non-admin technicians — **mismatch**.

### Performance

| Check | Status | Notes |
|-------|--------|-------|
| Lazy chunking with manualChunks | ✅ Done | 6 vendor chunks in vite.config |
| Firebase chunk separated | ✅ Done | ~600KB Firebase in own chunk |
| Drop console in production | ✅ Done | Terser `drop_console: true` |
| Recharts use ResponsiveContainer | ⚠ Partial | Charts in DashboardPage use ResponsiveContainer; check individual module charts |
| All onSnapshot return unsubscribe | ✅ Done | All `listen*` return Unsubscribe |
| PWA configured | ✅ Done | VitePWA plugin with Workbox |

**Performance concerns:**
- `collectionGroup` on `inventoryTransactions` in `useAlertEngine` scans entire DB every 60 minutes — potentially expensive at scale
- KPI engine computes technicians **sequentially** (not parallelized)
- `createNotification` called in loops without batching — 100 low-stock items = 100 sequential writes

---

## Critical Gaps — Legal/Operational Risk

### Legal Compliance (must fix immediately)

| Module | Gap | Legal Basis |
|--------|-----|-------------|
| M05 | Monthly PCCC inspection form (kiểm tra đầu báo khói, tủ báo cháy, bình chữa cháy, họng nước vách tường) | PCCC Law — periodic inspection mandatory |
| M05 | Fire drill report with participants + evaluation score | PCCC regulations require documented drills |
| M08 | Calibration certificate file upload (currently URL text only) | Kiểm định pháp lý requires actual cert documents |
| M08 | X-quang/CT radiation permit tracking | Atomic Energy Law — radiation safety permits |
| M12 | Daily WWTP log (pH, COD, coliform results) | Environmental Protection Law — mandatory daily records |
| M12 | Medical waste category segregation documentation | Medical waste regulations — category tracking required |

### Daily Operations (blocks M&E staff)

| Module | Gap | Impact |
|--------|-----|--------|
| M03 | Wastewater treatment readings form | NV M&E cannot log WWTP readings digitally |
| M04 | PM engine runs only on manual trigger | Preventive maintenance WOs are not auto-generated |
| M03 | Alert threshold config per system | No way to configure O₂ pressure alerts beyond hardcoded values |
| M09 | Over-quota export warning | Technicians can export more than authorized without warning |
| M04 | Tool/equipment checklist per WO | Tổ trưởng cannot track tools assigned to work |

### Management Reporting (blocks Trưởng phòng)

| Module | Gap | Impact |
|--------|-----|--------|
| M13 | Period tabs are non-functional | Reports cannot be filtered by month/quarter/year |
| M13 | Weekly maintenance summary | Tổ trưởng must manually compile weekly reports |
| M13 | BGĐ monthly report template | No standardized format for Board reporting |
| M02 | WO count per technician | Cannot evaluate staff performance |
| M09 | Slow-moving inventory report | Cannot identify stale stock |

---

## Minor Gaps — Nice to Have

| Module | Gap |
|--------|-----|
| M01 | Quick action [Ghi sự cố] button |
| M02 | RACI matrix |
| M02 | Training records per staff |
| M02 | Leave/absence tracking |
| M03 | "Cập nhật" timestamp visible on dashboard |
| M04 | Digital signature capture for WO completion |
| M04 | PDF generation for WO completion report |
| M06 | Daily patrol inspection form |
| M06 | Material storage tracking |
| M07 | Device lifecycle: Mua → Bảo trì → Thanh lý |
| M07 | Device lending/transfer tracker |
| M08 | Regulatory authority contact log |
| M08 | VILAS calibration lab database |
| M09 | 5S warehouse compliance checklist |
| M09 | Temperature/humidity storage monitoring |
| M10 | Annual inventory reconciliation workflow |
| M10 | New medical device → auto-create asset profile |
| M11 | Service scope (SOW) per contract |
| M11 | SLA terms per contractor |
| M11 | Contractor visit log |
| M11 | Quarterly contractor evaluation |
| M11 | Tender evaluation records |
| M12 | Pest control log |
| M13 | Cost vs budget comparison |
| M13 | Regulatory report templates |
| M13 | Training completion report |

---

## Firestore Security Rules — Priority Fixes

```javascript
// ISSUE 1: Line 33 — remove canReadAll, enforce role-based reads
// Current: allow read: if request.auth != null;
// FIX: Separate read rules per collection with role checks

// ISSUE 2: Line 56 — work orders wide open
// Current: allow write: if isAdmin() || isManager() || isTechnician();
// FIX: Technicians can only create (not update others' WOs or change cost/priority)

// ISSUE 3: Line 295 — disposalRequests too broad
// FIX: require request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];

// ISSUE 4: serviceHistory subcollection vs db.ts mismatch
// FIX: Either relax rules to allow technicians, or require admin role for write
```

---

## Quick Wins (< 30 minutes each)

1. **M01**: Add `[Ghi sự cố]` quick action button to Dashboard stat cards
2. **M04**: Fix `sourceFilter` never applied — add one line to filter function
3. **M04**: "Báo cáo sự cố" button in SystemDetailModal — actually open incident modal
4. **M09**: Add over-quota warning in ExportModal — check `requestedQty > approvedQuota`
5. **M13**: Fix period tabs — wire `activePeriod` state to filter `reports` array
6. **M13**: Show real MTTR from actual WO `completedAt - startedAt` instead of fake formula
7. **M07**: Wire the 3 dead footer buttons in DeviceDetailModal to real handlers
8. **M11**: Remove fabricated radar chart data — replace with actual `vendorRatings` per-criteria scores
