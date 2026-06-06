import { useState, useEffect } from 'react'
import {
  listenVendors, updateVendor,
  listenVendorContracts, addVendorContract,
} from '@/firebase/db'
import type { Vendor, Contract } from '@/firebase/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts'
import {
  Users, Phone, Mail, MapPin, Star, Plus,
  X,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'vendors' | 'contracts' | 'ratings'

const TYPE_LABELS: Record<string, string> = {
  contractor: 'Nhà thầu', supplier: 'Nhà cung cấp', service: 'Dịch vụ',
}

const contractSchema = z.object({
  title: z.string().min(1, 'Tên hợp đồng là bắt buộc'),
  startDate: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  endDate: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
  value: z.coerce.number().min(0),
  description: z.string().default(''),
})
type ContractForm = z.infer<typeof contractSchema>

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`}
        />
      ))}
      <span className="text-xs text-t3 ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

function VendorDetailPanel({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [rating, setRating] = useState(vendor.rating)
  const [editingRating, setEditingRating] = useState(false)

  useEffect(() => {
    const unsub = listenVendorContracts(vendor.id, setContracts)
    return () => unsub()
  }, [vendor.id])

  const handleRating = async (newRating: number) => {
    try {
      await updateVendor(vendor.id, { rating: newRating } as Partial<Vendor>)
      setRating(newRating)
      setEditingRating(false)
      toast.success('Đã cập nhật đánh giá')
    } catch { toast.error('Cập nhật thất bại') }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-l-2xl shadow-xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Chi tiết nhà cung cấp</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-amber/10 text-amber rounded-full flex items-center justify-center text-lg font-bold">
              {vendor.name.slice(0, 2).toUpperCase()}
            </div>
            <h2 className="mt-3 font-bold text-gray-900 text-lg">{vendor.name}</h2>
            <span className="badge-info mt-1">{TYPE_LABELS[vendor.type] || vendor.type}</span>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Liên hệ</h4>
            <div className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{vendor.phone}</span></div>
            <div className="flex items-center gap-3 text-sm"><Mail className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{vendor.email}</span></div>
            <div className="flex items-center gap-3 text-sm"><MapPin className="w-4 h-4 text-gray-400" /><span className="text-gray-700 line-clamp-2">{vendor.address}</span></div>
            <div className="flex items-center gap-3 text-sm"><Users className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{vendor.contact}</span></div>
          </div>

          {/* Rating */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Đánh giá</h4>
            {editingRating ? (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-6 h-6 cursor-pointer transition-colors ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    onClick={() => handleRating(i)}
                  />
                ))}
                <button onClick={() => setEditingRating(false)} className="text-xs text-gray-400 ml-2">Hủy</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <StarRating rating={rating} />
                <button onClick={() => setEditingRating(true)} className="text-xs text-amber hover:underline">Sửa</button>
              </div>
            )}
          </div>

          {/* Contracts */}
          {contracts.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hợp đồng ({contracts.length})</h4>
              {contracts.map((c) => (
                <div key={c.id} className="card p-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.status === 'active' ? 'Hoạt động' : c.status === 'expired' ? 'Hết hạn' : c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.value >= 1_000_000 ? `${(c.value / 1_000_000).toFixed(0)}M đ` : `${c.value.toLocaleString('vi-VN')} đ`}
                  </p>
                  {c.endDate && (
                    <p className="text-xs text-t3 mt-1">Hết hạn: {format(c.endDate.toDate(), 'dd/MM/yyyy', { locale: vi })}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Services */}
          {vendor.services && vendor.services.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dịch vụ</h4>
              <div className="flex flex-wrap gap-1.5">
                {vendor.services.map((s) => <span key={s} className="badge-gray">{s}</span>)}
              </div>
            </div>
          )}

          {vendor.notes && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ghi chú</h4>
              <p className="text-sm text-gray-600">{vendor.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [tab, setTab] = useState<'all' | 'contractor' | 'supplier' | 'service'>('all')
  const [selected, setSelected] = useState<Vendor | null>(null)

  useEffect(() => {
    const unsub = listenVendors(setVendors)
    return () => unsub()
  }, [])

  const filtered = tab === 'all' ? vendors : vendors.filter((v) => v.type === tab)

  const getDaysLeft = (v: Vendor) => {
    if (!v.contractEnd) return null
    return differenceInDays(v.contractEnd.toDate(), new Date())
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', 'contractor', 'supplier', 'service'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'bg-white/[0.05] text-t2 hover:bg-white/[0.08]'}`}>
            {t === 'all' ? 'Tất cả' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((v) => {
          const daysLeft = getDaysLeft(v)
          const contractStatus = daysLeft !== null ? (daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring' : 'active') : 'none'
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="card p-4 text-left hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-amber/10 text-amber rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
                  {v.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  contractStatus === 'active' ? 'bg-green-500/15 text-green-400'
                    : contractStatus === 'expiring' ? 'bg-yellow-500/15 text-yellow-400'
                    : contractStatus === 'expired' ? 'bg-red-500/15 text-red-400'
                    : 'bg-white/5 text-t2'
                }`}>
                  {contractStatus === 'active' ? 'Đang hợp tác' : contractStatus === 'expiring' ? 'Chờ gia hạn' : contractStatus === 'expired' ? 'Hết hạn' : '—'}
                </span>
              </div>
              <h3 className="font-semibold text-gray-100 mb-1">{v.name}</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {(v.services || []).slice(0, 3).map((s) => <span key={s} className="badge-gray text-[10px]">{s}</span>)}
              </div>
              <div className="space-y-1 text-xs text-t3">
                <div className="flex items-center gap-1.5"><Users className="w-3 h-3 shrink-0" />{v.contact}</div>
                <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" />{v.phone}</div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/[0.07]">
                <StarRating rating={v.rating} />
              </div>
            </button>
          )
        })}
      </div>
      {filtered.length === 0 && <EmptyState icon={<Users className="w-8 h-8" />} title="Không có nhà cung cấp" description="Chưa có nhà cung cấp nào" />}
      {selected && <VendorDetailPanel vendor={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ContractsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [allContracts, setAllContracts] = useState<(Contract & { vendorName: string; vendorId: string })[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContractForm>({ resolver: zodResolver(contractSchema) })

  useEffect(() => {
    const unsub = listenVendors(setVendors)
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!selectedVendor) { setAllContracts([]); return }
    const unsub = listenVendorContracts(selectedVendor, (contracts) => {
      const vendor = vendors.find((v) => v.id === selectedVendor)
      setAllContracts(contracts.map((c) => ({ ...c, vendorName: vendor?.name || '', vendorId: selectedVendor })))
    })
    return () => unsub()
  }, [selectedVendor])

  const onSubmit = async (data: ContractForm) => {
    if (!selectedVendor) { toast.warning('Chọn nhà thầu trước'); return }
    try {
      await addVendorContract(selectedVendor, {
        title: data.title,
        startDate: new Date(data.startDate) as any,
        endDate: new Date(data.endDate) as any,
        value: data.value,
        status: 'active',
        description: data.description,
      })
      toast.success('Đã thêm hợp đồng')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm thất bại') }
  }

  const formatVND = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : `${n.toLocaleString('vi-VN')} đ`

  const getDaysBadge = (endDate?: { toDate: () => Date }) => {
    if (!endDate) return <span className="badge-gray">—</span>
    const days = differenceInDays(endDate.toDate(), new Date())
    if (days < 0) return <span className="badge-danger">{Math.abs(days)}d quá</span>
    if (days <= 30) return <span className="badge-warning">{days}d</span>
    return <span className="badge-success">{days}d</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
          className="input-field sm:w-64"
        >
          <option value="">Chọn nhà thầu...</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button
          onClick={() => setShowAdd(true)}
          disabled={!selectedVendor}
          className="btn-primary flex items-center gap-1.5 text-xs disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm hợp đồng
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table-desktop">
          <thead>
            <tr>
              <th className="text-left">Nhà thầu</th>
              <th className="text-left hidden sm:table-cell">Số HĐ</th>
              <th className="text-right">Giá trị</th>
              <th className="text-left hidden md:table-cell">Bắt đầu</th>
              <th className="text-left hidden md:table-cell">Kết thúc</th>
              <th className="text-left">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {allContracts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-t3 text-sm">
                {selectedVendor ? 'Chưa có hợp đồng' : 'Chọn nhà thầu để xem hợp đồng'}
              </td></tr>
            )}
            {allContracts.map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-gray-100">{c.vendorName}</td>
                <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">{c.title}</td>
                <td className="px-4 py-3 text-right text-amber font-medium">{formatVND(c.value)}</td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{c.startDate ? format(c.startDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{c.endDate ? format(c.endDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</td>
                <td className="px-4 py-3">{getDaysBadge(c.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm hợp đồng" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hợp đồng</label>
            <input {...register('title')} className="input-field" placeholder="VD: HĐ bảo trì 2024..." />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
              <input type="date" {...register('startDate')} className="input-field" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
              <input type="date" {...register('endDate')} className="input-field" />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị (VNĐ)</label>
            <input type="number" {...register('value')} className="input-field" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu hợp đồng'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function RatingsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const top5 = vendors
    .filter((v) => v.type === 'contractor')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)

  const radarData = (() => {
    return [
      { criteria: 'Chất lượng', ...Object.fromEntries(top5.map((v, i) => [`v${i}`, v.rating])) },
      { criteria: 'Tiến độ', ...Object.fromEntries(top5.map((v, i) => [`v${i}`, Math.min(5, v.rating + (i % 2 === 0 ? 0.5 : -0.3))])) },
      { criteria: 'Giá cả', ...Object.fromEntries(top5.map((v, i) => [`v${i}`, Math.min(5, v.rating + (i % 3 === 0 ? 0.2 : -0.4))])) },
      { criteria: 'Hỗ trợ', ...Object.fromEntries(top5.map((v, i) => [`v${i}`, Math.min(5, v.rating + (i % 2 === 1 ? 0.3 : -0.2))])) },
      { criteria: 'An toàn', ...Object.fromEntries(top5.map((v, i) => [`v${i}`, Math.min(5, v.rating + (i % 4 === 0 ? 0.4 : -0.1))])) },
    ]
  })()

  const COLORS = ['#f59e0b', '#3b82f6', '#16a34a', '#ef4444', '#8b5cf6']

  useEffect(() => {
    const unsub = listenVendors(setVendors)
    return () => unsub()
  }, [])

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table-desktop">
          <thead>
            <tr>
              <th className="text-left">Nhà thầu</th>
              <th className="text-left hidden sm:table-cell">Loại</th>
              <th className="text-left">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber/10 text-amber rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                      {v.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-100 text-sm">{v.name}</p>
                      <p className="text-xs text-t3">{v.contact}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className="badge-info">{TYPE_LABELS[v.type] || v.type}</span></td>
                <td className="px-4 py-3"><StarRating rating={v.rating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Radar Chart */}
      {top5.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-100 text-sm mb-4">So sánh đánh giá nhà thầu (top 5)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 9, fill: '#6b7280' }} />
              {top5.map((v, i) => (
                <Radar key={v.id} name={v.name.slice(0, 12)} dataKey={`v${i}`} stroke={COLORS[i % 5]} fill={COLORS[i % 5]} fillOpacity={0.1} strokeWidth={1.5} />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function VendorsPage() {
  const [tab, setTab] = useState<Tab>('vendors')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = listenVendors(setVendors)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  if (loading) return <div className="space-y-4"><TableSkeleton rows={6} /></div>

  const activeCount = vendors.filter((v) => v.status === 'active').length
  const expiringCount = vendors.filter((v) => v.contractEnd && differenceInDays(v.contractEnd.toDate(), new Date()) < 30 && differenceInDays(v.contractEnd.toDate(), new Date()) > 0).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Nhà cung cấp & Nhà thầu</h1>
        <p className="text-sm text-gray-500">{vendors.length} nhà cung cấp · {activeCount} đang hợp tác · {expiringCount} chờ gia hạn</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {([
          { key: 'vendors' as Tab, label: 'Nhà thầu' },
          { key: 'contracts' as Tab, label: 'Hợp đồng' },
          { key: 'ratings' as Tab, label: 'Đánh giá' },
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

      {tab === 'vendors' && <VendorsTab />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'ratings' && <RatingsTab />}
    </div>
  )
}
