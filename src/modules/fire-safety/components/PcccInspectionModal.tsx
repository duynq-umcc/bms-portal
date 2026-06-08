import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useCreatePcccInspection, buildDefaultChecklist } from '@/hooks/usePcccInspections'
import type { PcccCheckItem, PcccCheckResult } from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Check, X, Minus, ChevronRight, ChevronLeft, FileText, Loader2 } from 'lucide-react'

const RESULT_OPTIONS: { value: PcccCheckResult; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'ok', label: 'Đạt', icon: Check, color: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' },
  { value: 'fail', label: 'Không đạt', icon: X, color: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' },
  { value: 'na', label: 'K/A', icon: Minus, color: 'bg-white/5 text-t2 border border-white/10 hover:bg-white/10' },
]

const CATEGORY_ICONS: Record<string, string> = {
  extinguisher: '🔋',
  detector: '📡',
  pump: '⚙️',
  exit: '🚪',
  sprinkler: '💧',
  hydrant: '🚿',
  panel: '📋',
}

const RESULT_BADGE: Record<string, string> = {
  pass: 'badge-success',
  conditional: 'badge-warning',
  fail: 'badge-danger',
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function PcccInspectionModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { create, creating } = useCreatePcccInspection()

  const [step, setStep] = useState(1)
  const [inspectorName, setInspectorName] = useState(user?.displayName || '')
  const [locationNotes, setLocationNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<PcccCheckItem[]>(buildDefaultChecklist)

  const failCount = checklist.filter((c) => c.result === 'fail').length
  const naCount = checklist.filter((c) => c.result === 'na').length

  const overallResult = failCount > 2 ? 'fail' : failCount > 0 ? 'conditional' : 'pass'

  const setResult = (index: number, result: PcccCheckResult) => {
    setChecklist((prev) => prev.map((c, i) => (i === index ? { ...c, result } : c)))
  }

  const setNote = (index: number, note: string) => {
    setChecklist((prev) => prev.map((c, i) => (i === index ? { ...c, note } : c)))
  }

  const handleSubmit = async () => {
    const ok = await create({ inspectorName, locationNotes, checklist, notes })
    if (ok) {
      onSuccess?.()
      onClose()
      // Reset
      setStep(1)
      setInspectorName(user?.displayName || '')
      setLocationNotes('')
      setNotes('')
      setChecklist(buildDefaultChecklist())
    }
  }

  const handleClose = () => {
    onClose()
    setStep(1)
    setChecklist(buildDefaultChecklist())
  }

  const grouped = checklist.reduce<Record<string, PcccCheckItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const CATEGORY_LABELS: Record<string, string> = {
    extinguisher: 'Bình chữa cháy',
    detector: 'Đầu báo',
    pump: 'Bơm PCCC',
    exit: 'Lối thoát & Cửa',
    sprinkler: 'Sprinkler',
    hydrant: 'Họng chữa cháy',
    panel: 'Tủ điều khiển',
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Biên bản kiểm tra PCCC tháng ${format(new Date(), 'MM/yyyy', { locale: vi })}`}
      size="lg"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((s) => (
          <button
            key={s}
            onClick={() => s < step && setStep(s)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              s === step
                ? 'bg-amber text-gray-900'
                : s < step
                ? 'bg-green-500/20 text-green-400 cursor-pointer'
                : 'bg-white/5 text-t2 cursor-not-allowed'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              s === step ? 'bg-gray-900 text-amber' : s < step ? 'bg-green-500 text-white' : 'bg-white/10'
            }`}>
              {s < step ? '✓' : s}
            </span>
            {s === 1 ? 'Thông tin' : 'Checklist'}
          </button>
        ))}
      </div>

      {/* Step 1: Header info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-4 border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-100">Biên bản kiểm tra PCCC hàng tháng</p>
                <p className="text-xs text-t3 mt-1">
                  Theo Nghị định 136/2020/NĐ-CP về phòng cháy chữa cháy. Mỗi tháng phải có biên bản tự kiểm tra.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Người kiểm tra</label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="input-field"
              placeholder="Họ tên người thực hiện kiểm tra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ghi chú địa điểm</label>
            <input
              type="text"
              value={locationNotes}
              onChange={(e) => setLocationNotes(e.target.value)}
              className="input-field"
              placeholder="VD: Toàn bộ khu vực Bệnh viện, tầng 1-5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ghi chú chung</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="Nhận xét chung, khuyến nghị..."
            />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!inspectorName.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            Tiếp tục — Kiểm tra checklist
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Checklist */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <div className="flex items-center gap-1.5">
              <span className={`badge ${RESULT_BADGE[overallResult]}`}>
                {overallResult === 'pass' ? 'Đạt' : overallResult === 'conditional' ? 'Có điều kiện' : 'Không đạt'}
              </span>
            </div>
            {failCount > 0 && (
              <span className="text-xs text-red-400">{failCount} hạng mục không đạt</span>
            )}
            {naCount > 0 && (
              <span className="text-xs text-t3">{naCount} hạng mục K/A</span>
            )}
          </div>

          {/* Checklist groups */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.07]">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                    {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category] || category}
                  </h4>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {items.map((item) => {
                    const idx = checklist.findIndex((c) => c.id === item.id)
                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${item.result === 'fail' ? 'text-red-400' : 'text-gray-200'}`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-t3 mt-0.5">{item.location}</p>
                            {item.result === 'fail' && (
                              <input
                                type="text"
                                value={item.note}
                                onChange={(e) => setNote(idx, e.target.value)}
                                className="mt-2 w-full text-xs input-field py-1.5"
                                placeholder="Mô tả lỗi / khuyến nghị khắc phục..."
                              />
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {RESULT_OPTIONS.map((opt) => {
                              const Icon = opt.icon
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => setResult(idx, opt.value)}
                                  title={opt.label}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                    item.result === opt.value
                                      ? opt.color
                                      : 'bg-white/5 text-t2 hover:bg-white/10'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </button>
            <button
              onClick={handleSubmit}
              disabled={creating || !inspectorName.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
              ) : (
                <>Lưu biên bản kiểm tra PCCC</>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
