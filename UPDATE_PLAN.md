# BMS Hospital — Update Plan
**Prioritized by:** operational impact + legal risk
**Based on:** AUDIT_REPORT.md (2026-06-06)
**Standard:** P.QT-VT_TTB 2026 Job Duties Document

---

## Phase 1 — CRITICAL
**Estimated: 4–6 sessions** | **Risk: Legal non-compliance + blocked daily ops**

---

### P1.1 Firestore Security Rules Hardening
**WHY:** Every authenticated user (including technicians) can read ALL collections and write ALL work orders. Disposal requests are open to anyone. This is a critical data breach and audit risk.

**WHAT:**
1. Replace `canReadAll()` with role-gated read rules per collection
   - `assets`: admin/manager read, technician read-only (no cost fields)
   - `disposalRequests`: admin/manager write, technician read-only
   - `compliance`, `legalDocuments`: admin/manager only
   - `workOrders`: technician can create + own assigned WOs; only admin/manager can change priority/cost
   - `incidents`: technician can create; admin/manager can update/close
2. Fix `serviceHistory` subcollection mismatch — allow technician writes (matching `db.ts`)
3. Add field-level validation for work order cost/priority changes

**Files:**
- `firestore.rules`
- `src/firebase/db.ts` (verify `addServiceRecord` role consistency)

**Claude Code prompt:**
```
Fix firestore.rules for the BMS Hospital portal. The project is at d:\GitHub\bms-portal.

CRITICAL ISSUES to fix:
1. canReadAll() (line 33) allows ALL authenticated users to read ALL collections — replace with role-gated rules:
   - admin/manager can read all collections
   - technician can read: workOrders (own only), incidents (read/create), org, inventory, assets (no cost fields), infra, systemReadings, operationLogs (own only)
   - technician CANNOT read: disposalRequests, disposalCouncils, legalDocuments, compliance (write), admin subcollections

2. workOrders write (line 56): currently allows technician to write ANY work order. Fix:
   - technician can CREATE workOrders (new docs only)
   - technician can UPDATE their OWN assigned workOrders (where assignedTo == request.auth.uid)
   - technician CANNOT update priority, cost, assignedTo, status=completed fields
   - admin/manager can write all fields

3. disposalRequests create (line 295): allow any authenticated user to create — restrict to admin/manager only

4. serviceHistory subcollection (line 224): currently admin-only in rules, but addServiceRecord in db.ts uses addDoc without role check. Allow technician write for serviceHistory subcollection (technicians do maintenance on medical devices).

5. incidents write: technician can CREATE, admin/manager can UPDATE/close

Apply minimal changes — preserve all existing correct rules. Test that admin/manager still have full access.
```

---

### P1.2 PM Auto-Generation Engine (M04)
**WHY:** Preventive maintenance WOs are not being auto-generated. The engine requires a manual "Chạy engine ngay" button click. NV M&E must have PM tasks auto-scheduled per equipment lifecycle.

**WHAT:**
1. Create a Firebase Cloud Function (scheduled) or Vercel cron job to trigger `checkAndCreatePmWorkOrders()` daily at 07:00
2. Alternatively: use a client-side approach — when any admin/manager logs in, check if engine ran today (via `pmExecutionLog`), run if not
3. Add "Last engine run" display in PmScheduleManager with human-readable timestamp

**Files:**
- `src/firebase/db.ts` — verify `checkAndCreatePmWorkOrders` exists and works
- `src/utils/pmEngine.ts` — verify engine logic
- `src/modules/maintenance/PmScheduleManager.tsx` — add "engine status" display
- `scripts/` — add Cloud Function or cron script (if not using client-side trigger)
- `firestore.rules` — allow scheduled function to write `pmWorkOrders`

**Claude Code prompt:**
```
Implement auto-triggered PM engine for the BMS Hospital portal at d:\GitHub\bms-portal.

Currently: checkAndCreatePmWorkOrders() in pmEngine.ts runs only when admin clicks "Chạy engine ngay" button.

Solution: Add a client-side auto-trigger on first admin/manager login each day.

Files to create/modify:
1. Create src/hooks/usePmAutoRunner.ts — on mount (if user is admin/manager), check pmExecutionLog for today's run. If no run today, call checkAndCreatePmWorkOrders() and show a toast "PM engine đã chạy tự động lúc [time]". Run only once per day (store lastRunDate in localStorage).

2. Modify src/layouts/AppShell.tsx — call usePmAutoRunner() for admin/manager sessions only.

3. In PmScheduleManager.tsx — add a status badge showing: "Engine đã chạy hôm nay lúc HH:MM" or "Engine chưa chạy hôm nay" with a manual "Chạy ngay" button.

4. Ensure firestore.rules allows pmWorkOrders write for admin/manager (already should be fine).

Do NOT modify pmEngine.ts — it already exists and works. Only create the hook and wire it up.
```

---

### P1.3 Monthly PCCC Inspection Form (M05)
**WHY:** PCCC Law requires documented monthly inspections of smoke detectors, fire alarm panels, extinguishers, and wall hydrants. Currently there is no monthly inspection form — only equipment cards with next-due dates.

