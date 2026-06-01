import { useState, useEffect } from 'react'
import { listenFireSafety, listenIncidents, addFireDrill, listenFireDrills, listenPeriodicInspections, updatePeriodicInspection } from '@/firebase/db'
import type { FireSafetyRecord, Incident, FireDrill, PeriodicInspection } from '@/firebase/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { EmptyState, TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { Flame, ShieldCheck, CheckCircle, Clock, AlertTriangle, Plus, Printer } from 'lucide-react'
import { format, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'equipment' | 'drills' | 'inspections'

const drillSchema = z.object({
  date: z.string().min(1, 'Ngày là bắt buộc'),
  area: z.string().min(1, 'Khu vực là bắt buộc'),
  drillType: z.enum(['theory', 'evacuation', 'fire_extinguisher', 'sprinkler']),
  responsible: z.string().min(1, 'Người phụ trách là bắt buộc'),
  notes: z.string().default(''),
})
type DrillForm = z.infer<typeof drillSchema>

const DRILL_TYPE_LABELS: Record<string, string> = {
  theory: 'Lý thuyết', evacuation: 'Sơ tán', fire_extinguisher: 'Bình chữa cháy', sprinkler: 'Sprinkler',
}
const DRILL_RESULT_LABELS: Record<string, string> = {
  pass: 'Đạt', fail: 'Không đạt', partial: 'Đạt một phần',
}
const DRILL_RESULT_COLORS: Record<string, string> = {
  pass: 'badge-success', fail: 'badge-danger', partial: 'badge-warning',
}

function StatusBadge({ status }: { status: FireSafetyRecord['status'] }) {
  const cfg: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ok: { label: 'Tốt', color: 'bg-green-500/15 text-green-400', icon: CheckCircle },
    due: { label: 'Sắp đến hạn', color: 'bg-yellow-500/15 text-yellow-400', icon: Clock },
    expired: { label: 'Hết hạn', color: 'bg-red-500/15 text-red-400', icon: AlertTriangle },
    maintenance: { label: 'Bảo trì', color: 'bg-blue-500/15 text-blue-400', icon: Clock },
  }
  const c = cfg[status] || cfg.ok
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <Icon className="w-3 h-3" />{c.label}
    </span>
  )
}

