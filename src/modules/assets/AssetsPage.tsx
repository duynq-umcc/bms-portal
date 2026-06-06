import { useState, useEffect } from 'react'
import { listenAssets, addAsset, listenDisposalRequests, listenDisposalCouncils, listenDisposalExecutions, listenDisposalCouncilVotes } from '@/firebase/db'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset } from '@/firebase/types'
import type {
  DisposalRequest,
  DisposalCouncil,
  DisposalExecution,
  CouncilVote,
} from '@/types/firestore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts'
import {
  Box, Plus, TrendingDown, Search,
  FileText, Users, CheckCircle2,
  Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import DisposalRequestModal from './DisposalRequestModal'
import DisposalCouncilModal from './DisposalCouncilModal'
import DisposalExecutionModal from './DisposalExecutionModal'
import DisposalRequestDetail from './DisposalRequestDetail'

// ─── type ─────────────────────────────────────────────────────────────────────

type Tab = 'registry' | 'depreciation' | 'disposal'
type DisposalSubTab = 'requests' | 'councils' | 'executed'

// ─── depreciation helpers (reused) ────────────────────────────────────────────

function calcDepreciation(asset: Asset) {
  if (!asset.purchaseDate) return { bookValue: asset.purchasePrice, accumulated: 0, monthly: 0, yearsOwned: 0 }
  const now = Date.now()
  const purchaseMs = asset.purchaseDate.toDate().getTime()
  const monthsElapsed = Math.max(0, (now - purchaseMs) / (1000 * 60 * 60 * 24 * 30))
  const yearsOwned = monthsElapsed / 12
  const depreciable = asset.purchasePrice - asset.salvageValue
  if (asset.depreciationMethod === 'straight_line') {
    const monthly = depreciable / (asset.usefulLifeYears * 12)
    const monthsCapped = Math.min(monthsElapsed, asset.usefulLifeYears * 12)
    return {
      bookValue: Math.max(asset.salvageValue, asset.purchasePrice - monthly * monthsCapped),
      accumulated: Math.min(monthly * monthsCapped, depreciable),
      monthly,
      yearsOwned,
    }
  }
  const rate = 2 / asset.usefulLifeYears
  let book = asset.purchasePrice
  for (let m = 0; m < Math.min(monthsElapsed, asset.usefulLifeYears * 12); m++) {
    book = book * (1 - rate / 12)
  }
  return {
    bookValue: Math.max(asset.salvageValue, book),
    accumulated: asset.purchasePrice - Math.max(asset.salvageValue, book),
    monthly: 0,
    yearsOwned,
  }
}

function generateDepreciationCurve(asset: Asset) {
  const points: { month: string; value: number }[] = []
  if (!asset.purchaseDate) return points
  const totalMonths = asset.usefulLifeYears * 12
  for (let m = 0; m <= totalMonths; m += Math.max(1, Math.floor(totalMonths / 12))) {
    let book = asset.purchasePrice
    for (let i = 0; i < m; i++) {
      book = book * (1 - (2 / asset.usefulLifeYears) / 12)
    }
    book = Math.max(asset.salvageValue, book)
    const date = new Date(asset.purchaseDate.toDate())
    date.setMonth(date.getMonth() + m)
    points.push({
      month: format(date, 'MM/yy'),
      value: Math.round(book / 1_000_000 * 10) / 10,
    })
  }
  return points
}

const formatVND = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return n.toLocaleString('vi-VN')
}

// ─── disposal helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Nháp', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  pending_review: { label: 'Chờ xem xét', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  in_council: { label: 'Đang họp HĐ', bg: 'bg-amber/15', text: 'text-amber' },
  approved: { label: 'Được duyệt', bg: 'bg-green-500/15', text: 'text-green-400' },
  rejected: { label: 'Từ chối', bg: 'bg-red-500/15', text: 'text-red-400' },
  executed: { label: 'Đã thanh lý', bg: 'bg-teal-500/15', text: 'text-teal-400' },
  cancelled: { label: 'Đã hủy', bg: 'bg-gray-500/15', text: 'text-gray-500' },
}

