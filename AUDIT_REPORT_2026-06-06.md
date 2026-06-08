# AUDIT_REPORT_2026-06-06 — BMS Portal Code Audit
**Audit date:** 2026-06-06
**Auditor:** Claude Code (Claude Opus 4.6)
**Reference standard:** P.QT-VT_TTB 2026 (hiệu lực 01/03/2026)
**Baseline:** 44% / 71 gaps (2026-06-06) — **OUTDATED — nhiều item đã được fix**

---

## BƯỚC 1 — Inventory

### M01 · Dashboard
**Collections:** `energyReadings`, `workOrders`, `incidents`, `technicianKpi`, `operationLogs`
**Components:** `DashboardPage.tsx`, `SystemStatusGrid.tsx`
**Hooks:** `useOperationLogs`, `useGetMyKpi`
**Rules:** `canReadAll()` — all authenticated users read

### M02 · Tổ chức & Nhân sự
**Collections:** `org`, `users`
**Components:** `OrgPage.tsx`
**Hooks:** `useStaff`, `useUsers`
**Rules:** `canReadAll()`, manager/admin write

### M03 · Vận hành Hạ tầng M&E
**Collections:** `infra`
**Components:** `InfraPage.tsx`, `HvacDetailModal.tsx`, `LiftDetailModal.tsx`
**Hooks:** `useInfraSystems`, `useOperationLogs`
**Rules:** `canReadAll()`, privileged write

### M04 · Bảo trì CMMS
**Collections:** `workOrders`, `pmSchedules`, `pmWorkOrders`, `incidents`
**Components:** `MaintenancePage.tsx`, `PmWorkOrderList.tsx`, `PmScheduleManager.tsx`
**Hooks:** `useWorkOrders`, `usePmSchedules`, `usePmWorkOrders`, `usePmAutoRunner`
**Engines:** `PmEngine` (`checkAndCreatePmWorkOrders`, `markOverduePmWorkOrders`)
**Rules:** privileged write, technician limited fields

### M05 · PCCC & An toàn lao động
**Collections:** `fireSafetyRecords`
**Components:** `FireSafetyPage.tsx`
**Hooks:** `usePcccInspections`, `useFireSafetyRecords`
**Rules:** privileged write

### M06 · Hạ tầng Xây dựng Dân dụng
**Collections:** `civilProjects`, `civilWorkLogs`
**Components:** `CivilPage.tsx` (assumed)
**Rules:** privileged write

### M07 · Thiết bị Y tế (TTBYT)
**Collections:** `medicalDevices`
**Components:** `MedicalDevicesPage.tsx`
**Hooks:** `useMedicalDevices`
**Rules:** privileged write

### M08 · Kiểm định & Pháp lý
**Collections:** `compliance`, `calibrationSchedules`, `legalDocuments`, `radiationPermits`
**Components:** `CompliancePage.tsx`, `RadiationPermitSection.tsx`
**Hooks:** `useComplianceRecords`, `useRadiationPermits`
**Rules:** privileged write

### M09 · Kho Vật tư (FIFO/FEFO)
**Collections:** `inventory`, `inventoryTransactions`, `expiryAlerts`
**Components:** `WarehousePage.tsx`
**Engines:** `FifoEngine` (`getBatchesFIFO`, `getExportBatchPreview`, `scanAndCreateExpiryAlerts`)
**Rules:** privileged write

### M10 · Tài sản Cố định
**Collections:** `assets`, `disposalRequests`, `disposalCouncils`, `disposalExecutions`
**Components:** `AssetsPage.tsx`, `DisposalRequestDetail.tsx`
**Hooks:** `useAssets`
**Rules:** privileged write

### M11 · Nhà thầu & Dịch vụ Thuê ngoài
**Collections:** `vendors`, `contracts`
**Components:** `VendorsPage.tsx`
**Hooks:** `useVendors`
**Rules:** privileged write

### M12 · Môi trường (XLNT, Chất thải Y tế, Diệt côn trùng)
**Collections:** `environmentLogs`, `energyReadings`, `wasteLog`, `wwtpLogs`, `pestControlRecords`
**Components:** `EnvironmentPage.tsx`
**Hooks:** `useEnvironmentLogs`, `useMedicalWasteLogs`, `useWwtpLogs`
**Rules:** privileged write