**WHAT:**
1. Create `PcccInspectionFormModal.tsx` — monthly inspection form with:
   - Month/Year picker (defaults to current month)
   - Location selector (from fireSafety equipment list)
   - Checklist per equipment type:
     - Đầu báo khói (smoke detectors): tested / not tested / faulty
     - Tủ báo cháy (fire alarm panels): status / last test date
     - Bình chữa cháy (extinguishers): type / pressure / location / inspection date
     - Họng nước vách tường (wall hydrants): pressure / flow / condition
   - Inspector name + date + signature field
   - Photos upload
   - Notes field
2. Add "Kiểm tra định kỳ" button on FireSafetyPage header
3. Store in `periodicInspections` collection (already exists)
4. Add `PcccInspectionReport` sub-collection or type for dedicated PCCC inspection records

**Files:**
- `src/modules/fire-safety/FireSafetyPage.tsx` — add "Kiểm tra định kỳ" button + modal
- `src/types/firestore.ts` — add `PcccInspection` type
- `src/firebase/db.ts` — add `addPcccInspection`, `listenPcccInspections`, `updatePcccInspection`

**Claude Code prompt:**
```
Add a monthly PCCC inspection form to the Fire Safety module at d:\GitHub\bms-portal.

Create a new component: src/modules/fire-safety/PcccInspectionFormModal.tsx

Requirements:
- 3-step modal wizard:
  Step 1 — Chọn khu vực: month/year picker, building/floor dropdown, equipment type selection (đầu báo khói / tủ báo cháy / bình chữa cháy / họng nước vách tường)
  Step 2 — Phiếu kiểm tra: dynamic checklist based on equipment type. Each item has: location, equipment ID, status (đạt/không đạt/cần thay), notes, photo upload
  Step 3 — Tổng kết: summary of items checked, pass/fail ratio, inspector name + date, signature field, submit button
- Submit to Firestore collection 'pcccInspections' (create this collection, add listen/add/update functions to db.ts)
- Add 'PcccInspection' type to src/types/firestore.ts with fields: id, date, month, year, building, floor, equipmentType, inspectorName, inspectorId, items[], overallStatus ('pass'/'fail'/'partial'), notes, photos[]

Wire it up:
- In FireSafetyPage.tsx: add a "Kiểm tra định kỳ" button in the page header
- Add a new tab "Kiểm tra PCCC" (after Inspections tab) that shows a list of past PCCC inspection records with a filter by month/year

Style: match existing FireSafetyPage dark theme. Use Vietnamese labels throughout.
```

---

### P1.4 Legal Document File Upload + Radiation Permits (M08)
**WHY:** Currently legal documents only accept a URL text input — no actual file storage. Calibration certificates and radiation permits must be stored with actual documents. This is a legal requirement for kiểm định pháp lý.

**WHAT:**
1. Replace URL text input with Firebase Storage file upload in `CompliancePage.tsx`
2. Add X-quang/CT radiation permit tracking:
   - New collection `radiationPermits` with fields: deviceId, deviceName, permitNumber, issueDate, expiryDate, issuingAuthority, fileUrl (Storage), status
   - Add "Giấy phép bức xạ" tab or section in CompliancePage
3. Add calibration lab database (VILAS, Cục ATBXHN) as a vendor type or separate collection

**Files:**
- `src/modules/compliance/CompliancePage.tsx` — replace URL inputs with DocUploadZone
- `src/components/ui/DocUploadZone.tsx` — already exists, reuse
- `src/types/firestore.ts` — add `RadiationPermit`, `CalibrationLab` types
- `src/firebase/db.ts` — add CRUD for `radiationPermits`, `calibrationLabs`

**Claude Code prompt:**
```
Improve the Compliance page at d:\GitHub\bms-portal with proper file uploads and radiation permit tracking.

1. In CompliancePage.tsx Legal tab — replace the fileUrl text input in AddLegalDocumentModal with a DocUploadZone component (import from @/components/ui/DocUploadZone). Store uploaded file URL in Firebase Storage under 'compliance/legal/{docId}'. Use storageUpload from @/utils/storageUpload.

2. Add RadiationPermit type to src/types/firestore.ts:
```typescript
export interface RadiationPermit {
  id: string
  deviceId?: string
  deviceName: string
  permitType: 'xray' | 'ct' | 'mri' | 'radiotherapy' | 'other'
  permitNumber: string
  issueDate: Timestamp
  expiryDate: Timestamp
  issuingAuthority: string  // e.g., "Cục An toàn Bức xạ Hạt nhân"
  fileUrl?: string
  status: 'active' | 'expiring' | 'expired'
  notes?: string
}
```

3. Add CRUD functions to src/firebase/db.ts:
- addRadiationPermit, listenRadiationPermits, updateRadiationPermit, deleteRadiationPermit

4. In CompliancePage.tsx: add a new "Giấy phép Bức xạ" tab (after Legal tab) with:
- Table showing all radiation permits with status badges (active/expiring/expired)
- Days-remaining countdown
- Add button opens RadiationPermitModal with fields matching the type above
- Filter by permit type (X-quang/CT/MRI)
- Red alert banner for expired permits

5. Add "Giấy phép Bức xạ" to the page header summary card count.

Style: match existing CompliancePage dark theme. Use Vietnamese labels.
```

