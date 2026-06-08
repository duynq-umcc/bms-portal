import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listenInventory,
  addInventoryItem,
  addInventoryTransaction,
  listenTransactionLog,
  updateInventoryQuantity,
  listenUnreadExpiryAlertsCount,
  addImportDocAudit,
} from '@/firebase/db'
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { InventoryItem, InventoryTransaction, LegalDocs } from '@/firebase/types'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Warehouse, Search, Plus, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, Package, ShoppingCart, Clock, FileText, ArrowLeft, ArrowRight,
  Layers,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import {
  getBatchesFIFO,
  getBatchesFEFO,
  validateFIFOExport,
  getExportBatchPreview,
  type BatchInfo,
  type FIFOWarning,
  type ExportPreview,
} from '@/utils/fifoEngine'
import ExpiryAlertTab from './ExpiryAlertTab'
import ImportDocPanel from './ImportDocPanel'
import ImportDocViewer from './ImportDocViewer'
// ─── Types ────────────────────────────────────────────────────────────────────

type WarehouseTab = 'inventory' | 'import' | 'export' | 'expiry'

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
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  importDate: z.string().optional(),
  storageCondition: z.string().optional(),
  notes: z.string().optional(),
  isImported: z.boolean().optional(),
})

const exportSchema = z.object({
  itemCode: z.string().min(1, 'Chọn vật tư'),
  requestUnit: z.string().min(1, 'Đơn vị yêu cầu là bắt buộc'),
  quantity: z.coerce.number().min(1, 'Số lượng phải lớn hơn 0'),
  approvedBy: z.string().optional(),
  purpose: z.string().optional(),
})

// ─── Import Modal ─────────────────────────────────────────────────────────────

