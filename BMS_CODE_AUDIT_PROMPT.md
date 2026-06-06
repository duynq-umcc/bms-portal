# 🔍 BMS-UMCC1 — Full Code Audit & Optimization Prompt
> Feed toàn bộ prompt này vào Claude Code session mới với codebase đã load sẵn.
> Mục tiêu: kiểm tra toàn bộ code, tối ưu performance, đảm bảo production-ready trên Vercel + Firebase Firestore.

---

## 📋 CONTEXT DỰ ÁN

```
Project     : bms-umcc1 (BMS Hospital Portal)
Stack       : React 18 + TypeScript + Tailwind CSS + Vite
State       : Zustand + TanStack Query
Database    : Firebase Firestore
Auth        : Firebase Auth
Deploy      : Vercel (frontend static) — hiện tại KHÔNG dùng Firebase Hosting
Backend API : Express (Vercel Serverless Functions) hoặc trực tiếp Firestore SDK từ frontend
PWA         : vite-plugin-pwa (generateSW mode)
Modules     : 13 modules (Dashboard, Org, Infra, Maintenance, Fire Safety, Civil,
              Medical Devices, Calibration, Warehouse, Assets, Vendors,
              Environment, Reports)
```

---

## 🎯 NHIỆM VỤ AUDIT — THỰC HIỆN THEO THỨ TỰ

### PHASE 1 — SCAN & INVENTORY

**1.1 Quét toàn bộ codebase, liệt kê:**
```
- Tất cả files trong src/ theo cấu trúc cây thư mục
- Số lượng components, pages, hooks, stores, utils
- Dependencies trong package.json (chia: production vs devDependencies)
- TypeScript config (tsconfig.json)
- Vite config hiện tại
```

**1.2 Phát hiện code smells:**
```
- Files > 500 lines → cần tách nhỏ
- Components > 200 lines → cần tách
- Any file có `// TODO`, `// FIXME`, `// HACK` → liệt kê
- Console.log còn sót trong production code → liệt kê file + line
- Hardcoded strings (URLs, IDs, secrets) → liệt kê
- Dead code (functions/components không được import ở đâu cả)
```

---

### PHASE 2 — TYPESCRIPT AUDIT

**2.1 Type safety:**
```
Tìm và fix tất cả:
- any type không có lý do → thay bằng type cụ thể
- as any casting → thay bằng proper typing
- Non-null assertion (!) dùng bừa bãi → thay bằng optional chaining (?.)
- Missing return types trên functions
- Props interface chưa đầy đủ
```

**2.2 Tạo/cập nhật shared types:**
```
Kiểm tra src/types/ (hoặc tạo nếu chưa có):
- Tạo types cho tất cả 13 modules Firestore collections
- Tạo ApiResponse<T> generic type
- Tạo PaginationParams, FilterParams shared types
- Export tất cả từ src/types/index.ts
```

**2.3 Báo cáo:**
```
- Số lượng TypeScript errors hiện tại (chạy: tsc --noEmit)
- Danh sách errors theo severity: error / warning
- Fix tất cả errors, còn warnings thì giải thích
```

---

### PHASE 3 — FIREBASE FIRESTORE AUDIT

**3.1 Firestore config:**
```
Kiểm tra src/lib/firebase.ts hoặc src/config/firebase.ts:
- Firebase app chỉ initialize 1 lần (guard: if (!getApps().length))
- Environment variables đúng tên (VITE_FIREBASE_*)
- Không có hardcoded API keys
- Firestore rules awareness: client-side SDK có cần rules không?
```

**3.2 Query patterns:**
```
Tìm tất cả Firestore queries trong codebase:
- collection() / doc() calls
- getDocs() / getDoc() / onSnapshot() usage
- where() / orderBy() / limit() có đầy đủ không
- Missing .limit() trên large collections → có thể gây performance issues
- N+1 query problems (loop bên trong loop gọi Firestore)
- onSnapshot listeners có cleanup trong useEffect return không?
```

**3.3 Data layer:**
```
Kiểm tra pattern:
- Có centralized service layer (src/services/) không?
- Nếu gọi Firestore trực tiếp trong components → tách ra hooks/services
- TanStack Query có được dùng đúng cách để cache Firestore data không?
- queryKey patterns có consistent không?
- staleTime / gcTime có được set hợp lý không?
```

**3.4 Tạo Firestore indexes list:**
```
Liệt kê tất cả compound queries cần composite index:
Format: Collection | Fields | Order
→ Tạo file firestore.indexes.json nếu chưa có
```

---

### PHASE 4 — PERFORMANCE AUDIT

**4.1 Bundle analysis:**
```
Chạy: npm run build
Liệt kê các chunks và size:
- Chunks > 300KB → suggest code splitting
- Kiểm tra vite.config.ts manualChunks có đúng không:
  manualChunks phải dùng OBJECT SYNTAX (không phải function)
  để tránh circular dependency gây React duplicate instance
  
  ✅ ĐÚNG:
  manualChunks: {
    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
    'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
    'charts': ['recharts'],
    'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
    'utils': ['date-fns', 'zustand', '@tanstack/react-query', 'lucide-react'],
  }
  
  ❌ SAI (gây lỗi blank page trên production):
  manualChunks(id) { if (id.includes('react')) return 'react-core' ... }