---

### P1.5 WWTP Daily Log + Medical Waste Segregation (M12)
**WHY:** Environmental Protection Law requires daily WWTP (Wastewater Treatment Plant) readings with pH, COD, coliform results. NV M&E must record these daily. Medical waste segregation documentation is also legally required.

**WHAT:**
1. Add WWTP Daily Log form in `EnvironmentPage.tsx` (new tab):
   - Daily form fields: date, shift, influent flow (m³/ngày), effluent flow (m³/ngày), pH, COD (mg/L), BOD (mg/L), coliform (MPN/100ml), chlorine residual (mg/L), chemical dosing (type + dose rate), operator name, notes
   - Monthly summary chart (bar chart showing pH/COD trend over 30 days)
   - Alert if pH < 6.5 or > 9.0, COD > 100 mg/L
2. Improve waste log with dedicated forms per category:
   - Medical hazardous: generator facility, license number, manifest number, weight, treatment method
   - General waste: weight, disposal site
   - Recyclable: weight, recycler name, certificate

**Files:**
- `src/modules/environment/EnvironmentPage.tsx` — add WWTP tab
- `src/types/firestore.ts` — add `WwtpDailyLog` type
- `src/firebase/db.ts` — add WWTP CRUD functions
- `src/modules/environment/WwtpLogModal.tsx` — create new modal

**Claude Code prompt:**
```
Add wastewater treatment plant (WWTP) daily log to the Environment module at d:\GitHub\bms-portal.

1. Create src/modules/environment/WwtpLogModal.tsx:
- Modal with form fields: Ngày (date picker, default today), Ca (morning/afternoon/night dropdown), Lưu lượng đầu vào (m³), Lưu lượng đầu ra (m³), pH (number with validation 0-14), COD mg/L, BOD mg/L, Coliform MPN/100ml, Chlorine residual mg/L, Hóa chất khử trùng (text), Liều lượng châm (text), Người vận hành (text), Ghi chú (textarea)
- Real-time validation: highlight pH red if < 6.5 or > 9.0, COD red if > 100
- Save to collection 'wwtpLogs'

2. Add to src/types/firestore.ts:
```typescript
export interface WwtpDailyLog {
  id: string
  date: string  // YYYY-MM-DD
  shift: OperationLogShift
  influentFlow: number
  effluentFlow: number
  ph: number
  cod: number
  bod: number
  coliform: number
  chlorineResidual: number
  chemicalType: string
  chemicalDoseRate: string
  operatorName: string
  notes?: string
  createdBy: string
  createdAt: Timestamp
}
```

3. Add to src/firebase/db.ts:
- addWwtpLog, listenWwtpLogs (by month), updateWwtpLog

4. In EnvironmentPage.tsx: add "Xử lý nước thải" tab between "Nước" and "Chất thải" tabs with:
- Summary cards: today's pH (color-coded), today's COD, compliance rate (samples within limits / total)
- "Ghi nhật ký" button opening WwtpLogModal
- Table of recent 20 logs with pH/COD status badges
- Monthly trend chart (line chart showing pH and COD over 30 days — two lines)

Style: match existing EnvironmentPage. Use Vietnamese labels throughout.
```

---

### P1.6 FIFO/Batch Export Quantity Enforcement (M09)
**WHY:** ExportModal checks aggregate quantity but not batch-specific quantity. A user could export 100 units from a batch that only has 5. This is a data integrity violation for a hospital inventory system.

**WHAT:**
1. Fix ExportModal to validate requested quantity against the **selected batch's quantity**, not the aggregate item quantity
2. Add quantity input in batch selection — show "Còn lại: X" per batch
3. Auto-calculate remaining batch quantity after export
4. Add per-batch transaction record in `inventoryTransactions` with `batchNumber`

**Files:**
- `src/modules/warehouse/WarehousePage.tsx` (ExportModal section) — fix batch quantity validation
- `src/firebase/db.ts` — ensure `updateInventoryQuantity` tracks per-batch quantities (may need new `inventoryBatches` collection)

**Claude Code prompt:**
```
Fix the FIFO batch quantity enforcement bug in WarehousePage.tsx at d:\GitHub\bms-portal.

ISSUE: In ExportModal, when a user selects a batch and enters export quantity, the code validates against selectedItem.quantity (the AGGREGATE item quantity), NOT the specific batch's quantity. A batch with only 5 units can have 100 exported.

FIX:
1. In the ExportModal batch selection section, show "Còn lại trong lô: X {unit}" per batch (not just total available)
2. Add validation: if requestedQty > selectedBatch.quantity, show red error "Số lượng xuất ({requestedQty}) vượt quá số lượng lô ({batchQty})"
3. Disable the "Xuất kho" submit button when quantity exceeds batch quantity
4. After successful export, update the batch's remaining quantity in Firestore. If using aggregate quantity tracking, add a new 'inventoryBatches' collection:
```typescript
// Collection: inventoryBatches
// Fields: id, itemId, batchNumber, quantity (current remaining), expiryDate, importDate, createdAt
```
Add batch decrement on export. The FIFO engine already selects the correct batch — you just need to enforce the quantity.

5. Show batch quantity in the export history table: add a "Lô" column showing batchNumber.

Keep the FIFO/FEFO logic unchanged — it already works correctly.
```

