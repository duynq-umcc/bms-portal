# BMS Portal — Code Audit Prompt (v2, 2026-06)

> **Mục đích:** Đưa prompt này vào một phiên Claude mới (Claude.ai web hoặc Claude Code)
> cùng với toàn bộ codebase để nhận báo cáo audit cập nhật nhất so với tài liệu
> **Phân công nhiệm vụ P.QT-VT_TTB 2026** (hiệu lực 01/03/2026).
>
> **Cách dùng:**
> - **Claude.ai web:** Paste prompt này + upload các file cần thiết (xem mục "Files to include")
> - **Claude Code terminal:** `cat BMS_CODE_AUDIT_PROMPT.md | claude` (từ thư mục repo)
> - **File upload:** Zip toàn bộ `src/` + `firestore.rules` + `package.json` rồi upload cùng prompt

---

## CONTEXT

Bạn là một senior full-stack engineer đang thực hiện code audit cho dự án **bms-umcc1** — một
Building Management System portal cho bệnh viện/phòng khám tư nhân tại Việt Nam.

### Tech stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + TanStack React Query + Recharts + lucide-react
- **Backend/DB:** Firebase (Auth, Firestore, Storage, Cloud Messaging)
- **State:** Zustand
- **Roles:** `admin` | `manager` | `technician` (định nghĩa trong `rolePermissions.ts`)

### Cấu trúc thư mục
```
src/
  modules/          ← 13 module (M01–M13)
  utils/            ← PmEngine, KpiEngine, FifoEngine, AlertEngine
  hooks/            ← TanStack Query hooks
  components/       ← Shared UI components
  stores/           ← Zustand stores
  types/            ← TypeScript types
firestore.rules     ← Firestore security rules
```

### Baseline audit (2026-06-06)
Điểm tổng thể trước đó: **44% / 71 gaps**. Audit này sẽ đo lại điểm sau các thay đổi.

---

## NGHIỆP VỤ CẦN ĐỐI CHIẾU

Hệ thống phải đáp ứng đầy đủ các nhiệm vụ của **Phòng QT-VT_TTB** gồm 4 vị trí:

### Trưởng phòng (Lâm Tứ Hải)
- Hoạch định chiến lược & ngân sách hàng năm
- Thẩm định hồ sơ kỹ thuật / cấu hình thiết bị
- Tham gia ban dự án & hội đồng tư vấn mua sắm
- Kiểm soát báo giá & giải pháp kỹ thuật từ nhà thầu
- Phê duyệt hợp đồng bảo trì (SLA, Scope of Work)
- An toàn & tuân thủ pháp lý (PCCC, ATVSLĐ, bức xạ, môi trường)
- Quản lý tài sản: kiểm kê, điều chuyển, thanh lý
- Quản lý kho & cung ứng (định mức dự trữ an toàn)
- Quản lý dịch vụ thuê ngoài (bảo vệ, diệt côn trùng, bảo trì chuyên sâu)
- Quản trị nhân sự & KPI
- Báo cáo định kỳ lên BGĐ & cơ quan nhà nước

### Phó phòng (Nguyễn Quang Duy)
- Lập kế hoạch bảo trì/bảo dưỡng/kiểm định toàn bộ hệ thống hàng năm
- Vận hành hạ tầng: Điện trung/hạ thế, Nước, HVAC, Khí y tế, Xử lý nước thải
- Quản lý TTBYT: phân phối, hiệu quả sử dụng, tình trạng kỹ thuật
- Chịu trách nhiệm chính PCCC: diễn tập, làm việc Cảnh sát PCCC
- Kiểm soát nhà thầu dịch vụ thuê ngoài
- Quản lý dự án sửa chữa cơ sở vật chất
- Thẩm định mua sắm kỹ thuật
- Kiểm định & pháp lý: đôn đốc thiết bị y tế (X-quang, CT…)
- Xử lý sự cố khẩn cấp (mất điện diện rộng, vỡ ống nước…)
- Tham gia thanh lý tài sản
- Kiểm soát ngân sách bảo trì
- Đào tạo & phân công KPI cho tổ trưởng / nhân viên kỹ thuật
- Báo cáo lên Trưởng phòng & BGĐ
- Giám sát hệ thống XLNT & chất thải y tế