const REASON_LABELS: Record<string, string> = {
  broken_unrepairable: 'Hư hỏng không sửa được',
  obsolete: 'Lỗi thời',
  end_of_life: 'Hết khấu hao',
  damaged_beyond_repair: 'Hư hỏng nặng',
  regulatory_compliance: 'Không đáp ứng quy định',
  other: 'Khác',
}

const METHOD_LABELS: Record<string, string> = {
  auction: 'Đấu giá',
  sell_fixed_price: 'Bán giá cố định',
  transfer_to_dept: 'Điều chuyển',
  donate: 'Hiến tặng',
  scrap: 'Phế liệu',
  destroy: 'Tiêu hủy',
}

const COUNCIL_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Đã lên lịch', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  in_progress: { label: 'Đang họp', bg: 'bg-amber/15', text: 'text-amber' },
  completed: { label: 'Hoàn thành', bg: 'bg-green-500/15', text: 'text-green-400' },
}

// ─── form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  code: z.string().min(1, 'Mã tài sản là bắt buộc'),
  name: z.string().min(2, 'Tên tài sản ít nhất 2 ký tự'),
  category: z.string().min(1, 'Danh mục là bắt buộc'),
  location: z.string().min(1, 'Vị trí là bắt buộc'),
  dept: z.enum(['admin', 'it', 'electrical', 'medical', 'warehouse', 'compliance', 'civil', 'viewer']),
  purchasePrice: z.coerce.number().min(0),
  usefulLifeYears: z.coerce.number().min(1),
  salvageValue: z.coerce.number().min(0),
  depreciationMethod: z.enum(['straight_line', 'declining']),
})
type Form = z.infer<typeof schema>

// ─── Registry Tab ─────────────────────────────────────────────────────────────

