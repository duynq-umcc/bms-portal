import { useState, useEffect } from 'react'
import {
  listenCivilProjects, listenCivilWorkLogs, addCivilWorkLog,
  listenBuildingInspections, updateBuildingInspection,
} from '@/firebase/db'
import type { CivilProject, CivilWorkLog, BuildingInspection } from '@/firebase/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { EmptyState, TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import {
  HardHat, Calendar, Clock, Users, ChevronRight, ChevronDown,
  CheckSquare, Square, Image, Printer,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'projects' | 'checklist' | 'worklog'

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planning: { label: 'Chờ duyệt', color: 'bg-gray-500/15 text-gray-400', dot: 'bg-gray-400' },
  in_progress: { label: 'Đang thi công', color: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400' },
  completed: { label: 'Hoàn thành', color: 'bg-green-500/15 text-green-400', dot: 'bg-green-400' },
  on_hold: { label: 'Tạm dừng', color: 'bg-yellow-500/15 text-yellow-400', dot: 'bg-yellow-400' },
}

const AREA_LABELS: Record<string, string> = {
  wall: 'Tường', ceiling: 'Trần', floor: 'Sàn', door: 'Cửa', roof: 'Mái', exterior: 'Ngoại thất',
}

const workLogSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc'),
  description: z.string().default(''),
  location: z.string().min(1, 'Vị trí là bắt buộc'),
  contractor: z.string().default(''),
  cost: z.coerce.number().min(0).default(0),
  notes: z.string().default(''),
})
type WorkLogForm = z.infer<typeof workLogSchema>

function formatVND(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return `${n.toLocaleString('vi-VN')} đ`
}

function ProjectCard({ project }: { project: CivilProject }) {
  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning
  const budgetPct = project.budget > 0 ? Math.min(100, (project.spent / project.budget) * 100) : 0
  const overBudget = budgetPct > 100

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          project.status === 'completed' ? 'bg-green-500/10 text-green-400'
            : project.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400'
            : project.status === 'on_hold' ? 'bg-yellow-500/10 text-yellow-400'
            : 'bg-white/[0.06] text-t2'
        }`}>
          <HardHat className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-100">{project.name}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
            </span>
          </div>
          <p className="text-xs text-t3 mt-0.5">{project.location}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-t3 mb-1">
          <span>Tiến độ</span>
          <span className="font-medium text-gray-100">{project.progress || 0}%</span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${project.progress === 100 ? 'bg-green-500' : 'bg-amber'}`}
            style={{ width: `${project.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Budget */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-t3 mb-1">
          <span>Ngân sách</span>
          <span className={`font-medium ${overBudget ? 'text-red-400' : 'text-gray-100'}`}>
            {formatVND(project.spent)} / {formatVND(project.budget)}
          </span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${overBudget ? 'bg-red-500' : budgetPct > 80 ? 'bg-yellow-400' : 'bg-teal-400'}`}
            style={{ width: `${Math.min(100, budgetPct)}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-t3 mt-3 pt-3 border-t border-white/[0.06]">
        {project.manager && (
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{project.manager}</span>
        )}
        {project.startDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {format(project.startDate.toDate(), 'dd/MM/yyyy', { locale: vi })}
          </span>
        )}
        {project.endDate && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {format(project.endDate.toDate(), 'dd/MM/yyyy', { locale: vi })}
          </span>
        )}
      </div>
    </div>
  )
}

function ProjectsTab({ projects }: { projects: CivilProject[] }) {
  const [filter, setFilter] = useState<string>('all')
  const filters = ['all', 'planning', 'in_progress', 'completed', 'on_hold']

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'bg-white/[0.05] text-t2 hover:bg-white/[0.08]'
            }`}
          >
            {f === 'all' ? 'Tất cả' : STATUS_CONFIG[f]?.label || f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={<HardHat className="w-8 h-8" />} title="Không có dự án" description="Chưa có dự án xây dựng nào" />
          </div>
        )}
      </div>
    </div>
  )
}

