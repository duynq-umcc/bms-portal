import { useState, useEffect } from 'react'
import {
  listenCompliance, listenCalibrationSchedules, addCalibrationSchedule,
  listenLegalDocuments, addLegalDocument, listenVendors,
} from '@/firebase/db'
import type { ComplianceRecord, CalibrationSchedule, LegalDocument, Vendor } from '@/firebase/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { ShieldCheck, AlertTriangle, CheckCircle, Plus, Download, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'

type Tab = 'calibration' | 'legal' | 'contractors'

const calSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1, 'Tên thiết bị là bắt buộc'),
  calibrationLab: z.string().min(1, 'Đơn vị kiểm định là bắt buộc'),
  lastCalibrationDate: z.string().optional(),
  nextCalibrationDate: z.string().min(1, 'Ngày kiểm định tiếp theo là bắt buộc'),
  certNumber: z.string().default(''),
  notes: z.string().default(''),
})
type CalForm = z.infer<typeof calSchema>

const legalSchema = z.object({
  type: z.enum(['license', 'cert', 'permit', 'insurance', 'other']),
  certNumber: z.string().min(1, 'Số hiệu là bắt buộc'),
  issueDate: z.string().optional(),
  expiryDate: z.string().min(1, 'Ngày hết hạn là bắt buộc'),
  issuingAuthority: z.string().min(1, 'Cơ quan cấp là bắt buộc'),
  fileUrl: z.string().default(''),
  notes: z.string().default(''),
})
type LegalForm = z.infer<typeof legalSchema>

function DaysBadge({ date }: { date: Date | null }) {
  if (!date) return <span className="badge-gray">—</span>
  const days = differenceInDays(date, new Date())
  if (days < 0) return <span className="badge-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Quá {Math.abs(days)}d</span>
  if (days <= 7) return <span className="badge-danger flex items-center gap-1"><Clock className="w-3 h-3" />{days}d</span>
  if (days <= 30) return <span className="badge-warning flex items-center gap-1"><Clock className="w-3 h-3" />{days}d</span>
  return <span className="badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" />{days}d</span>
}

