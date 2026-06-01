import { useState, useEffect } from 'react'
import {
  listenInventory,
  addInventoryItem,
  addInventoryTransaction,
  listenTransactionLog,
  updateInventoryQuantity,
} from '@/firebase/db'
import type { InventoryItem, InventoryTransaction } from '@/firebase/types'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Warehouse, Search, Plus, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, Package, ShoppingCart,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type WarehouseTab = 'inventory' | 'import' | 'export'

const CATEGORIES = ['Điện', 'Nước', 'HVAC', 'PCCC', 'Y tế', 'Xây dựng', 'IT', 'Khác']
const UNITS = ['cái', 'bộ', 'm', 'kg', 'lít', 'tấm', 'hộp', 'gói']

// ─── Shared Form Schemas ──────────────────────────────────────────────────────

const itemSchema = z.object({
  code: z.string().min(1, 'Mã vật tư là bắt buộc'),
  name: z.string().min(2, 'Tên vật tư ít nhất 2 ký tự'),
  category: z.string().min(1, 'Chọn danh mục'),
  unit: z.string().min(1, 'Chọn đơn vị'),
  quantity: z.coerce.number().min(0),
  minQuantity: z.coerce.number().min(0),
  location: z.string().min(1, 'Vị trí là bắt buộc'),
  price: z.coerce.number().min(0),
  supplier: z.string().optional(),
  expiryDate: z.string().optional(),
})