```

**4.2 Lazy loading:**
```
Kiểm tra src/App.tsx hoặc src/router/:
- Tất cả 13 page components có được lazy load không?
  ✅ ĐÚNG: const DashboardPage = lazy(() => import('./pages/DashboardPage'))
  ❌ SAI: import DashboardPage from './pages/DashboardPage'
  
- Có <Suspense fallback={<LoadingSpinner />}> bao quanh <Routes> không?
- Heavy components (charts, tables lớn) có lazy load không?

→ Nếu thiếu: implement React.lazy() cho tất cả page-level components
```

**4.3 Re-render optimization:**
```
Tìm performance issues:
- Components lớn không có React.memo()
- useCallback/useMemo thiếu trên expensive computations
- Object/array literals trong JSX props (tạo reference mới mỗi render)
  VD: <Component style={{ color: 'red' }} /> → extract ra ngoài
- Event handlers inline không có useCallback
- Context value objects không được useMemo → gây re-render toàn bộ consumers
```

**4.4 Image & Asset optimization:**
```
- Kiểm tra public/ folder có images chưa optimize không
- SVG icons có inline hay dùng lucide-react? (lucide đã tree-shakeable)
- Font loading strategy trong index.html (display=swap?)
```

---

### PHASE 5 — SECURITY AUDIT

**5.1 Environment variables:**
```
Kiểm tra:
- Không có .env files được commit (kiểm tra .gitignore)
- Tất cả Firebase config dùng import.meta.env.VITE_*
- Không có secret keys trong source code
- .env.example có đầy đủ tất cả required vars không?

Tạo .env.example nếu chưa có:
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=/api
```

**5.2 Auth guard:**
```
Kiểm tra routing:
- Có PrivateRoute / AuthGuard component không?
- Tất cả 13 module pages có được bảo vệ bởi auth guard không?
- Redirect về /login khi chưa auth
- Role-based access control (RBAC) nếu có nhiều role user
```

**5.3 Input validation:**
```
- Form submissions có validate trước khi gọi Firestore không?
- Zod schemas có được dùng consistent không?
- XSS prevention: dangerouslySetInnerHTML có ở đâu không?
```

---

### PHASE 6 — CODE QUALITY & MAINTAINABILITY

**6.1 Component architecture:**
```
Kiểm tra pattern:
- Có tách biệt UI components vs Container/Smart components không?
- Shared UI components (Button, Input, Modal, Table...) có ở src/components/ui/ không?
- Business logic có bị lẫn vào UI components không?
- Custom hooks có được tách ra src/hooks/ không?
```

**6.2 Error handling:**
```
Tìm các điểm thiếu error handling:
- Firestore calls không có try/catch
- Missing error boundaries (ErrorBoundary component)
- TanStack Query onError handlers
- Unhandled promise rejections

→ Tạo global ErrorBoundary nếu chưa có
→ Tạo src/components/ErrorBoundary.tsx
```

**6.3 Loading states:**
```
Kiểm tra UX:
- Tất cả async operations có loading state không?
- Skeleton loading hay spinner?
- Empty states khi data = []?
- Error states khi query fail?
```

**6.4 Naming conventions:**
```
- Components: PascalCase ✅
- Hooks: use* prefix ✅
- Utils: camelCase ✅
- Constants: UPPER_SNAKE_CASE ✅
- Firestore collection names: consistent (camelCase hay kebab-case?)
- File names: consistent với component names?
```

---

### PHASE 7 — VERCEL DEPLOYMENT OPTIMIZATION

**7.1 vercel.json:**
```
Kiểm tra file vercel.json ở root:
- Có SPA fallback routing không? (quan trọng cho React Router)
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
- Nếu có backend API routes, có config đúng không?
- Headers security (X-Frame-Options, CSP) có được set không?
```

**7.2 Build optimization:**
```
Kiểm tra package.json scripts:
- "build": "tsc -b && vite build" ✅
- "preview": "vite preview" ✅
- Có "lint" script không? (ESLint)
- Có "typecheck" script không? (tsc --noEmit)

→ Thêm nếu thiếu:
  "typecheck": "tsc --noEmit",
  "lint": "eslint src --ext .ts,.tsx",
  "lint:fix": "eslint src --ext .ts,.tsx --fix"
