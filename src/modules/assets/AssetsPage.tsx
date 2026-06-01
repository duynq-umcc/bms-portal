import { useState, useEffect } from 'react'
import { listenAssets, addAsset } from '@/firebase/db'
import type { Asset } from '@/firebase/types'
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
import { Box, Plus, TrendingDown, Trash2, Search } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'registry' | 'depreciation' | 'disposal'

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
    const rate = 2 / asset.usefulLifeYears
    let book = asset.purchasePrice
    for (let i = 0; i < m; i++) {
      book = book * (1 - rate / 12)
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Mã TS</th>
                  <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden sm:table-cell">Tên tài sản</th>
                  <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Danh mục</th>
                  <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Vị trí</th>
                  <th className="text-right px-4 py-3 font-medium text-t3 text-xs hidden xl:table-cell">Ngày mua</th>
                  <th className="text-right px-4 py-3 font-medium text-t3 text-xs hidden xl:table-cell">Nguyên giá</th>
                  <th className="text-right px-4 py-3 font-medium text-t3 text-xs">Giá trị còn lại</th>
                  <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
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
      {/* Summary */}
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

      {/* Depreciation table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Tài sản</th>
                <th className="text-right px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Nguyên giá</th>
                <th className="text-right px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Đã khấu hao</th>
                <th className="text-right px-4 py-3 font-medium text-t3 text-xs">Giá trị còn lại</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden xl:table-cell">Phương pháp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart comparison */}
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

        {/* Depreciation curves */}
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

function DisposalTab({ assets }: { assets: Asset[] }) {
  const disposed = assets.filter((a) => a.status === 'disposed')

  return (
    <div className="space-y-4">
      {disposed.length === 0 ? (
        <EmptyState icon={<Trash2 className="w-8 h-8" />} title="Không có tài sản thanh lý" description="Tài sản đã thanh lý sẽ hiển thị tại đây" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Tên tài sản</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Lý do thanh lý</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Ngày thanh lý</th>
                <th className="text-right px-4 py-3 font-medium text-t3 text-xs hidden xl:table-cell">Nguyên giá</th>
                <th className="text-right px-4 py-3 font-medium text-t3 text-xs">Người duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {disposed.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-100">{a.name}</p>
                    <p className="text-xs text-t3 font-mono">{a.code}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{a.notes || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">
                    {a.purchaseDate ? format(a.purchaseDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden xl:table-cell">{formatVND(a.purchasePrice)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.assignedTo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [tab, setTab] = useState<Tab>('registry')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  useEffect(() => {
    const unsub = listenAssets(setAssets)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  const onSubmit = async (data: Form) => {
    try {
      await addAsset({ ...data, status: 'active', purchaseDate: undefined } as Omit<Asset, 'id'>)
      toast.success('Thêm tài sản thành công')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm tài sản thất bại') }
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

      {tab === 'registry' && <RegistryTab assets={assets} onAdd={() => setShowAdd(true)} />}
      {tab === 'depreciation' && <DepreciationTab assets={assets} />}
      {tab === 'disposal' && <DisposalTab assets={assets} />}

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
    </div>
  )
}