---

## Phase 2 — IMPORTANT
**Estimated: 4–5 sessions** | **Impact: Daily operations + management reporting**

---

### P2.1 Technician KPI Dashboard (M02 + M13)
**WHY:** Trưởng phòng must evaluate staff performance. Currently KPI data exists in `technicianKpi` but the org page has no search, no period picker, and no WO count breakdown.

**WHAT:**
1. Add period picker to OrgPage KPI tab (current month by default, allow past 12 months)
2. Add search by name in KPI table
3. Add per-technician WO breakdown: total assigned / completed / overdue this period
4. Add trend chart (line chart showing score over last 6 months)
5. Add export to CSV for Phó phòng review
6. Fix "Tính lại KPI" button to also trigger on schedule, not just manual

**Files:**
- `src/modules/org/TechnicianKpiTab.tsx` — add period picker + search + WO breakdown columns
- `src/modules/org/OrgPage.tsx` — add KPI tab improvements
- `src/utils/kpiEngine.ts` — verify `computeAllTechnicianKpi` covers all required stats

**Claude Code prompt:**
```
Enhance the Technician KPI tab in OrgPage at d:\GitHub\bms-portal.

1. In TechnicianKpiTab.tsx — add a period picker:
   - Dropdown showing last 12 months + current month
   - Default: current month
   - On change: re-query listenTechnicianKpi(period) and re-render table

2. Add a search input above the KPI table:
   - Filter by name (client-side)

3. Expand the KPI table columns to include:
   - Tổng WO được giao (from woStats.totalAssigned)
   - WO hoàn thành (woStats.totalCompleted)
   - WO quá hạn (woStats.overdue)
   - Tỷ lệ đúng hạn % (woStats.onTimeRate)
   - Thời gian phản hồi TB (responseStats.avgResponseMinutes)

4. Add a trend sparkline in the KPI table: show score trend over last 6 periods using a tiny SVG line chart (no external library)

5. Add CSV export button at the top right of the KPI tab: export all technicians' KPI for the selected period as CSV.

6. Fix the "Tính lại KPI" button: on click, call computeAllTechnicianKpi() for the CURRENT period, show a loading state, show success toast on completion.

Style: match existing OrgPage dark theme. Vietnamese labels.
```

---

### P2.2 Device Lifecycle + Lending Tracker (M07)
**WHY:** Medical devices must be tracked through their full lifecycle (purchase → use → maintenance → disposal). Device lending between departments must be documented. Tổ trưởng must supervise contractors on MRI/CT/lift maintenance.

**WHAT:**
1. Add device lifecycle timeline in DeviceDetailModal:
   - Purchase date, first use date, major maintenance events, disposal date
   - Status flow: `operational` → `maintenance` → `calibration` → `out_of_service` → `retired`
2. Add device lending tracker:
   - Collection `deviceLendings`: lenderId, deviceId, fromDept, toDept, lendDate, expectedReturnDate, actualReturnDate, status
   - "Cho mượn" button in DeviceDetailModal
   - Lending history tab in DeviceDetailModal
3. Add contractor supervision note field to service records:
   - When adding service record, contractor name field → links to vendor
   - Supervisor name field (the Tổ trưởng who supervised)
4. Add "Báo cáo hư hỏng" (damage report) button → creates disposal request pre-filled with device info

**Files:**
- `src/modules/medical-devices/MedicalDevicesPage.tsx` — add lifecycle timeline, lending
- `src/types/firestore.ts` — add `DeviceLending`, `DeviceLifecycleEvent` types
- `src/firebase/db.ts` — add device lending CRUD

**Claude Code prompt:**
```
Add device lifecycle tracking and lending management to MedicalDevicesPage at d:\GitHub\bms-portal\src\modules\medical-devices.

1. Add to src/types/firestore.ts:
```typescript
export interface DeviceLending {
  id: string
  deviceId: string
  deviceName: string
  fromDept: string
  toDept: string
  lendDate: Timestamp
  expectedReturnDate: Timestamp
  actualReturnDate?: Timestamp | null
  status: 'active' | 'returned' | 'overdue'
  requestedBy: string
  requestedByName: string
  approvedBy: string
  notes?: string
}