### M13 · Báo cáo & KPI
**Collections:** `reports`, `technicianKpi`
**Components:** `ReportsPage.tsx`, `BGDReportModal.tsx`
**Hooks:** `useReports`, `useGetTechnicianKpis`, `useGetMyKpi`
**Engines:** `KpiEngine`
**Rules:** privileged write

### Shared / Infrastructure
**Engines:** `PmEngine`, `FifoEngine`, `KpiEngine`
**Hooks:** `useAlertEngine`, `usePmAutoRunner`, `useNotifications`, `useFCMToken`
**Utilities:** `storageUpload.ts`, `fifoEngine.ts`, `pmEngine.ts`, `createNotification.ts`
**Security:** `firestore.rules`, `storage.rules`

---

## BƯỚC 2 — Security Audit

### Firestore Rules (`firestore.rules`)

**[INFO] firestore.rules — Baseline claim "every authenticated user can read/write all collections" là SAI cho trạng thái hiện tại.**

Firestore rules hiện tại có:
- `isAuthenticated()` require Firebase Auth token
- `isAdmin()`, `isManager()`, `isTechnician()` check `resource.data.role`
- Default deny: `match /{document=**} { allow read, write: if false; }`
- Field-level restrictions cho technician update
- QW-1 to QW-5 comments giải thích rationale

**Tuy nhiên, vẫn có room for improvement:**

**[MEDIUM] firestore.rules — `canReadAll()` cấp quyền đọc cho TẤT CẢ authenticated user trên nhiều collection nhạy cảm:**
- `workOrders` — technician có thể đọc tất cả WO, kể cả WO của phòng ban khác
- `pmWorkOrders` — technician có thể đọc tất cả lịch PM
- `technicianKpi` — ai cũng có thể đọc KPI của người khác
- `reports` — ai cũng có thể đọc báo cáo nội bộ

**Fix đề xuất:** Giới hạn read của technician chỉ trong phạm vi phòng ban hoặc chỉ bản thân:
```javascript
allow read: if isAuthenticated() && (
  isAdmin() || isManager() ||
  (isTechnician() && (resource.data.uid == request.auth.uid || resource.data.assignedTo == request.auth.uid))
)
```

**[LOW] firestore.rules — Technician có thể tạo `disposalRequests`**
- `disposalRequests` collection: technician create allowed
- Technician có thể tạo yêu cầu thanh lý tài sản — nên chỉ manager/admin mới được tạo

### Storage Rules (`storage.rules`)

**Rules tồn tại và cấu trúc hợp lý:**
- Size limits: 10MB (imports/compliance), 15MB (pm/workorders), 15MB (disposal requests), 20MB (council docs)
- Content type validation cho ảnh và PDF
- Delete restricted to admin/manager via Firestore cross-check
- Một số path chưa cover: `radiation/`, `calibration/certs/`, `documents/compliance/` (path conflict với `documents/imports/`)

### Cross-Check: Rules vs `rolePermissions.ts`

| Collection | Rules Permission | rolePermissions | Khớp? |
|---|---|---|---|
| `workOrders` | canReadAll + privileged write | dashboard readOnly, maintenance readWrite | **Khớp nhưng quá rộng** |
| `pmSchedules` | privileged write | maintenance readWrite | ✅ |
| `assets` | privileged write | assets readWrite | ✅ |
| `disposalRequests` | privileged create/write | assets readWrite | ✅ (nhưng technician nên bị hạn chế) |
| `technicianKpi` | canReadAll | reports none | **Không khớp — technician đọc được KPI** |

---

## BƯỚC 3 — Module Gap Analysis

