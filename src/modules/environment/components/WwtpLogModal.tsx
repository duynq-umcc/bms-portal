import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateWwtpLog } from '@/hooks/useWwtpLogs'
import type { WwtpReadings, WwtpChemicalUsed } from '@/types/firestore'
import { QCVN28_LIMITS } from '@/types/firestore'
import { toast } from '@/components/ui/Toast'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

function ReadingField({
  label, value, onChange, unit, limitLabel, limit,
  onBlur, result,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
  limitLabel: string
  limit?: { min?: number; max?: number }
  result?: 'ok' | 'warn' | 'fail'
  onBlur?: () => void
}) {
  void limit
  const borderColor = result === 'fail' ? 'border-red-500/50' : result === 'warn' ? 'border-amber-500/50' : 'border-white/10'
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {label} <span className="text-t3 font-normal">({limitLabel})</span>
      </label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`input-field pr-10 ${borderColor}`}
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-t3">{unit}</span>
      </div>
      {result && (
        <span className={`text-[10px] ${
          result === 'fail' ? 'text-red-400' :
          result === 'warn' ? 'text-amber-400' :
          'text-green-400'
        }`}>
          {result === 'fail' ? '⚠ Vượt giới hạn' : result === 'warn' ? '⚠ Gần giới hạn' : '✓ Đạt'}
        </span>
      )}
    </div>
  )
}

function getReadingResult(value: number, limit?: { min?: number; max?: number }): 'ok' | 'warn' | 'fail' | undefined {
  if (!limit) return undefined
  if (limit.max !== undefined) {
    if (value > limit.max) return 'fail'
    if (value > limit.max * 0.8) return 'warn'
  }
  if (limit.min !== undefined) {
    if (value < limit.min) return 'fail'
  }
  return 'ok'
}

const SHIFT_LABELS = { morning: 'Sáng (06:00–14:00)', afternoon: 'Chiều (14:00–22:00)', night: 'Đêm (22:00–06:00)' }