export interface DeviceLifecycleEvent {
  id: string
  deviceId: string
  eventType: 'purchase' | 'commissioning' | 'maintenance' | 'calibration' | 'transfer' | 'disposal'
  date: Timestamp
  description: string
  performedBy: string
  cost?: number
  documents?: string[]
}
```

2. Add to src/firebase/db.ts:
- addDeviceLending, listenDeviceLendings, updateDeviceLending
- addDeviceLifecycleEvent, listenDeviceLifecycleEvents

3. In DeviceDetailModal — add a 5th tab "Cho mượn / Điều chuyển":
- Show lending history table (deviceLendings filtered by deviceId)
- "Cho mượn" button → opens LendingModal with dept picker, date fields
- Status badges: đang mượn (amber), đã trả (green), quá hạn (red)

4. In DeviceDetailModal Info tab — add a lifecycle timeline section at the bottom:
- Vertical timeline showing: purchase → commissioning → [maintenance events] → current status
- Each event: icon, date, description, cost

5. Wire up the dead "Tạo Work Order BT" footer button → opens MaintenancePage with device pre-filled in new WO modal.

Style: match existing MedicalDevicesPage dark theme.
```

---

### P2.3 BGĐ Monthly Report Template (M13)
**WHY:** Trưởng phòng must report to Board of Directors (BGĐ) monthly. No standardized template exists. The period tabs don't work, making monthly reporting impossible.

**WHAT:**
1. Fix the broken period tabs in ReportsPage — wire `activePeriod` to filter data
2. Create a dedicated `BaoCaoThangModal.tsx` — standardized BGĐ monthly report:
   - Header: hospital name, month/year, report number, prepared by, date
   - Section 1: Tình hình tài sản (asset summary: new acquisitions, disposals, total value)
   - Section 2: Sự cố và xử lý (incidents this month: count by type, resolution time, recurring incidents)
   - Section 3: Bảo trì bảo dưỡng (maintenance: WOs completed, PM completed, average response time, overdue count)
   - Section 4: Chi phí (costs: breakdown by category, vs previous month, vs budget)
   - Section 5: Nhân sự (staff: headcount, training, KPI summary)
   - Section 6: Kiến nghị (recommendations)
   - Print-optimized CSS for government report format
3. Add "Xuất báo cáo BGĐ" button in ReportsPage header

**Files:**
- `src/modules/reports/ReportsPage.tsx` — fix period tabs + add BGĐ button
- `src/modules/reports/BaoCaoThangModal.tsx` — create new component
- `src/types/firestore.ts` — add `MonthlyReport` type

**Claude Code prompt:**
```
Create a standardized BGĐ monthly report template for ReportsPage at d:\GitHub\bms-portal.

1. First fix the broken period tabs in ReportsPage.tsx:
- The Tháng/Quý/Năm tabs set activeTab state but never filter data
- Wire activeTab to filter the reports data: when "Tháng" is selected, filter reports array to current month; "Quý" filters to current quarter; "Năm" filters to current year
- If no matching report exists, show a "Chưa có báo cáo" empty state with "Tạo báo cáo" button

2. Create src/modules/reports/BaoCaoThangModal.tsx:
A full-screen print-optimized report modal with Vietnamese government document styling (blue header, bordered sections):

Header section:
- CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
- Độc lập – Tự do – Hạnh phúc
- BÁO CÁO CÔNG TÁC BẢO TRÌ – THIẾT BỊ Y TẾ
- [Logo placeholder]
- Kỳ báo cáo: Tháng [X] / [YYYY]
- Ngày lập: [today]
- Người lập: [current user name]
- Phòng ban: Phòng Vật tư – Thiết bị

Body sections (auto-populated from Firestore):
1. TÌNH HÌNH TÀI SẢN — new acquisitions this month, disposals, total book value
2. SỰ CỐ VÀ XỬ LÝ — incident count by severity, avg resolution time, recurring incidents
3. BẢO TRÌ BẢO DƯỠNG — WO completed, PM completed, avg response time, overdue
4. CHI PHÍ — breakdown by category from CostData, vs budget comparison
5. KIỂM ĐỊNH – AN TOÀN — calibration due, fire safety inspections, compliance rate
6. NHÂN SỰ – ĐÀO TẠO — avg team KPI score, training records count
7. KIẾN NGHỊ — textarea for manager to fill in

Footer: Signature blocks for Trưởng phòng + Phó phòng

Print button: triggers window.print() with @media print CSS to hide nav/modals.

3. In ReportsPage.tsx: add a "Xuất BC tháng" button in the header. On click, open BaoCaoThangModal.
```

---

### P2.4 Vendor Contract Management + Visit Log (M11)
**WHY:** Tổ trưởng must supervise all contractor visits. Currently there is no visit log. Service scope (SOW) and SLA terms are missing from contracts. Trưởng phòng needs quarterly contractor evaluations.

**WHAT:**
1. Add contractor visit log:
   - Collection `contractorVisits`: vendorId, vendorName, visitDate, purpose, supervisor (Tổ trưởng), technician, workScope, duration, outcome, signOff
   - "Nhật ký giám sát" section in VendorDetailPanel
   - "Thêm lượt giám sát" button in VendorDetailPanel
2. Add SOW (Scope of Work) field per contract:
   - Add `scopeOfWork` text field to Contract type
   - Display SOW in contract detail view
3. Add quarterly evaluation form:
   - Collection `contractorEvaluations`: vendorId, quarter, year, quality score, schedule score, cost score, support score, safety score, overallScore, evaluator, date
   - "Đánh giá" button in VendorDetailPanel → opens evaluation modal
   - Show latest evaluation in vendor card