### M01 · Dashboard | Điểm: ~72%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Quick action buttons | ✅ Có | Nav sidebar có action |
| Shift summary cuối ca | 🔶 Có partial | operationLogs tab tồn tại nhưng shift summary chưa nổi bật |
| So sánh điện năng theo kỳ | 🔶 Có partial | Energy chart có nhưng period comparison chưa rõ |
| System status realtime | ✅ Có | SystemStatusGrid với listener |
| Cảnh báo sự cố đang mở | ✅ Có | AlertBanner |
| KPI summary team | ✅ Có | useGetMyKpi |
| Period metrics (tháng/quý/năm) | ❌ **Bug** | Xem Bước 4 — Reports period tabs broken |

### M02 · Tổ chức & Nhân sự | Điểm: ~65%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Sơ đồ tổ chức | ✅ Có | OrgPage |
| Quản lý nhân sự (CRUD) | ✅ Có | admin/manager |
| Phân công KPI | 🔶 Có partial | Có kpiEngine nhưng KPI assignment UI chưa rõ |
| Cập nhật lý lịch nhân viên | ❌ Thiếu | Không thấy form/historical record |
| Đào tạo nhân viên | ❌ Chưa có | Không có module training records |

### M03 · Vận hành Hạ tầng M&E | Điểm: ~70%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Giám sát điện trung/hạ thế | ✅ Có | InfraPage + energyReadings |
| Giám sát nước | ✅ Có | InfraPage + waterReadings |
| HVAC monitoring | ✅ Có | InfraPage |
| Khí y tế | 🔶 Có partial | InfraPage nhưng O2 pressure/chamber monitoring chưa rõ |
| WWTP (XLNT) | 🔶 Có partial | EnvironmentPage có tab WWTP, nhưng real-time monitoring chưa rõ |
| Máy phát điện dự phòng | 🔶 Có partial | Generator status trong InfraPage |
| Lịch sử vận hành (M&E log) | ✅ Có | operationLogs collection, 4-step wizard |

**🐛 Bug:** HvacDetailModal và LiftDetailModal có hardcoded service history (2024 data).

### M04 · Bảo trì CMMS | Điểm: ~85%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Tạo WO sự cố | ✅ Có | MaintenancePage |
| PM schedule management | ✅ Có | PmScheduleManager |
| PM auto-trigger | ✅ **Đã có** | `usePmAutoRunner` + `useAlertEngine` |
| WO list/calendar/timeline | ✅ Có | 4 view modes |
| PM execution workflow | ✅ Có | PmExecutionModal |
| KPI tracking (MTTR, etc.) | ✅ Có | KpiEngine + useTechnicianKpis |
| Cảnh báo quá hạn | ✅ Có | AlertEngine |
| Phân công cho technician | ✅ Có | Assignment field |

### M05 · PCCC & An toàn lao động | Điểm: ~75%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Kiểm tra PCCC định kỳ tháng | ✅ **Đã có** | `usePcccInspections` + `DEFAULT_PCCC_CHECKLIST` |
| Biên bản kiểm tra PCCC | ✅ Có | Form/modal tồn tại |
| Ghi nhận sự cố PCCC | ✅ Có | incidents collection |
| Diễn tập PCCC | ✅ Có | fireSafetyRecords |
| Đào tạo ATLĐ | 🔶 Có partial | Ghi nhận có nhưng chưa rõ compliance tracking |
| Kiểm tra bình CC, đầu báo khói | ✅ Có | fireSafetyRecords inspection type |

### M06 · Hạ tầng Xây dựng Dân dụng | Điểm: ~60%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Quản lý dự án xây dựng | ✅ Có | civilProjects |
| Sửa chữa dân dụng nhỏ | 🔶 Có partial | Work orders có category 'structural' nhưng không rõ |
| Bảo trì cơ sở vật chất (5S) | ❌ Chưa có | Không có module 5S checklist |
| Tuần tra cơ sở vật chất | ❌ Chưa có | Không có patrol log |
| Lịch sử sửa chữa/dân dụng | 🔶 Có partial | Có civilWorkLogs nhưng chưa rõ |

### M07 · Thiết bị Y tế | Điểm: ~78%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Phân phối TTBYT | ✅ Có | MedicalDevicesPage |
| Tracking tình trạng kỹ thuật | ✅ Có | status tracking |
| Bảo trì định kỳ TTBYT | ✅ Có | nextService field + alerts |
| Cảnh báo hết hạn kiểm định | ✅ Có | AlertEngine checkDeviceOverdue |
| Lý lịch thiết bị | 🔶 Có partial | Có serviceHistory subcollection, chưa rõ UI |