const importSchema = z.object({
  itemCode: z.string().min(1, 'Chọn vật tư'),
  supplier: z.string().min(1, 'Nhà cung cấp là bắt buộc'),
  poNumber: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Số lượng phải lớn hơn 0'),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

const exportSchema = z.object({
  itemCode: z.string().min(1, 'Chọn vật tư'),
  requestUnit: z.string().min(1, 'Đơn vị yêu cầu là bắt buộc'),
  quantity: z.coerce.number().min(1, 'Số lượng phải lớn hơn 0'),
  approvedBy: z.string().optional(),
  purpose: z.string().optional(),
})

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({
  items,
  open,
  onClose,
  onSuccess,
}: {
  items: InventoryItem[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  type F = z.infer<typeof importSchema>
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(importSchema),
  })
  const selectedCode = watch('itemCode')
  const selectedItem = items.find((i) => i.code === selectedCode)

  const onSubmit = async (data: F) => {
    if (!selectedItem) { toast.error('Không tìm thấy vật tư'); return }
    try {
      await updateInventoryQuantity(selectedItem.id, data.quantity)
      await addInventoryTransaction(selectedItem.id, selectedItem.name, selectedItem.code, {
        type: 'import',
        quantity: data.quantity,
        user: 'current_user',
        supplier: data.supplier,
        poNumber: data.poNumber,
        notes: data.notes,
      })
      toast.success(`Đã nhập ${data.quantity} ${selectedItem.unit} "${selectedItem.name}"`)
      onSuccess()
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message ?? 'Nhập kho thất bại')
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Nhập kho" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã vật tư *</label>
          <select {...register('itemCode')} className="input-field">
            <option value="">— Chọn vật tư —</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>{i.code} — {i.name}</option>
            ))}
          </select>
          {errors.itemCode && <p className="text-red-500 text-xs mt-1">{errors.itemCode.message}</p>}
        </div>
        {selectedItem && (
          <div className="text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg">
            Hiện tồn: <strong>{selectedItem.quantity}</strong> {selectedItem.unit} · Định mức: {selectedItem.minQuantity}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp *</label>
          <input {...register('supplier')} className="input-field" placeholder="Tên nhà cung cấp..." />
          {errors.supplier && <p className="text-red-500 text-xs mt-1">{errors.supplier.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng *</label>
            <input type="number" step="1" {...register('quantity')} className="input-field" />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO / Hóa đơn</label>
            <input {...register('poNumber')} className="input-field" placeholder="Số PO..." />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hạn sử dụng</label>
          <input type="date" {...register('expiryDate')} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <textarea {...register('notes')} className="input-field" rows={2} placeholder="Ghi chú..." />
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
          <ArrowDownToLine className="w-4 h-4" />
          {isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({
  items,
  open,
  onClose,
  onSuccess,
  prefillCode,
}: {
  items: InventoryItem[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
  prefillCode?: string
}) {
  type F = z.infer<typeof exportSchema>
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(exportSchema),
    defaultValues: prefillCode ? { itemCode: prefillCode } : {},
  })
  const selectedCode = watch('itemCode')
  const selectedItem = items.find((i) => i.code === selectedCode)

  const onSubmit = async (data: F) => {
    if (!selectedItem) { toast.error('Không tìm thấy vật tư'); return }
    if (data.quantity > selectedItem.quantity) {
      toast.error(`Không đủ hàng! Hiện chỉ còn ${selectedItem.quantity} ${selectedItem.unit}`)
      return
    }
    try {
      await updateInventoryQuantity(selectedItem.id, -data.quantity)
      await addInventoryTransaction(selectedItem.id, selectedItem.name, selectedItem.code, {
        type: 'export',
        quantity: data.quantity,
        user: 'current_user',
        requestUnit: data.requestUnit,
        approvedBy: data.approvedBy,
        purpose: data.purpose,
      })
      toast.success(`Đã xuất ${data.quantity} ${selectedItem.unit} "${selectedItem.name}"`)
      onSuccess()
      onClose()
      reset()
    } catch (e: any) {
      toast.error(e.message ?? 'Xuất kho thất bại')
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Xuất kho" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã vật tư *</label>
          <select {...register('itemCode')} className="input-field">
            <option value="">— Chọn vật tư —</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>{i.code} — {i.name}</option>
            ))}
          </select>
          {errors.itemCode && <p className="text-red-500 text-xs mt-1">{errors.itemCode.message}</p>}
        </div>
        {selectedItem && (
          <div className="text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg">
            Hiện tồn: <strong>{selectedItem.quantity}</strong> {selectedItem.unit}
            {selectedItem.quantity < selectedItem.minQuantity && (
              <span className="ml-2 text-red-500 font-medium">— Cảnh báo: dưới định mức!</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng *</label>
            <input type="number" step="1" {...register('quantity')} className="input-field" />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị yêu cầu *</label>
            <input {...register('requestUnit')} className="input-field" placeholder="Tên đơn vị..." />
            {errors.requestUnit && <p className="text-red-500 text-xs mt-1">{errors.requestUnit.message}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Người duyệt</label>
          <input {...register('approvedBy')} className="input-field" placeholder="Tên người duyệt..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích</label>
          <textarea {...register('purpose')} className="input-field" rows={2} placeholder="Mục đích sử dụng..." />
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
          <ArrowUpFromLine className="w-4 h-4" />
          {isSubmitting ? 'Đang xử lý...' : 'Xác nhận xuất kho'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

function AddItemModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  type F = z.infer<typeof itemSchema>
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(itemSchema),
  })

  const onSubmit = async (data: F) => {
    try {
      await addInventoryItem({
        ...data,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        lastImport: undefined,
        lastExport: undefined,
        expiryDate: data.expiryDate ? { toDate: () => new Date(data.expiryDate as string) } as any : undefined,
      })
      toast.success('Thêm vật tư thành công')
      onSuccess()
      onClose()
      reset()
    } catch {
      toast.error('Thêm vật tư thất bại')
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Thêm vật tư mới" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã vật tư *</label>
            <input {...register('code')} className="input-field" placeholder="VT-XXX" />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên vật tư *</label>
            <input {...register('name')} className="input-field" placeholder="Tên vật tư..." />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
            <select {...register('category')} className="input-field">
              <option value="">Chọn danh mục</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị *</label>
            <select {...register('unit')} className="input-field">
              <option value="">Chọn đơn vị</option>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
            <input type="number" {...register('quantity')} className="input-field" defaultValue={0} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Định mức tối thiểu *</label>
            <input type="number" {...register('minQuantity')} className="input-field" />
            {errors.minQuantity && <p className="text-red-500 text-xs mt-1">{errors.minQuantity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá (VNĐ)</label>
            <input type="number" {...register('price')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí *</label>
            <input {...register('location')} className="input-field" placeholder="Kệ / Khu vực..." />
            {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
            <input {...register('supplier')} className="input-field" placeholder="Tên nhà cung cấp..." />
          </div>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Đang thêm...' : 'Thêm vật tư'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Tab 1: Inventory Table ───────────────────────────────────────────────────

function InventoryTable({
  items,
  onExport,
  onOrder,
}: {
  items: InventoryItem[]
  onExport: (code: string) => void
  onOrder: (code: string) => void
}) {
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = items.filter((i) => {
    if (filterCat !== 'all' && i.category !== filterCat) return false
    const ratio = i.quantity / Math.max(i.minQuantity, 1)
    if (filterStatus === 'low' && ratio >= 0.5) return false
    if (filterStatus === 'critical' && (ratio >= 0.5 || i.quantity >= i.minQuantity)) return false
    if (filterStatus === 'ok' && i.quantity < i.minQuantity * 0.5) return false
    if (search) {
      const s = search.toLowerCase()
      if (!i.name.toLowerCase().includes(s) && !i.code.toLowerCase().includes(s)) return false
    }
    return true
  })

  const lowCount = items.filter((i) => i.quantity < i.minQuantity * 0.5).length
  const warnCount = items.filter((i) => i.quantity >= i.minQuantity * 0.5 && i.quantity < i.minQuantity).length
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price, 0)

  const getStatus = (item: InventoryItem) => {
    const ratio = item.quantity / Math.max(item.minQuantity, 1)
    if (item.quantity >= item.minQuantity) return { label: 'Đủ', color: 'badge-success' }
    if (ratio >= 0.5) return { label: 'Cận min', color: 'badge-warning' }
    return { label: 'Cần đặt', color: 'badge-danger' }
  }

  const getProgressPct = (item: InventoryItem) =>
    Math.min(100, Math.round((item.quantity / Math.max(item.minQuantity, 1)) * 100))

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-xl">
        <div className="text-center">
          <p className="text-xs text-gray-400">Tổng SKUs</p>
          <p className="text-lg font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-red-500">Cần đặt</p>
          <p className="text-lg font-bold text-red-600">{lowCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-amber-600">Gần hết</p>
          <p className="text-lg font-bold text-amber-600">{warnCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Tổng giá trị</p>
          <p className="text-lg font-bold text-gray-900">{totalValue.toLocaleString('vi-VN')} đ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã / tên..."
            className="input-field pl-9"
          />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả danh mục</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả</option>
          <option value="ok">Đủ</option>
          <option value="warn">Cận min</option>
          <option value="low">Cần đặt</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Warehouse className="w-8 h-8" />} title="Không tìm thấy vật tư" description="Thử điều chỉnh bộ lọc" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Mã VT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Tên</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">ĐVT</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Tồn</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Định mức</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Hạn SD</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const status = getStatus(item)
                  const pct = getProgressPct(item)
                  const isCritical = item.quantity < item.minQuantity * 0.5
                  const daysUntilExpiry = item.expiryDate ? differenceInDays(item.expiryDate.toDate(), new Date()) : null
                  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-400">{item.code}</p>
                        <p className="font-medium text-gray-900 md:hidden">{item.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.category}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isCritical && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                          )}
                          <span className={`font-semibold ${isCritical ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.quantity.toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-16 h-1 bg-gray-200 rounded-full mt-0.5 ml-auto">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs hidden lg:table-cell">
                        {item.minQuantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={status.color}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {item.expiryDate ? (
                          <span className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                            {format(item.expiryDate.toDate(), 'dd/MM/yyyy')}
                            {isExpired && ' (hết hạn)'}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onExport(item.code)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Xuất kho"
                          >
                            <ArrowUpFromLine className="w-4 h-4" />
                          </button>
                          {isCritical && (
                            <button
                              onClick={() => onOrder(item.code)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Đặt hàng"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Import History ────────────────────────────────────────────────────

function ImportHistoryTab({ transactions }: { transactions: InventoryTransaction[] }) {
  const imports = transactions.filter((t) => t.type === 'import')

  return (
    <div>
      {imports.length === 0 ? (
        <EmptyState icon={<ArrowDownToLine className="w-8 h-8" />} title="Chưa có phiếu nhập" description="Dữ liệu nhập kho sẽ hiển thị tại đây" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ngày</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Mã VT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tên</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">SL nhập</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Nhà cung cấp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">PO</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {imports.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {t.date ? (
                        <span className="text-gray-600 text-xs">
                          {format(t.date.toDate(), 'dd/MM/yyyy HH:mm')}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{(t as any).itemCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{(t as any).itemName ?? t.itemId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-600">
                        +{t.quantity.toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{t.supplier ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{t.poNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">{t.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Export History ────────────────────────────────────────────────────

function ExportHistoryTab({ transactions }: { transactions: InventoryTransaction[] }) {
  const exports = transactions.filter((t) => t.type === 'export')

  return (
    <div>
      {exports.length === 0 ? (
        <EmptyState icon={<ArrowUpFromLine className="w-8 h-8" />} title="Chưa có phiếu xuất" description="Dữ liệu xuất kho sẽ hiển thị tại đây" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ngày</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Mã VT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tên</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">SL xuất</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Đơn vị yêu cầu</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Người duyệt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Mục đích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exports.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {t.date ? (
                        <span className="text-gray-600 text-xs">
                          {format(t.date.toDate(), 'dd/MM/yyyy HH:mm')}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{(t as any).itemCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{(t as any).itemName ?? t.itemId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-600">
                        -{t.quantity.toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{t.requestUnit ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{t.approvedBy ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">{t.purpose ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('inventory')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsub1 = listenInventory(setItems)
    const unsub2 = listenTransactionLog(setTransactions)
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => { unsub1(); unsub2(); clearTimeout(timer) }
  }, [])

  const handleExport = (code: string) => {
    setPrefillCode(code)
    setShowExport(true)
  }

  const handleOrder = (code: string) => {
    setPrefillCode(code)
    setShowExport(true)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64"><div className="card h-full animate-pulse bg-gray-100" /></div>
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Kho vật tư</h1>
          <p className="text-sm text-gray-500">
            {items.length} vật tư · {items.filter((i) => i.quantity < i.minQuantity * 0.5).length} cần đặt
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <ArrowDownToLine className="w-4 h-4" /> Nhập kho
          </button>
          <button onClick={() => { setPrefillCode(undefined); setShowExport(true) }} className="btn-primary text-sm flex items-center gap-1.5">
            <ArrowUpFromLine className="w-4 h-4" /> Xuất kho
          </button>
        </div>
      </div>

      {/* Low stock alert */}
      {items.filter((i) => i.quantity < i.minQuantity * 0.5).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            {items.filter((i) => i.quantity < i.minQuantity * 0.5).length} vật tư cần đặt hàng ngay
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {([
          { id: 'inventory' as WarehouseTab, label: 'Tồn kho', icon: Package },
          { id: 'import' as WarehouseTab, label: 'Nhập kho', icon: ArrowDownToLine },
          { id: 'export' as WarehouseTab, label: 'Xuất kho', icon: ArrowUpFromLine },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inventory' && (
        <>
          <InventoryTable items={items} onExport={handleExport} onOrder={handleOrder} />
          <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Thêm vật tư mới
          </button>
        </>
      )}
      {activeTab === 'import' && (
        <div className="flex justify-end">
          <button onClick={() => setShowImport(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nhập kho
          </button>
        </div>
      )}
      {activeTab === 'export' && (
        <div className="flex justify-end">
          <button onClick={() => { setPrefillCode(undefined); setShowExport(true) }} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Xuất kho
          </button>
        </div>
      )}
      {activeTab === 'import' && <ImportHistoryTab transactions={transactions} />}
      {activeTab === 'export' && <ExportHistoryTab transactions={transactions} />}

      {/* Modals */}
      <ImportModal
        items={items}
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => setActiveTab('import')}
      />
      <ExportModal
        items={items}
        open={showExport}
        onClose={() => { setShowExport(false); setPrefillCode(undefined) }}
        onSuccess={() => setActiveTab('export')}
        prefillCode={prefillCode}
      />
      <AddItemModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
