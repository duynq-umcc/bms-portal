import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import type { AlertTrigger } from '@/firebase/types'

interface RuleBuilderModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type Role = 'admin' | 'manager' | 'technician'

const TRIGGERS: { value: AlertTrigger; label: string }[] = [
  { value: 'inventory', label: 'Vật tư tồn kho' },
  { value: 'devices', label: 'Thiết bị y tế' },
  { value: 'documents', label: 'Chứng từ & pháp lý' },
  { value: 'workOrders', label: 'Work Orders' },
]

const TRIGGER_DEFAULTS: Record<AlertTrigger, number> = {
  inventory: 50,
  devices: 7,
  documents: 30,
  workOrders: 48,
}

const TRIGGER_SUGGESTIONS: Record<AlertTrigger, string> = {
  inventory: 'Vật tư cần đặt',
  devices: 'Thiết bị quá hạn bảo trì',
  documents: 'Chứng từ sắp hết hạn',
  workOrders: 'Work order chưa xử lý',
}

const THRESHOLD_LABELS: Record<AlertTrigger, string> = {
  inventory: 'Tồn kho dưới [X]% định mức',
  devices: 'Hạn bảo trì còn dưới [X] ngày',
  documents: 'Hạn hiệu lực còn dưới [X] ngày',
  workOrders: 'Chưa xử lý quá [X] giờ',
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  technician: 'Technician',
}

function getPreviewBody(trigger: AlertTrigger, threshold: number): string {
  const labels = THRESHOLD_LABELS[trigger]
  return labels.replace('[X]', String(threshold))
}

export default function RuleBuilderModal({ open, onClose, onSaved }: RuleBuilderModalProps) {
  const { user } = useAuth()
  const [trigger, setTrigger] = useState<AlertTrigger>('inventory')
  const [threshold, setThreshold] = useState(50)
  const [targetRoles, setTargetRoles] = useState<Role[]>(['manager'])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTrigger('inventory')
      setThreshold(50)
      setTargetRoles(['manager'])
      setName('')
      setSaving(false)
    }
  }, [open])

  const handleTriggerChange = (t: AlertTrigger) => {
    setTrigger(t)
    setThreshold(TRIGGER_DEFAULTS[t])
    setName(TRIGGER_SUGGESTIONS[t])
  }

  const toggleRole = (role: Role) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const isValid = name.trim() && targetRoles.length > 0 && threshold > 0

  const handleSave = async () => {
    if (!isValid || !user) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'alertRules'), {
        name: name.trim(),
        trigger,
        threshold,
        targetRoles,
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      })
      toast.success(`Đã thêm quy tắc '${name.trim()}'`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm quy tắc cảnh báo" size="md">
      <div className="space-y-5">
        {/* Trigger */}
        <div>
          <label className="form-label">Trigger</label>
          <select
            className="form-input"
            value={trigger}
            onChange={(e) => handleTriggerChange(e.target.value as AlertTrigger)}
          >
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Threshold */}
        <div>
          <label className="form-label">Ngưỡng</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="form-input w-32"
            />
            <span className="text-sm text-t2">
              {THRESHOLD_LABELS[trigger].replace('[X]', String(threshold))}
            </span>
          </div>
        </div>

        {/* Target roles */}
        <div>
          <label className="form-label">Gửi cho <span className="text-danger">*</span></label>
          <div className="flex gap-3 mt-1">
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
              <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="accent-amber"
                />
                <span className="text-sm text-t1">{ROLE_LABELS[role]}</span>
              </label>
            ))}
          </div>
          {targetRoles.length === 0 && (
            <p className="text-xs text-danger mt-1">Chọn ít nhất 1 vai trò</p>
          )}
        </div>

        {/* Rule name */}
        <div>
          <label className="form-label">Tên quy tắc <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên quy tắc..."
          />
        </div>

        {/* Preview */}
        <div className="bg-ink rounded-lg border-l-[3px] border-amber px-4 py-3">
          <p className="text-[11px] text-t3 uppercase tracking-wide mb-2">Xem trước</p>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
              <span className="text-amber text-sm">🔔</span>
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-100">
                {name || 'Tên quy tắc'}
              </p>
              <p className="text-[12px] text-t2 mt-0.5">
                {getPreviewBody(trigger, threshold)}
              </p>
              <p className="text-[11px] text-t3 mt-1">
                → Gửi cho: {targetRoles.map((r) => ROLE_LABELS[r]).join(', ') || '...'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
          <button className="btn-outline" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Đang lưu...' : 'Lưu quy tắc'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