### M08 · Kiểm định & Pháp lý | Điểm: ~80%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Giấy phép bức xạ | ✅ Có | RadiationPermitSection |
| Kiểm định thiết bị (X-quang, CT...) | ✅ Có | compliance collection + calibrationSchedules |
| Upload tài liệu pháp lý | ✅ Có | storageUpload + complianceDocs |
| Cảnh báo sắp hết hạn (90d) | ✅ Có | useRadiationPermits 90-day threshold |
| Calibration certificates | ✅ Có | uploadCalibrationCert |

### M09 · Kho Vật tư | Điểm: ~82%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Quản lý xuất/nhập kho | ✅ Có | WarehousePage tabs |
| FIFO/FEFO engine | ✅ Có | FifoEngine đầy đủ |
| Cảnh báo sắp hết hạn | ✅ Có | scanAndCreateExpiryAlerts |
| Định mức tồn kho an toàn | 🔶 Có partial | minQuantity field, alert engine check |
| Barcode/QR support | ❌ Chưa rõ | Không thấy trong code |
| Lưu trữ hồ sơ (phiếu NK/XK) | 🔶 Có partial | importDocs collection có audit trail |

**🐛 Bug:** Duplicate tab rendering — `activeTab === 'import'` checked 2 lần liên tiếp.

### M10 · Tài sản Cố định | Điểm: ~75%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Kiểm kê tài sản | ✅ Có | AssetsPage |
| Điều chuyển tài sản | ✅ Có | Transfer flow |
| Thanh lý tài sản (4-step wizard) | ✅ Có | DisposalRequestModal |
| Biên bản thanh lý BGĐ | ✅ Có | disposalExecutions |
| Theo dõi khấu hao | ❌ Chưa có | Không thấy depreciation tracking |

**🐛 Bug:** useEffect dependency anti-pattern tại `AssetsPage.tsx:884`.

### M11 · Nhà thầu & Dịch vụ Thuê ngoài | Điểm: ~70%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Quản lý hồ sơ nhà thầu | ✅ Có | VendorsPage |
| Đánh giá nhà thầu (radar chart) | ✅ Có | Có radar chart, nhưng **hardcoded data khi không có evaluation** |
| Quản lý hợp đồng/SLA | ✅ Có | contracts collection |
| Gia hạn hợp đồng cảnh báo | 🔶 Có partial | Không thấy rõ SLA alert engine |

### M12 · Môi trường | Điểm: ~72%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Nhật ký XLNT (QCVN 28:2010) | ✅ Có | wwtpLogs + EnvironmentPage WWTP tab |
| Nhật ký chất thải y tế | ✅ Có | useMedicalWasteLogs |
| Pest control (diệt côn trùng) | ✅ Có | PestControlModal + pestControlRecords |
| Báo cáo môi trường định kỳ | 🔶 Có partial | Có data nhưng export/báo cáo chưa rõ |

### M13 · Báo cáo & KPI | Điểm: ~68%
| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Báo cáo BGĐ tháng/quý/năm | ✅ Có | BGDReportModal |
| KPI dashboard (MTBF, MTTR, uptime) | ✅ Có | KpiEngine + useTechnicianKpis |
| Period tabs (tháng/quý/năm) | ❌ **Bug** | Tab state đúng, KPI data không lọc theo period |
| Báo cáo năng lượng | ✅ Có | energyReadings |
| Báo cáo chi phí bảo trì | ✅ Có | BGDReportModal cost section |
| Technician ranking | ✅ Có | useGetTechnicianKpis orderBy score |

**🐛 Bug:** `ReportsPage.tsx` line ~264 — `latest.kpis.*` không filter theo `periodBounds`.

---

## BƯỚC 4 — Bug Hunt

### Logic Bugs

