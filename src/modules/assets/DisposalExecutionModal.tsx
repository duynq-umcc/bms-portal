import { useState, useRef } from 'react'
import { X, Image, Plus, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { addDisposalExecution, updateDisposalRequest, updateAsset } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import type { DisposalRequest, DisposalExecutionPhoto } from '@/types/firestore'

const formatVND = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n.toLocaleString('vi-VN') + ' đ'

interface Props {
  isOpen: boolean
  onClose: () => void
  disposalRequest: DisposalRequest & { id: string }
  councilDecision?: {
    method: string
    approvedValue: number
    conditions: string
  }
}

interface ExecutionPhoto {
  file?: File
  preview?: string
  caption: string
  uploading: boolean
  progress: number
  url?: string
}

export default function DisposalExecutionModal({ isOpen, onClose, disposalRequest, councilDecision }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<ExecutionPhoto[]>([])

  const [form, setForm] = useState({
    executionDate: new Date().toISOString().split('T')[0],
    executedBy: user?.uid || '',
    executedByName: user?.displayName || user?.email || '',
    witnessedBy: '',
    disposalMethod: councilDecision?.method || disposalRequest.proposedDisposalMethod,
    actualDisposalValue: councilDecision?.approvedValue ?? disposalRequest.proposedDisposalValue,
    buyerInfo: '',
    receiptNumber: '',
    revenueReceived: 0,
    revenueHandedTo: '',
    handoverDate: '',
    executionReport: '',
  })

  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPhotos: ExecutionPhoto[] = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      caption: '',
      uploading: false,
      progress: 0,
    }))
    setPhotos((prev) => [...prev, ...newPhotos])
    e.target.value = ''
  }

  const updatePhoto = (i: number, patch: Partial<ExecutionPhoto>) => {
    setPhotos((prev) => {
      const updated = [...prev]
      updated[i] = { ...updated[i], ...patch }
      return updated
    })
  }

  const removePhoto = (i: number) => {
    if (photos[i].preview) URL.revokeObjectURL(photos[i].preview)
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    if (!form.executedByName.trim()) { toast.error('Vui lòng nhập người thực hiện'); return }
    if (!form.witnessedBy.trim()) { toast.error('Vui lòng nhập người chứng kiến'); return }
    if (photos.length < 2) { toast.error('Cần ít nhất 2 ảnh chứng minh'); return }

    setSaving(true)
    try {
      // Upload photos
      const uploadedPhotos: DisposalExecutionPhoto[] = []
      for (const photo of photos) {
        if (!photo.file) continue
        const filename = `exec_${Date.now()}_${photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const path = `disposal/requests/${disposalRequest.id}/${filename}`
        const storageRef = ref(storage, path)
        try {
          const snap = await uploadBytesResumable(storageRef, photo.file)
          const url = await getDownloadURL(snap.ref)
          uploadedPhotos.push({ url, caption: photo.caption })
        } catch { /* skip */ }
      }

      const revenueReceived = form.disposalMethod === 'auction' || form.disposalMethod === 'sell_fixed_price'
        ? form.revenueReceived
        : 0

      await addDisposalExecution({
        requestId: disposalRequest.id,
        councilId: disposalRequest.councilId || '',
        assetId: disposalRequest.assetId,
        assetName: disposalRequest.assetName,
        assetCode: disposalRequest.assetCode,
        executionDate: Timestamp.fromDate(new Date(form.executionDate)),
        executedBy: user!.uid,
        executedByName: form.executedByName,
        disposalMethod: form.disposalMethod,
        actualDisposalValue: form.actualDisposalValue,
        buyerInfo: form.buyerInfo || null,
        receiptNumber: form.receiptNumber || null,
        witnessedBy: form.witnessedBy,
        photos: uploadedPhotos,
        executionReport: form.executionReport,
        revenueReceived,
        revenueHandedTo: form.revenueHandedTo,
        handoverDate: form.handoverDate ? Timestamp.fromDate(new Date(form.handoverDate)) : null,
        createdAt: Timestamp.now(),
      })

      await updateDisposalRequest(disposalRequest.id, { status: 'executed' })
      await updateAsset(disposalRequest.assetId, {
        status: 'disposed',
        disposedAt: Timestamp.now(),
        disposedValue: form.actualDisposalValue,
      } as any)

      toast.success('Đã hoàn thành thanh lý tài sản')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Thực hiện thanh lý thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const isSale = form.disposalMethod === 'auction' || form.disposalMethod === 'sell_fixed_price'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1] shrink-0">
          <div>
            <h3 className="font-semibold text-gray-100 text-base">Thực hiện thanh lý tài sản</h3>
            <p className="text-xs text-t3 mt-0.5">
              {disposalRequest.assetName} — {disposalRequest.assetCode}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Asset summary */}
          <div className="card p-4 border border-amber/20">
            <div className="flex items-center gap-2 text-amber text-xs font-medium mb-2">
              ✓ Đã được HĐ thanh lý phê duyệt
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-t3 text-xs">Hình thức HĐ duyệt</span>
                <p className="text-gray-200 font-medium">{councilDecision?.method || disposalRequest.proposedDisposalMethod}</p>
              </div>
              <div>
                <span className="text-t3 text-xs">Giá trị HĐ duyệt</span>
                <p className="text-amber font-bold">{formatVND(councilDecision?.approvedValue ?? disposalRequest.proposedDisposalValue)}</p>
              </div>
            </div>
            {councilDecision?.conditions && (
              <p className="text-xs text-t3 mt-2 italic">Điều kiện: {councilDecision.conditions}</p>
            )}
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ngày thực hiện</label>
              <input type="date" value={form.executionDate} onChange={(e) => setForm((f) => ({ ...f, executionDate: e.target.value }))} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Người thực hiện <span className="text-red-400">*</span>
              </label>
              <input value={form.executedByName} onChange={(e) => setForm((f) => ({ ...f, executedByName: e.target.value }))} className="input-field w-full" placeholder="Tên người thực hiện..." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Người chứng kiến <span className="text-red-400">*</span>
            </label>
            <input value={form.witnessedBy} onChange={(e) => setForm((f) => ({ ...f, witnessedBy: e.target.value }))} className="input-field w-full" placeholder="Tên người chứng kiến..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Hình thức thanh lý thực tế</label>
              <select value={form.disposalMethod} onChange={(e) => setForm((f) => ({ ...f, disposalMethod: e.target.value }))} className="input-field w-full">
                <option value="auction">Đấu giá công khai</option>
                <option value="sell_fixed_price">Bán giá cố định</option>
                <option value="transfer_to_dept">Điều chuyển nội bộ</option>
                <option value="donate">Hiến tặng</option>
                <option value="scrap">Thanh lý phế liệu</option>
                <option value="destroy">Tiêu hủy</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Giá trị thanh lý thực tế (VNĐ) <span className="text-red-400">*</span>
              </label>
              <input type="number" value={form.actualDisposalValue || ''} onChange={(e) => setForm((f) => ({ ...f, actualDisposalValue: Number(e.target.value) }))} className="input-field w-full" />
            </div>
          </div>

          {/* Sale-specific fields */}
          {isSale && (
            <div className="card p-4 space-y-3 border border-white/[0.06]">
              <h4 className="text-sm font-medium text-gray-300">Thông tin người mua</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-t3 mb-1">Tên người mua / Đơn vị</label>
                  <input value={form.buyerInfo} onChange={(e) => setForm((f) => ({ ...f, buyerInfo: e.target.value }))} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-t3 mb-1">Số biên lai / Hóa đơn</label>
                  <input value={form.receiptNumber} onChange={(e) => setForm((f) => ({ ...f, receiptNumber: e.target.value }))} className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-t3 mb-1">Số tiền thực thu (VNĐ)</label>
                <input type="number" value={form.revenueReceived || ''} onChange={(e) => setForm((f) => ({ ...f, revenueReceived: Number(e.target.value) }))} className="input-field w-full" />
              </div>
            </div>
          )}

          {/* Revenue handover */}
          {(isSale || form.revenueReceived > 0) && (
            <div className="card p-4 space-y-3 border border-white/[0.06]">
              <h4 className="text-sm font-medium text-gray-300">Nộp tiền cho kế toán</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-t3 mb-1">Số tiền nộp</label>
                  <input type="number" value={form.revenueReceived || ''} onChange={(e) => setForm((f) => ({ ...f, revenueReceived: Number(e.target.value) }))} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-t3 mb-1">Ngày nộp</label>
                  <input type="date" value={form.handoverDate} onChange={(e) => setForm((f) => ({ ...f, handoverDate: e.target.value }))} className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-t3 mb-1">Người nhận tại kế toán</label>
                <input value={form.revenueHandedTo} onChange={(e) => setForm((f) => ({ ...f, revenueHandedTo: e.target.value }))} className="input-field w-full" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mô tả quá trình thực hiện</label>
            <textarea
              value={form.executionReport}
              onChange={(e) => setForm((f) => ({ ...f, executionReport: e.target.value }))}
              rows={3}
              className="input-field w-full text-sm"
              placeholder="Chi tiết về quá trình đấu giá / bán / tiêu hủy..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Ảnh chứng minh (tối thiểu 2) <span className="text-red-400">*</span>
            </label>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
            <div className="grid grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10">
                  {p.preview ? (
                    <img src={p.preview} alt="" className="w-full aspect-square object-cover" />
                  ) : p.url ? (
                    <img src={p.url} alt="" className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                      <Image className="w-6 h-6 text-t3" />
                    </div>
                  )}
                  {p.uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                  <input
                    value={p.caption}
                    onChange={(e) => updatePhoto(i, { caption: e.target.value })}
                    placeholder="Chú thích..."
                    className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-[10px] text-white placeholder-t3"
                  />
                </div>
              ))}
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-amber/50 flex flex-col items-center justify-center gap-1 text-t2 hover:text-amber transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px]">Thêm ảnh</span>
              </button>
            </div>
            {photos.length > 0 && <p className="text-xs text-t3 mt-1">{photos.length} ảnh</p>}
            {photos.length < 2 && <p className="text-xs text-red-400 mt-1">Cần ít nhất 2 ảnh</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.1] flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || photos.length < 2}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {saving ? 'Đang lưu...' : 'Xác nhận hoàn thành thanh lý'}
          </button>
        </div>
      </div>
    </div>
  )
}