export default function WwtpLogModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { create, creating } = useCreateWwtpLog()

  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [shift, setShift] = useState<'morning' | 'afternoon' | 'night'>('morning')
  const [operatorName, setOperatorName] = useState(user?.displayName || '')
  const [issues, setIssues] = useState('')

  const [readings, setReadings] = useState<WwtpReadings>({
    inflowVolume: 0, outflowVolume: 0, ph: 7, bod5: 0, cod: 0, tss: 0,
    coliform: 0, chlorineResidual: 0, dissolvedOxygen: 0,
  })

  const [chemicals, setChemicals] = useState<WwtpChemicalUsed[]>([])

  const setReading = (field: keyof WwtpReadings, value: string) => {
    setReadings((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }))
  }

  const addChemical = () => {
    setChemicals((prev) => [...prev, { name: '', quantity: 0, unit: 'kg' }])
  }

  const updateChemical = (index: number, field: keyof WwtpChemicalUsed, value: string | number) => {
    setChemicals((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const removeChemical = (index: number) => {
    setChemicals((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!operatorName.trim()) {
      toast.error('Vui lòng nhập tên người vận hành')
      return
    }
    const ok = await create({
      logDate: new Date(logDate),
      shift,
      operatorId: user?.uid || '',
      operatorName,
      readings,
      chemicalUsed: chemicals.filter((c) => c.name.trim()),
      issues,
    })
    if (ok) {
      onSuccess?.()
      onClose()
      setReadings({ inflowVolume: 0, outflowVolume: 0, ph: 7, bod5: 0, cod: 0, tss: 0, coliform: 0, chlorineResidual: 0, dissolvedOxygen: 0 })
      setChemicals([])
      setIssues('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nhật ký vận hành WWTP" size="lg">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Header info */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Ngày ghi</label>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Ca làm việc</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as typeof shift)} className="input-field">
              <option value="morning">{SHIFT_LABELS.morning}</option>
              <option value="afternoon">{SHIFT_LABELS.afternoon}</option>
              <option value="night">{SHIFT_LABELS.night}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Người vận hành</label>
            <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} className="input-field" placeholder="Tên..." />
          </div>
        </div>

        {/* Volume readings */}
        <div>
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-3">Lưu lượng</h4>
          <div className="grid grid-cols-2 gap-3">
            <ReadingField label="Lưu lượng vào" value={String(readings.inflowVolume || '')}
              onChange={(v) => setReading('inflowVolume', v)} unit="m³/ngày" limitLabel="—" />
            <ReadingField label="Lưu lượng ra" value={String(readings.outflowVolume || '')}
              onChange={(v) => setReading('outflowVolume', v)} unit="m³/ngày" limitLabel="—" />
          </div>
        </div>

        {/* Water quality readings */}
        <div>
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-3">Chất lượng nước (QCVN 28:2010)</h4>
          <div className="grid grid-cols-2 gap-3">
            <ReadingField label="pH" value={String(readings.ph || '')}
              onChange={(v) => setReading('ph', v)} unit=""
              limitLabel={`${QCVN28_LIMITS.ph.min}–${QCVN28_LIMITS.ph.max}`}
              limit={{ min: QCVN28_LIMITS.ph.min, max: QCVN28_LIMITS.ph.max }}
              result={getReadingResult(readings.ph, { min: QCVN28_LIMITS.ph.min, max: QCVN28_LIMITS.ph.max })} />
            <ReadingField label="BOD₅" value={String(readings.bod5 || '')}
              onChange={(v) => setReading('bod5', v)} unit="mg/L"
              limitLabel={`≤ ${QCVN28_LIMITS.bod5.max} mg/L`}
              limit={{ max: QCVN28_LIMITS.bod5.max }}
              result={getReadingResult(readings.bod5, { max: QCVN28_LIMITS.bod5.max })} />
            <ReadingField label="COD" value={String(readings.cod || '')}
              onChange={(v) => setReading('cod', v)} unit="mg/L"
              limitLabel={`≤ ${QCVN28_LIMITS.cod.max} mg/L`}
              limit={{ max: QCVN28_LIMITS.cod.max }}
              result={getReadingResult(readings.cod, { max: QCVN28_LIMITS.cod.max })} />
            <ReadingField label="TSS" value={String(readings.tss || '')}
              onChange={(v) => setReading('tss', v)} unit="mg/L"
              limitLabel={`≤ ${QCVN28_LIMITS.tss.max} mg/L`}
              limit={{ max: QCVN28_LIMITS.tss.max }}
              result={getReadingResult(readings.tss, { max: QCVN28_LIMITS.tss.max })} />
            <ReadingField label="Coliform" value={String(readings.coliform || '')}
              onChange={(v) => setReading('coliform', v)} unit="MPN/100mL"
              limitLabel={`≤ ${QCVN28_LIMITS.coliform.max} MPN/100mL`}
              limit={{ max: QCVN28_LIMITS.coliform.max }}
              result={getReadingResult(readings.coliform, { max: QCVN28_LIMITS.coliform.max })} />
            <ReadingField label="Clo dư" value={String(readings.chlorineResidual || '')}
              onChange={(v) => setReading('chlorineResidual', v)} unit="mg/L"
              limitLabel={`${QCVN28_LIMITS.chlorineResidual.min}–${QCVN28_LIMITS.chlorineResidual.max} mg/L`}
              limit={{ min: QCVN28_LIMITS.chlorineResidual.min, max: QCVN28_LIMITS.chlorineResidual.max }}
              result={getReadingResult(readings.chlorineResidual, { min: QCVN28_LIMITS.chlorineResidual.min, max: QCVN28_LIMITS.chlorineResidual.max })} />
            <ReadingField label="Oxy hòa tan (DO)" value={String(readings.dissolvedOxygen || '')}
              onChange={(v) => setReading('dissolvedOxygen', v)} unit="mg/L"
              limitLabel={`≥ ${QCVN28_LIMITS.dissolvedOxygen.min} mg/L`}
              limit={{ min: QCVN28_LIMITS.dissolvedOxygen.min }}
              result={getReadingResult(readings.dissolvedOxygen, { min: QCVN28_LIMITS.dissolvedOxygen.min })} />
          </div>
        </div>

        {/* Chemicals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Hóa chất sử dụng</h4>
            <button onClick={addChemical} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
          {chemicals.length === 0 ? (
            <p className="text-xs text-t3 text-center py-3">Chưa có hóa chất nào</p>
          ) : (
            <div className="space-y-2">
              {chemicals.map((c, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-xs text-t3 mb-1">Tên hóa chất</label>
                    <input value={c.name} onChange={(e) => updateChemical(i, 'name', e.target.value)} className="input-field text-xs py-1.5" placeholder="VD: PAC, NaOCl..." />
                  </div>
                  <div>
                    <label className="block text-xs text-t3 mb-1">Số lượng</label>
                    <input type="number" value={c.quantity || ''} onChange={(e) => updateChemical(i, 'quantity', parseFloat(e.target.value) || 0)} className="input-field text-xs py-1.5" />
                  </div>
                  <div className="flex items-end gap-1">
                    <input value={c.unit} onChange={(e) => updateChemical(i, 'unit', e.target.value)} className="input-field text-xs py-1.5 flex-1" placeholder="đơn vị" />
                    <button onClick={() => removeChemical(i)} className="p-1.5 text-t3 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Issues */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Sự cố / Ghi chú</label>
          <textarea value={issues} onChange={(e) => setIssues(e.target.value)} className="input-field" rows={2} placeholder="Mô tả sự cố hoặc ghi chú vận hành..." />
        </div>

        <button onClick={handleSubmit} disabled={creating}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</> : 'Lưu nhật ký WWTP'}
        </button>
      </div>
    </Modal>
  )
}
