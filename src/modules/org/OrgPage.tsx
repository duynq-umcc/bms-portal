import { useState, useEffect } from 'react'
import { getAllStaff } from '@/firebase/db'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { StaffMember } from '@/firebase/types'
import type { TechnicianKpi } from '@/types/firestore'
import { CardSkeleton, EmptyState } from '@/components/ui/Table'
import TechnicianKpiTab from './TechnicianKpiTab'
import { Users, Phone, Mail, Search, ChevronDown, ChevronRight, X, BarChart3 } from 'lucide-react'

const DEPT_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/15 text-purple-400',
  it: 'bg-blue-500/15 text-blue-400',
  electrical: 'bg-yellow-500/15 text-yellow-400',
  medical: 'bg-red-500/15 text-red-400',
  warehouse: 'bg-green-500/15 text-green-400',
  compliance: 'bg-orange-500/15 text-orange-400',
  civil: 'bg-gray-500/15 text-gray-400',
  viewer: 'bg-white/5 text-t2',
}

const DEPT_LABELS: Record<string, string> = {
  admin: 'Quản trị', it: 'CNTT', electrical: 'Điện', medical: 'Y tế',
  warehouse: 'Kho', compliance: 'Compliance', civil: 'Xây dựng', viewer: 'Viewer',
}

type Level = 0 | 1 | 2

type OrgTab = 'tree' | 'staff' | 'kpi'

