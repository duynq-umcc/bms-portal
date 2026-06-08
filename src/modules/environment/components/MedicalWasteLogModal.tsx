import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateMedicalWasteLog } from '@/hooks/useMedicalWasteLogs'
import type { MedicalWaste } from '@/types/firestore'
import { toast } from '@/components/ui/Toast'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function MedicalWasteLogModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { create, creating } = useCreateMedicalWasteLog()

  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [recordedBy] = useState(user?.uid || '')
  const [recordedByName, setRecordedByName] = useState(user?.displayName || '')
  const [waste, setWaste] = useState<MedicalWaste>({ groupB: 0, groupC: 0, groupD: 0, groupE: 0 })
  const [collectedBy, setCollectedBy] = useState('')
  const [collectionReceiptNo, setCollectionReceiptNo] = useState('')
  const [storageLocation, setStorageLocation] = useState('')
  const [notes, setNotes] = useState('')

  const total = waste.groupB + waste.groupC + waste.groupD + waste.groupE

  const handleSubmit = async () => {
    if (!recordedByName.trim()) {
      toast.error('Vui lòng nhập tên người ghi')
      return
    }
    const ok = await create({
      logDate: new Date(logDate),
      recordedBy,
      recordedByName,
      waste,
      collectedBy,
      collectionReceiptNo,
      storageLocation,
      notes,
    })
    if (ok) {
      onSuccess?.()
      onClose()
      setWaste({ groupB: 0, groupC: 0, groupD: 0, groupE: 0 })
      setCollectedBy('')
      setCollectionReceiptNo('')
      setStorageLocation('')
      setNotes('')
    }
  }

  const setWasteGroup = (key: keyof MedicalWaste, value: string) => {
    setWaste((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Ghi nhận chất thải y tế" size="md">
      <div className="space-y-4">
        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Ngày ghi</label>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Người ghi nhận</label>
            <input value={recordedByName} onChange={(e) => setRecordedByName(e.target.value)} className="input-field" placeholder="Tên..." />
          </div>
        </div>

        {/* Waste weights */}
        <div>
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Khối lượng theo nhóm</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 border border-red-500/20 bg-red-500/5">
              <label className="block text-xs font-medium text-red-400 mb-1.5">
                Nhóm B <span className="text-t3 font-normal">(Túi đỏ — Lây nhiễm)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={waste.groupB || ''} onChange={(e) => setWasteGroup('groupB', e.target.value)} className="input-field text-sm" placeholder="0" />
                <span className="text-xs text-t3">kg</span>
              </div>
            </div>
            <div className="card p-3 border border-gray-500/20 bg-white/[0.02]">
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Nhóm C <span className="text-t3 font-normal">(Túi đen — Hóa học)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={waste.groupC || ''} onChange={(e) => setWasteGroup('groupC', e.target.value)} className="input-field text-sm" placeholder="0" />
                <span className="text-xs text-t3">kg</span>
              </div>
            </div>
            <div className="card p-3 border border-yellow-500/20 bg-yellow-500/5">
              <label className="block text-xs font-medium text-yellow-400 mb-1.5">
                Nhóm D <span className="text-t3 font-normal">(Hộp vàng — Sắc nhọn)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={waste.groupD || ''} onChange={(e) => setWasteGroup('groupD', e.target.value)} className="input-field text-sm" placeholder="0" />
                <span className="text-xs text-t3">kg</span>
              </div>
            </div>
            <div className="card p-3 border border-green-500/20 bg-green-500/5">
              <label className="block text-xs font-medium text-green-400 mb-1.5">
                Nhóm E <span className="text-t3 font-normal">(Túi xanh — Thông thường)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={waste.groupE || ''} onChange={(e) => setWasteGroup('groupE', e.target.value)} className="input-field text-sm" placeholder="0" />
                <span className="text-xs text-t3">kg</span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="text-sm text-t3">Tổng: </span>
            <span className="text-sm font-bold text-gray-100">{total.toFixed(1)} kg</span>
          </div>
        </div>

        {/* Collector info */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Đơn vị thu gom</label>
          <input value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)} className="input-field" placeholder="VD: URENCO, Công ty Môi trường..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Số phiếu xác nhận thu gom</label>
          <input value={collectionReceiptNo} onChange={(e) => setCollectionReceiptNo(e.target.value)} className="input-field" placeholder="VD: PXN-2026-001..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Khu vực lưu giữ tạm</label>
          <input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="input-field" placeholder="VD: Tầng 1, Khu B..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Ghi chú</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} />
        </div>

        <button onClick={handleSubmit} disabled={creating}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : 'Lưu nhật ký chất thải y tế'}
        </button>
      </div>
    </Modal>
  )
}