**Files:**
- `src/modules/vendors/VendorsPage.tsx` — add visit log + evaluation
- `src/types/firestore.ts` — add `ContractorVisit`, `ContractorEvaluation` types
- `src/firebase/db.ts` — add CRUD

**Claude Code prompt:**
```
Enhance VendorsPage at d:\GitHub\bms-portal with contractor visit supervision and quarterly evaluation.

1. Add to src/types/firestore.ts:
```typescript
export interface ContractorVisit {
  id: string
  vendorId: string
  vendorName: string
  visitDate: Timestamp
  purpose: string  // e.g. "Bảo trì MRI", "Sửa chững thang máy"
  supervisorId: string
  supervisorName: string
  technicianName: string
  workScope: string
  duration: number  // hours
  outcome: 'completed' | 'partial' | 'pending'
  signOffBy: string
  signOffAt: Timestamp
  notes?: string
}

export interface ContractorEvaluation {
  id: string
  vendorId: string
  vendorName: string
  quarter: 1 | 2 | 3 | 4
  year: number
  qualityScore: number  // 1-10
  scheduleScore: number
  costScore: number
  supportScore: number
  safetyScore: number
  overallScore: number
  evaluatorId: string
  evaluatorName: string
  evaluatedAt: Timestamp
  notes?: string
}
```

2. Add to src/firebase/db.ts:
- addContractorVisit, listenContractorVisits, updateContractorVisit
- addContractorEvaluation, listenContractorEvaluations, updateContractorEvaluation

3. In VendorDetailPanel (slide-in panel in VendorsPage):
- Add a "Giám sát" tab (after Contracts tab) showing visit history table
- Add "Thêm lượt giám sát" button → opens ContractorVisitModal with fields above
- The supervisor field defaults to current user

4. In VendorsPage Ratings tab:
- Add "Đánh giá định kỳ" section with "Thêm đánh giá" button
- Opens ContractorEvaluationModal: select quarter/year, rate 5 criteria (1-10 slider each), overall auto-calculated, notes, submit
- Store in contractorEvaluations collection

5. Fix the radar chart in Ratings tab — replace fabricated data with actual per-criteria scores from ContractorEvaluation records. If no evaluation exists, show "Chưa có đánh giá" instead of fake data.
```

---

### P2.5 Asset Disposal Full Workflow Fixes (M10)
**WHY:** Several disposal workflow buttons are dead stubs. Asset status doesn't revert on rejection. No signed biên bản upload. No notification to requester.

**WHAT:**
1. Wire the dead "Thực hiện thanh lý" and "Sửa đề xuất" buttons in DisposalRequestDetail
2. On request rejection → revert asset status from `maintenance` back to `active`
3. Add signed document upload for council biên bản — upload scanned signed document to Firebase Storage
4. Send notification to requester when request moves to `in_council` status
5. Add "In biên bản" PDF generation (not just window.print() HTML)

**Files:**
- `src/modules/assets/DisposalRequestDetail.tsx` — wire dead buttons
- `src/modules/assets/DisposalCouncilModal.tsx` — add signed doc upload
- `src/firebase/db.ts` — fix status transitions + notifications

**Claude Code prompt:**
```
Fix the dead buttons and missing features in the asset disposal workflow at d:\GitHub\bms-portal.

1. In DisposalRequestDetail.tsx — wire the dead buttons:
   - "Thực hiện thanh lý" button (status === 'approved'): call the parent's onExecute callback → open DisposalExecutionModal
   - "Sửa đề xuất" button (status === 'draft'): open DisposalRequestModal in edit mode (pass request as prop)
   - "Nộp lại đề xuất mới" (status === 'rejected'): create a NEW DisposalRequest pre-filled with data from the rejected request (clone flow)

2. In DisposalCouncilModal.tsx — add signed minutes upload:
   - In the "Biên bản" (Minutes) tab, add a DocUploadZone for uploading the signed biên bản
   - Store URL in disposalCouncils/{id}.minutesSignedUrl
   - Show "Đã ký" badge with download link when uploaded

3. Fix asset status on rejection:
   - In the function that handles "Từ chối" council vote → call updateAsset(assetId, { status: 'active' })
   - This fixes the bug where rejected requests leave asset stuck in 'maintenance' status

4. Add notification on council creation:
   - When a request moves from 'pending_review' to 'in_council' → createNotification for the requester (requestedBy)
   - Message: "Đề xuất thanh lý [assetName] đã được đưa vào Hội đồng thanh lý ngày [date]"

5. In DisposalCouncilModal — add council quorum enforcement:
   - Require minimum 3 members (already UI-enforced) AND minimum 3 members must vote before "Kết thúc cuộc họp" is enabled
   - Show warning: "Cần ít nhất 3 thành viên biểu quyết trước khi kết thúc"
```

---

### P2.6 Medical Waste Forms + Pest Control (M12)
**WHY:** Medical waste segregation documentation is legally required. Pest control is part of environmental compliance.