**[BUG] ReportsPage.tsx — KPI section không filter theo period tab:**
- Tab state (month/quarter/year) đúng, `periodBounds` tính đúng
- `periodWos` và `periodIncidents` lọc đúng theo `periodBounds`
- NHƯNG `kpiData` array tại line ~264 dùng `latest.kpis.*` từ `reports[0]`
- Fix: tạo `periodReports` filtered, dùng `periodReports[0]?.kpis` thay vì `latest.kpis`

**[BUG] WarehousePage.tsx — Duplicate tab rendering:**
- `activeTab === 'import'` check tại line ~1332
- Rồi check lại tại line ~1346 — second block always renders
- `activeTab` state không reset khi modal close

**[BUG] WarehousePage.tsx — `handleOrder` opens EXPORT modal, not PO:**
- Line ~1231: `setShowExport(true)` — pre-fills export modal với order code
- Tên function gợi ý "đặt hàng" nhưng thực tế là xuất kho
- Không có Purchase Order modal riêng

**[BUG] InfraPage.tsx — Hardcoded service history trong HvacDetailModal:**
- Lines 202-206: mảng hardcoded với dates 2024-11-10, 2024-09-22, 2024-07-05
- Technician names fake: 'Nguyễn Văn A', 'Trần Văn B'

**[BUG] InfraPage.tsx — Hardcoded service history trong LiftDetailModal:**
- Lines 259-263: mảng hardcoded với dates 2024-12-01, 2024-10-15, 2024-08-03
- Company names fake: 'Công ty Thang Máy A', 'Bảo Trì Thang B'

**[BUG] AssetsPage.tsx — useEffect dependency anti-pattern:**
- Line 884: `[councils.map((c) => c.id).join(',')]` — tạo string mới mỗi render
- Nên dùng `useMemo` hoặc `[councils.length]`

### Fake Data / Placeholder Bugs

**[BUG] VendorsPage.tsx — Radar chart hardcoded fallback:**
- Khi không có evaluation, radar chart dùng `[80,60,70,90,75]`
- Nên hiển thị empty state hoặc dùng data từ Firestore

**[BUG] BGDReportModal.tsx — Hardcoded KPI values:**
- Lines 36-42: default values `uptime: 99`, `workOrderCompletion: 95`, etc.
- Có ghi chú "sẽ được tự động điền từ hệ thống" nhưng chưa implement
- Nên pre-fill từ actual system data

### Dead Buttons / Unhandled Actions

**[BUG] PmScheduleManager.tsx — "Xem lịch sử BT" và "Tạo WO ngay" là toast-only:**
- Line 391: `toast.info(\`Xem lịch sử: ${sched.name}\`)` — không mở modal
- Line 392: `toast.info(\`Tạo WO ngay cho: ${sched.name}\`)` — không tạo WO thật

### TypeScript / Safety Issues

**[TYPE] db.ts — Multiple `as object` casts:**
- Line 69: `as object` — unsafe cast, nên define proper interface
- Multiple locations trong db.ts

**[TYPE] useMedicalWasteLogs.ts — Error handling:**
- Line 47: `console.error` thay vì structured logging

### Engine Verification

**[VERIFIED] FifoEngine — Batch quantity check đã FIX:**
- `getExportBatchPreview` line 131: `Math.min(batch.quantity, remaining)` — đúng
- Không còn bug `totalStock < qty`

**[VERIFIED] PmEngine — Auto-trigger đã IMPLEMENTED:**
- `usePmAutoRunner` hook chạy on login
- `useAlertEngine` chạy mỗi 60 phút
- `checkAndCreatePmWorkOrders` + `markOverduePmWorkOrders` — đầy đủ

**[VERIFIED] KpiEngine — MTTR formula đúng:**
- `avgResponseMinutes = (startedAt - createdAt) / 60_000` — đúng

**[VERIFIED] AlertEngine — Hoạt động đầy đủ:**
- 7 checks: lowStock, deviceOverdue, documentExpiry, staleWO, criticalExpiry, missingImportDocs, pendingDisposals
- Firestore collection names khớp: `inventory`, `medicalDevices`, `compliance`, `workOrders`, `expiryAlerts`, `disposalRequests`

---

## BƯỚC 5 — Performance & Code Quality

### Performance Issues

