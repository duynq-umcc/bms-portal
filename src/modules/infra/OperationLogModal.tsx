import { useState, useEffect, useCallback } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { toast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { createNotificationForRoles } from '@/utils/createNotification'
import {
  Zap, Droplets, Wind, Power, AlertTriangle,
  ChevronRight, ChevronLeft, Check, Clock, User,
} from 'lucide-react'
import type { OperationLogShift } from '@/firebase/types'

// ─── shift helpers ────────────────────────────────────────────────────────────

function getCurrentShift(): OperationLogShift {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return 'morning'
  if (h >= 14 && h < 22) return 'afternoon'
  return 'night'
}

const SHIFT_LABELS: Record<OperationLogShift, string> = {
  morning: 'Ca sáng (06:00–14:00)',
  afternoon: 'Ca chiều (14:00–22:00)',
  night: 'Ca đêm (22:00–06:00)',
}

const NEXT_SHIFT: Record<OperationLogShift, string> = {
  morning: 'Ca chiều',
  afternoon: 'Ca đêm',
  night: 'Ca sáng',
}

// ─── types ────────────────────────────────────────────────────────────────────

interface FormData {
  electricity: {
    totalCurrent: number | string
    voltage: number | string
    powerFactor: number | string
    totalKwh: number | string
    generatorFuelPct: number
    generatorStatus: 'standby' | 'running' | 'fault'
  }
  water: {
    rooftankLevel: number | string
    rooftankPct: number
    boosterPressure: number | string
    dailyConsumption: number | string
    wastewaterFlow: number | string
  }
  hvac: {
    ahu3Temp: number | string
    ahu3Capacity: number | string
    ahu1Temp: number | string
    ahu2Temp: number | string
    chillerSupplyTemp: number | string
    chillerReturnTemp: number | string
  }
  medicalGas: {
    o2Pressure: number | string
    o2Status: 'normal' | 'low' | 'critical'
    airPressure: number | string
    vacuumPressure: number | string
    n2oPressure: number | string
  }
  checklist: {
    electricalPanel: boolean
    generator: boolean
    waterPump: boolean
    hvacAhu: boolean
    medicalGasRoom: boolean
    fireSystem: boolean
    wastewater: boolean
    elevator: boolean
    energyMeter: boolean
    securityCameras: boolean
  }
  handover: {
    incidentsThisShift: string
    pendingTasks: string
    equipmentIssues: string
    nextShiftNotes: string
    receivedBy: string
    receivedByName: string
    handoverTime: string
  }
}

const DEFAULT_FORM: FormData = {
  electricity: {
    totalCurrent: '',
    voltage: 380,
    powerFactor: '',
    totalKwh: '',
    generatorFuelPct: 80,
    generatorStatus: 'standby',
  },
  water: {
    rooftankLevel: '',
    rooftankPct: 0,
    boosterPressure: '',
    dailyConsumption: '',
    wastewaterFlow: '',
  },
  hvac: {
    ahu3Temp: '',
    ahu3Capacity: '',
    ahu1Temp: '',
    ahu2Temp: '',
    chillerSupplyTemp: '',
    chillerReturnTemp: '',
  },
  medicalGas: {
    o2Pressure: '',
    o2Status: 'normal',
    airPressure: '',
    vacuumPressure: '',
    n2oPressure: '',
  },
  checklist: {
    electricalPanel: false,
    generator: false,
    waterPump: false,
    hvacAhu: false,
    medicalGasRoom: false,
    fireSystem: false,
    wastewater: false,
    elevator: false,
    energyMeter: false,
    securityCameras: false,
  },
  handover: {
    incidentsThisShift: '',
    pendingTasks: '',
    equipmentIssues: '',
    nextShiftNotes: '',
    receivedBy: '',
    receivedByName: '',
    handoverTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  },
}

const CHECKLIST_ITEMS = [
  { key: 'electricalPanel', label: 'Kiểm tra tủ điện tổng' },
  { key: 'generator', label: 'Kiểm tra máy phát dự phòng' },
  { key: 'waterPump', label: 'Kiểm tra bơm nước + bể mái' },
  { key: 'hvacAhu', label: 'Kiểm tra AHU các tầng' },
  { key: 'medicalGasRoom', label: 'Kiểm tra phòng khí y tế' },
  { key: 'fireSystem', label: 'Kiểm tra hệ thống PCCC' },
  { key: 'wastewater', label: 'Vận hành trạm XLNT' },
  { key: 'elevator', label: 'Kiểm tra thang máy' },
  { key: 'energyMeter', label: 'Ghi chỉ số đồng hồ điện/nước' },
  { key: 'securityCameras', label: 'Kiểm tra camera an ninh' },
] as const

const GEN_STATUS_OPTIONS = [
  { value: 'standby', label: 'Standby' },
  { value: 'running', label: 'Đang chạy' },
  { value: 'fault', label: 'Lỗi' },
]

// ─── step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Điện & Máy phát', 'Nước & HVAC', 'Khí y tế', 'Bàn giao ca']

function StepIndicator({ step, done }: { step: number; done: boolean[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const isActive = i === step
        const isDone = done[i]
        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className={`w-8 h-px mx-1 ${isDone ? 'bg-green-500' : 'bg-white/10'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-amber text-black'
                    : 'border border-white/20 text-gray-500'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${isActive ? 'text-amber' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── number field ─────────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, placeholder, step, min, max, unit, note,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  step?: string
  min?: string
  max?: string
  unit?: string
  note?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step ?? 'any'}
          min={min}
          max={max}
          className="input-field w-full pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{unit}</span>
        )}
      </div>
      {note && <p className="text-[10px] text-gray-500 mt-0.5">{note}</p>}
    </div>
  )
}

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    normal: { cls: 'bg-green-500/20 text-green-400', label: 'Bình thường' },
    standby: { cls: 'bg-gray-500/20 text-gray-400', label: 'Standby' },
    running: { cls: 'bg-green-500/20 text-green-400', label: 'Đang chạy' },
    fault: { cls: 'bg-red-500/20 text-red-400 animate-pulse', label: 'Lỗi' },
    low: { cls: 'bg-amber/20 text-amber', label: 'Theo dõi' },
    critical: { cls: 'bg-red-500/20 text-red-400 animate-pulse', label: 'KHẨN CẤP' },
  }
  const cfg = map[status] ?? { cls: 'bg-gray-500/20 text-gray-400', label: status }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {status === 'fault' || status === 'critical' ? <AlertTriangle className="w-3 h-3" /> : null}
      {cfg.label}
    </span>
  )
}

// ─── O2 status logic ─────────────────────────────────────────────────────────

function getO2Status(pressure: number | string): 'normal' | 'low' | 'critical' {
  const v = typeof pressure === 'string' ? parseFloat(pressure) : pressure
  if (isNaN(v)) return 'normal'
  if (v > 3.5) return 'normal'
  if (v >= 2.0) return 'low'
  return 'critical'
}

// ─── main modal ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function OperationLogModal({ isOpen, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState([false, false, false, false])
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [receivers, setReceivers] = useState<{ uid: string; displayName: string }[]>([])

  const currentShift = getCurrentShift()
  const nextShiftLabel = NEXT_SHIFT[currentShift]

  // Load technicians for handover receiver dropdown
  useEffect(() => {
    if (!isOpen) return
    import('@/firebase/config').then(({ db }) => {
      import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
        getDocs(query(collection(db, 'users'), where('role', '==', 'technician'))).then((snap) => {
          setReceivers(snap.docs.map((d) => ({ uid: d.id, displayName: d.data().displayName || d.id })))
        })
      })
    })
  }, [isOpen])

  const set = useCallback(<K extends keyof FormData>(
    section: K,
    field: keyof FormData[K] extends string ? keyof FormData[K] : never,
    value: FormData[K][keyof FormData[K]],
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }, [])

  const markDone = (i: number) => {
    setDone((prev) => {
      const next = [...prev]
      next[i] = true
      return next
    })
  }

  const goNext = () => {
    markDone(step)
    setStep((s) => Math.min(s + 1, 4))
  }
  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleO2Change = (val: string) => {
    set('medicalGas', 'o2Pressure', val)
    const status = getO2Status(val)
    set('medicalGas', 'o2Status', status)
    if (status === 'critical' && user) {
      createNotificationForRoles(['manager', 'admin'], {
        title: 'KHẨN CẤP: Áp suất Oxy thấp nguy hiểm',
        body: `Đọc số: ${val} bar — dưới ngưỡng an toàn 2.0 bar`,
        type: 'system',
        priority: 'urgent',
        link: '/infra',
      }).catch(() => {})
    }
  }

  const rooftankPct = (() => {
    const v = typeof form.water.rooftankLevel === 'string'
      ? parseFloat(form.water.rooftankLevel) : form.water.rooftankLevel
    return isNaN(v as number) ? 0 : Math.round(((v as number) / 40) * 100)
  })()

  const checklistDone = Object.values(form.checklist).filter(Boolean).length

  const handleSubmit = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await addDoc(collection(db, 'operationLogs'), {
        date: today,
        shift: currentShift,
        loggedBy: user.uid,
        loggedByName: user.displayName || user.email,
        createdAt: Timestamp.now(),
        readings: {
          electricity: {
            totalCurrent: Number(form.electricity.totalCurrent),
            voltage: Number(form.electricity.voltage),
            powerFactor: Number(form.electricity.powerFactor),
            totalKwh: Number(form.electricity.totalKwh),
            generatorFuelPct: form.electricity.generatorFuelPct,
            generatorStatus: form.electricity.generatorStatus,
          },
          water: {
            rooftankLevel: Number(form.water.rooftankLevel),
            rooftankPct: rooftankPct,
            boosterPressure: Number(form.water.boosterPressure),
            dailyConsumption: Number(form.water.dailyConsumption),
            wastewaterFlow: Number(form.water.wastewaterFlow),
          },
          hvac: {
            ahu3Temp: Number(form.hvac.ahu3Temp),
            ahu3Capacity: Number(form.hvac.ahu3Capacity),
            ahu1Temp: Number(form.hvac.ahu1Temp),
            ahu2Temp: Number(form.hvac.ahu2Temp),
            chillerSupplyTemp: Number(form.hvac.chillerSupplyTemp),
            chillerReturnTemp: Number(form.hvac.chillerReturnTemp),
          },
          medicalGas: {
            o2Pressure: Number(form.medicalGas.o2Pressure),
            o2Status: form.medicalGas.o2Status,
            airPressure: Number(form.medicalGas.airPressure),
            vacuumPressure: Number(form.medicalGas.vacuumPressure),
            n2oPressure: Number(form.medicalGas.n2oPressure),
          },
        },
        handover: {
          incidentsThisShift: form.handover.incidentsThisShift,
          pendingTasks: form.handover.pendingTasks,
          equipmentIssues: form.handover.equipmentIssues,
          nextShiftNotes: form.handover.nextShiftNotes,
          receivedBy: form.handover.receivedBy,
          receivedByName: form.handover.receivedByName,
          handoverTime: Timestamp.now(),
        },
        checklist: { ...form.checklist },
        status: 'submitted',
      })
      toast.success(`Nhật ký ${SHIFT_LABELS[currentShift].split(' (')[0]} đã được ghi nhận`)
      setForm(DEFAULT_FORM)
      setStep(0)
      setDone([false, false, false, false])
      onClose()
      onSaved?.()
    } catch {
      toast.error('Lỗi khi lưu nhật ký')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── step content ─────────────────────────────────────────────────────────

  const renderStepContent = () => {
    if (step === 4) return renderSummary()

    if (step === 0) return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 border-b border-white/5 pb-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Chỉ số điện — {SHIFT_LABELS[currentShift]}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Dòng điện tổng (A)" value={form.electricity.totalCurrent}
            onChange={(v) => set('electricity', 'totalCurrent', v)} placeholder="280" />
          <NumField label="Điện áp (V)" value={form.electricity.voltage}
            onChange={(v) => set('electricity', 'voltage', v)} placeholder="380" />
          <NumField label="Hệ số công suất" value={form.electricity.powerFactor}
            onChange={(v) => set('electricity', 'powerFactor', v)} placeholder="0.95"
            step="0.01" min="0" max="1" />
          <NumField label="Chỉ số kWh tổng" value={form.electricity.totalKwh}
            onChange={(v) => set('electricity', 'totalKwh', v)} placeholder="12450" unit="kWh" />
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
            <Power className="w-4 h-4 text-orange-400" />
            Máy phát dự phòng
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                Nhiên liệu MPĐ (%) — {form.electricity.generatorFuelPct}%
              </label>
              <input
                type="range" min={0} max={100}
                value={form.electricity.generatorFuelPct}
                onChange={(e) => set('electricity', 'generatorFuelPct', Number(e.target.value))}
                className="w-full accent-amber"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trạng thái MPĐ</label>
              <select
                value={form.electricity.generatorStatus}
                onChange={(e) => set('electricity', 'generatorStatus', e.target.value as 'standby' | 'running' | 'fault')}
                className="input-field w-full"
              >
                {GEN_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="mt-1.5">
                <StatusBadge status={form.electricity.generatorStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )

    if (step === 1) return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 border-b border-white/5 pb-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          Hệ thống nước
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Bể nước mái (m³)" value={form.water.rooftankLevel}
            onChange={(v) => set('water', 'rooftankLevel', v)} placeholder="28" unit="m³" />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Mức bể (%)</label>
            <div className="input-field bg-white/5 text-gray-300">
              {rooftankPct}% <span className="text-xs text-gray-500">/ 40 m³</span>
            </div>
          </div>
          <NumField label="Áp suất bơm (bar)" value={form.water.boosterPressure}
            onChange={(v) => set('water', 'boosterPressure', v)} placeholder="3.5" step="0.1" unit="bar" />
          <NumField label="Tiêu thụ hôm nay (m³)" value={form.water.dailyConsumption}
            onChange={(v) => set('water', 'dailyConsumption', v)} placeholder="45" unit="m³" />
          <NumField label="Lưu lượng XLNT (m³/h)" value={form.water.wastewaterFlow}
            onChange={(v) => set('water', 'wastewaterFlow', v)} placeholder="12" unit="m³/h" />
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
            <Wind className="w-4 h-4 text-cyan-400" />
            HVAC
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <NumField label="AHU-3 nhiệt độ (°C)" value={form.hvac.ahu3Temp}
                onChange={(v) => set('hvac', 'ahu3Temp', v)} placeholder="22" unit="°C"
                note="ICU / Phòng mổ" />
              {(() => {
                const t = typeof form.hvac.ahu3Temp === 'string'
                  ? parseFloat(form.hvac.ahu3Temp) : form.hvac.ahu3Temp
                if (!isNaN(t) && t > 24) {
                  return (
                    <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      AHU-3 vượt ngưỡng phòng mổ — kiểm tra ngay
                    </div>
                  )
                }
                return null
              })()}
            </div>
            <NumField label="AHU-3 công suất (%)" value={form.hvac.ahu3Capacity}
              onChange={(v) => set('hvac', 'ahu3Capacity', v)} placeholder="72" unit="%" />
            <NumField label="AHU-1 nhiệt độ (°C)" value={form.hvac.ahu1Temp}
              onChange={(v) => set('hvac', 'ahu1Temp', v)} placeholder="23" unit="°C" />
            <NumField label="AHU-2 nhiệt độ (°C)" value={form.hvac.ahu2Temp}
              onChange={(v) => set('hvac', 'ahu2Temp', v)} placeholder="23" unit="°C" />
            <NumField label="Chilled water cấp (°C)" value={form.hvac.chillerSupplyTemp}
              onChange={(v) => set('hvac', 'chillerSupplyTemp', v)} placeholder="7" unit="°C" />
            <NumField label="Chilled water hồi (°C)" value={form.hvac.chillerReturnTemp}
              onChange={(v) => set('hvac', 'chillerReturnTemp', v)} placeholder="12" unit="°C" />
          </div>
        </div>
      </div>
    )

    if (step === 2) return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 border-b border-white/5 pb-2">
          <Wind className="w-4 h-4 text-sky-400" />
          Kiểm tra áp suất khí y tế
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <NumField label="Oxy (O₂) (bar)" value={form.medicalGas.o2Pressure}
              onChange={handleO2Change} placeholder="4.0" step="0.1" unit="bar" />
            <div className="mt-1.5">
              <StatusBadge status={form.medicalGas.o2Status} />
            </div>
            {form.medicalGas.o2Status === 'critical' && (
              <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                KHẨN CẤP — Báo ngay cho quản lý!
              </div>
            )}
          </div>
          <NumField label="Khí nén (bar)" value={form.medicalGas.airPressure}
            onChange={(v) => set('medicalGas', 'airPressure', v)} placeholder="6.0" step="0.1" unit="bar" />
          <NumField label="Chân không (bar)" value={form.medicalGas.vacuumPressure}
            onChange={(v) => set('medicalGas', 'vacuumPressure', v)} placeholder="-0.8" step="0.1" unit="bar" />
          <NumField label="N₂O (bar)" value={form.medicalGas.n2oPressure}
            onChange={(v) => set('medicalGas', 'n2oPressure', v)} placeholder="3.5" step="0.1" unit="bar" />
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300">Checklist kiểm tra đầu ca</span>
            <span className="text-xs text-gray-500">{checklistDone}/10 đã kiểm tra</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${(checklistDone / 10) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={form.checklist[item.key]}
                  onChange={(e) => set('checklist', item.key, e.target.checked)}
                  className="accent-green-500 w-4 h-4"
                />
                <span className="text-xs text-gray-300">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    )

    if (step === 3) return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 border-b border-white/5 pb-2">
          <Clock className="w-4 h-4 text-amber" />
          Bàn giao ca — {SHIFT_LABELS[currentShift]} → {nextShiftLabel}
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sự cố trong ca</label>
            <textarea
              value={form.handover.incidentsThisShift}
              onChange={(e) => set('handover', 'incidentsThisShift', e.target.value)}
              placeholder="Không có sự cố"
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Công việc dang dở</label>
            <textarea
              value={form.handover.pendingTasks}
              onChange={(e) => set('handover', 'pendingTasks', e.target.value)}
              placeholder="Không có"
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Thiết bị cần theo dõi</label>
            <textarea
              value={form.handover.equipmentIssues}
              onChange={(e) => set('handover', 'equipmentIssues', e.target.value)}
              placeholder="Không có"
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Lưu ý cho ca sau</label>
            <textarea
              value={form.handover.nextShiftNotes}
              onChange={(e) => set('handover', 'nextShiftNotes', e.target.value)}
              placeholder="Không có"
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Người nhận ca</label>
              <select
                value={form.handover.receivedBy}
                onChange={(e) => {
                  const found = receivers.find((r) => r.uid === e.target.value)
                  set('handover', 'receivedBy', e.target.value)
                  set('handover', 'receivedByName', found?.displayName || '')
                }}
                className="input-field w-full"
              >
                <option value="">— Chọn người nhận ca —</option>
                {receivers.map((r) => (
                  <option key={r.uid} value={r.uid}>{r.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Giờ bàn giao</label>
              <input
                type="time"
                value={form.handover.handoverTime}
                onChange={(e) => set('handover', 'handoverTime', e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── summary screen ────────────────────────────────────────────────────────

  function renderSummary() {
    const { electricity, water, hvac, medicalGas, handover } = form
    const cards = [
      {
        icon: <Zap className="w-4 h-4 text-yellow-400" />,
        title: 'Điện',
        rows: [
          ['Dòng điện', `${electricity.totalCurrent} A`],
          ['Điện áp', `${electricity.voltage} V`],
          ['Hệ số công suất', `${electricity.powerFactor}`],
          ['kWh tổng', `${electricity.totalKwh}`],
          ['MPĐ', `${electricity.generatorFuelPct}%`],
          ['Trạng thái MPĐ', electricity.generatorStatus],
        ],
      },
      {
        icon: <Droplets className="w-4 h-4 text-blue-400" />,
        title: 'Nước',
        rows: [
          ['Bể mái', `${water.rooftankLevel} m³`],
          ['Mức bể', `${rooftankPct}%`],
          ['Áp suất bơm', `${water.boosterPressure} bar`],
          ['Tiêu thụ hôm nay', `${water.dailyConsumption} m³`],
          ['Lưu lượng XLNT', `${water.wastewaterFlow} m³/h`],
        ],
      },
      {
        icon: <Wind className="w-4 h-4 text-cyan-400" />,
        title: 'HVAC',
        rows: [
          ['AHU-3 nhiệt độ', `${hvac.ahu3Temp}°C`],
          ['AHU-3 công suất', `${hvac.ahu3Capacity}%`],
          ['AHU-1 nhiệt độ', `${hvac.ahu1Temp}°C`],
          ['AHU-2 nhiệt độ', `${hvac.ahu2Temp}°C`],
          ['Chilled cấp', `${hvac.chillerSupplyTemp}°C`],
          ['Chilled hồi', `${hvac.chillerReturnTemp}°C`],
        ],
      },
      {
        icon: <Wind className="w-4 h-4 text-sky-400" />,
        title: 'Khí y tế',
        rows: [
          ['O₂', `${medicalGas.o2Pressure} bar`],
          ['Trạng thái O₂', medicalGas.o2Status],
          ['Khí nén', `${medicalGas.airPressure} bar`],
          ['Chân không', `${medicalGas.vacuumPressure} bar`],
          ['N₂O', `${medicalGas.n2oPressure} bar`],
        ],
      },
    ]

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400 text-center mb-4">Xác nhận thông tin trước khi nộp</p>
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div key={card.title} className="bg-white/[0.04] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                {card.icon}
                <span className="text-sm font-semibold text-gray-200">{card.title}</span>
              </div>
              <div className="space-y-1">
                {card.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-300">{v || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Handover */}
        <div className="bg-white/[0.04] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-amber" />
            <span className="text-sm font-semibold text-gray-200">Bàn giao ca</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Người nhận</span><span className="text-gray-300">{handover.receivedByName || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Giờ bàn giao</span><span className="text-gray-300">{handover.handoverTime}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Sự cố</span><span className="text-gray-300">{handover.incidentsThisShift || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Công việc dang dở</span><span className="text-gray-300">{handover.pendingTasks || '—'}</span></div>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white/[0.04] rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-200">Checklist</span>
            <span className="text-xs text-gray-400">{checklistDone}/10</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(checklistDone / 10) * 100}%` }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => setStep(3)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Sửa lại
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            {submitting ? 'Đang lưu...' : <><Check className="w-4 h-4" /> Xác nhận nộp</>}
          </button>
        </div>
      </div>
    )
  }

  const isSummaryStep = step === 4

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Nhật ký vận hành — ${SHIFT_LABELS[currentShift]}`}
      size="lg"
    >
      <StepIndicator step={step} done={done} />

      {isSummaryStep ? (
        renderSummary()
      ) : (
        <>
          <div className="min-h-[300px]">
            {renderStepContent()}
          </div>

          <div className="flex gap-3 pt-4 mt-4 border-t border-white/5">
            {step > 0 && (
              <button onClick={goPrev} className="btn-secondary flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Quay lại
              </button>
            )}
            <div className="flex-1" />
            <button onClick={goNext} className="btn-primary flex items-center gap-1.5">
              Tiếp tục <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