**WHAT:**
1. Enhance waste log with category-specific mandatory fields:
   - Medical hazardous: generator facility, waste manifest number, license number, treatment method
   - General waste: volume estimate, disposal contractor
   - Recyclable: recycler name, recycling certificate number
2. Add pest control log:
   - Collection `pestControlLogs`: date, contractor, area, chemical used, method, nextScheduledDate, certificate
   - New "Kiểm soát côn trùng" tab in EnvironmentPage
   - Add button → opens PestControlLogModal

**Files:**
- `src/modules/environment/EnvironmentPage.tsx` — add pest control tab
- `src/modules/environment/PestControlModal.tsx` — create
- `src/types/firestore.ts` — add `PestControlLog` type
- `src/firebase/db.ts` — add CRUD

**Claude Code prompt:**
```
Add pest control log to EnvironmentPage and enhance medical waste forms at d:\GitHub\bms-portal.

1. Create src/modules/environment/PestControlModal.tsx:
- Form fields: Ngày thực hiện, Nhà thầu (vendor picker from vendors collection), Khu vực (multi-select: Kitchen, Warehouse, Wards, Operating theaters, Pharmacy, Exterior), Hóa chất sử dụng, Phương pháp (spray/trap/bait/fumigation), Chứng chỉ số, Ngày thực hiện tiếp theo, Ghi chú
- Save to collection 'pestControlLogs'

2. Add to src/types/firestore.ts:
```typescript
export interface PestControlLog {
  id: string
  date: Timestamp
  contractorId: string
  contractorName: string
  areas: string[]  // ['kitchen', 'warehouse', ...]
  chemicalUsed: string
  method: 'spray' | 'trap' | 'bait' | 'fumigation' | 'other'
  certificateNumber?: string
  nextScheduledDate?: Timestamp
  operatorName: string
  notes?: string
  createdAt: Timestamp
}
```

3. Add to src/firebase/db.ts:
- addPestControlLog, listenPestControlLogs, updatePestControlLog

4. In EnvironmentPage.tsx — add a new "Kiểm soát côn trùng" tab (last tab):
- Summary cards: tổng số lượt, lần gần nhất, lần tiếp theo sắp tới
- Table of pest control logs (last 20)
- "Thêm nhật ký" button → opens PestControlModal
- Red alert if nextScheduledDate < today (overdue pest control)

5. Enhance the waste log form in EnvironmentPage:
   - When category = 'medical_hazardous': require fields generator facility + waste manifest number
   - When category = 'recyclable': require recycler name + certificate number
   - These fields should be visible only when the relevant category is selected (conditional rendering)
```

---

## Phase 3 — Enhancement
**Estimated: 3–4 sessions** | **Impact: Polish + management tooling**

---

### P3.1 Weekly PM Summary Auto-Generation (M04)
**WHY:** Tổ trưởng must compile weekly/monthly PM results for Phó phòng. No auto-generated summary exists.

**WHAT:**
1. Create a weekly summary collection `pmWeeklySummary` with auto-generated content
2. Add "BC tuần/tháng" button in MaintenancePage → generates + downloads summary
3. Include: WO completed, PM completed, avg response time, overdue count, cost breakdown

---

### P3.2 Staff Training Records (M02)
**WHY:** AT-VSLĐ compliance requires training records per staff. Currently no training tracking exists.

**WHAT:**
1. New collection `trainingRecords`: staffId, staffName, trainingType, provider, date, expiryDate, certificateUrl, status
2. Training types: PCCC, AT-VSLĐ, kỹ thuật y tế, an toàn bức xạ
3. "Đào tạo" tab in OrgPage showing training records per staff member
4. Alert when training is expiring within 30 days

---

### P3.3 Civil Daily Patrol + Material Tracking (M06)
**WHY:** NV Xây dựng must log daily patrol inspections and track material storage.

**WHAT:**
1. Daily patrol form: area selection, condition checklist (tường/trần/sàn/cửa/mái/ngoại thất), issues found, photos
2. Material storage tracking: inventory of stored materials (cement, sand, paint, bricks) with location and quantity
3. Contractor supervision log for civil works

---

### P3.4 Tender Evaluation Records (M11)
**WHY:** Trưởng phòng participates in technical tender evaluation. Records must be kept.

**WHAT:**
1. New collection `tenderEvaluations`: tenderId, tenderName, vendorId, technicalScore, priceScore, totalScore, evaluatorId, date, notes
2. Tender evaluation list in VendorsPage or separate module
3. Link to vendor profiles

---

### P3.5 5S Warehouse Compliance (M09)
**WHY:** Warehouse 5S compliance is a hospital standard. No checklist exists.

**WHAT:**
1. New collection `warehouse5sChecks`: date, area, inspector, score (1-5 per S), photos, issues[], status
2. 5S categories: Sort, Set in order, Shine, Standardize, Sustain
3. Monthly 5S score dashboard in WarehousePage

---

### P3.6 SLA Alerts + Escalation (M04)
**WHY:** No SLA timers or escalation. Work orders can sit indefinitely.

**WHAT:**
1. Define SLA thresholds per priority: critical = 2h response, high = 4h, medium = 24h, low = 72h
2. Add SLA countdown timer on WO cards and list
3. Auto-escalate: if SLA breached → notify manager + escalate priority
4. SLA breach log for reporting

