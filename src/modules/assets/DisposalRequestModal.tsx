import { useState, useRef } from 'react'
import { X, ChevronRight, Upload, Image, Plus, Trash2, Check } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import { addDisposalRequest, updateAsset } from '@/firebase/db'
import { createNotificationForRoles } from '@/utils/createNotification'
import { toast } from '@/components/ui/Toast'
import type { Asset } from '@/firebase/types'
import type { DisposalRequest, DisposalReason, DisposalMethod, DisposalAttachment, DisposalRequestStatus } from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcBookValue(asset: Asset): { bookValue: number; accumulated: number; yearsOwned: string; depPct: number } {
  if (!asset.purchaseDate) return { bookValue: asset.purchasePrice, accumulated: 0, yearsOwned: '0 năm', depPct: 0 }
  const now = Date.now()
  const purchaseMs = asset.purchaseDate.toDate().getTime()
  const monthsElapsed = Math.max(0, (now - purchaseMs) / (1000 * 60 * 60 * 24 * 30))
  const years = monthsElapsed / 12
  const depreciable = asset.purchasePrice - asset.salvageValue
  const monthly = depreciable / (asset.usefulLifeYears * 12)
  const monthsCapped = Math.min(monthsElapsed, asset.usefulLifeYears * 12)
  const accumulated = Math.min(monthly * monthsCapped, depreciable)
  const bookValue = Math.max(asset.salvageValue, asset.purchasePrice - monthly * monthsCapped)
  const depPct = asset.purchasePrice > 0 ? (accumulated / asset.purchasePrice) * 100 : 0
  const y = Math.floor(years)
  const m = Math.round(monthsElapsed % 12)
  const yearsOwned = `${y} năm ${m} tháng`
  return { bookValue, accumulated, yearsOwned, depPct }
}

