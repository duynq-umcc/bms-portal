import { useState, useRef, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import { useGetRadiationPermits, useCreateRadiationPermit } from '@/hooks/useRadiationPermits'
import { uploadRadiationPermitDoc } from '@/utils/storageUpload'
import { toast } from '@/components/ui/Toast'
import type { RadiationPermit, RadiationPermitStatus } from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Plus, Eye, Upload, FileText,
  Loader2, X, Radio
} from 'lucide-react'

const STATUS_CONFIG: Record<RadiationPermitStatus, { label: string; cls: string; border: string }> = {
  valid: { label: 'Còn hiệu lực', cls: 'badge-success', border: 'border-green-500/20' },
  expiring_soon: { label: 'Sắp hết hạn', cls: 'badge-warning', border: 'border-amber-500/40' },
  expired: { label: 'Đã hết hạn', cls: 'badge-danger', border: 'border-red-500/40' },
}

function PermitCard({ permit }: { permit: RadiationPermit & { id: string } }) {
  const cfg = STATUS_CONFIG[permit.status]
  const daysLeft = permit.expiryDate
    ? Math.max(0, Math.round((permit.expiryDate.toDate().getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className={`card p-4 border ${cfg.border} ${permit.status === 'expired' ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          permit.status === 'expired' ? 'bg-red-500/10 text-red-400' :
          permit.status === 'expiring_soon' ? 'bg-amber-500/10 text-amber-400' :
          'bg-purple-500/10 text-purple-400'
        }`}>
          <Radio className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
            {permit.status === 'expired' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
          <h4 className="font-semibold text-gray-100 text-sm truncate">{permit.equipmentName}</h4>
          <p className="text-xs text-t3 mt-0.5">
            {permit.equipmentCode} · GP số: <span className="font-mono">{permit.permitNumber}</span>
          </p>
          <p className="text-xs text-t3">Cấp bởi: {permit.issuedBy}</p>
          <p className="text-xs text-t3">Người phụ trách: {permit.safetyOfficer}</p>
        </div>
      </div>
      <div className="flex justify-between text-xs text-t3 mt-3 pt-3 border-t border-white/[0.06]">
        <span>Ngày hết hạn</span>
        <span className={`font-medium ${
          permit.status === 'expired' ? 'text-red-400' :
          permit.status === 'expiring_soon' ? 'text-amber-400' :
          'text-gray-400'
        }`}>
          {permit.expiryDate ? format(permit.expiryDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
          {daysLeft !== null && permit.status !== 'valid' && ` (${daysLeft}d)`}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        {permit.licenseFileUrl && (
          <a
            href={permit.licenseFileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1 py-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Xem file
          </a>
        )}
      </div>
    </div>
  )
}

function AddPermitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create, creating } = useCreateRadiationPermit()
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [equipmentName, setEquipmentName] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [permitNumber, setPermitNumber] = useState('')
  const [issuedBy, setIssuedBy] = useState('Cục An toàn bức xạ và hạt nhân')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [safetyOfficer, setSafetyOfficer] = useState('')

  const handleFileUpload = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Chỉ chấp nhận file PDF, JPG, PNG, WebP')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File quá lớn — tối đa 20MB')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const tempId = `temp_${Date.now()}`
      const url = await uploadRadiationPermitDoc(tempId, file, (pct) => setProgress(pct))
      setUploadedUrl(url)
      setFileName(file.name)
      toast.success('Đã tải file lên')
    } catch {
      toast.error('Tải file thất bại')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleSubmit = async () => {
    if (!equipmentName || !permitNumber || !expiryDate || !safetyOfficer) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc')
      return
    }
    const ok = await create({
      equipmentName,
      equipmentCode,
      permitNumber,
      issuedBy,
      issuedDate: issuedDate ? new Date(issuedDate) : new Date(),
      expiryDate: new Date(expiryDate),
      licenseFileUrl: uploadedUrl,
      safetyOfficer,
    })
    if (ok) {
      onClose()
      setEquipmentName(''); setEquipmentCode(''); setPermitNumber('')
      setIssuedDate(''); setExpiryDate(''); setSafetyOfficer('')
      setUploadedUrl(''); setFileName('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm giấy phép bức xạ" size="md">
      <div className="space-y-4">
        <div className="card p-3 border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-start gap-2">
            <Radio className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-t3">
              Giấy phép sử dụng thiết bị bức xạ theo quy định của Cục An toàn bức xạ và hạt nhân (Bộ Y tế).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Tên thiết bị <span className="text-red-400">*</span></label>
            <input value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} className="input-field" placeholder="VD: Máy X-quang kỹ thuật số DR-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Mã thiết bị</label>
            <input value={equipmentCode} onChange={(e) => setEquipmentCode(e.target.value)} className="input-field" placeholder="Mã tài sản..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Số giấy phép <span className="text-red-400">*</span></label>
            <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className="input-field" placeholder="VD: GPBX-2026-001" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Cơ quan cấp</label>
            <input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ngày cấp</label>
            <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ngày hết hạn <span className="text-red-400">*</span></label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Người phụ trách ATBX <span className="text-red-400">*</span></label>
            <input value={safetyOfficer} onChange={(e) => setSafetyOfficer(e.target.value)} className="input-field" placeholder="Họ tên người phụ trách an toàn bức xạ" />
          </div>
        </div>

        {/* File upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">File giấy phép</label>
          {uploadedUrl ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{fileName}</p>
                <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline">Xem file</a>
              </div>
              <button onClick={() => { setUploadedUrl(''); setFileName('') }} className="text-t3 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : uploading ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex justify-between text-xs text-t2 mb-1.5">
                <span>Đang tải lên... {progress}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-white/15 hover:border-white/25 bg-white/[0.02] cursor-pointer py-6"
            >
              <Upload className="w-5 h-5 text-t2" />
              <span className="text-xs text-t2">Click để chọn file (PDF, ảnh — tối đa 20MB)</span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
        </div>

        <button onClick={handleSubmit} disabled={creating || uploading}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : 'Lưu giấy phép bức xạ'}
        </button>
      </div>
    </Modal>
  )
}

export default function RadiationPermitSection() {
  const { permits, loading } = useGetRadiationPermits()
  const [showAdd, setShowAdd] = useState(false)

  const expired = permits.filter((p) => p.status === 'expired')
  const expiringSoon = permits.filter((p) => p.status === 'expiring_soon')
  const valid = permits.filter((p) => p.status === 'valid')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-100 text-sm">Giấy phép bức xạ</h3>
          <p className="text-xs text-t3 mt-0.5">Theo quy định Cục ATBX&HN — Bộ Y tế</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Thêm giấy phép
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-t3">{permits.length} giấy phép ·</span>
        {expired.length > 0 && <span className="badge-danger badge-sm">{expired.length} hết hạn</span>}
        {expiringSoon.length > 0 && <span className="badge-warning badge-sm">{expiringSoon.length} sắp hết</span>}
        {valid.length > 0 && <span className="badge-success badge-sm">{valid.length} còn hiệu lực</span>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 h-32 animate-pulse bg-white/[0.03]" />)}
        </div>
      ) : permits.length === 0 ? (
        <div className="text-center py-12 text-t2 text-sm">
          <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Chưa có giấy phép bức xạ nào</p>
          <p className="text-xs text-t3 mt-1">Thiết bị X-quang, CT, MRI cần có giấy phép bức xạ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {permits.map((p) => <PermitCard key={p.id} permit={p} />)}
        </div>
      )}

      <AddPermitModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