function getLevel(position: string): Level {
  const p = (position || '').toLowerCase()
  if (p.includes('giám đốc') || p.includes('director') || p.includes('ceo')) return 0
  if (p.includes('trưởng') || p.includes('phó') || p.includes('head') || p.includes('manager')) return 1
  return 2
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function Avatar({ name, dept, size = 'md' }: { name: string; dept: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm'
  const colorMap: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-400',
    it: 'bg-blue-500/20 text-blue-400',
    electrical: 'bg-yellow-500/20 text-yellow-400',
    medical: 'bg-red-500/20 text-red-400',
    warehouse: 'bg-green-500/20 text-green-400',
    compliance: 'bg-orange-500/20 text-orange-400',
    civil: 'bg-gray-500/20 text-gray-400',
  }
  return (
    <div className={`${sz} rounded-full flex items-center justify-center shrink-0 font-bold ${colorMap[dept] || 'bg-white/10 text-gray-300'}`}>
      {getInitials(name)}
    </div>
  )
}

function ScoreRingSmall({ score, grade }: { score: number; grade: string }) {
  const GRADE_RING: Record<string, string> = {
    A: '#16a34a', B: '#0d9488', C: '#d97706', D: '#ea580c', F: '#dc2626',
  }
  const color = GRADE_RING[grade] ?? '#dc2626'
  const r = 12
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  return (
    <div className="relative shrink-0" style={{ width: 28, height: 28 }}>
      <svg width={28} height={28} className="-rotate-90">
        <circle cx={14} cy={14} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
        <circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-green-500/15 text-green-400',
  B: 'bg-teal-500/15 text-teal-400',
  C: 'bg-amber/15 text-amber',
  D: 'bg-orange-500/15 text-orange-500',
  F: 'bg-red-500/15 text-red-400',
}

function StaffDetailPanel({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-l-2xl shadow-xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Chi tiết nhân sự</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex flex-col items-center text-center">
            <Avatar name={staff.displayName || ''} dept={staff.dept} size="lg" />
            <h2 className="mt-3 font-bold text-gray-900 text-lg">{staff.displayName}</h2>
            <p className="text-sm text-gray-500">{staff.position}</p>
            <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${DEPT_COLORS[staff.dept] || 'bg-gray-100 text-gray-600'}`}>
              {DEPT_LABELS[staff.dept] || staff.dept}
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thông tin liên hệ</h4>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-700">{staff.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-700">{staff.phone || '—'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thông tin khác</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Phòng ban</span>
              <span className="font-medium text-gray-900">{DEPT_LABELS[staff.dept] || staff.dept}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Chức vụ</span>
              <span className="font-medium text-gray-900">{staff.position}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vai trò</span>
              <span className="font-medium text-gray-900 capitalize">{staff.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Trạng thái</span>
              <span className={`font-medium ${staff.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                {staff.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </span>
            </div>
            {staff.managerId && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Quản lý</span>
                <span className="font-medium text-gray-900">#{staff.managerId}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrgPage() {
  const [tab, setTab] = useState<OrgTab>('tree')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [dept, setDept] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [kpiMap, setKpiMap] = useState<Record<string, TechnicianKpi>>({})

  useEffect(() => {
    getAllStaff().then((snap) => {
      setStaff(snap.docs.map((d) => ({ ...(d.data() as object), uid: d.id, id: d.id } as unknown as StaffMember)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Subscribe to KPI data for staff list
  useEffect(() => {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const unsub = onSnapshot(
      query(collection(db, 'technicianKpi'), where('period', '==', period)),
      (snap) => {
        const map: Record<string, TechnicianKpi> = {}
        snap.docs.forEach((d) => {
          map[d.id] = d.data() as TechnicianKpi
        })
        setKpiMap(map)
      },
    )
    return unsub
  }, [])

  const filtered = staff.filter((s) => {
    const matchesDept = dept === 'all' || s.dept === dept
    const matchesSearch = !search ||
      (s.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.position || '').toLowerCase().includes(search.toLowerCase())
    return matchesDept && matchesSearch
  })

  const depts = ['all', ...Object.keys(DEPT_LABELS).filter((d) => d !== 'viewer')]

  const directors = filtered.filter((s) => getLevel(s.position) === 0)
  const managers = filtered.filter((s) => getLevel(s.position) === 1)
  const employees = filtered.filter((s) => getLevel(s.position) === 2)

  const toggleDept = (d: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  const staffByDept = (list: StaffMember[]) => {
    const map: Record<string, StaffMember[]> = {}
    list.forEach((s) => {
      if (!map[s.dept]) map[s.dept] = []
      map[s.dept].push(s)
    })
    return map
  }

  const renderTreeLevel = (members: StaffMember[], level: Level, color: string) => {
    if (members.length === 0) return null
    const grouped = staffByDept(members)
    return (
      <div className="space-y-3">
        {Object.entries(grouped).map(([deptKey, members]) => (
          <div key={deptKey}>
            <button
              onClick={() => toggleDept(`${level}-${deptKey}`)}
              className="flex items-center gap-2 text-xs font-medium text-t2 hover:text-gray-200 mb-2 transition-colors"
            >
              {expandedDepts.has(`${level}-${deptKey}`) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {DEPT_LABELS[deptKey] || deptKey} ({members.length})
            </button>
            {(!expandedDepts.has(`${level}-${deptKey}`) || level === 0) && (
              <div className="flex flex-wrap gap-2">
                {members.map((s) => {
                  const kpi = kpiMap[s.uid]
                  const woCount = kpi?.woStats?.totalAssigned ?? null
                  return (
                    <button
                      key={s.uid}
                      onClick={() => setSelectedStaff(s)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-md ${color} bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer text-left min-w-[140px]`}
                    >
                      <Avatar name={s.displayName || ''} dept={s.dept} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-100 truncate">{s.displayName}</p>
                        <p className="text-[10px] text-t3 truncate">{s.position}</p>
                        {woCount !== null && (
                          <p className="text-[9px] text-amber/70">WO tháng: {woCount}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {expandedDepts.has(`${level}-${deptKey}`) && level > 0 && (
              <div className="ml-4 pl-4 border-l border-white/10 space-y-2 mt-2">
                {members.map((s) => {
                  const kpi = kpiMap[s.uid]
                  const woCount = kpi?.woStats?.totalAssigned ?? null
                  return (
                    <button
                      key={s.uid}
                      onClick={() => setSelectedStaff(s)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all w-full text-left"
                    >
                      <Avatar name={s.displayName || ''} dept={s.dept} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-200 truncate">{s.displayName}</p>
                        <p className="text-[10px] text-t3 truncate">{s.position}</p>
                        {woCount !== null && (
                          <p className="text-[9px] text-amber/70">WO: {woCount}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48"><div className="card h-full animate-pulse bg-gray-100" /></div>
        <div className="h-8 w-72 skeleton-line" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-100">Cơ cấu Tổ chức</h1>
        <p className="text-sm text-gray-500">{staff.length} nhân sự · {directors.length} giám đốc · {managers.length} trưởng phòng · {employees.length} nhân viên</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 max-w-sm">
        {([
          { key: 'tree' as OrgTab, label: 'Sơ đồ tổ chức' },
          { key: 'staff' as OrgTab, label: 'Danh sách nhân viên' },
          { key: 'kpi' as OrgTab, label: 'KPI nhân viên', icon: BarChart3 },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kpi' && <TechnicianKpiTab />}

      {tab === 'tree' && (
      <div className="card p-4 space-y-5">
        <h2 className="font-semibold text-gray-100 text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-amber" />
          Sơ đồ tổ chức
        </h2>

        {directors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber rounded-full" />
              Giám đốc
            </p>
            <div className="flex flex-wrap gap-2">
              {directors.map((s) => (
                <button
                  key={s.uid}
                  onClick={() => setSelectedStaff(s)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber/40 bg-amber/5 hover:bg-amber/10 transition-all text-left hover:scale-[1.02]"
                >
                  <Avatar name={s.displayName || ''} dept={s.dept} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-100">{s.displayName}</p>
                    <p className="text-xs text-amber/80">{s.position}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {managers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-teal-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-teal-400 rounded-full" />
              Trưởng phòng
            </p>
            {renderTreeLevel(managers, 1, 'hover:border-teal-400/30')}
          </div>
        )}

        {employees.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-t2 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-t2 rounded-full" />
              Nhân viên
            </p>
            {renderTreeLevel(employees, 2, 'hover:border-white/20')}
          </div>
        )}
      </div>
      )}

      {tab === 'staff' && (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/[0.07]">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc chức vụ..."
                className="input-field pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {depts.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    dept === d ? 'bg-amber/15 text-amber' : 'bg-white/[0.05] text-t2 hover:bg-white/[0.08]'
                  }`}
                >
                  {d === 'all' ? 'Tất cả' : DEPT_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-desktop">
            <thead>
              <tr>
                <th className="text-left">Họ tên</th>
                <th className="text-left hidden md:table-cell">Chức vụ</th>
                <th className="text-left hidden lg:table-cell">Phòng ban</th>
                <th className="text-left hidden sm:table-cell">SĐT</th>
                <th className="text-left hidden xl:table-cell">Email</th>
                <th className="text-left">Trạng thái</th>
                <th className="text-left hidden xl:table-cell">KPI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <EmptyState icon={<Users className="w-8 h-8" />} title="Không tìm thấy" description="Không có nhân sự phù hợp" />
                  </td>
                </tr>
              ) : filtered.map((s) => {
                  const kpi = kpiMap[s.uid]
                  return (<tr key={s.uid} className="hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => setSelectedStaff(s)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.displayName || ''} dept={s.dept} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-100 truncate">{s.displayName}</p>
                          <p className="text-xs text-t3 truncate md:hidden">{s.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 hidden md:table-cell">{s.position}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DEPT_COLORS[s.dept] || 'bg-white/5 text-t2'}`}>
                        {DEPT_LABELS[s.dept] || s.dept}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 hidden xl:table-cell">
                      <span className="line-clamp-1">{s.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-t2'}`}>
                        {s.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {kpi ? (
                        <div className="flex items-center gap-2">
                          <ScoreRingSmall score={kpi.score} grade={kpi.grade} />
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_COLOR[kpi.grade] ?? 'text-gray-400'}`}>
                            {kpi.grade}
                          </span>
                        </div>
                      ) : (
                        <span className="text-t3 text-xs">—</span>
                      )}
                    </td>
                  </tr>)
                })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {selectedStaff && <StaffDetailPanel staff={selectedStaff} onClose={() => setSelectedStaff(null)} />}
    </div>
  )
}