### Tổ trưởng Bảo trì (Phạm Hiếu Nhân)
- Phân công lịch làm việc hàng ngày cho tổ
- Vận hành M&E: điện nguồn, máy phát, bơm nước, điều hòa, thang máy
- Bảo dưỡng định kỳ & sửa chữa nhỏ TTBYT
- Giám sát nhà thầu phụ (MRI, CT, thang máy…)
- Kiểm tra PCCC định kỳ (đầu báo khói, tủ báo cháy, bình CC, họng nước)
- Tiếp nhận & xử lý sự cố kỹ thuật khó
- Sửa chữa dân dụng nhỏ (bóng đèn, vòi nước, cửa, sơn dặm)
- Cập nhật hồ sơ lý lịch máy sau mỗi lần bảo trì/sửa chữa

### Nhân viên Kho (Phạm Thị Vân Khanh)
- Tiếp nhận & kiểm tra hàng nhập kho (so PO, hóa đơn, nhãn mác, số lô, HSD)
- Nhập kho hệ thống (mã hóa, barcode/QR)
- Quản lý xuất kho theo yêu cầu có phê duyệt
- Theo dõi tồn kho thực tế vs định mức
- Cảnh báo hàng sắp hết hạn / sắp dưới định mức
- Quản lý kho FIFO/FEFO
- Hỗ trợ thanh toán: tổng hợp hóa đơn, chứng từ nhập kho
- Báo cáo Nhập–Xuất–Tồn; hàng chậm luân chuyển
- Quản lý thiết bị cho mượn/điều chuyển giữa khoa phòng
- Lưu trữ hồ sơ (phiếu nhập, phiếu xuất, thẻ kho)

---

## NHIỆM VỤ AUDIT

Đọc toàn bộ code trong các file được cung cấp và thực hiện audit theo từng bước dưới đây.
**Không bỏ qua bước nào. Không đưa ra nhận xét chung chung — mọi gap phải ghi rõ file + line.**

---

### BƯỚC 1 — Inventory (Kiểm kê hiện trạng)

Liệt kê những gì **đã có** trong code theo từng module M01–M13:
- Các collection Firestore đang dùng
- Các React component / page chính
- Các hook TanStack Query
- Các engine/utility (`PmEngine`, `FifoEngine`, v.v.)
- Firestore security rules đang apply

Format:
```
### M01 · Dashboard
**Collections:** energyReadings, workOrders, incidents
**Components:** DashboardPage.tsx, SystemStatusGrid.tsx
**Hooks:** useWorkOrders, useIncidents
**Rules:** canReadAll() line 33
```

---

### BƯỚC 2 — Security Audit (Bắt buộc, ưu tiên cao nhất)

Đọc `firestore.rules` và kiểm tra:

1. **canReadAll / canWriteAll holes:** Có rule nào cho phép toàn bộ authenticated user đọc/ghi không?
2. **Role mismatch:** Rule có khớp với `rolePermissions.ts` không?
3. **Subcollection gaps:** Subcollection (ví dụ `serviceHistory`) có được protect riêng không?
4. **Create vs update logic:** Có ai tạo document mà không được phép không? (ví dụ: technician tạo disposalRequest)
5. **Storage rules:** Firebase Storage rules có tồn tại và đúng không?

Output mẫu:
```
[CRITICAL] firestore.rules line 33: canReadAll() cấp quyền đọc TẤT CẢ collections
  cho mọi user xác thực. Cần restrict theo role.
  Fix: match /databases/{db}/documents/{coll}/{doc} {
         allow read: if request.auth != null && request.auth.token.role in ['admin','manager'];
       }
```

---

### BƯỚC 3 — Module Gap Analysis