function RegistryTab({ assets, onAdd }: { assets: Asset[]; onAdd: () => void }) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const categories = ['all', ...new Set(assets.map((a) => a.category).filter(Boolean))]
  const filtered = assets.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase())
    const matchesCat = filterCategory === 'all' || a.category === filterCategory
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus
    return matchesSearch && matchesCat && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã, tên..." className="input-field pl-9" />
        </div>
        <div className="flex gap-2">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field w-auto">
            {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'Tất cả danh mục' : c}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-auto">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="maintenance">Bảo trì</option>
            <option value="disposed">Đã thanh lý</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Box className="w-8 h-8" />} title="Không tìm thấy" description="Thêm tài sản đầu tiên" action={onAdd} actionLabel="Thêm tài sản" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Mã TS</th>
                  <th className="text-left hidden sm:table-cell">Tên tài sản</th>
                  <th className="text-left hidden md:table-cell">Danh mục</th>
                  <th className="text-left hidden lg:table-cell">Vị trí</th>
                  <th className="text-right hidden xl:table-cell">Ngày mua</th>
                  <th className="text-right hidden xl:table-cell">Nguyên giá</th>
                  <th className="text-right">Giá trị còn lại</th>
                  <th className="text-left">Trạng thái</th>
                  <th className="text-left hidden xl:table-cell">Thanh lý</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const dep = calcDepreciation(a)
                  return (
                    <tr key={a.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs text-t3">{a.code}</td>
                      <td className="px-4 py-3 hidden sm:table-cell font-medium text-gray-100">{a.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-info text-xs">{a.category}</span></td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">{a.location}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-400 text-xs text-right">
                        {a.purchaseDate ? format(a.purchaseDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-400 text-xs text-right">{formatVND(a.purchasePrice)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-amber">{formatVND(dep.bookValue)}</span>
                        <p className="text-[10px] text-t3">-{formatVND(dep.accumulated)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'active' ? 'bg-green-500/15 text-green-400'
                            : a.status === 'disposed' ? 'bg-red-500/15 text-red-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {a.status === 'active' ? 'Hoạt động' : a.status === 'disposed' ? 'Đã thanh lý' : 'Bảo trì'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {(a as any).disposalRequestId ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                            {(a as any).disposalStatus === 'pending_review' ? 'Chờ HĐ'
                              : (a as any).disposalStatus === 'in_council' ? 'Đang xử lý'
                              : (a as any).disposalStatus === 'executed' ? 'Đã thanh lý'
                              : 'Đã gửi'}
                          </span>
                        ) : a.status === 'disposed' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">Đã thanh lý</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Depreciation Tab ─────────────────────────────────────────────────────────

function DepreciationTab({ assets }: { assets: Asset[] }) {
  const activeAssets = assets.filter((a) => a.status === 'active')
  const totalPurchase = activeAssets.reduce((s, a) => s + a.purchasePrice, 0)
  const totalAccumulated = activeAssets.reduce((s, a) => s + calcDepreciation(a).accumulated, 0)
  const totalBookValue = activeAssets.reduce((s, a) => s + calcDepreciation(a).bookValue, 0)

  const chartData = activeAssets.slice(0, 10).map((a) => {
    const dep = calcDepreciation(a)
    return {
      name: a.name.length > 15 ? a.name.slice(0, 15) + '...' : a.name,
      original: Math.round(a.purchasePrice / 1_000_000 * 10) / 10,
      bookValue: Math.round(dep.bookValue / 1_000_000 * 10) / 10,
      depreciated: Math.round(dep.accumulated / 1_000_000 * 10) / 10,
    }
  })

  const allCurves = activeAssets.slice(0, 5).map((a) => ({
    asset: a,
    data: generateDepreciationCurve(a),
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Tổng nguyên giá</p>
          <p className="text-lg font-bold text-gray-100">{formatVND(totalPurchase)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Đã khấu hao</p>
          <p className="text-lg font-bold text-red-400">{formatVND(totalAccumulated)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-t3 mb-1">Giá trị còn lại</p>
          <p className="text-lg font-bold text-amber">{formatVND(totalBookValue)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-desktop">
            <thead>
              <tr>
                <th className="text-left">Tài sản</th>
                <th className="text-right hidden lg:table-cell">Nguyên giá</th>
                <th className="text-right hidden md:table-cell">Đã khấu hao</th>
                <th className="text-right">Giá trị còn lại</th>
                <th className="text-left hidden xl:table-cell">Phương pháp</th>
              </tr>
            </thead>
            <tbody>
              {activeAssets.map((a) => {
                const dep = calcDepreciation(a)
                const depPct = a.purchasePrice > 0 ? (dep.accumulated / a.purchasePrice) * 100 : 0
                return (
                  <tr key={a.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100 text-sm">{a.name}</p>
                      <p className="text-xs text-t3 font-mono">{a.code}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 hidden lg:table-cell">{formatVND(a.purchasePrice)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-red-400">{formatVND(dep.accumulated)}</span>
                      <div className="w-16 bg-white/5 rounded-full h-1 mt-1">
                        <div className="bg-red-500/60 h-1 rounded-full" style={{ width: `${Math.min(100, depPct)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-amber">{formatVND(dep.bookValue)}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-t3">
                        {a.depreciationMethod === 'straight_line' ? 'Đường thẳng' : 'Giảm dần'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-100 text-sm mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber" />
            Nguyên giá vs Giá trị còn lại (top 10)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
              <Tooltip formatter={(v) => [`${v}M`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="original" name="Nguyên giá" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="bookValue" name="Còn lại" fill="#16a34a" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-100 text-sm mb-4">Đường khấu hao theo thời gian</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
              <Tooltip formatter={(v) => [`${v}M`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              {allCurves.map((c, i) => (
                <Area key={c.asset.id} type="monotone" dataKey="value" data={c.data} name={c.asset.name.slice(0, 10)} stroke={['#f59e0b', '#3b82f6', '#16a34a', '#ef4444', '#8b5cf6'][i % 5]} fillOpacity={0.1} strokeWidth={1.5} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Disposal Tab ─────────────────────────────────────────────────────────────

function DisposalTab({
  assets,
  requests,
  councils,
  executions,
  onNewRequest,
  onOpenCouncil,
  onViewRequest,
  onExecute,
  userRole,
}: {
  assets: Asset[]
  requests: (DisposalRequest & { id: string })[]
  councils: (DisposalCouncil & { id: string })[]
  executions: (DisposalExecution & { id: string })[]
  onNewRequest: () => void
  onOpenCouncil: (council?: DisposalCouncil & { id: string }) => void
  onViewRequest: (req: DisposalRequest & { id: string }) => void
  onExecute: (req: DisposalRequest & { id: string } ) => void
  userRole: string
}) {
  const [subTab, setSubTab] = useState<DisposalSubTab>('requests')
  const [filterStatus, setFilterStatus] = useState('all')
  const isAdminManager = ['admin', 'manager'].includes(userRole)

  const filteredRequests = requests.filter((r) => filterStatus === 'all' || r.status === filterStatus)
  const pendingCount = requests.filter((r) => r.status === 'pending_review').length
  const inCouncilCount = requests.filter((r) => r.status === 'in_council').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const executedThisMonth = executions.filter((e) => {
    if (!e.executionDate) return false
    const now = new Date()
    const d = e.executionDate.toDate()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const totalRevenue = executions.reduce((s, e) => s + (e.revenueReceived || 0), 0)
  const handedToAccounting = executions.filter((e) => e.revenueReceived > 0).length
  const notHanded = executions.filter((e) => e.revenueReceived > 0 && !e.revenueHandedTo).length

  const scheduledCouncils = councils.filter((c) => c.status === 'scheduled').length
  const inProgressCouncils = councils.filter((c) => c.status === 'in_progress').length
  const completedCouncils = councils.filter((c) => c.status === 'completed').length

  // Merge disposal info into assets
  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]))
  const enrichedRequests = filteredRequests.map((r) => ({
    ...r,
    asset: assetMap[r.assetId],
  }))

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {subTab === 'requests' && (
          <>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Chờ xem xét</p>
              <p className="text-2xl font-bold text-blue-400">{pendingCount}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đang họp HĐ</p>
              <p className="text-2xl font-bold text-amber">{inCouncilCount}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Được duyệt</p>
              <p className="text-2xl font-bold text-green-400">{approvedCount}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đã thanh lý tháng</p>
              <p className="text-2xl font-bold text-teal-400">{executedThisMonth}</p>
            </div>
          </>
        )}
        {subTab === 'councils' && (
          <>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Sắp họp</p>
              <p className="text-2xl font-bold text-blue-400">{scheduledCouncils}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đang họp</p>
              <p className="text-2xl font-bold text-amber">{inProgressCouncils}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đã hoàn thành</p>
              <p className="text-2xl font-bold text-green-400">{completedCouncils}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Tổng HĐ</p>
              <p className="text-2xl font-bold text-gray-400">{councils.length}</p>
            </div>
          </>
        )}
        {subTab === 'executed' && (
          <>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đã thanh lý tháng</p>
              <p className="text-2xl font-bold text-teal-400">{executedThisMonth}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Tổng thu về</p>
              <p className="text-lg font-bold text-amber">{formatVND(totalRevenue)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Đã nộp kế toán</p>
              <p className="text-2xl font-bold text-green-400">{handedToAccounting}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-t3">Chưa nộp</p>
              <p className={`text-2xl font-bold ${notHanded > 0 ? 'text-red-400' : 'text-gray-400'}`}>{notHanded}</p>
            </div>
          </>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
        {([
          { key: 'requests' as DisposalSubTab, label: 'Đề xuất', icon: FileText },
          { key: 'councils' as DisposalSubTab, label: 'Hội đồng', icon: Users },
          { key: 'executed' as DisposalSubTab, label: 'Đã thực hiện', icon: CheckCircle2 },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              subTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* SUB-TAB: Requests */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field w-auto text-xs"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="draft">Nháp</option>
                <option value="pending_review">Chờ xem xét</option>
                <option value="in_council">Đang họp HĐ</option>
                <option value="approved">Được duyệt</option>
                <option value="rejected">Từ chối</option>
                <option value="executed">Đã thanh lý</option>
              </select>
            </div>
            <button onClick={onNewRequest} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Đề xuất thanh lý mới
            </button>
          </div>

          {enrichedRequests.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="Không có đề xuất thanh lý"
              description="Tạo đề xuất thanh lý mới từ danh sách tài sản"
              action={onNewRequest}
              actionLabel="Đề xuất thanh lý mới"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-desktop">
                  <thead>
                    <tr>
                      <th className="text-left">Tài sản</th>
                      <th className="text-left hidden md:table-cell">Lý do</th>
                      <th className="text-left hidden lg:table-cell">Hình thức</th>
                      <th className="text-right hidden xl:table-cell">Giá trị đề xuất</th>
                      <th className="text-left">Trạng thái</th>
                      <th className="text-left hidden xl:table-cell">Ngày</th>
                      <th className="text-left">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedRequests.map((r) => {
                      const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft
                      return (
                        <tr key={r.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-100 text-sm">{r.assetName}</p>
                            <p className="text-xs text-t3 font-mono">{r.assetCode}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="badge-warning text-xs">{REASON_LABELS[r.requestReason] || r.requestReason}</span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="badge-info text-xs">{METHOD_LABELS[r.proposedDisposalMethod] || r.proposedDisposalMethod}</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden xl:table-cell">
                            <span className="text-amber font-semibold">{formatVND(r.proposedDisposalValue)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">
                            {r.requestedAt ? format(r.requestedAt.toDate(), 'dd/MM/yy') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onViewRequest(r)}
                                className="px-2.5 py-1 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                              >
                                Xem
                              </button>
                              {r.status === 'approved' && isAdminManager && (
                                <button
                                  onClick={() => onExecute(r)}
                                  className="px-2.5 py-1 rounded-lg text-xs text-green-400 hover:bg-green-500/10 transition-colors"
                                >
                                  Thực hiện
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: Councils */}
      {subTab === 'councils' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            {isAdminManager && (
              <button onClick={() => onOpenCouncil()} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tổ chức HĐ thanh lý
              </button>
            )}
          </div>

          {councils.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="Chưa có cuộc họp Hội đồng"
              description="Tổ chức cuộc họp để xem xét các đề xuất thanh lý"
              action={isAdminManager ? () => onOpenCouncil() : undefined}
              actionLabel={isAdminManager ? 'Tổ chức HĐ thanh lý' : undefined}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-desktop">
                  <thead>
                    <tr>
                      <th className="text-left">Tên biên bản</th>
                      <th className="text-left hidden md:table-cell">Ngày họp</th>
                      <th className="text-left hidden lg:table-cell">Chủ tịch HĐ</th>
                      <th className="text-center hidden xl:table-cell">Tài sản</th>
                      <th className="text-left">Trạng thái</th>
                      <th className="text-left">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {councils.map((c) => {
                      const status = COUNCIL_STATUS[c.status] || COUNCIL_STATUS.scheduled
                      return (
                        <tr key={c.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-100 text-sm">{c.title}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                            {c.meetingDate ? format(c.meetingDate.toDate(), 'dd/MM/yyyy HH:mm', { locale: vi }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                            {c.chairperson?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-center hidden xl:table-cell">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-300">{c.requestIds.length}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => onOpenCouncil(c)}
                              className="px-2.5 py-1 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                            >
                              {c.status === 'in_progress' ? 'Tiếp tục' : 'Xem'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: Executed */}
      {subTab === 'executed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/15 text-gray-300 hover:bg-white/[0.06] transition-colors">
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>
          </div>

          {executions.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8" />}
              title="Chưa có biên bản thanh lý"
              description="Danh sách tài sản đã hoàn thành thanh lý sẽ hiển thị tại đây"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-desktop">
                  <thead>
                    <tr>
                      <th className="text-left">Ngày</th>
                      <th className="text-left">Tài sản</th>
                      <th className="text-left hidden md:table-cell">Hình thức</th>
                      <th className="text-right hidden lg:table-cell">Giá trị thực</th>
                      <th className="text-left hidden xl:table-cell">Người mua</th>
                      <th className="text-left hidden lg:table-cell">Người thực hiện</th>
                      <th className="text-left">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {e.executionDate ? format(e.executionDate.toDate(), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-100 text-sm">{e.assetName}</p>
                          <p className="text-xs text-t3 font-mono">{e.assetCode}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="badge-info text-xs">{METHOD_LABELS[e.disposalMethod] || e.disposalMethod}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          <span className="text-amber font-semibold">{formatVND(e.actualDisposalValue)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">
                          {e.buyerInfo || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {e.executedByName}
                        </td>
                        <td className="px-4 py-3">
                          <button className="px-2.5 py-1 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Asset Picker Modal ───────────────────────────────────────────────────────

function AssetPickerModal({
  isOpen,
  onClose,
  assets,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  assets: Asset[]
  onSelect: (asset: Asset) => void
}) {
  const [search, setSearch] = useState('')
  const eligible = assets.filter((a) => a.status === 'active')
  const filtered = eligible.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal open={isOpen} onClose={onClose} title="Chọn tài sản để thanh lý" size="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài sản..."
            className="input-field pl-9"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-t3 py-8">Không có tài sản phù hợp</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filtered.map((a) => {
              const dep = calcDepreciation(a)
              return (
                <button
                  key={a.id}
                  onClick={() => { onSelect(a); onClose() }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-amber/30 hover:bg-amber/5 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 text-sm">{a.name}</p>
                    <p className="text-xs text-t3 font-mono">{a.code} · {a.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber text-sm font-semibold">{formatVND(dep.bookValue)}</p>
                    <p className="text-[10px] text-t3">Giá trị còn lại</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { user } = useAuth()
  const userRole = user?.role || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [requests, setRequests] = useState<(DisposalRequest & { id: string })[]>([])
  const [councils, setCouncils] = useState<(DisposalCouncil & { id: string })[]>([])
  const [executions, setExecutions] = useState<(DisposalExecution & { id: string })[]>([])
  const [votesMap, setVotesMap] = useState<Record<string, (CouncilVote & { id: string })[]>>({})

  const [tab, setTab] = useState<Tab>('registry')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  // Disposal modals
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showCouncilModal, setShowCouncilModal] = useState(false)
  const [editingCouncil, setEditingCouncil] = useState<DisposalCouncil & { id: string } | undefined>()
  const [showExecutionModal, setShowExecutionModal] = useState(false)
  const [selectedExecutionReq, setSelectedExecutionReq] = useState<DisposalRequest & { id: string } | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DisposalRequest & { id: string } | null>(null)

  useEffect(() => {
    const unsubAssets = listenAssets(setAssets)
    const unsubRequests = listenDisposalRequests(setRequests)
    const unsubCouncils = listenDisposalCouncils(setCouncils)
    const unsubExecutions = listenDisposalExecutions(setExecutions)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => {
      unsubAssets(); unsubRequests(); unsubCouncils(); unsubExecutions(); clearTimeout(timer)
    }
  }, [])

  // Build asset disposal map
  const assetDisposalMap: Record<string, { status: string; requestId: string }> = {}
  for (const r of requests) {
    if (!assetDisposalMap[r.assetId]) {
      assetDisposalMap[r.assetId] = { status: r.status, requestId: r.id }
    }
  }
  const assetsWithDisposal = assets.map((a) => ({
    ...a,
    disposalRequestId: assetDisposalMap[a.id]?.requestId,
    disposalStatus: assetDisposalMap[a.id]?.status,
  }))

  // Load votes for councils
  useEffect(() => {
    const unsubs: (() => void)[] = []
    for (const c of councils) {
      const unsub = listenDisposalCouncilVotes(c.id, (votes) => {
        setVotesMap((prev) => ({ ...prev, [c.id]: votes }))
      })
      unsubs.push(unsub)
    }
    return () => unsubs.forEach((u) => u())
  }, [councils.map((c) => c.id).join(',')])

  const onSubmit = async (data: Form) => {
    try {
      await addAsset({ ...data, status: 'active', purchaseDate: undefined } as Omit<Asset, 'id'>)
      toast.success('Thêm tài sản thành công')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm tài sản thất bại') }
  }

  const handleNewRequest = () => {
    setShowAssetPicker(true)
  }

  const handleAssetSelected = (asset: Asset) => {
    setSelectedAsset(asset)
    setShowRequestModal(true)
  }

  const handleViewRequest = (req: DisposalRequest & { id: string }) => {
    setSelectedRequest(req)
    setShowDetailPanel(true)
  }

  const handleExecute = (req: DisposalRequest & { id: string }) => {
    setSelectedExecutionReq(req)
    setShowExecutionModal(true)
  }

  const handleOpenCouncil = (council?: DisposalCouncil & { id: string }) => {
    setEditingCouncil(council)
    setShowCouncilModal(true)
  }

  const handleAddToCouncil = (_req: DisposalRequest & { id: string }) => {
    setShowDetailPanel(false)
    setEditingCouncil(undefined)
    setShowCouncilModal(true)
  }

  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Tài sản</h1>
          <p className="text-sm text-gray-500">{assets.length} tài sản · {assets.filter((a) => a.status === 'active').length} hoạt động · {assets.filter((a) => a.status === 'disposed').length} đã thanh lý</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Thêm tài sản
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {([
          { key: 'registry' as Tab, label: 'Danh sách' },
          { key: 'depreciation' as Tab, label: 'Khấu hao' },
          { key: 'disposal' as Tab, label: 'Thanh lý' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-t2 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'registry' && <RegistryTab assets={assetsWithDisposal as Asset[]} onAdd={() => setShowAdd(true)} />}
      {tab === 'depreciation' && <DepreciationTab assets={assets} />}
      {tab === 'disposal' && (
        <DisposalTab
          assets={assetsWithDisposal as Asset[]}
          requests={requests}
          councils={councils}
          executions={executions}
          onNewRequest={handleNewRequest}
          onOpenCouncil={handleOpenCouncil}
          onViewRequest={handleViewRequest}
          onExecute={handleExecute}
          userRole={userRole}
        />
      )}

      {/* Add asset modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm tài sản mới" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tài sản</label>
              <input {...register('code')} className="input-field" placeholder="AST-XXX" />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên tài sản</label>
              <input {...register('name')} className="input-field" placeholder="Tên tài sản..." />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
              <input {...register('category')} className="input-field" placeholder="VD: Điện, Cơ điện..." />
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
              <input {...register('location')} className="input-field" />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nguyên giá (VNĐ)</label>
              <input type="number" {...register('purchasePrice')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tuổi thọ (năm)</label>
              <input type="number" {...register('usefulLifeYears')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị thu hồi (VNĐ)</label>
              <input type="number" {...register('salvageValue')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp khấu hao</label>
              <select {...register('depreciationMethod')} className="input-field">
                <option value="straight_line">Khấu hao đường thẳng</option>
                <option value="declining">Khấu hao giảm dần</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
              <select {...register('dept')} className="input-field">
                <option value="it">CNTT</option><option value="electrical">Điện</option>
                <option value="medical">Y tế</option><option value="warehouse">Kho</option>
                <option value="civil">Xây dựng</option><option value="compliance">Compliance</option>
                <option value="admin">Quản trị</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang thêm...' : 'Thêm tài sản'}
          </button>
        </form>
      </Modal>

      {/* Asset picker for disposal */}
      <AssetPickerModal
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        assets={assets}
        onSelect={handleAssetSelected}
      />

      {/* Disposal request modal */}
      {selectedAsset && (
        <DisposalRequestModal
          isOpen={showRequestModal}
          onClose={() => { setShowRequestModal(false); setSelectedAsset(null) }}
          asset={selectedAsset}
        />
      )}

      {/* Council modal */}
      <DisposalCouncilModal
        isOpen={showCouncilModal}
        onClose={() => { setShowCouncilModal(false); setEditingCouncil(undefined) }}
        existingCouncil={editingCouncil}
      />

      {/* Execution modal */}
      {selectedExecutionReq && (
        <DisposalExecutionModal
          isOpen={showExecutionModal}
          onClose={() => { setShowExecutionModal(false); setSelectedExecutionReq(null) }}
          disposalRequest={selectedExecutionReq}
        />
      )}

      {/* Request detail panel */}
      {selectedRequest && (
        <DisposalRequestDetail
          isOpen={showDetailPanel}
          onClose={() => { setShowDetailPanel(false); setSelectedRequest(null) }}
          request={selectedRequest}
          council={councils.find((c) => c.requestIds.includes(selectedRequest.id))}
          votes={votesMap[councils.find((c) => c.requestIds.includes(selectedRequest.id))?.id || '']?.filter((v) => v.requestId === selectedRequest.id)}
          execution={executions.find((e) => e.requestId === selectedRequest.id)}
          onAddToCouncil={() => handleAddToCouncil(selectedRequest)}
          onExecute={() => { setShowDetailPanel(false); handleExecute(selectedRequest) }}
          userRole={userRole}
        />
      )}
    </div>
  )
}