function ChecklistTab({ inspections }: { inspections: BuildingInspection[] }) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(['wall', 'ceiling', 'floor', 'door', 'roof', 'exterior']))
  const [currentMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const thisMonthItems = inspections.filter((i) => {
    const mi = `${i.year}-${String(i.month).padStart(2, '0')}`
    return mi === currentMonth
  })
  const checked = thisMonthItems.filter((i) => i.checked).length
  const total = thisMonthItems.length
  const progressPct = total > 0 ? (checked / total) * 100 : 0

  const grouped: Record<string, BuildingInspection[]> = {}
  inspections.forEach((i) => {
    const key = i.area
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(i)
  })

  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      next.has(area) ? next.delete(area) : next.add(area)
      return next
    })
  }

  const toggleItem = async (item: BuildingInspection) => {
    try {
      await updateBuildingInspection(item.id, {
        checked: !item.checked,
        checkedAt: new Date() as any,
      })
    } catch { toast.error('Cập nhật thất bại') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-100 text-sm">Kiểm tra công trình</h3>
          <p className="text-xs text-t3 mt-0.5">{checked}/{total} hạng mục tháng này</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-xs">
          <Printer className="w-3.5 h-3.5" /> In checklist
        </button>
      </div>

      <div className="card p-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-t2">Tiến độ tháng này</span>
          <span className="font-medium text-gray-100">{checked}/{total}</span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${progressPct === 100 ? 'bg-green-500' : 'bg-teal-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {Object.entries(grouped).map(([area, items]) => {
        const areaChecked = items.filter((i) => i.checked).length
        const isExpanded = expandedAreas.has(area)
        return (
          <div key={area} className="card overflow-hidden">
            <button
              onClick={() => toggleArea(area)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-t3" /> : <ChevronRight className="w-4 h-4 text-t3" />}
                <span className="font-semibold text-gray-100 text-sm">{AREA_LABELS[area] || area}</span>
              </div>
              <span className="text-xs text-t3">{areaChecked}/{items.length}</span>
            </button>
            {isExpanded && (
              <div className="divide-y divide-white/[0.04]">
                {items.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer">
                    <button onClick={() => toggleItem(item)} className="shrink-0">
                      {item.checked
                        ? <CheckSquare className="w-4.5 h-4.5 text-teal-400" />
                        : <Square className="w-4.5 h-4.5 text-t3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.checked ? 'text-t2 line-through' : 'text-gray-200'}`}>{item.item}</p>
                      <p className="text-xs text-t3">{item.location}</p>
                    </div>
                    {item.checked && item.checkedAt && (
                      <span className="text-xs text-teal-400 shrink-0">
                        {format(item.checkedAt.toDate(), 'dd/MM', { locale: vi })}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {inspections.length === 0 && (
        <EmptyState icon={<CheckSquare className="w-8 h-8" />} title="Chưa có checklist" description="Thêm hạng mục kiểm tra từ Firestore" />
      )}
    </div>
  )
}

function WorklogTab({ logs }: { logs: CivilWorkLog[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WorkLogForm>({
    resolver: zodResolver(workLogSchema),
  })

  const onSubmit = async (data: WorkLogForm) => {
    try {
      await addCivilWorkLog({ ...data, date: new Date() as any })
      toast.success('Đã thêm nhật ký')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm thất bại') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          + Nhật ký mới
        </button>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.08]" />

        {logs.map((log) => (
          <div key={log.id} className="relative">
            <div className="absolute -left-[13px] top-2 w-3 h-3 rounded-full bg-amber border-2 border-ink" />
            <div className="card p-4 ml-2">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-semibold text-gray-100 text-sm">{log.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-t3 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {format(log.date.toDate(), 'EEEE, dd/MM/yyyy', { locale: vi })}
                    {log.location && <><span>·</span><span>{log.location}</span></>}
                  </div>
                </div>
                {log.cost && log.cost > 0 && (
                  <span className="text-xs font-medium text-amber">{formatVND(log.cost)}</span>
                )}
              </div>
              {log.description && <p className="text-xs text-t2 mb-2">{log.description}</p>}
              {log.contractor && (
                <p className="text-xs text-t3">Nhà thầu: {log.contractor}</p>
              )}
              {log.photos && log.photos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {log.photos.slice(0, 4).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                        <Image className="w-6 h-6 text-t3" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <EmptyState icon={<HardHat className="w-8 h-8" />} title="Chưa có nhật ký" description="Nhật ký công trình sẽ hiển thị tại đây" />
        )}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm nhật ký công trình" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
            <input {...register('title')} className="input-field" placeholder="VD: Thi công sửa chữa tầng 2..." />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea {...register('description')} className="input-field" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
            <input {...register('location')} className="input-field" placeholder="VD: Tầng 1, Khu A..." />
            {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nhà thầu</label>
              <input {...register('contractor')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chi phí (VNĐ)</label>
              <input type="number" {...register('cost')} className="input-field" />
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu nhật ký'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

export default function CivilWorksPage() {
  const [tab, setTab] = useState<Tab>('projects')
  const [projects, setProjects] = useState<CivilProject[]>([])
  const [workLogs, setWorkLogs] = useState<CivilWorkLog[]>([])
  const [inspections, setInspections] = useState<BuildingInspection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub1 = listenCivilProjects(setProjects)
    const unsub2 = listenCivilWorkLogs(setWorkLogs)
    const unsub3 = listenBuildingInspections(setInspections)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub1(); unsub2(); unsub3(); clearTimeout(timer) }
  }, [])

  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Công trình Xây dựng</h1>
        <p className="text-sm text-gray-500">
          {projects.length} dự án · {projects.filter((p) => p.status === 'in_progress').length} đang thi công
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {(['projects', 'checklist', 'worklog'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t === 'projects' ? 'Dự án' : t === 'checklist' ? 'Checklist' : 'Nhật ký'}
          </button>
        ))}
      </div>

      {tab === 'projects' && <ProjectsTab projects={projects} />}
      {tab === 'checklist' && <ChecklistTab inspections={inspections} />}
      {tab === 'worklog' && <WorklogTab logs={workLogs} />}
    </div>
  )
}