const formatVND = (n: number) =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(1)} tỷ`
    : n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n.toLocaleString('vi-VN') + ' đ'

const REASON_LABELS: Record<DisposalReason, string> = {
  broken_unrepairable: 'Hư hỏng không sửa được',
  obsolete: 'Lỗi thời công nghệ',
  end_of_life: 'Hết khấu hao, lạc hậu',
  damaged_beyond_repair: 'Hư hỏng nặng do sự cố',
  regulatory_compliance: 'Không đáp ứng quy định pháp lý',
  other: 'Lý do khác',
}

const METHOD_LABELS: Record<DisposalMethod, string> = {
  auction: 'Đấu giá công khai',
  sell_fixed_price: 'Bán giá cố định',
  transfer_to_dept: 'Điều chuyển nội bộ',
  donate: 'Hiến tặng / Chuyển giao',
  scrap: 'Thanh lý phế liệu',
  destroy: 'Tiêu hủy',
}

const STEPS = ['Thông tin tài sản', 'Tình trạng hư hỏng', 'Đề xuất thanh lý', 'Tài liệu đính kèm']

interface Props {
  isOpen: boolean
  onClose: () => void
  asset: Asset
  existingRequest?: DisposalRequest & { id: string }
}

// ─── photo upload ─────────────────────────────────────────────────────────────

interface PhotoUpload {
  file?: File
  preview?: string
  caption: string
  uploading: boolean
  progress: number
  url?: string
}

function PhotoUploadGrid({ photos, onChange }: { photos: PhotoUpload[]; onChange: (p: PhotoUpload[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const addPhoto = () => inputRef.current?.click()

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPhotos: PhotoUpload[] = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      caption: '',
      uploading: false,
      progress: 0,
    }))
    onChange([...photos, ...newPhotos])
    e.target.value = ''
  }

  const updatePhoto = (i: number, patch: Partial<PhotoUpload>) => {
    const updated = [...photos]
    updated[i] = { ...updated[i], ...patch }
    onChange(updated)
  }

  const removePhoto = (i: number) => {
    if (photos[i].preview) URL.revokeObjectURL(photos[i].preview)
    onChange(photos.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                  <span className="text-xs text-white">{p.progress}%</span>
                </div>
              </div>
            )}
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
            <input
              value={p.caption}
              onChange={(e) => updatePhoto(i, { caption: e.target.value })}
              placeholder="Mô tả ảnh..."
              className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-[10px] text-white placeholder-t3 focus:outline-none"
            />
          </div>
        ))}
        <button
          onClick={addPhoto}
          className="w-full aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-amber/50 flex flex-col items-center justify-center gap-1 text-t2 hover:text-amber transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px]">Thêm ảnh</span>
        </button>
      </div>
      {photos.length > 0 && (
        <p className="text-xs text-t3">{photos.length} ảnh đã chọn</p>
      )}
    </div>
  )
}

// ─── step content ─────────────────────────────────────────────────────────────

function Step1AssetInfo({ asset }: { asset: Asset }) {
  const dep = calcBookValue(asset)
  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3 border border-amber/20">
        <div className="flex items-center gap-2 text-amber text-xs font-medium">
          <Check className="w-3.5 h-3.5" />
          Tài sản được chọn để thanh lý
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-t3 text-xs">Mã tài sản</span>
            <p className="font-mono text-gray-200">{asset.code}</p>
          </div>
          <div>
            <span className="text-t3 text-xs">Danh mục</span>
            <p className="text-gray-200"><span className="badge-info text-xs">{asset.category}</span></p>
          </div>
          <div className="col-span-2">
            <span className="text-t3 text-xs">Tên tài sản</span>
            <p className="font-semibold text-gray-100">{asset.name}</p>
          </div>
          <div>
            <span className="text-t3 text-xs">Phòng ban</span>
            <p className="text-gray-200">{asset.dept}</p>
          </div>
          <div>
            <span className="text-t3 text-xs">Vị trí</span>
            <p className="text-gray-200">{asset.location}</p>
          </div>
          <div>
            <span className="text-t3 text-xs">Ngày mua</span>
            <p className="text-gray-200">
              {asset.purchaseDate ? format(asset.purchaseDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-t3 text-xs">Nguyên giá</span>
            <p className="text-gray-200 font-semibold">{formatVND(asset.purchasePrice)}</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h4 className="text-xs font-medium text-t3 mb-3">Tính khấu hao đến hiện tại</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-t3">Đã sử dụng</p>
            <p className="font-semibold text-gray-200">{dep.yearsOwned}</p>
          </div>
          <div>
            <p className="text-xs text-t3">Đã khấu hao</p>
            <p className="font-semibold text-red-400">{dep.depPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-t3">Giá trị còn lại</p>
            <p className="font-bold text-amber text-sm">{formatVND(dep.bookValue)}</p>
          </div>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 mt-3">
          <div className="bg-red-500/60 h-2 rounded-full" style={{ width: `${Math.min(100, dep.depPct)}%` }} />
        </div>
        <p className="text-xs text-t3 mt-2">
          Phương pháp: {asset.depreciationMethod === 'straight_line' ? 'Khấu hao đường thẳng' : 'Khấu hao giảm dần'} · Tuổi thọ: {asset.usefulLifeYears} năm
        </p>
      </div>
    </div>
  )
}

interface Step2Data {
  requestReason: DisposalReason | ''
  conditionDescription: string
  repairAttempts: string
  repairCostToDate: number
  hasRepairWOs: boolean
}

function Step2Condition({ data, onChange }: { data: Step2Data; onChange: (d: Step2Data) => void }) {
  const reasons: DisposalReason[] = [
    'broken_unrepairable', 'obsolete', 'end_of_life',
    'damaged_beyond_repair', 'regulatory_compliance', 'other',
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Lý do đề xuất thanh lý <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {reasons.map((r) => (
            <label
              key={r}
              className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                data.requestReason === r
                  ? 'border-amber bg-amber/10 text-amber'
                  : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={data.requestReason === r}
                onChange={() => onChange({ ...data, requestReason: r })}
                className="mt-0.5 accent-amber"
              />
              <span className="text-sm">{REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Mô tả tình trạng hư hỏng <span className="text-red-400">*</span>
        </label>
        <textarea
          value={data.conditionDescription}
          onChange={(e) => onChange({ ...data, conditionDescription: e.target.value })}
          rows={4}
          className="input-field w-full text-sm"
          placeholder="Mô tả chi tiết tình trạng hư hỏng, các bộ phận không còn hoạt động, nguyên nhân hư hỏng..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Các lần sửa chữa đã thực hiện</label>
        <textarea
          value={data.repairAttempts}
          onChange={(e) => onChange({ ...data, repairAttempts: e.target.value })}
          rows={3}
          className="input-field w-full text-sm"
          placeholder="VD: Đã sửa 3 lần trong năm 2025, tổng chi phí 15 triệu đồng..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Tổng chi phí sửa chữa đã bỏ ra (VNĐ)</label>
        <input
          type="number"
          value={data.repairCostToDate || ''}
          onChange={(e) => onChange({ ...data, repairCostToDate: Number(e.target.value) })}
          className="input-field w-full"
          placeholder="0"
          min={0}
        />
        {data.repairCostToDate > 0 && (
          <p className="text-xs text-t3 mt-1">Tổng: {formatVND(data.repairCostToDate)}</p>
        )}
      </div>
    </div>
  )
}

interface Step3Data {
  proposedDisposalMethod: DisposalMethod | ''
  proposedDisposalValue: number
  proposedTransferDept: string
  justification: string
  targetDate: string
}

function Step3Proposal({ data, onChange, bookValue }: { data: Step3Data; onChange: (d: Step3Data) => void; bookValue: number }) {
  const methods: DisposalMethod[] = ['auction', 'sell_fixed_price', 'transfer_to_dept', 'donate', 'scrap', 'destroy']

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Hình thức thanh lý đề xuất <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {methods.map((m) => (
            <label
              key={m}
              className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                data.proposedDisposalMethod === m
                  ? 'border-amber bg-amber/10 text-amber'
                  : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={data.proposedDisposalMethod === m}
                onChange={() => onChange({ ...data, proposedDisposalMethod: m })}
                className="accent-amber"
              />
              <span className="text-sm">{METHOD_LABELS[m]}</span>
            </label>
          ))}
        </div>
      </div>

      {data.proposedDisposalMethod === 'transfer_to_dept' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Phòng ban nhận điều chuyển</label>
          <select
            value={data.proposedTransferDept}
            onChange={(e) => onChange({ ...data, proposedTransferDept: e.target.value })}
            className="input-field w-full"
          >
            <option value="">-- Chọn phòng ban --</option>
            <option value="admin">Ban Giám đốc</option>
            <option value="it">CNTT / Hành chính</option>
            <option value="electrical">Điện</option>
            <option value="medical">Y tế</option>
            <option value="warehouse">Kho</option>
            <option value="civil">Xây dựng</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Giá trị thanh lý đề xuất (VNĐ)
        </label>
        <input
          type="number"
          value={data.proposedDisposalValue || ''}
          onChange={(e) => onChange({ ...data, proposedDisposalValue: Number(e.target.value) })}
          className="input-field w-full"
          placeholder="0"
          min={0}
        />
        <p className="text-xs text-t3 mt-1">
          Giá trị sổ sách còn lại: <span className="text-amber">{formatVND(bookValue)}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Lý do chi tiết <span className="text-red-400">*</span>
        </label>
        <textarea
          value={data.justification}
          onChange={(e) => onChange({ ...data, justification: e.target.value })}
          rows={4}
          className="input-field w-full text-sm"
          placeholder="Phân tích chi phí-lợi ích việc tiếp tục sử dụng so với thanh lý tài sản này..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Thời gian đề xuất hoàn thành</label>
        <input
          type="date"
          value={data.targetDate}
          onChange={(e) => onChange({ ...data, targetDate: e.target.value })}
          className="input-field w-full"
        />
      </div>
    </div>
  )
}

interface Step4Data {
  photos: PhotoUpload[]
  attachments: { file?: File; name: string; type: string; url?: string; uploading: boolean; progress: number }[]
}

function Step4Attachments({ data, onChange }: { data: Step4Data; onChange: (d: Step4Data) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasMinPhotos = data.photos.length >= 2

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles = files.map((f) => ({
      file: f,
      name: f.name,
      type: f.type,
      uploading: false,
      progress: 0,
    }))
    onChange({ ...data, attachments: [...data.attachments, ...newFiles] })
    e.target.value = ''
  }

  const removeFile = (i: number) => {
    const updated = [...data.attachments]
    updated.splice(i, 1)
    onChange({ ...data, attachments: updated })
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-1">
          Ảnh tình trạng hư hỏng <span className="text-red-400">*</span>
        </h4>
        <p className="text-xs text-t3 mb-3">Tải lên ít nhất 2 ảnh minh chứng tình trạng tài sản</p>
        <PhotoUploadGrid photos={data.photos} onChange={(p) => onChange({ ...data, photos: p })} />
        {!hasMinPhotos && (
          <p className="text-xs text-red-400 mt-2">
            Cần ít nhất 2 ảnh — hiện tại {data.photos.length} ảnh
          </p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-1">Tài liệu đính kèm khác</h4>
        <p className="text-xs text-t3 mb-3">Biên bản hư hỏng, báo giá sửa chữa, tài liệu khác (PDF hoặc ảnh)</p>
        <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={addFiles} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-white/15 text-t2 hover:border-amber/50 hover:text-amber transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          Thêm tài liệu
        </button>
        {data.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {data.attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className="text-xs text-gray-300 truncate flex-1">{a.name}</span>
                <span className="text-[10px] text-t3">{a.type}</span>
                <button onClick={() => removeFile(i)} className="p-1 text-t3 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-amber/5 border border-amber/20">
        <p className="text-xs text-amber">
          <span className="font-medium">Đủ điều kiện nộp:</span>{' '}
          {hasMinPhotos
            ? 'Đã có đủ ảnh hư hỏng (tối thiểu 2 ảnh)'
            : 'Chưa đủ — cần thêm ảnh hư hỏng'}
        </p>
      </div>
    </div>
  )
}

// ─── main modal ───────────────────────────────────────────────────────────────

export default function DisposalRequestModal({ isOpen, onClose, asset, existingRequest }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const isEditMode = !!existingRequest

  const [step2, setStep2] = useState<Step2Data>({
    requestReason: existingRequest?.requestReason || '',
    conditionDescription: existingRequest?.conditionDescription || '',
    repairAttempts: existingRequest?.repairAttempts || '',
    repairCostToDate: existingRequest?.repairCostToDate ?? 0,
    hasRepairWOs: false,
  })

  const [step3, setStep3] = useState<Step3Data>({
    proposedDisposalMethod: existingRequest?.proposedDisposalMethod || '',
    proposedDisposalValue: existingRequest?.proposedDisposalValue ?? 0,
    proposedTransferDept: existingRequest?.proposedTransferDept || '',
    justification: existingRequest?.justification || '',
    targetDate: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      return d.toISOString().split('T')[0]
    })(),
  })

  const [step4, setStep4] = useState<Step4Data>(() => {
    const existingAttachments = existingRequest?.attachments || []
    // Separate existing attachments into photos and other docs
    const photoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
    const photos: Step4Data['photos'] = []
    const otherAttachments: Step4Data['attachments'] = []
    for (const a of existingAttachments) {
      const ext = (a.fileName || '').split('.').pop()?.toLowerCase()
      if (ext && photoExtensions.includes(ext)) {
        photos.push({ url: a.url, caption: a.fileName, uploading: false, progress: 100 })
      } else {
        otherAttachments.push({ name: a.fileName, type: a.type || '', url: a.url, uploading: false, progress: 100 })
      }
    }
    return { photos, attachments: otherAttachments }
  })

  const dep = calcBookValue(asset)

  const canSubmit =
    step2.requestReason &&
    step2.conditionDescription.trim() &&
    step3.proposedDisposalMethod &&
    step3.justification.trim() &&
    step4.photos.length >= 2

  const uploadAllFiles = async (requestId: string): Promise<DisposalAttachment[]> => {
    const attachments: DisposalAttachment[] = []

    for (const photo of step4.photos) {
      // Keep existing uploaded photos (those with URL but no file)
      if (photo.url && !photo.file) {
        attachments.push({ url: photo.url, fileName: photo.caption || 'photo', type: 'image' })
        continue
      }
      if (!photo.file) continue
      const ext = photo.file.name.split('.').pop()
      const filename = `photo_${Date.now()}.${ext}`
      const path = `disposal/requests/${requestId}/${filename}`
      const storageRef = ref(storage, path)
      try {
        const snap = await uploadBytesResumable(storageRef, photo.file)
        const url = await getDownloadURL(snap.ref)
        attachments.push({ url, fileName: photo.file.name, type: photo.file.type })
      } catch { /* skip failed uploads */ }
    }

    for (const att of step4.attachments) {
      // Keep existing attachment URLs
      if (att.url && !att.file) {
        attachments.push({ url: att.url, fileName: att.name, type: att.type })
        continue
      }
      if (!att.file) continue
      const path = `disposal/requests/${requestId}/${att.file.name}`
      const storageRef = ref(storage, path)
      try {
        const snap = await uploadBytesResumable(storageRef, att.file)
        const url = await getDownloadURL(snap.ref)
        attachments.push({ url, fileName: att.file.name, type: att.file.type })
      } catch { /* skip */ }
    }

    return attachments
  }

  const handleSubmit = async (asDraft: boolean) => {
    if (!asDraft && !canSubmit) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc')
      return
    }
    setSaving(true)
    try {
      if (isEditMode && existingRequest) {
        const uploadedAttachments = await uploadAllFiles(existingRequest.id)
        const updates = {
          requestReason: step2.requestReason as DisposalReason,
          conditionDescription: step2.conditionDescription,
          repairAttempts: step2.repairAttempts,
          repairCostToDate: step2.repairCostToDate,
          proposedDisposalMethod: step3.proposedDisposalMethod as DisposalMethod,
          proposedDisposalValue: step3.proposedDisposalValue,
          proposedTransferDept: step3.proposedDisposalMethod === 'transfer_to_dept' ? step3.proposedTransferDept : null,
          justification: step3.justification,
          status: (asDraft ? 'draft' : 'pending_review') as DisposalRequestStatus,
          updatedAt: Timestamp.now(),
        }
        const { updateDisposalRequest: upd } = await import('@/firebase/db')
        await upd(existingRequest.id, {
          ...updates,
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        })
        toast.success(asDraft ? 'Đã lưu nháp' : 'Đề xuất đã được cập nhật')
        onClose()
        return
      }

      // New request — create doc first to get real ID for file uploads
      const docData = {
        assetId: asset.id,
        assetName: asset.name,
        assetCode: asset.code,
        assetCategory: asset.category,
        department: asset.dept,
        location: asset.location,
        purchaseDate: asset.purchaseDate,
        purchasePrice: asset.purchasePrice,
        currentBookValue: dep.bookValue,
        depreciationYears: asset.usefulLifeYears,
        requestedBy: user!.uid,
        requestedByName: user!.displayName || user!.email,
        requestedAt: Timestamp.now(),
        requestReason: step2.requestReason as DisposalReason,
        conditionDescription: step2.conditionDescription,
        repairAttempts: step2.repairAttempts,
        repairCostToDate: step2.repairCostToDate,
        proposedDisposalMethod: step3.proposedDisposalMethod as DisposalMethod,
        proposedDisposalValue: step3.proposedDisposalValue,
        proposedTransferDept: step3.proposedDisposalMethod === 'transfer_to_dept' ? step3.proposedTransferDept : null,
        justification: step3.justification,
        attachments: [] as DisposalAttachment[],
        status: (asDraft ? 'draft' : 'pending_review') as DisposalRequestStatus,
        councilId: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      const docRef = await addDisposalRequest(docData)

      // Upload files with real document ID
      const uploadedAttachments = await uploadAllFiles(docRef.id)
      if (uploadedAttachments.length > 0) {
        const { updateDisposalRequest: upd } = await import('@/firebase/db')
        await upd(docRef.id, { attachments: uploadedAttachments })
      }

      // Update asset status
      await updateAsset(asset.id, { status: 'maintenance' as const })

      if (!asDraft) {
        await createNotificationForRoles(['admin', 'manager'], {
          title: `Đề xuất thanh lý: ${asset.name}`,
          body: `${user!.displayName || user!.email} đề xuất thanh lý ${asset.name} — ${REASON_LABELS[step2.requestReason as DisposalReason]}`,
          type: 'system',
          link: `/assets?tab=disposal&req=${docRef.id}`,
          priority: 'medium',
        })
      }

      toast.success(asDraft ? 'Đã lưu nháp' : 'Đề xuất thanh lý đã được gửi')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Lưu đề xuất thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1] shrink-0">
          <div>
            <h3 className="font-semibold text-gray-100 text-base">{isEditMode ? 'Sửa đề xuất thanh lý' : 'Đề xuất thanh lý tài sản'}</h3>
            <p className="text-xs text-t3 mt-0.5">{asset.name} — {asset.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1 ${i < STEPS.length - 1 ? 'border-r border-white/10' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mb-1 transition-colors ${
                    i < step ? 'bg-amber text-gray-900'
                      : i === step ? 'bg-amber/20 text-amber border border-amber'
                      : 'bg-white/5 text-t3'
                  }`}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] text-center ${i === step ? 'text-amber' : 'text-t3'}`}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && <Step1AssetInfo asset={asset} />}
          {step === 1 && <Step2Condition data={step2} onChange={setStep2} />}
          {step === 2 && <Step3Proposal data={step3} onChange={setStep3} bookValue={dep.bookValue} />}
          {step === 3 && <Step4Attachments data={step4} onChange={setStep4} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.1] flex justify-between shrink-0">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
          >
            {step === 0 ? 'Đóng' : '← Quay lại'}
          </button>
          <div className="flex gap-2">
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !step2.requestReason}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                Tiếp tục <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm border border-white/15 text-gray-300 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                >
                  Lưu nháp
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={saving || !canSubmit}
                  className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40"
                >
                  {saving ? 'Đang gửi...' : 'Nộp đề xuất →'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