function EquipmentCard({ record }: { record: FireSafetyRecord }) {
  const isOverdue = record.nextDue && record.nextDue.toDate() < new Date()
  const daysUntil = record.nextDue ? differenceInDays(record.nextDue.toDate(), new Date()) : null

  return (
    <div className={`card p-4 border ${isOverdue ? 'border-red-500/30 bg-red-500/5' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-t2'
          }`}>
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100 text-sm">{record.name}</h3>
            <p className="text-xs text-t3">{record.location}</p>
          </div>
        </div>
        <StatusBadge status={record.status} />
      </div>
      <div className="flex justify-between text-xs text-t3 mt-2 pt-2 border-t border-white/[0.06]">
        <span>Kiểm tra gần nhất</span>
        <span className="text-gray-400">{record.lastChecked ? format(record.lastChecked.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</span>
      </div>
      <div className="flex justify-between text-xs text-t3 mt-1">
        <span>Kiểm tra tiếp theo</span>
        <span className={isOverdue ? 'text-red-400 font-medium' : 'text-gray-400'}>
          {record.nextDue ? format(record.nextDue.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
        </span>
      </div>
      {daysUntil !== null && !isOverdue && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className={`flex-1 h-1.5 rounded-full bg-white/[0.06]`}>
            <div className={`h-full rounded-full ${daysUntil <= 7 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${Math.max(5, 100 - (daysUntil / 30) * 100)}%` }} />
          </div>
          <span className={`text-[10px] font-medium ${daysUntil <= 7 ? 'text-yellow-400' : 'text-t3'}`}>
            {daysUntil}d
          </span>
        </div>
      )}
    </div>
  )
}

function DrillsTab({ drills, incidents, onAddDrill }: {
  drills: FireDrill[]
  incidents: Incident[]
  onAddDrill: (data: DrillForm) => Promise<void>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DrillForm>({ resolver: zodResolver(drillSchema) })

  const onSubmit = async (data: DrillForm) => {
    await onAddDrill(data)
    setShowAdd(false)
    reset()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-100 text-sm">Lịch diễn tập</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Lên lịch diễn tập
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs">Ngày</th>
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs hidden sm:table-cell">Khu vực</th>
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs hidden md:table-cell">Loại</th>
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs hidden lg:table-cell">Người phụ trách</th>
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs">Kết quả</th>
              <th className="text-left px-3 py-2.5 font-medium text-t3 text-xs hidden xl:table-cell">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {drills.map((d) => (
              <tr key={d.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-3 text-gray-300 text-xs">{d.date ? format(d.date.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</td>
                <td className="px-3 py-3 text-gray-300 hidden sm:table-cell">{d.area}</td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="badge-info">{DRILL_TYPE_LABELS[d.drillType] || d.drillType}</span>
                </td>
                <td className="px-3 py-3 text-gray-400 hidden lg:table-cell text-xs">{d.responsible}</td>
                <td className="px-3 py-3">
                  {d.result && <span className={`badge ${DRILL_RESULT_COLORS[d.result]}`}>{DRILL_RESULT_LABELS[d.result]}</span>}
                </td>
                <td className="px-3 py-3 text-t3 text-xs hidden xl:table-cell max-w-[120px] line-clamp-1">{d.notes || '—'}</td>
              </tr>
            ))}
            {drills.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-t3 text-sm">Chưa có lịch diễn tập</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Fire Incidents */}
      {incidents.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-red-400 text-xs uppercase tracking-wide mb-2">Sự cố cháy nổ gần đây</h4>
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div key={inc.id} className="card p-3 border border-red-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-100">{inc.title}</p>
                    <p className="text-xs text-t3">{inc.location} · {inc.createdAt ? format(inc.createdAt.toDate(), 'dd/MM/yyyy', { locale: vi }) : ''}</p>
                  </div>
                  <span className={`badge ${inc.status === 'closed' ? 'badge-success' : 'badge-danger'}`}>
                    {inc.status === 'closed' ? 'Đã xử lý' : 'Đang xử lý'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Lên lịch diễn tập PCCC" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày diễn tập</label>
            <input type="date" {...register('date')} className="input-field" />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khu vực</label>
            <input {...register('area')} className="input-field" placeholder="VD: Tầng 1, Khu A..." />
            {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại diễn tập</label>
            <select {...register('drillType')} className="input-field">
              <option value="theory">Lý thuyết</option>
              <option value="evacuation">Sơ tán</option>
              <option value="fire_extinguisher">Bình chữa cháy</option>
              <option value="sprinkler">Sprinkler</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách</label>
            <input {...register('responsible')} className="input-field" placeholder="Tên người phụ trách..." />
            {errors.responsible && <p className="text-red-500 text-xs mt-1">{errors.responsible.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea {...register('notes')} className="input-field" rows={2} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu lịch diễn tập'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function InspectionsTab({ inspections }: { inspections: PeriodicInspection[] }) {
  const now = new Date()
  const thisMonth = inspections.filter((i) => {
    if (!i.checkedAt) return false
    return isWithinInterval(i.checkedAt.toDate(), { start: startOfMonth(now), end: endOfMonth(now) })
  })
  const total = inspections.length
  const checkedThisMonth = thisMonth.length
  const progressPct = total > 0 ? (checkedThisMonth / total) * 100 : 0

  const grouped: Record<string, PeriodicInspection[]> = {}
  inspections.forEach((i) => {
    const floor = i.floor || 'Khác'
    if (!grouped[floor]) grouped[floor] = []
    grouped[floor].push(i)
  })

  const toggleCheck = async (inspection: PeriodicInspection) => {
    try {
      await updatePeriodicInspection(inspection.id, {
        checked: !inspection.checked,
        checkedAt: new Date() as any,
      })
    } catch { toast.error('Cập nhật thất bại') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-100 text-sm">Checklist kiểm tra định kỳ</h3>
          <p className="text-xs text-t3 mt-0.5">{checkedThisMonth}/{total} hạng mục đã kiểm tra tháng này</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-xs">
          <Printer className="w-3.5 h-3.5" /> In checklist
        </button>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-t2">Tiến độ kiểm tra tháng {format(now, 'MM/yyyy', { locale: vi })}</span>
          <span className="font-medium text-gray-100">{checkedThisMonth}/{total}</span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${progressPct === 100 ? 'bg-green-500' : 'bg-amber'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {Object.entries(grouped).map(([floor, items]) => (
        <div key={floor} className="card overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.07]">
            <h4 className="font-semibold text-gray-100 text-sm">{floor}</h4>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleCheck(item)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber focus:ring-amber accent-amber"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.checked ? 'text-t2 line-through' : 'text-gray-200'}`}>{item.name}</p>
                  <p className="text-xs text-t3">{item.location}</p>
                </div>
                {item.checked && item.checkedAt && (
                  <span className="text-xs text-green-400 shrink-0">
                    {format(item.checkedAt.toDate(), 'dd/MM', { locale: vi })}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      {inspections.length === 0 && (
        <EmptyState icon={<CheckCircle className="w-8 h-8" />} title="Chưa có checklist" description="Liên hệ quản trị để thêm hạng mục kiểm tra" />
      )}
    </div>
  )
}

export default function FireSafetyPage() {
  const [tab, setTab] = useState<Tab>('equipment')
  const [records, setRecords] = useState<FireSafetyRecord[]>([])
  const [drills, setDrills] = useState<FireDrill[]>([])
  const [inspections, setInspections] = useState<PeriodicInspection[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub1 = listenFireSafety(setRecords)
    const unsub2 = listenFireDrills(setDrills)
    const unsub3 = listenPeriodicInspections(setInspections)
    const unsub4 = listenIncidents((docs) => setIncidents(docs.filter((d) => d.type === 'fire')))
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); clearTimeout(timer) }
  }, [])

  const overdue = records.filter((r) => r.status === 'expired' || (r.nextDue && r.nextDue.toDate() < new Date()))
  const dueSoon = records.filter((r) => r.status === 'due')

  const handleAddDrill = async (data: DrillForm) => {
    try {
      await addFireDrill({ ...data, result: 'pass' as const, date: new Date(data.date) as any })
      toast.success('Đã thêm lịch diễn tập')
    } catch { toast.error('Thêm thất bại') }
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'equipment', label: 'Thiết bị PCCC', badge: overdue.length || undefined },
    { key: 'drills', label: 'Diễn tập' },
    { key: 'inspections', label: 'Kiểm tra định kỳ' },
  ]

  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">PCCC & An toàn</h1>
        <p className="text-sm text-gray-500">{records.length} thiết bị · {overdue.length} quá hạn · {dueSoon.length} sắp đến hạn</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-red-400">{overdue.length}</p>
          <p className="text-xs text-t2">Hết hạn / Quá hạn</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-yellow-400">{dueSoon.length}</p>
          <p className="text-xs text-t2">Sắp đến hạn</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                tab === t.key ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'
              }`}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'equipment' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map((r) => <EquipmentCard key={r.id} record={r} />)}
          {records.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={<Flame className="w-8 h-8" />} title="Chưa có thiết bị PCCC" description="Thêm thiết bị từ Firestore để bắt đầu" />
            </div>
          )}
        </div>
      )}
      {tab === 'drills' && <DrillsTab drills={drills} incidents={incidents} onAddDrill={handleAddDrill} />}
      {tab === 'inspections' && <InspectionsTab inspections={inspections} />}
    </div>
  )
}