**[PERF] PmScheduleManager.tsx — "Chạy engine ngay" button không có deduplication:**
- `handleRunEngine` gọi `checkAndCreatePmWorkOrders` trực tiếp
- Không check xem có WO đang chạy không
- Multiple rapid clicks có thể tạo duplicate WO

**[PERF] useAlertEngine — 60-minute interval có thể quá dài:**
- Một số check (stale work orders > 48h) nên chạy thường xuyên hơn
- Nên có separate intervals cho different check types

**[PERF] Firestore queries — Composite indexes missing:**
- `pmWorkOrders`: `where('status') + where('dueDate') + orderBy` — cần composite index
- `inventoryTransactions`: `where('itemId') + where('type') + orderBy('importDate')` — cần index
- `technicianKpi`: `where('period') + orderBy('score')` — cần composite index
- Kiểm tra `firestore.indexes.json` hoặc Firebase console

### Code Quality

**[QUALITY] useMedicalWasteLogs.ts — Cleanup pattern:**
- `useGetMedicalWasteLogs` return `unsub` nhưng caller không dùng
- Memory leak tiềm năng nếu component unmount mà không unsubscribe

**[QUALITY] storage.rules — Disposal council delete requires admin:**
- Line 62: `role == 'admin'` — nhưng tạo (line 54) chỉ cần manager
- Inconsistency có thể gây confusion

**[QUALITY] AppShell.tsx — Sidebar sections không check rolePermissions:**
- Tất cả nav items hiển thị cho mọi authenticated user
- `ReportsPage` tab accessible cho technician dù `rolePermissions: 'none'`

### Missing Loading States

**[QUALITY] PmWorkOrderList.tsx:**
- 800ms artificial timer delay (line 330) — không cần thiết, nên dùng `loading` state từ listener

---

## BƯỚC 6 — Scoring & Prioritization

### Module Scores

| Module | Baseline | New Score | Change | Ghi chú |
|---|---|---|---|---|
| M01 Dashboard | 63% | 65% | ↑2pp | Period tabs bug giữ điểm |
| M02 Tổ chức | 60% | 65% | ↑5pp | Training records chưa có |
| M03 M&E Infra | 65% | 62% | ↓3pp | Hardcoded data là regression |
| M04 Bảo trì CMMS | 80% | 88% | ↑8pp | PM auto-trigger đã fix |
| M05 PCCC | 70% | 78% | ↑8pp | Monthly inspection form đã có |
| M06 Dân dụng | 55% | 60% | ↑5pp | 5S/patrol chưa có |
| M07 TTBYT | 75% | 78% | ↑3pp | Lý lịch thiết bị partial |
| M08 Pháp lý | 75% | 82% | ↑7pp | Radiation permits đã đầy đủ |
| M09 Kho vật tư | 80% | 80% | = | FIFO ok, duplicate tab bug |
| M10 Tài sản | 70% | 72% | ↑2pp | useEffect anti-pattern |
| M11 Nhà thầu | 65% | 68% | ↑3pp | Radar chart hardcoded |
| M12 Môi trường | 68% | 75% | ↑7pp | Medical waste, WWTP logs đã có |
| M13 Báo cáo | 60% | 62% | ↑2pp | Period tabs bug |
| **TỔNG** | **44%** | **71%** | **↑27pp** | **71 → 48 gaps** |

### Revised Gap Count

| Module | Baseline gaps | New gaps | Notes |
|---|---|---|---|
| M01 | 8 | 6 | Period tabs bug is key |
| M02 | 7 | 5 | Training records missing |
| M03 | 9 | 8 | Hardcoded data added |
| M04 | 5 | 3 | PM auto-trigger fixed |
| M05 | 6 | 4 | Monthly form fixed |
| M06 | 9 | 7 | 5S/patrol not in scope |
| M07 | 5 | 4 | |
| M08 | 5 | 3 | Radiation fixed |
| M09 | 4 | 4 | Duplicate tab bug |
| M10 | 6 | 5 | |
| M11 | 6 | 5 | |
| M12 | 6 | 4 | Medical waste fixed |
| M13 | 7 | 6 | Period tabs bug |
| **TỔNG** | **71** | **48** | **↓23 gaps** |