```

**7.3 PWA config:**
```
Kiểm tra vite-plugin-pwa config:
- registerType: 'autoUpdate' ✅
- workbox globPatterns đầy đủ
- manifest icons có đúng path không?
- theme_color match với design system

Kiểm tra public/icons/:
- icon-192.svg tồn tại
- icon-512.svg tồn tại
```

---

### PHASE 8 — MODULE COMPLETENESS CHECK

**Kiểm tra từng module trong src/pages/:**
```
Cho mỗi trong 13 modules, báo cáo:
[ ] DashboardPage     — CRUD? Charts? Real data từ Firestore?
[ ] OrgPage           — Org chart render đúng không?
[ ] InfraPage         — System status realtime?
[ ] MaintenancePage   — Work orders CRUD đầy đủ?
[ ] FireSafetyPage    — Inspection records?
[ ] CivilWorksPage    — Tasks management?
[ ] MedicalDevicesPage — Device inventory CRUD?
[ ] CompliancePage    — Calibration records?
[ ] WarehousePage     — Stock in/out tracking?
[ ] AssetsPage        — Asset lifecycle?
[ ] VendorsPage       — Vendor management?
[ ] EnvironmentPage   — Monitoring data?
[ ] ReportsPage       — PDF/Excel export hoạt động?

Với mỗi module:
- Status: ✅ Complete / 🔄 Partial / ❌ Stub/Empty
- Missing features (nếu có)
- Firestore integration: ✅ / ❌
```

---

### PHASE 9 — AUTO-FIX TASKS

**Thực hiện fix tự động (không cần hỏi) cho các vấn đề sau:**

```
1. Xóa tất cả console.log trong src/ (giữ console.error, console.warn)
2. Fix TypeScript errors (không phải warnings)
3. Thêm React.lazy() cho các page components chưa có
4. Thêm <Suspense> wrapper nếu thiếu
5. Fix missing cleanup trong useEffect (onSnapshot listeners)
6. Thêm .limit(50) cho Firestore queries không có limit
7. Cập nhật vite.config.ts manualChunks sang object syntax nếu đang dùng function syntax
8. Tạo .env.example nếu chưa có
9. Tạo ErrorBoundary component nếu chưa có
10. Thêm vercel.json SPA rewrite rule nếu thiếu
```

---

### PHASE 10 — DELIVERABLES

**Sau khi hoàn thành audit, tạo các files sau:**

```
📄 AUDIT_REPORT.md
   ├── Executive Summary (điểm mạnh / điểm yếu)
   ├── Critical Issues (cần fix ngay)
   ├── Performance Score (1-10)
   ├── Security Score (1-10)
   ├── Code Quality Score (1-10)
   ├── Module Completeness (% done)
   └── Recommended Next Steps (ưu tiên theo impact)

📄 OPTIMIZATION_CHANGES.md
   └── Danh sách tất cả thay đổi đã thực hiện
       Format: [FILE] [THAY ĐỔI] [LÝ DO]

📄 firestore.indexes.json (nếu chưa có)
   └── Tất cả composite indexes cần thiết

📄 .env.example (nếu chưa có)
   └── Template env vars đầy đủ
```

---

## ⚡ QUICK COMMANDS

Chạy các lệnh này để hỗ trợ audit:

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | head -50

# Bundle size analysis
npm run build 2>&1 | grep -E "(dist/|kB|warning)"

# Find console.log
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx"

# Find any type
grep -rn ": any" src/ --include="*.ts" --include="*.tsx"

# Find TODO/FIXME
grep -rn "TODO\|FIXME\|HACK\|XXX" src/

# Find hardcoded strings
grep -rn "http://\|https://" src/ --include="*.ts" --include="*.tsx" | grep -v "fonts\|cdn\|api\|placeholder"

# Check lazy loading
grep -rn "React.lazy\|lazy(" src/ --include="*.tsx"

# Check Firestore listeners cleanup
grep -rn "onSnapshot" src/ --include="*.ts" --include="*.tsx"
```

---

## 🚫 KHÔNG THAY ĐỔI

```
- vercel.json routing cơ bản (đang hoạt động)
- Firebase project config (IDs, bucket names)
- Tailwind config và design tokens
- PWA manifest (name, icons)
- Git history
- Public API contracts (nếu có backend)
```

---

## ✅ DEFINITION OF DONE

Audit hoàn thành khi:
- [ ] 0 TypeScript errors (tsc --noEmit clean)
- [ ] 0 console.log trong production code
- [ ] Tất cả pages lazy loaded
- [ ] Bundle: vendor chunk < 800KB
- [ ] Firestore listeners có cleanup
- [ ] AUDIT_REPORT.md đã tạo
- [ ] OPTIMIZATION_CHANGES.md đã tạo
- [ ] Build thành công: npm run build ✅