Với mỗi module M01–M13, so sánh code hiện tại vs nghiệp vụ yêu cầu ở mục "NGHIỆP VỤ CẦN ĐỐI CHIẾU" và điền bảng sau:

```
## M01 · Dashboard
| Yêu cầu nghiệp vụ | Trạng thái | File / Ghi chú |
|---|---|---|
| Quick action buttons (tạo WO, ghi sự cố) | ❌ Thiếu | — |
| Shift summary cuối ca | ❌ Thiếu | — |
| So sánh điện năng theo kỳ | ❌ Thiếu | — |
| System status realtime | ✅ Có | SystemStatusGrid.tsx |
| Cảnh báo sự cố đang mở | ✅ Có | AlertBanner.tsx |
**Điểm: X/Y tính năng = ZZ%**
```

Lặp lại cho tất cả 13 module theo danh sách:
- M01 · Dashboard
- M02 · Sơ đồ tổ chức & nhân sự
- M03 · Vận hành hạ tầng M&E (Điện, Nước, HVAC, Khí y tế, XLNT)
- M04 · Bảo trì CMMS (WO, PM, sự cố)
- M05 · PCCC & An toàn lao động
- M06 · Hạ tầng xây dựng dân dụng
- M07 · Quản lý TTBYT
- M08 · Kiểm định & Pháp lý
- M09 · Kho vật tư (FIFO/FEFO)
- M10 · Tài sản cố định (kiểm kê, điều chuyển, thanh lý)
- M11 · Nhà thầu & dịch vụ thuê ngoài
- M12 · Môi trường (XLNT, chất thải y tế, diệt côn trùng)
- M13 · Báo cáo & KPI

---

### BƯỚC 4 — Bug Hunt (Lỗi logic & UI chết)

Tìm và liệt kê:

1. **Dead buttons / unhandled onClick:** Button có `onClick` nhưng handler rỗng hoặc `console.log` hoặc `TODO`
2. **Fake/hardcoded data:** Biểu đồ, chỉ số, danh sách dùng data cứng thay vì Firestore
3. **Broken state logic:** Tab/filter không hoạt động, state không reset đúng
4. **Engine bugs:**
   - `FifoEngine`: kiểm tra logic so sánh quantity với batch quantity (không phải aggregate)
   - `PmEngine`: có auto-trigger khi login không? Hay chỉ manual?
   - `KpiEngine`: công thức MTTR có đúng không?
   - `AlertEngine`: rule có match với Firestore collection tên thực không?
5. **TypeScript `any` / unsafe cast:** Ghi lại vị trí dùng `as any` hoặc `as unknown as X`
6. **Missing error handling:** `useQuery`/`useMutation` không có `onError` hoặc error UI

Format:
```
[BUG] src/modules/M07/MedicalDevicePage.tsx line 142
  onClick={} — handler rỗng, button "Xem lý lịch" không làm gì.

[BUG] src/modules/M11/VendorPage.tsx line 89
  RadarChart data là mảng hardcode [80,60,70,90,75], không lấy từ Firestore.

[BUG] src/utils/FifoEngine.ts line 67
  Kiểm tra `totalStock < qty` thay vì `batch.quantity < qty` → cho phép xuất
  nhiều hơn số lượng trong batch.
```

---

### BƯỚC 5 — Performance & Code Quality

Kiểm tra nhanh:

1. **N+1 queries:** Có `useQuery` trong loop không?
2. **Missing indexes:** Collection query có `orderBy` + `where` nhưng không có composite index ghi chú không?
3. **Large bundle imports:** Import toàn bộ thư viện thay vì tree-shake (`import _ from 'lodash'`)
4. **useEffect dependency array:** Có dependency bị thiếu (lint warning) không?
5. **Unsubscribed listeners:** `onSnapshot` listener có được cleanup trong useEffect return không?
6. **Missing loading/skeleton states:** Page nào render blank trong khi fetch không?

---

### BƯỚC 6 — Scoring & Prioritization

Tổng hợp thành bảng điểm:

```
| Module | Điểm cũ (06/06) | Điểm mới | Thay đổi | Gap còn lại |
|--------|----------------|----------|----------|-------------|
| M01    | 63%            | ??%      | ↑/↓/=    | N gaps      |
| ...    | ...            | ...      | ...      | ...         |
| TỔNG   | 44%            | ??%      | ±??pp    | N gaps      |
```

Sau đó phân loại gap còn lại:

**🔴 P1 — Phải làm ngay (security / pháp lý / data integrity):**
- Mỗi item: mô tả ngắn + file + ước lượng thời gian

**🟡 P2 — Quan trọng (tính năng chính còn thiếu):**
- Mỗi item: mô tả ngắn + file + ước lượng thời gian

**🟢 P3 — Cải thiện (UX, báo cáo, tối ưu):**
- Mỗi item: mô tả ngắn

**⚡ Quick wins (< 15 phút mỗi cái):**
- Liệt kê các fix nhỏ có thể làm ngay trong 1 phiên

---

### BƯỚC 7 — Output Files

Tạo 2 file tại gốc repo:

#### `AUDIT_REPORT_[DATE].md`
Toàn bộ kết quả từ Bước 1–6.

#### `UPDATE_PLAN_[DATE].md`
Kế hoạch thực thi với format:

```markdown
# Update Plan — BMS Portal [DATE]

## Phase 1 · Critical (1–2 phiên)
### P1.1 · [Tên task]
**File:** src/...
**Thay đổi cần làm:**
- [ ] Bước cụ thể 1
- [ ] Bước cụ thể 2
**Code mẫu:** (nếu có)
```typescript
// Before
// After
```

## Phase 2 · Important (3–4 phiên)
...

## Phase 3 · Enhancement
...

## Quick Wins (làm trước, < 1 phiên)
- [ ] Fix ... tại src/... line ...
```

---

## FILES TO INCLUDE (khi upload)

Cung cấp các file/folder sau để audit đầy đủ:

```
firestore.rules
firestore.indexes.json (nếu có)
src/modules/          ← toàn bộ 13 module
src/utils/            ← PmEngine, FifoEngine, KpiEngine, AlertEngine
src/hooks/            ← tất cả hooks
src/types/            ← types & interfaces
src/stores/           ← Zustand stores
src/components/       ← shared components
rolePermissions.ts (hoặc vị trí tương đương)
package.json
```

**Tối thiểu cần thiết (nếu không thể upload tất cả):**
```
firestore.rules
src/utils/*.ts
src/modules/[module_cần_audit]/
```

---

## OUTPUT FORMAT

- Viết bằng **tiếng Việt** cho mô tả nghiệp vụ và gap
- Viết bằng **tiếng Anh** cho tên file, tên function, code snippet
- Dùng emoji prefix: ✅ Có đủ | 🔶 Có nhưng thiếu | ❌ Chưa có | 🐛 Có bug
- Mỗi gap phải ghi rõ: **file path + line number** (nếu có thể)
- Không viết nhận xét chung chung như "cần cải thiện UX" — phải cụ thể
- Ước lượng thời gian fix theo đơn vị: phút / giờ / phiên (1 phiên ≈ 2–3 giờ)

---

## COLLABORATION RULES (cho phiên làm việc tiếp theo)

Sau khi audit xong, khi tôi yêu cầu fix từng item:
- Viết code hoàn chỉnh, không dùng `// TODO` hay placeholder
- Ưu tiên surgical edit (chỉ thay đổi đúng chỗ cần) thay vì rewrite toàn file
- Không dùng preamble ("Tuyệt vời!", "Câu hỏi hay!") — trả lời thẳng vào vấn đề
- Khi reference file, dùng markdown link: [filename.ts](src/path/filename.ts)
- Không dùng emoji trừ khi tôi dùng trước

---

*Prompt version: 2.0 | Generated: 2026-06-06 | Baseline score: 44% (71 gaps)*
*Repo: d:\GitHub\bms-portal | Stack: React 18 + Firebase + TypeScript*