---

### P3.7 Slow-Moving Inventory Report (M09)
**WHY:** Phó phòng needs slow-moving inventory report to identify stale stock.

**WHAT:**
1. Define "slow-moving" = no export transaction in last 90 days
2. Add "Hàng chậm luân chuyển" tab in WarehousePage
3. Show: item name, last export date, days since last export, current quantity, value
4. Export to CSV for Phó phòng review

---

### P3.8 Dashboard Quick Actions + Shift Summary (M01)
**WHY:** Dashboard needs quick action buttons and shift summary widget for daily use.

**WHAT:**
1. Add quick action buttons: [Ghi sự cố], [Tạo WO], [Nhật ký vận hành]
2. Add shift summary widget: shows current shift's log status + pending tasks from handover
3. Add "Cập nhật lúc HH:MM" timestamp to dashboard header

---

## Quick Wins (< 1 session — do immediately)

### QW-1: Fix broken period tabs in Reports (5 min)
```typescript
// In ReportsPage.tsx, around line 250 — wire the period state to filter
const filteredReports = period === 'thang'
  ? reports.filter(r => r.month === currentMonth && r.year === currentYear)
  : period === 'quy'
  ? reports.filter(r => r.quarter === currentQuarter && r.year === currentYear)
  : reports.filter(r => r.year === currentYear)
const activeReport = filteredReports[0] || reports[0]
```

### QW-2: Wire dead M07 footer buttons (10 min)
```typescript
// In DeviceDetailModal footer:
// "Tạo Work Order BT" → navigate('/maintenance?deviceId=' + device.id)
// "Xuất PDF" → window.print() with device info
// "Cập nhật" → open AddServiceRecordModal pre-filled
```

### QW-3: Fix M04 sourceFilter not applied (2 min)
```typescript
// In MaintenancePage.tsx filter function (around line 545):
// Add: if (source !== 'all' && wo.source !== source) return false;
// This one line enables the source filter
```

### QW-4: Add M01 quick action buttons (15 min)
```typescript
// In DashboardPage — add below stat cards:
<div className="flex gap-2">
  <button onClick={() => navigate('/infra?tab=log')} className="btn-primary">
    📝 Nhật ký vận hành
  </button>
  <button onClick={() => navigate('/maintenance?new=wo')} className="btn-secondary">
    🔧 Tạo WO
  </button>
</div>
```

### QW-5: Fix M11 radar chart fake data (10 min)
```typescript
// In VendorsPage.tsx — replace radar chart data:
// Use vendorRatings collection per-criteria scores directly
// If no rating exists: show "Chưa có đánh giá" text instead of fabricated numbers
```

### QW-6: Fix M13 MTTR calculation (5 min)
```typescript
// In ReportsPage.tsx — replace fake uptime formula:
// Real MTTR = sum(completedWO.resolvedAt - completedWO.startedAt) / count(completedWO)
// Real uptime = (totalTime - incidentDowntime) / totalTime * 100
```

### QW-7: Add M09 over-quota warning (10 min)
```typescript
// In ExportModal — after quantity input:
// Add: if (requestedQty > approvedQuota) show warning banner
// Add approvedQuota field to inventoryItems collection
```

### QW-8: Fix M10 asset status on rejection (5 min)
```typescript
// In disposal workflow — on request rejected:
// updateAsset(request.assetId, { status: 'active' })
// Add this in the status transition handler for 'rejected'
```

---

## Estimated Completion

| Phase | Sessions | Target Date | Delivered By |
|-------|----------|-------------|--------------|
| QW-1 to QW-8 (Quick Wins) | 1 | 2026-06-07 | Immediate |
| P1.1 Firestore Security | 1 | 2026-06-08 | Security engineer |
| P1.2 PM Auto-Engine | 1 | 2026-06-09 | Claude Code |
| P1.3 PCCC Inspection Form | 1 | 2026-06-10 | Claude Code |
| P1.4 Legal Docs Upload | 1 | 2026-06-11 | Claude Code |
| P1.5 WWTP Daily Log | 1 | 2026-06-12 | Claude Code |
| P1.6 FIFO Batch Fix | 1 | 2026-06-13 | Claude Code |
| **Phase 1 Complete** | **6** | **2026-06-13** | |
| P2.1 KPI Dashboard | 1 | 2026-06-15 | Claude Code |
| P2.2 Device Lifecycle | 1 | 2026-06-16 | Claude Code |
| P2.3 BGĐ Report Template | 1 | 2026-06-17 | Claude Code |
| P2.4 Vendor Visit + Evaluation | 1 | 2026-06-18 | Claude Code |
| P2.5 Disposal Workflow Fixes | 1 | 2026-06-19 | Claude Code |
| P2.6 Medical Waste + Pest | 1 | 2026-06-20 | Claude Code |
| **Phase 2 Complete** | **6** | **2026-06-20** | |
| Phase 3 (Enhancement) | 4 | 2026-07-01 | |
| **Full compliance target** | **~16 sessions** | **2026-07-01** | |