function CalibrationTab() {
  const [schedules, setSchedules] = useState<CalibrationSchedule[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CalForm>({ resolver: zodResolver(calSchema) })

  useEffect(() => {
    const unsub = listenCalibrationSchedules(setSchedules)
    return () => unsub()
  }, [])

  const onSubmit = async (data: CalForm) => {
    try {
      await addCalibrationSchedule({
        deviceId: data.deviceId || data.deviceName,
        deviceName: data.deviceName,
        calibrationLab: data.calibrationLab,
        lastCalibrationDate: data.lastCalibrationDate ? new Date(data.lastCalibrationDate) as any : undefined,
        nextCalibrationDate: new Date(data.nextCalibrationDate) as any,
        certNumber: data.certNumber,
        status: 'pending',
        notes: data.notes,
      })
      toast.success('Đã thêm lịch kiểm định')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm thất bại') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Thêm lịch KĐ
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Thiết bị</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Đơn vị KĐ</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden sm:table-cell">KĐ gần nhất</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">KĐ tiếp theo</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Số chứng chỉ</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Còn lại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-gray-100">{s.deviceName}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{s.calibrationLab}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">
                    {s.lastCalibrationDate ? format(s.lastCalibrationDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {s.nextCalibrationDate ? format(s.nextCalibrationDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs font-mono">{s.certNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <DaysBadge date={s.nextCalibrationDate?.toDate() ?? null} />
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-t3 text-sm">Chưa có lịch kiểm định</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm lịch kiểm định" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên thiết bị</label>
            <input {...register('deviceName')} className="input-field" placeholder="VD: Máy X-quang..." />
            {errors.deviceName && <p className="text-red-500 text-xs mt-1">{errors.deviceName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị kiểm định</label>
            <input {...register('calibrationLab')} className="input-field" placeholder="VD: Trung tâm KĐ..." />
            {errors.calibrationLab && <p className="text-red-500 text-xs mt-1">{errors.calibrationLab.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KĐ gần nhất</label>
              <input type="date" {...register('lastCalibrationDate')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KĐ tiếp theo</label>
              <input type="date" {...register('nextCalibrationDate')} className="input-field" />
              {errors.nextCalibrationDate && <p className="text-red-500 text-xs mt-1">{errors.nextCalibrationDate.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số chứng chỉ</label>
            <input {...register('certNumber')} className="input-field" placeholder="Số GCN..." />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu lịch kiểm định'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function LegalTab() {
  const [docs, setDocs] = useState<LegalDocument[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LegalForm>({ resolver: zodResolver(legalSchema) })

  useEffect(() => {
    const unsub = listenLegalDocuments(setDocs)
    return () => unsub()
  }, [])

  const onSubmit = async (data: LegalForm) => {
    try {
      await addLegalDocument({
        type: data.type,
        certNumber: data.certNumber,
        issueDate: data.issueDate ? new Date(data.issueDate) as any : undefined,
        expiryDate: new Date(data.expiryDate) as any,
        issuingAuthority: data.issuingAuthority,
        fileUrl: data.fileUrl,
        notes: data.notes,
      })
      toast.success('Đã thêm giấy tờ')
      setShowAdd(false)
      reset()
    } catch { toast.error('Thêm thất bại') }
  }

  const DOC_TYPE_LABELS: Record<string, string> = {
    license: 'Giấy phép', cert: 'Chứng nhận', permit: 'Giấy phép hoạt động', insurance: 'Bảo hiểm', other: 'Khác',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Thêm giấy tờ
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Loại GCN</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Số hiệu</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Ngày cấp</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Ngày hết hạn</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Cơ quan</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <span className="badge-info">{DOC_TYPE_LABELS[d.type] || d.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs font-mono">{d.certNumber}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {d.issueDate ? format(d.issueDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.expiryDate ? format(d.expiryDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">{d.issuingAuthority}</td>
                  <td className="px-4 py-3">
                    {d.fileUrl ? (
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-amber hover:underline flex items-center gap-1 text-xs">
                        <Download className="w-3.5 h-3.5" /> Tải
                      </a>
                    ) : <span className="text-t3 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-t3 text-sm">Chưa có giấy tờ pháp lý</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm giấy tờ pháp lý" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại giấy tờ</label>
            <select {...register('type')} className="input-field">
              <option value="license">Giấy phép</option>
              <option value="cert">Chứng nhận</option>
              <option value="permit">Giấy phép hoạt động</option>
              <option value="insurance">Bảo hiểm</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số hiệu</label>
            <input {...register('certNumber')} className="input-field" placeholder="VD: GCN-2024-001..." />
            {errors.certNumber && <p className="text-red-500 text-xs mt-1">{errors.certNumber.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày cấp</label>
              <input type="date" {...register('issueDate')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn</label>
              <input type="date" {...register('expiryDate')} className="input-field" />
              {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cơ quan cấp</label>
            <input {...register('issuingAuthority')} className="input-field" placeholder="VD: Sở Y tế..." />
            {errors.issuingAuthority && <p className="text-red-500 text-xs mt-1">{errors.issuingAuthority.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL file (Firebase Storage)</label>
            <input {...register('fileUrl')} className="input-field" placeholder="https://firebasestorage..." />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu giấy tờ'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function ContractorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([])

  useEffect(() => {
    const unsub = listenVendors(setVendors)
    return () => unsub()
  }, [])

  const getDaysLeft = (vendor: Vendor) => {
    if (!vendor.contractEnd) return null
    return differenceInDays(vendor.contractEnd.toDate(), new Date())
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Nhà thầu</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden sm:table-cell">Loại dịch vụ</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden md:table-cell">Hạn HĐ</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs">Bảo hiểm</th>
                <th className="text-left px-4 py-3 font-medium text-t3 text-xs hidden lg:table-cell">Đánh giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {vendors.map((v) => {
                const daysLeft = getDaysLeft(v)
                return (
                  <tr key={v.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100">{v.name}</p>
                      <p className="text-xs text-t3">{v.contact}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(v.services || []).map((s) => (
                          <span key={s} className="badge-gray text-[10px]">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {daysLeft !== null ? (
                        <DaysBadge date={v.contractEnd?.toDate() ?? null} />
                      ) : <span className="badge-gray">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${v.status === 'active' ? 'text-green-400' : 'text-t3'}`}>
                        {v.status === 'active' ? 'Còn hiệu lực' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map((i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${i <= Math.round(v.rating) ? 'bg-amber' : 'bg-white/10'}`} />
                        ))}
                        <span className="text-xs text-t3 ml-1">{v.rating.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {vendors.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-t3 text-sm">Chưa có nhà thầu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('calibration')
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = listenCompliance(setRecords)
    const timer = setTimeout(() => setLoading(false), 800)
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  const dueCount = records.filter((r) => r.status === 'due').length
  const overdueCount = records.filter((r) => r.status === 'overdue').length

  if (loading) return <div className="space-y-4"><TableSkeleton rows={8} /></div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Compliance</h1>
        <p className="text-sm text-gray-500">{records.length} hạng mục · {dueCount} sắp đến hạn · {overdueCount} quá hạn</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-yellow-400">{dueCount}</p>
          <p className="text-xs text-t2">Sắp đến hạn</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center mx-auto mb-2">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
          <p className="text-xs text-t2">Quá hạn</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
        {([
          { key: 'calibration' as Tab, label: 'Kiểm định' },
          { key: 'legal' as Tab, label: 'Pháp lý' },
          { key: 'contractors' as Tab, label: 'Nhà thầu' },
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

      {tab === 'calibration' && <CalibrationTab />}
      {tab === 'legal' && <LegalTab />}
      {tab === 'contractors' && <ContractorsTab />}
    </div>
  )
}