type ImportStep = 1 | 2

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
  const { user } = useAuth()
  type F = z.infer<typeof importSchema>
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(importSchema),
    defaultValues: { isImported: false },
  })

  const [step, setStep] = useState<ImportStep>(1)
  const [importId, setImportId] = useState('')
  const [legalDocs, setLegalDocs] = useState<LegalDocs>({})
  const [legalDocsComplete, setLegalDocsComplete] = useState(false)
  const [legalDocsStatus, setLegalDocsStatus] = useState('missing')
  const [skipped, setSkipped] = useState(false)
  const [step1Data, setStep1Data] = useState<F | null>(null)

  const selectedCode = watch('itemCode')
  const selectedItem = items.find((i) => i.code === selectedCode)
  const isImported = watch('isImported')

  const goToStep2 = (data: F) => {
    setStep1Data(data)
    setImportId(`IMP-${Date.now()}`)
    setStep(2)
  }

  const handleDocsChange = (docs: LegalDocs, complete: boolean, status: string) => {
    setLegalDocs(docs)
    setLegalDocsComplete(complete)
    setLegalDocsStatus(status)
  }

  const handleSkip = () => {
    setSkipped(true)
    setLegalDocsStatus('missing')
  }

  const onSubmit = async (data: F) => {
    const formData = step1Data ?? data
    if (!selectedItem) { toast.error('Không tìm thấy vật tư'); return }

    const effectiveDocs = skipped ? {} : legalDocs
    const effectiveStatus = skipped ? 'missing' : legalDocsStatus
    const effectiveComplete = skipped ? false : legalDocsComplete

    try {
      const importTs = formData.importDate
        ? Timestamp.fromDate(new Date(formData.importDate))
        : Timestamp.now()
      const expiryTs = formData.expiryDate
        ? Timestamp.fromDate(new Date(formData.expiryDate))
        : undefined

      await updateInventoryQuantity(selectedItem.id, formData.quantity)

      // Audit logs for each uploaded doc
      const docTypes = ['co', 'cq', 'invoice', 'customsDeclaration', 'deliveryNote'] as const
      for (const dt of docTypes) {
        const doc = effectiveDocs[dt]
        if (doc?.fileUrl) {
          await addImportDocAudit({
            transactionId: importId,
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            docType: dt,
            action: 'upload',
            performedBy: user?.uid ?? 'unknown',
            performedByName: user?.displayName ?? user?.email ?? 'Unknown',
          })
        }
      }

      // Write transaction with pre-generated importId as document ID
      await setDoc(doc(db, `inventoryTransactions/${importId}`), {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        itemCode: selectedItem.code,
        type: 'import',
        quantity: formData.quantity,
        user: user?.uid ?? 'current_user',
        supplier: formData.supplier,
        poNumber: formData.poNumber,
        notes: formData.notes,
        batchNumber: formData.batchNumber,
        expiryDate: expiryTs ?? null,
        importDate: importTs,
        date: serverTimestamp(),
        legalDocs: effectiveDocs,
        legalDocsComplete: effectiveComplete,
        legalDocsStatus: effectiveStatus,
      })

      if (effectiveComplete) {
        toast.success('Nhập kho thành công — hồ sơ đầy đủ')
      } else if (effectiveStatus === 'partial') {
        toast.warning('Nhập kho thành công — cần bổ sung hồ sơ')
      } else {
        toast.warning('Nhập kho thành công — chưa có hồ sơ pháp lý')
      }

      onSuccess()
      onClose()
      reset()
      setStep(1)
      setImportId('')
      setLegalDocs({})
      setLegalDocsComplete(false)
      setLegalDocsStatus('missing')
      setSkipped(false)
      setStep1Data(null)
    } catch (e: any) {
      toast.error(e?.message ?? 'Nhập kho thất bại')
    }
  }

  const handleClose = () => {
    onClose()
    reset()
    setStep(1)
    setImportId('')
    setLegalDocs({})
    setLegalDocsComplete(false)
    setLegalDocsStatus('missing')
    setSkipped(false)
    setStep1Data(null)
  }

  const step1Missing = !skipped && !legalDocsComplete
    ? ['co', 'cq', 'invoice', 'customsDeclaration'].filter((t) => !legalDocs[t as keyof LegalDocs]?.fileUrl).length
    : 0

  if (step === 2) {
    return (
      <Modal open={open} onClose={handleClose} title="Hồ sơ pháp lý nhập kho" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ImportDocPanel
            importId={importId}
            isImported={isImported ?? false}
            onDocsChange={handleDocsChange}
            onSkip={handleSkip}
          />

          {step1Missing > 0 && !skipped && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Còn thiếu {step1Missing} chứng từ bắt buộc
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              {isSubmitting
                ? 'Đang xử lý...'
                : legalDocsComplete || skipped
                ? 'Xác nhận nhập kho'
                : 'Nhập kho (thiếu hồ sơ)'}
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập kho" size="md">
      <form onSubmit={handleSubmit(goToStep2)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mã vật tư *</label>
          <select {...register('itemCode')} className="input-field">
            <option value="">— Chọn vật tư —</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>{i.code} — {i.name}</option>
            ))}
          </select>
          {errors.itemCode && <p className="text-red-400 text-xs mt-1">{errors.itemCode.message}</p>}
        </div>
        {selectedItem && (
          <div className="text-xs text-t2 px-3 py-2 bg-white/[0.05] rounded-lg">
            Hiện tồn: <strong>{selectedItem.quantity}</strong> {selectedItem.unit} · Định mức: {selectedItem.minQuantity ?? '—'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nhà cung cấp *</label>
          <input {...register('supplier')} className="input-field" placeholder="Tên nhà cung cấp..." />
          {errors.supplier && <p className="text-red-400 text-xs mt-1">{errors.supplier.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Số lượng *</label>
            <input type="number" step="1" {...register('quantity')} className="input-field" />
            {errors.quantity && <p className="text-red-400 text-xs mt-1">{errors.quantity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">PO / Hóa đơn</label>
            <input {...register('poNumber')} className="input-field" placeholder="Số PO..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Số lô</label>
            <input {...register('batchNumber')} className="input-field" placeholder="LOT-XXXX" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hạn sử dụng</label>
            <input type="date" {...register('expiryDate')} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ngày nhập</label>
            <input type="date" {...register('importDate')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Điều kiện bảo quản</label>
            <select {...register('storageCondition')} className="input-field">
              <option value="">— Chọn —</option>
              <option value="room_temp">Nhiệt độ phòng</option>
              <option value="cold">Lạnh 2-8°C</option>
              <option value="frozen">Đông lạnh</option>
            </select>
          </div>
        </div>

        {/* Imported goods toggle */}
        <label className="flex items-center gap-2 text-sm text-t2 cursor-pointer">
          <input type="checkbox" {...register('isImported')} className="accent-amber" />
          Hàng nhập khẩu (yêu cầu CO + tờ khai hải quan)
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Ghi chú</label>
          <textarea {...register('notes')} className="input-field" rows={2} placeholder="Ghi chú..." />
        </div>
        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
          Tiếp theo
          <ArrowRight className="w-4 h-4" />
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
  const qty = Number(watch('quantity') ?? 0)

  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [fifoWarning, setFifoWarning] = useState<FIFOWarning | null>(null)
  const [method, setMethod] = useState<'fifo' | 'fefo'>('fifo')
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [, setLoadingPreview] = useState(false)

  useEffect(() => {
    if (!selectedItem) return
    setLoadingBatches(true)
    setSelectedBatch('')
    setFifoWarning(null)
    setPreview(null)
    setBatches([])
    const load = async () => {
      const b = method === 'fifo'
        ? await getBatchesFIFO(selectedItem.id)
        : await getBatchesFEFO(selectedItem.id)
      setBatches(b)
      if (b.length > 0) setSelectedBatch(b[0].batchNumber)
      setLoadingBatches(false)
    }
    load()
  }, [selectedItem?.id, method])

  // Load batch preview when quantity changes
  useEffect(() => {
    if (!selectedItem || qty <= 0) {
      setPreview(null)
      return
    }
    let cancelled = false
    setLoadingPreview(true)
    getExportBatchPreview(selectedItem.id, qty, method, selectedBatch).then((p) => {
      if (!cancelled) {
        setPreview(p)
        setLoadingPreview(false)
      }
    })
    return () => { cancelled = true }
  }, [selectedItem?.id, qty, method, selectedBatch])

  const handleBatchChange = async (batch: string) => {
    if (!selectedItem) return
    setSelectedBatch(batch)
    const result = await validateFIFOExport(selectedItem.id, batch, 0)
    setFifoWarning(result.warning ?? null)
  }

  const selectedBatchData = batches.find((b) => b.batchNumber === selectedBatch)

  // QW-7: over-quota warning — check against FIFO-first batch, not total stock
  const currentBatchQty = selectedBatchData?.quantity ?? 0
  const currentBatchIdx = batches.findIndex((b) => b.batchNumber === selectedBatch)
  const nextBatch = batches[currentBatchIdx + 1]
  const overQuota = selectedItem && qty > 0 && qty > currentBatchQty

  const onSubmit = async (data: F) => {
    if (!selectedItem) { toast.error('Không tìm thấy vật tư'); return }
    if (selectedBatch && selectedBatchData && selectedBatchData.daysRemaining <= 0) {
      toast.error('Không thể xuất kho vật tư đã hết hạn')
      return
    }
    // Block if insufficient total stock (aggregate check)
    if (data.quantity > selectedItem.quantity) {
      toast.error(`Không đủ hàng! Hiện chỉ còn ${selectedItem.quantity} ${selectedItem.unit}`)
      return
    }
    // Block if preview is invalid (batch-level validation via P1.6 fix)
    if (preview && !preview.isValid) {
      toast.error(preview.errorMessage || 'Số lượng vượt tồn kho')
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
        batchNumber: selectedBatch || undefined,
        expiryDate: selectedBatchData?.expiryDate ?? null,
        importDate: selectedBatchData?.importDate,
        fifoWarning: fifoWarning !== null,
      })
      toast.success(`Đã xuất ${data.quantity} ${selectedItem.unit} "${selectedItem.name}"`)
      onSuccess()
      onClose()
      reset()
      setSelectedBatch('')
      setFifoWarning(null)
      setBatches([])
    } catch (e: any) {
      toast.error(e.message ?? 'Xuất kho thất bại')
    }
  }

  const batchBadgeColor = (days: number) => {
    if (days <= 0) return 'bg-red-500/20 text-red-400 line-through'
    if (days <= 30) return 'bg-red-500/20 text-red-400'
    if (days <= 90) return 'bg-amber-500/20 text-amber'
    return ''
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Xuất kho" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mã vật tư *</label>
          <select {...register('itemCode')} className="input-field">
            <option value="">— Chọn vật tư —</option>
            {items.map((i) => (
              <option key={i.id} value={i.code}>{i.code} — {i.name}</option>
            ))}
          </select>
          {errors.itemCode && <p className="text-red-400 text-xs mt-1">{errors.itemCode.message}</p>}
        </div>
        {selectedItem && (
          <div className="text-xs text-t2 px-3 py-2 bg-white/[0.05] rounded-lg">
            Hiện tồn: <strong>{selectedItem.quantity}</strong> {selectedItem.unit}
            {selectedItem.quantity < (selectedItem.minQuantity ?? 0) && (
              <span className="ml-2 text-red-400 font-medium">— Cảnh báo: dưới định mức!</span>
            )}
          </div>
        )}

        {/* Batch picker */}
        {selectedItem && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-300">Chọn lô *</label>
              <span className="text-xs text-t2">— FIFO / FEFO</span>
            </div>
            {/* Method toggle */}
            <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setMethod('fifo')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  method === 'fifo' ? 'bg-amber text-ink' : 'text-t2 hover:text-gray-200'
                }`}
              >
                FIFO — Nhập trước xuất trước
              </button>
              <button
                type="button"
                onClick={() => setMethod('fefo')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  method === 'fefo' ? 'bg-amber text-ink' : 'text-t2 hover:text-gray-200'
                }`}
              >
                FEFO — Hết hạn trước xuất trước
              </button>
            </div>

            {loadingBatches ? (
              <div className="card p-3 animate-pulse">
                <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/[0.06] rounded w-1/2" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-xs text-t2 px-3 py-2 bg-white/[0.04] rounded-lg">
                Chưa có lô nhập kho cho vật tư này
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {batches.map((batch, idx) => {
                  const isSelected = batch.batchNumber === selectedBatch
                  const isExpired = batch.daysRemaining <= 0
                  const isRecommended = idx === 0
                  return (
                    <label
                      key={batch.batchNumber}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        isExpired
                          ? 'border-red-500/20 bg-red-500/5 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-amber/50 bg-amber/10'
                          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="batch-select"
                        value={batch.batchNumber}
                        checked={isSelected}
                        onChange={() => !isExpired && handleBatchChange(batch.batchNumber)}
                        disabled={isExpired}
                        className="accent-amber"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-300">{batch.batchNumber}</span>
                          {isRecommended && !isExpired && (
                            <span className="text-xs bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded font-medium">Đề xuất</span>
                          )}
                          {isExpired && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium line-through">ĐÃ HẾT HẠN</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-t2 mt-0.5">
                          <span>NH: {format(batch.importDate.toDate(), 'dd/MM/yyyy')}</span>
                          {batch.expiryDate && (
                            <span>HH: {format(batch.expiryDate.toDate(), 'dd/MM/yyyy')}</span>
                          )}
                          <span>{batch.quantity} VT</span>
                        </div>
                      </div>
                      {batch.daysRemaining <= 90 && !isExpired && (
                        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${batchBadgeColor(batch.daysRemaining)}`}>
                          {batch.daysRemaining > 30
                            ? `${batch.daysRemaining}N`
                            : batch.daysRemaining <= 0
                            ? 'Hết HH'
                            : `Cận HH ${batch.daysRemaining}N`}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {/* FIFO warning banner */}
            {fifoWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-2">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-amber-400">Cảnh báo FIFO</div>
                    <div className="text-xs text-t2 mt-1 whitespace-pre-line">{fifoWarning.message}</div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          handleBatchChange(fifoWarning.oldestBatch.batchNumber)
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-amber/20 text-amber hover:bg-amber/30 transition-colors font-medium"
                      >
                        Chọn lô đề xuất
                      </button>
                      <button
                        type="button"
                        onClick={() => setFifoWarning(null)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.06] text-t2 hover:text-gray-200 transition-colors"
                      >
                        Tiếp tục (ghi nhận vi phạm)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Số lượng *</label>
            <input type="number" step="1" {...register('quantity')} className="input-field" />
            {errors.quantity && <p className="text-red-400 text-xs mt-1">{errors.quantity.message}</p>}
            {overQuota && (
              <p className="text-xs text-amber mt-1 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 flex-shrink-0" />
                Lô hiện tại chỉ còn {currentBatchQty} — xuất thêm sẽ sang lô tiếp theo
                {nextBatch?.expiryDate ? ` (HH: ${format(nextBatch.expiryDate.toDate(), 'dd/MM/yyyy')})` : ''}
              </p>
            )}

            {/* P1.6: Batch preview — shows which batches will be touched */}
            {preview && preview.lines.length > 1 && (
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-400">
                    Xuất từ {preview.lines.length} lô hàng:
                  </span>
                </div>
                <div className="space-y-1.5">
                  {preview.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-300">{line.batchNumber}</span>
                        {line.expiryDate && (
                          <span className="text-t3">HH: {format(line.expiryDate.toDate(), 'dd/MM/yyyy')}</span>
                        )}
                      </div>
                      <span className="text-gray-100 font-medium">
                        −{line.deductQty} VT
                        {line.remainingAfter > 0 && (
                          <span className="text-t3 font-normal ml-1">(còn {line.remainingAfter})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview && !preview.isValid && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 mt-1">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-400">{preview.errorMessage}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Đơn vị yêu cầu *</label>
            <input {...register('requestUnit')} className="input-field" placeholder="Tên đơn vị..." />
            {errors.requestUnit && <p className="text-red-400 text-xs mt-1">{errors.requestUnit.message}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Người duyệt</label>
          <input {...register('approvedBy')} className="input-field" placeholder="Tên người duyệt..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mục đích</label>
          <textarea {...register('purpose')} className="input-field" rows={2} placeholder="Mục đích sử dụng..." />
        </div>
        <button type="submit" disabled={isSubmitting || (preview !== null && !preview.isValid)} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
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
        expiryDate: data.expiryDate ? Timestamp.fromDate(new Date(data.expiryDate)) : undefined,
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Mã vật tư *</label>
            <input {...register('code')} className="input-field" placeholder="VT-XXX" />
            {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tên vật tư *</label>
            <input {...register('name')} className="input-field" placeholder="Tên vật tư..." />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Danh mục *</label>
            <select {...register('category')} className="input-field">
              <option value="">Chọn danh mục</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Đơn vị *</label>
            <select {...register('unit')} className="input-field">
              <option value="">Chọn đơn vị</option>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unit && <p className="text-red-400 text-xs mt-1">{errors.unit.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Số lượng</label>
            <input type="number" {...register('quantity')} className="input-field" defaultValue={0} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Định mức tối thiểu *</label>
            <input type="number" {...register('minQuantity')} className="input-field" />
            {errors.minQuantity && <p className="text-red-400 text-xs mt-1">{errors.minQuantity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Đơn giá (VNĐ)</label>
            <input type="number" {...register('price')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Vị trí *</label>
            <input {...register('location')} className="input-field" placeholder="Kệ / Khu vực..." />
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Nhà cung cấp</label>
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

  const min = (item: InventoryItem) => item.minQuantity ?? 0
  const ratio = (item: InventoryItem) => item.quantity / Math.max(min(item), 1)

  const filtered = items.filter((i) => {
    if (filterCat !== 'all' && i.category !== filterCat) return false
    const r = i.quantity / Math.max(min(i), 1)
    if (filterStatus === 'low' && r >= 0.5) return false
    if (filterStatus === 'critical' && (r >= 0.5 || i.quantity >= min(i))) return false
    if (filterStatus === 'ok' && i.quantity < min(i) * 0.5) return false
    if (search) {
      const s = search.toLowerCase()
      if (!i.name.toLowerCase().includes(s) && !i.code.toLowerCase().includes(s)) return false
    }
    return true
  })

  const lowCount = items.filter((i) => i.quantity < min(i) * 0.5).length
  const warnCount = items.filter((i) => i.quantity >= min(i) * 0.5 && i.quantity < min(i)).length
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price, 0)

  const getStatus = (item: InventoryItem) => {
    const r = ratio(item)
    if (item.quantity >= min(item)) return { label: 'Đủ', color: 'badge-success' }
    if (r >= 0.5) return { label: 'Cận min', color: 'badge-warning' }
    return { label: 'Cần đặt', color: 'badge-danger' }
  }

  const getProgressPct = (item: InventoryItem) =>
    Math.min(100, Math.round(ratio(item) * 100))

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 p-3 bg-white/[0.05] rounded-xl">
        <div className="text-center">
          <p className="text-xs text-t2">Tổng SKUs</p>
          <p className="text-lg font-bold text-gray-200">{items.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-red-400">Cần đặt</p>
          <p className="text-lg font-bold text-red-400">{lowCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-amber">Gần hết</p>
          <p className="text-lg font-bold text-amber">{warnCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-t2">Tổng giá trị</p>
          <p className="text-lg font-bold text-gray-200">{totalValue.toLocaleString('vi-VN')} đ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t2" />
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
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Mã VT</th>
                  <th className="text-left hidden md:table-cell">Tên</th>
                  <th className="text-center">ĐVT</th>
                  <th className="text-right">Tồn</th>
                  <th className="text-center hidden lg:table-cell">Định mức</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-left hidden xl:table-cell">Hạn SD</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const status = getStatus(item)
                  const pct = getProgressPct(item)
                  const isCritical = item.quantity < min(item) * 0.5
                  const daysUntilExpiry = item.expiryDate ? differenceInDays(item.expiryDate.toDate(), new Date()) : null
                  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0
                  const isNearExpiry = daysUntilExpiry !== null && !isExpired && daysUntilExpiry <= 30

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-400">{item.code}</p>
                        <p className="font-medium text-gray-200 md:hidden">{item.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="font-medium text-gray-200">{item.name}</p>
                        <p className="text-xs text-t2">{item.category}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-t2 text-xs">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isCritical && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                          )}
                          <span className={`font-semibold ${isCritical ? 'text-red-400' : 'text-gray-200'}`}>
                            {item.quantity.toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-16 h-1 bg-white/[0.08] rounded-full mt-0.5 ml-auto">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-t2 text-xs hidden lg:table-cell">
                        {(item.minQuantity ?? 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={status.color}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {item.expiryDate ? (
                          <span className={`text-xs ${
                            isExpired
                              ? 'text-red-400 font-medium'
                              : daysUntilExpiry !== null && daysUntilExpiry <= 30
                              ? 'text-red-400'
                              : daysUntilExpiry !== null && daysUntilExpiry <= 90
                              ? 'text-amber'
                              : 'text-t2'
                          }`}>
                            {format(item.expiryDate.toDate(), 'dd/MM/yyyy')}
                            {isExpired && ' (Đã HH)'}
                            {!isExpired && isNearExpiry && (
                              <span className="ml-1 text-red-400">⚠</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-t3 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onExport(item.code)}
                            className="p-1.5 rounded-lg text-t3 hover:text-amber hover:bg-amber/10 transition-colors"
                            title="Xuất kho"
                          >
                            <ArrowUpFromLine className="w-4 h-4" />
                          </button>
                          {isCritical && (
                            <button
                              onClick={() => onOrder(item.code)}
                              className="p-1.5 rounded-lg text-t3 hover:text-amber hover:bg-amber/10 transition-colors"
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

function ImportHistoryTab({
  transactions,
  onViewDocs,
}: {
  transactions: InventoryTransaction[]
  onViewDocs: (tx: InventoryTransaction) => void
}) {
  const imports = transactions.filter((t) => t.type === 'import')

  const statusBadge = (status?: string) => {
    switch (status) {
      case 'complete':
        return <span className="badge-success">Đầy đủ</span>
      case 'verified':
        return <span className="bg-teal-500/20 text-teal-400 text-xs px-2 py-0.5 rounded-full">Đã xác minh</span>
      case 'partial': {
        const missing = ['co', 'cq', 'invoice', 'customsDeclaration'].filter(
          (k) => !transactions.find((t) => t.legalDocs?.[k as keyof typeof t.legalDocs]?.fileUrl)
        ).length
        return <span className="bg-amber-500/20 text-amber text-xs px-2 py-0.5 rounded-full">Thiếu {missing > 0 ? missing : ''} chứng từ</span>
      }
      case 'missing':
        return <span className="badge-danger">Chưa có hồ sơ</span>
      default:
        return <span className="bg-white/10 text-gray-400 text-xs px-2 py-0.5 rounded-full">—</span>
    }
  }

  const missingIncomplete = imports.filter(
    (t) => t.legalDocsStatus && t.legalDocsStatus !== 'complete' && t.legalDocsStatus !== 'verified'
  )

  return (
    <div>
      {/* Missing docs banner */}
      {missingIncomplete.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber flex-1">
            {missingIncomplete.length} phiếu nhập chưa đủ hồ sơ pháp lý — cần bổ sung trong vòng 3 ngày làm việc
          </p>
        </div>
      )}

      {imports.length === 0 ? (
        <EmptyState icon={<ArrowDownToLine className="w-8 h-8" />} title="Chưa có phiếu nhập" description="Dữ liệu nhập kho sẽ hiển thị tại đây" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Ngày</th>
                  <th className="text-left hidden md:table-cell">Mã VT</th>
                  <th className="text-left">Tên</th>
                  <th className="text-right">SL nhập</th>
                  <th className="text-left hidden lg:table-cell">Nhà cung cấp</th>
                  <th className="text-left hidden xl:table-cell">PO</th>
                  <th className="text-center">Hồ sơ pháp lý</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      {t.date ? (
                        <span className="text-gray-400 text-xs">
                          {format(t.date.toDate(), 'dd/MM/yyyy HH:mm')}
                        </span>
                      ) : (
                        <span className="text-t3 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{t.itemCode ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-200">{t.itemName ?? t.itemId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-400">
                        +{t.quantity.toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{t.supplier ?? '—'}</td>
                    <td className="px-4 py-3 text-t2 text-xs hidden xl:table-cell">{t.poNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {statusBadge(t.legalDocsStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewDocs(t)}
                          className="p-1.5 rounded-lg text-t3 hover:text-amber hover:bg-amber/10 transition-colors"
                          title="Xem hồ sơ"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Ngày</th>
                  <th className="text-left hidden md:table-cell">Mã VT</th>
                  <th className="text-left">Tên</th>
                  <th className="text-right">SL xuất</th>
                  <th className="text-left hidden lg:table-cell">Đơn vị yêu cầu</th>
                  <th className="text-left hidden lg:table-cell">Người duyệt</th>
                  <th className="text-left hidden xl:table-cell">Mục đích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {exports.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      {t.date ? (
                        <span className="text-gray-400 text-xs">
                          {format(t.date.toDate(), 'dd/MM/yyyy HH:mm')}
                        </span>
                      ) : (
                        <span className="text-t3 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{t.itemCode ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-200">{t.itemName ?? t.itemId}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-400">
                        -{t.quantity.toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{t.requestUnit ?? '—'}</td>
                    <td className="px-4 py-3 text-t2 text-xs hidden lg:table-cell">{t.approvedBy ?? '—'}</td>
                    <td className="px-4 py-3 text-t2 text-xs hidden xl:table-cell">{t.purpose ?? '—'}</td>
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

export default function WarehousePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<WarehouseTab>('inventory')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined)
  const [expiryCount, setExpiryCount] = useState(0)
  const [viewingDoc, setViewingDoc] = useState<InventoryTransaction | null>(null)

  const lowItems = (items: InventoryItem[]) => items.filter((i) => i.quantity < (i.minQuantity ?? 0) * 0.5)

  useEffect(() => {
    console.log('[Warehouse] user:', user?.email, '| inventory items:', items.length)
  }, [user, items])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let settled = false
    const settle = () => { if (!settled) { settled = true; setLoading(false) } }

    const unsub1 = listenInventory((docs) => { setItems(docs); settle() }, (err) => { setError(err.message); settle() })
    const unsub2 = listenTransactionLog((docs) => { setTransactions(docs); settle() }, undefined, (err) => { setError(err.message); settle() })

    timer = setTimeout(settle, 3000)
    return () => { unsub1(); unsub2(); clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const unsub = listenUnreadExpiryAlertsCount(setExpiryCount)
    return unsub
  }, [])

  const handleExport = (code: string) => {
    setPrefillCode(code)
    setShowExport(true)
  }


  if (error) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="font-medium text-red-400">Lỗi tải dữ liệu kho</p>
        <p className="text-sm text-t2 mt-1">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-3 text-sm">Thử lại</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64"><div className="card h-full animate-pulse bg-white/[0.06]" /></div>
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Kho vật tư</h1>
          <p className="text-sm text-t2">
            {items.length} vật tư · {lowItems(items).length} cần đặt
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
      {lowItems(items).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">
            {lowItems(items).length} vật tư cần đặt hàng ngay
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
        {([
          { id: 'inventory' as WarehouseTab, label: 'Tồn kho', icon: Package },
          { id: 'import' as WarehouseTab, label: 'Nhập kho', icon: ArrowDownToLine },
          { id: 'export' as WarehouseTab, label: 'Xuất kho', icon: ArrowUpFromLine },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.id
                ? 'bg-amber text-ink font-semibold'
                : 'text-t2 hover:text-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('expiry')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'expiry'
              ? 'bg-amber text-ink font-semibold'
              : 'text-t2 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Hàng cận date
          {expiryCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold leading-none">
              {expiryCount > 99 ? '99+' : expiryCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'inventory' && (
        <>
          <InventoryTable items={items} onExport={handleExport} onOrder={handleExport} />
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
      {activeTab === 'import' && (
        <ImportHistoryTab transactions={transactions} onViewDocs={setViewingDoc} />
      )}
      {activeTab === 'export' && <ExportHistoryTab transactions={transactions} />}
      {activeTab === 'expiry' && <ExpiryAlertTab />}

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

      {/* Doc viewer panel */}
      {viewingDoc && (
        <ImportDocViewer
          transaction={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onUpdated={() => setViewingDoc(null)}
        />
      )}
    </div>
  )
}