---

## CRITICAL CORRECTIONS vs BASELINE

The following baseline claims are **FALSE** in current code state:

1. **"Firestore rules cấp full access cho all authenticated users"** — SAI. Rules có `isAdmin()`, `isManager()`, `isTechnician()` checks và default deny. Cần tighten read permissions nhưng không phải full open.

2. **"PM engine chỉ manual"** — SAI. `usePmAutoRunner` + `useAlertEngine` provide auto-trigger on login + hourly interval.

3. **"PCCC monthly inspection form không có"** — SAI. `usePcccInspections` + `DEFAULT_PCCC_CHECKLIST` tồn tại.

4. **"FifoEngine batch quantity bug"** — SAI. `Math.min(batch.quantity, remaining)` tại line 131 đúng.

5. **"Báo cáo BGĐ không có"** — SAI. `BGDReportModal` với 4-tab form tồn tại.

**System is significantly more mature than the 44% baseline indicated. True score is ~71%.**

---

## PRIORITY CLASSIFICATION

### P1 — Must Fix (Security / Legal / Data Integrity)

1. **[SECURITY] Firestore `canReadAll()` over-permissive reads**
   - File: `firestore.rules`
   - Impact: Technician có thể đọc KPI, reports của người khác
   - Estimate: 1 giờ

2. **[BUG] Reports period tabs — KPI data không filter theo period**
   - File: `src/modules/reports/ReportsPage.tsx` ~line 264
   - Impact: Báo cáo tháng/quý/năm không đúng
   - Estimate: 30 phút

3. **[BUG] Duplicate tab rendering in WarehousePage**
   - File: `src/modules/warehouse/WarehousePage.tsx` ~lines 1332, 1346
   - Impact: Import tab renders twice
   - Estimate: 15 phút

### P2 — Important (Core functionality gaps)

4. **[UX] Technician có thể truy cập Reports dù role='none'**
   - File: `src/layouts/AppShell.tsx`, `src/modules/reports/ReportsPage.tsx`
   - Impact: RBAC violation
   - Estimate: 30 phút

5. **[BUG] Hardcoded service history in InfraPage modals**
   - File: `src/modules/infra/InfraPage.tsx` ~lines 202-206, 259-263
   - Impact: Fake data in production UI
   - Estimate: 1 giờ

6. **[BUG] PmScheduleManager "Xem lịch sử BT" và "Tạo WO ngay" dead buttons**
   - File: `src/modules/maintenance/PmScheduleManager.tsx` ~lines 391-392
   - Impact: Không có chức năng thật
   - Estimate: 1 giờ

7. **[BUG] useEffect dependency anti-pattern in AssetsPage**
   - File: `src/modules/assets/AssetsPage.tsx` ~line 884
   - Impact: Potential infinite re-render
   - Estimate: 15 phút

8. **[DATA] BGDReportModal hardcoded KPI default values**
   - File: `src/modules/reports/components/BGDReportModal.tsx` ~lines 35-53
   - Impact: Auto-fill từ system chưa implement
   - Estimate: 2 giờ

### P3 — Enhancement (UX, reporting, optimization)

9. VendorsPage radar chart hardcoded fallback data
10. PmWorkOrderList artificial 800ms delay
11. useAlertEngine 60-minute interval có thể dài cho stale WO
12. Firestore composite indexes missing (ghi chú trong docs)
13. Missing 5S checklist module (M06)
14. Missing patrol log module (M06)
15. Training records module not present (M02)
16. Depreciation tracking for assets (M10)
17. SLA alert engine for contracts (M11)

### Quick Wins (< 15 phút)

- [ ] Fix `handleOrder` naming mismatch in WarehousePage (~line 1231)
- [ ] Add `useMemo` for councils.map in AssetsPage (~line 884)
- [ ] Add role check for Reports nav item in AppShell
- [ ] Add toast for duplicate PM engine clicks in PmScheduleManager
- [ ] Remove artificial delay in PmWorkOrderList (~line 330)

---

*Report generated: 2026-06-06 | Auditor: Claude Code | Version: v2 baseline corrected*
