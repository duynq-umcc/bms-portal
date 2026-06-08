import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { addPestControlLog } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { Bug } from 'lucide-react'

interface PestControlModalProps {
  open: boolean
  onClose: () => void
}

const AREAS = [
  { key: 'kitchen', label: 'Nhà bếp' },
  { key: 'warehouse', label: 'Kho' },
  { key: 'wards', label: 'Khu điều trị' },
  { key: 'operating_theatres', label: 'Phòng mổ' },
  { key: 'pharmacy', label: 'Dược phòng' },
  { key: 'exterior', label: 'Khu vực ngoài' },
  { key: 'laboratory', label: 'Xét nghiệm' },
  { key: 'morgue', label: 'Nhà xác' },
  { key: 'sterilization', label: 'Tiệt khuẩn' },
]

const METHOD_LABELS: Record<string, string> = {
  spray: 'Xịt thuốc',
  trap: 'Bẫy',
  bait: 'Mồi độc',
  fumigation: 'Khói/hơi',
  other: 'Khác',
}

export default function PestControlModal({ open, onClose }: PestControlModalProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    contractorName: '',
    areas: [] as string[],
    chemicalUsed: '',
    method: 'spray' as 'spray' | 'trap' | 'bait' | 'fumigation' | 'other',
    certificateNumber: '',
    nextScheduledDate: '',
    operatorName: user?.displayName || user?.email || '',
    notes: '',
  })

  const toggleArea = (key: string) => {
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(key)
        ? f.areas.filter((a) => a !== key)
        : [...f.areas, key],
    }))
  }

  const handleSave = async () => {
    if (!form.date) { toast.error('Vui lòng chọn ngày thực hiện'); return }
    if (!form.contractorName.trim()) { toast.error('Vui lòng nhập tên nhà thầu'); return }
    if (form.areas.length === 0) { toast.error('Vui lòng chọn ít nhất 1 khu vực'); return }
    if (!form.operatorName.trim()) { toast.error('Vui lòng nhập tên người thực hiện'); return }

    setSaving(true)
    try {
      await addPestControlLog({
        date: Timestamp.fromDate(new Date(form.date)),
        contractorId: '',
        contractorName: form.contractorName,
        areas: form.areas,
        chemicalUsed: form.chemicalUsed,
        method: form.method,
        certificateNumber: form.certificateNumber || undefined,
        nextScheduledDate: form.nextScheduledDate ? Timestamp.fromDate(new Date(form.nextScheduledDate)) : undefined,
        operatorName: form.operatorName,
        notes: form.notes || undefined,
        createdAt: Timestamp.now(),
      })
      toast.success('Đã lưu nhật ký kiểm soát côn trùng')
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nhật ký kiểm soát côn trùng" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ngày thực hiện *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Người thực hiện *</label>
            <input
              value={form.operatorName}
              onChange={(e) => setForm((f) => ({ ...f, operatorName: e.target.value }))}
              className="input-field"
              placeholder="Tên người thực hiện..."
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Nhà thầu *</label>
            <input
              value={form.contractorName}
              onChange={(e) => setForm((f) => ({ ...f, contractorName: e.target.value }))}
              className="input-field"
              placeholder="Tên công ty/nhà thầu kiểm soát côn trùng..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Khu vực *</label>
          <div className="grid grid-cols-3 gap-2">
            {AREAS.map((area) => (
              <label
                key={area.key}
                className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  form.areas.includes(area.key)
                    ? 'border-amber bg-amber/10 text-amber'
                    : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.areas.includes(area.key)}
                  onChange={() => toggleArea(area.key)}
                  className="accent-amber"
                />
                <span className="text-sm">{area.label}</span>
              </label>
            ))}
          </div>
          {form.areas.length === 0 && (
            <p className="text-xs text-red-400 mt-1">Chọn ít nhất 1 khu vực</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hóa chất sử dụng</label>
            <input
              value={form.chemicalUsed}
              onChange={(e) => setForm((f) => ({ ...f, chemicalUsed: e.target.value }))}
              className="input-field"
              placeholder="VD: Fenobucarb, Cypermethrin..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phương pháp</label>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as typeof f.method }))}
              className="input-field"
            >
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Chứng chỉ số</label>
            <input
              value={form.certificateNumber}
              onChange={(e) => setForm((f) => ({ ...f, certificateNumber: e.target.value }))}
              className="input-field"
              placeholder="Số chứng chỉ phòng trừ..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Lịch thực hiện tiếp theo</label>
            <input
              type="date"
              value={form.nextScheduledDate}
              onChange={(e) => setForm((f) => ({ ...f, nextScheduledDate: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Ghi chú</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input-field w-full"
            rows={3}
            placeholder="Kết quả kiểm tra, phát hiện đặc biệt, khuyến nghị..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Bug className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu nhật ký'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}
