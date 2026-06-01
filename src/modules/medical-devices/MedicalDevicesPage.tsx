import { useState, useEffect } from 'react'
import { listenMedicalDevices, listenServiceHistory, addServiceRecord, listenMaintenanceSchedule, addMaintenanceSchedule } from '@/firebase/db'
import type { MedicalDevice, ServiceRecord, MaintenanceSchedule } from '@/firebase/types'
import { TableSkeleton, EmptyState } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Stethoscope, Search, Plus, Clock, AlertTriangle,
  Calendar, FileText, Info, History, FolderOpen,
  WrenchIcon, RefreshCw,
} from 'lucide-react'
import { format, differenceInDays, isBefore, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceTab = 'devices' | 'schedule' | 'calibration'
type DetailTab = 'info' | 'history' | 'docs'

const DEVICE_STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  maintenance: 'badge-warning',
  calibration: 'badge-info',
  retired: 'badge-gray',
  operational: 'badge-success',
  out_of_service: 'badge-danger',
}
const DEVICE_STATUS_LABELS: Record<string, string> = {
  active: 'Hoạt động',
  maintenance: 'Bảo trì',
  calibration: 'Hiệu chuẩn',
  retired: 'Ngừng sử dụng',
  operational: 'Hoạt động',
  out_of_service: 'Ngừng hoạt động',
}
const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  scheduled: 'badge-info',
  in_progress: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-gray',
}
const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  preventive: 'Bảo trì định kỳ',
  repair: 'Sửa chữa',
  calibration: 'Hiệu chuẩn',
  inspection: 'Kiểm tra',
}

// ─── Maintenance Schedule Modal ───────────────────────────────────────────────

const scheduleSchema = z.object({
  deviceId: z.string().min(1, 'Chọn thiết bị'),
  type: z.string().min(1, 'Chọn loại bảo trì'),
  scheduledDate: z.string().min(1, 'Chọn ngày'),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
})
type ScheduleForm = z.infer<typeof scheduleSchema>

function AddScheduleModal({ devices, open, onClose }: { devices: MedicalDevice[]; open: boolean; onClose: () => void }) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
  })
  const selectedId = watch('deviceId')
  const selectedDevice = devices.find((d) => d.id === selectedId)

  const onSubmit = async (data: ScheduleForm) => {
    try {
      const device = devices.find((d) => d.id === data.deviceId)
      await addMaintenanceSchedule({
        deviceId: data.deviceId,
        deviceName: device?.name ?? '',
        type: data.type as MaintenanceSchedule['type'],
        scheduledDate: { toDate: () => new Date(data.scheduledDate) } as any,
        assignedTo: data.assignedTo,
        notes: data.notes,
        status: 'scheduled',
      })
      toast.success('Đã thêm lịch bảo trì')
      onClose()
      reset()
    } catch {
      toast.error('Thêm lịch bảo trì thất bại')
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Thêm lịch bảo trì" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Thiết bị *</label>
          <select {...register('deviceId')} className="input-field">
            <option value="">— Chọn thiết bị —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.deviceId && <p className="text-red-500 text-xs mt-1">{errors.deviceId.message}</p>}
        </div>
        {selectedDevice && (
          <div className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded">
            {selectedDevice.model} · {selectedDevice.serial} · {selectedDevice.location}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại bảo trì *</label>
          <select {...register('type')} className="input-field">
            <option value="">— Chọn loại —</option>
            <option value="preventive">Bảo trì định kỳ</option>
            <option value="repair">Sửa chữa</option>
            <option value="calibration">Hiệu chuẩn</option>
            <option value="inspection">Kiểm tra</option>
          </select>
          {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ngày lên lịch *</label>
          <input type="date" {...register('scheduledDate')} className="input-field" />
          {errors.scheduledDate && <p className="text-red-500 text-xs mt-1">{errors.scheduledDate.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nhân viên phụ trách</label>
          <input {...register('assignedTo')} className="input-field" placeholder="Tên nhân viên..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <textarea {...register('notes')} className="input-field" rows={2} placeholder="Ghi chú thêm..." />
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Đang thêm...' : 'Thêm lịch bảo trì'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Device Detail Modal ─────────────────────────────────────────────────────

function DeviceDetailModal({ device }: { device: MedicalDevice | null }) {
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const [history, setHistory] = useState<(ServiceRecord & { id: string })[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!device?.id) return
    setLoadingHistory(true)
    const unsub = listenServiceHistory(device.id, (records) => {
      setHistory(records)
      setLoadingHistory(false)
    })
    return () => unsub()
  }, [device?.id])

  if (!device) return null

  const tabs: { id: DetailTab; label: string; icon: any }[] = [
    { id: 'info', label: 'Thông tin', icon: Info },
    { id: 'history', label: 'Lịch sử BT', icon: History },
    { id: 'docs', label: 'Hồ sơ', icon: FolderOpen },
  ]

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 py-3 border-b border-gray-100">
        <Stethoscope className="w-5 h-5 text-primary-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{device.name}</h3>
          <p className="text-xs text-gray-400 font-mono">{device.serial}</p>
        </div>
        <span className={`${DEVICE_STATUS_COLORS[device.status] ?? 'badge-gray'}`}>
          {DEVICE_STATUS_LABELS[device.status] ?? device.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setDetailTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              detailTab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-3">
        {detailTab === 'info' && <InfoTab device={device} />}
        {detailTab === 'history' && <HistoryTab records={history} loading={loadingHistory} deviceId={device.id} />}
        {detailTab === 'docs' && <DocsTab device={device} />}
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-3 border-t border-gray-100 mt-2">
        <button className="btn-secondary flex-1 text-sm">
          <WrenchIcon className="w-4 h-4" /> Tạo Work Order BT
        </button>
        <button className="btn-secondary flex-1 text-sm">
          <RefreshCw className="w-4 h-4" /> Cập nhật
        </button>
        <button className="btn-primary flex-1 text-sm">
          <FileText className="w-4 h-4" /> Xuất PDF
        </button>
      </div>
    </div>
  )
}

function InfoTab({ device }: { device: MedicalDevice }) {
  const fmt = (ts: any) => {
    if (!ts) return null
    try { return format(ts.toDate(), 'dd/MM/yyyy') } catch { return null }
  }
  const fmtDays = (ts: any, label: string) => {
    if (!ts) return null
    try {
      const days = differenceInDays(ts.toDate(), new Date())
      return (
        <span className={days < 0 ? 'text-red-600 font-medium' : 'text-gray-900'}>
          {label}: {fmt(ts)} {days < 0 ? `(quá hạn ${Math.abs(days)} ngày)` : `(còn ${days} ngày)`}
        </span>
      )
    } catch { return null }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Model">{device.model}</Field>
        <Field label="Serial">{device.serial}</Field>
        <Field label="Hãng sản xuất">{device.manufacturer}</Field>
        <Field label="Vị trí">{device.location}</Field>
        {device.brand && <Field label="Nhãn hiệu">{device.brand}</Field>}
        <Field label="Khoa/Phòng">{device.dept}</Field>
        {device.purchaseDate && <Field label="Ngày mua">{fmt(device.purchaseDate)}</Field>}
        {device.warrantyEnd && <Field label="Hết bảo hành">{fmt(device.warrantyEnd)}</Field>}
        {device.lastService && <Field label="Bảo dưỡng gần nhất">{fmt(device.lastService)}</Field>}
        {device.nextService && <Field label="Lịch BT tiếp theo">{fmtDays(device.nextService, 'Dự kiến')}</Field>}
        {device.requiresCalibration && device.nextCalibration && (
          <Field label="Hiệu chuẩn">{fmtDays(device.nextCalibration, 'Hiệu chuẩn')}</Field>
        )}
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">ID: {device.id}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{children ?? <span className="text-gray-300">—</span>}</p>
    </div>
  )
}

function HistoryTab({ records, loading, deviceId }: { records: (ServiceRecord & { id: string })[]; loading: boolean; deviceId: string }) {
  const addRecordSchema = z.object({
    type: z.string().min(1),
    description: z.string().min(1, 'Mô tả là bắt buộc'),
    technician: z.string().optional(),
    notes: z.string().optional(),
    cost: z.coerce.number().min(0).optional(),
    date: z.string().min(1, 'Chọn ngày'),
  })
  type AddForm = z.infer<typeof addRecordSchema>

  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddForm>({
    resolver: zodResolver(addRecordSchema),
  })

  const onAdd = async (data: AddForm) => {
    try {
      await addServiceRecord(deviceId, {
        type: data.type,
        description: data.description,
        technician: data.technician,
        notes: data.notes,
        cost: data.cost,
        date: { toDate: () => new Date(data.date) } as any,
      })
      toast.success('Đã ghi nhận lịch sử bảo trì')
      setShowAdd(false)
      reset()
    } catch {
      toast.error('Thêm thất bại')
    }
  }

  if (loading) return <TableSkeleton rows={4} />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Thêm
        </button>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={<History className="w-6 h-6" />} title="Chưa có lịch sử" description="Bảo trì sẽ hiển thị tại đây" />
      ) : (
        <div className="relative pl-4 space-y-4">
          {/* Timeline line */}
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />
          {records.map((r) => (
            <div key={r.id} className="relative">
              <div className={`absolute -left-3.5 top-1 w-2 h-2 rounded-full border-2 bg-white ${
                r.type === 'completed' ? 'border-green-500' :
                r.type === 'repair' ? 'border-amber-500' :
                r.type === 'calibration' ? 'border-blue-500' : 'border-gray-400'
              }`} />
              <div className="ml-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">{SCHEDULE_TYPE_LABELS[r.type] ?? r.type}</span>
                  {r.date && (
                    <span className="text-xs text-gray-400">
                      {(() => { try { return format(r.date.toDate(), 'dd/MM/yyyy') } catch { return '' } })()}
                    </span>
                  )}
                  {r.cost != null && r.cost > 0 && (
                    <span className="text-xs text-gray-400">{r.cost.toLocaleString('vi-VN')} đ</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{r.description}</p>
                {r.technician && <p className="text-xs text-gray-400">Kỹ thuật: {r.technician}</p>}
                {r.notes && <p className="text-xs text-gray-400 italic">{r.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset() }} title="Thêm lịch sử bảo trì" size="md">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày *</label>
            <input type="date" {...register('date')} className="input-field" />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại *</label>
            <select {...register('type')} className="input-field">
              <option value="">— Chọn loại —</option>
              <option value="preventive">Bảo trì định kỳ</option>
              <option value="repair">Sửa chữa</option>
              <option value="calibration">Hiệu chuẩn</option>
              <option value="inspection">Kiểm tra</option>
            </select>
            {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả *</label>
            <textarea {...register('description')} className="input-field" rows={2} />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kỹ thuật viên</label>
              <input {...register('technician')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chi phí (đ)</label>
              <input type="number" {...register('cost')} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea {...register('notes')} className="input-field" rows={2} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function DocsTab({ device }: { device: MedicalDevice }) {
  const docs = device.attachments ?? []
  if (docs.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">Chưa có hồ sơ đính kèm</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {docs.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-primary-600 underline truncate">{url.split('/').pop() ?? url}</span>
        </a>
      ))}
    </div>
  )
}

// ─── Tab 1: Device Registry ───────────────────────────────────────────────────

function DeviceRegistry({ devices }: { devices: MedicalDevice[] }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MedicalDevice | null>(null)

  const filtered = devices.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (filterDept !== 'all' && d.dept !== filterDept) return false
    if (search) {
      const s = search.toLowerCase()
      if (!d.name.toLowerCase().includes(s) &&
          !d.serial.toLowerCase().includes(s) &&
          !d.location.toLowerCase().includes(s) &&
          !(d.brand ?? '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const borderColors: Record<string, string> = {
    active: 'border-t-green-500',
    maintenance: 'border-t-amber-500',
    calibration: 'border-t-blue-500',
    retired: 'border-t-gray-400',
    operational: 'border-t-green-500',
    out_of_service: 'border-t-red-500',
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm thiết bị..."
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="maintenance">Bảo trì</option>
          <option value="calibration">Hiệu chuẩn</option>
          <option value="out_of_service">Ngừng hoạt động</option>
          <option value="retired">Ngừng sử dụng</option>
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">Tất cả khoa</option>
          <option value="medical">Y tế</option>
          <option value="it">IT</option>
          <option value="electrical">Điện</option>
          <option value="admin">Hành chính</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="w-8 h-8" />}
          title="Không tìm thấy thiết bị"
          description="Thử điều chỉnh bộ lọc"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {filtered.map((d) => {
            const overdue = d.nextService && isBefore(d.nextService.toDate(), new Date())
            return (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`card text-left border-t-2 ${borderColors[d.status] ?? 'border-t-gray-300'} hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`${DEVICE_STATUS_COLORS[d.status] ?? 'badge-gray'}`}>
                    {DEVICE_STATUS_LABELS[d.status] ?? d.status}
                  </span>
                  {overdue && (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                </div>
                <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-1">{d.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{d.location}</p>
                {d.brand && (
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mb-2">
                    {d.brand}
                  </span>
                )}
                {d.nextService && (
                  <p className={`text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    <Clock className="w-3 h-3 inline mr-0.5" />
                    {(() => {
                      try {
                        return format(d.nextService!.toDate(), 'dd/MM/yyyy')
                      } catch { return '' }
                    })()}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="" size="lg">
        <DeviceDetailModal device={selected} />
      </Modal>
    </>
  )
}

// ─── Tab 2: Maintenance Schedule ─────────────────────────────────────────────

function MaintenanceScheduleTab({ schedule }: { schedule: (MaintenanceSchedule & { id: string })[] }) {
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const devices = useDevices()

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const thisQStart = startOfQuarter(now)
  const thisQEnd = endOfQuarter(now)

  const filtered = schedule.filter((s) => {
    if (filter === 'overdue') {
      try { return isBefore(s.scheduledDate.toDate(), now) && s.status !== 'completed' && s.status !== 'cancelled' } catch { return false }
    }
    if (filter === 'month') {
      try {
        const d = s.scheduledDate.toDate()
        return d >= thisMonthStart && d <= thisMonthEnd
      } catch { return false }
    }
    if (filter === 'quarter') {
      try {
        const d = s.scheduledDate.toDate()
        return d >= thisQStart && d <= thisQEnd
      } catch { return false }
    }
    return true
  })

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'month', label: 'Tháng này' },
            { value: 'quarter', label: 'Quý này' },
            { value: 'overdue', label: 'Quá hạn' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Thêm lịch BT
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Thiết bị</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Loại BT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ngày lên lịch</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Nhân viên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Không có lịch nào</td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isOverdue = (() => {
                    try {
                      return isBefore(s.scheduledDate.toDate(), now) &&
                             s.status !== 'completed' && s.status !== 'cancelled'
                    } catch { return false }
                  })()
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.deviceName}</p>
                        {s.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-32">{s.notes}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="badge-info">{SCHEDULE_TYPE_LABELS[s.type] ?? s.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
                          {(() => {
                            try { return format(s.scheduledDate.toDate(), 'dd/MM/yyyy') } catch { return '—' }
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{s.assignedTo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={SCHEDULE_STATUS_COLORS[s.status] ?? 'badge-gray'}>
                          {s.status === 'scheduled' ? 'Đã lên lịch' :
                           s.status === 'in_progress' ? 'Đang thực hiện' :
                           s.status === 'completed' ? 'Hoàn thành' :
                           s.status === 'cancelled' ? 'Đã hủy' : s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddScheduleModal devices={devices} open={showAdd} onClose={() => setShowAdd(false)} />
    </>
  )
}

// ─── Tab 3: Calibration Tracker ──────────────────────────────────────────────

function CalibrationTracker({ devices }: { devices: MedicalDevice[] }) {
  const calibrated = devices.filter((d) => d.requiresCalibration)
  const now = new Date()

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Thiết bị</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Model</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Vị trí</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ngày hiệu chuẩn</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {calibrated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Không có thiết bị cần hiệu chuẩn
                </td>
              </tr>
            ) : (
              calibrated.map((d) => {
                const daysUntil = d.nextCalibration ? differenceInDays(d.nextCalibration.toDate(), now) : null
                const isOverdue = daysUntil !== null && daysUntil < 0
                const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30

                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{d.serial}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{d.model}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{d.location}</td>
                    <td className="px-4 py-3">
                      {d.nextCalibration ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
                          {(() => {
                            try { return format(d.nextCalibration.toDate(), 'dd/MM/yyyy') } catch { return '—' }
                          })()}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isOverdue ? (
                        <div className="flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                          <span className="badge-danger">Quá hạn</span>
                        </div>
                      ) : isDueSoon ? (
                        <span className="badge-warning">Sắp đến hạn</span>
                      ) : daysUntil !== null ? (
                        <span className="badge-success">Còn {daysUntil} ngày</span>
                      ) : (
                        <span className="badge-gray">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── useDevices hook ─────────────────────────────────────────────────────────

function useDevices() {
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  useEffect(() => {
    const unsub = listenMedicalDevices(setDevices)
    return () => unsub()
  }, [])
  return devices
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MedicalDevicesPage() {
  const [activeTab, setActiveTab] = useState<DeviceTab>('devices')
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [schedule, setSchedule] = useState<(MaintenanceSchedule & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub1 = listenMedicalDevices(setDevices)
    const unsub2 = listenMaintenanceSchedule(setSchedule)
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => { unsub1(); unsub2(); clearTimeout(timer) }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64"><div className="card h-full animate-pulse bg-gray-100" /></div>
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Thiết bị Y tế</h1>
        <p className="text-sm text-gray-500">
          Quản lý thiết bị · {devices.length} thiết bị · {schedule.filter((s) => {
            try { return isBefore(s.scheduledDate.toDate(), new Date()) && s.status !== 'completed' } catch { return false }
          }).length} quá hạn
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {([
          { id: 'devices' as DeviceTab, label: 'Thiết bị', icon: Stethoscope },
          { id: 'schedule' as DeviceTab, label: 'Lịch bảo trì', icon: Calendar },
          { id: 'calibration' as DeviceTab, label: 'Kiểm định', icon: AlertTriangle },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.id === 'schedule' && schedule.filter((s) => {
              try { return isBefore(s.scheduledDate.toDate(), new Date()) && s.status !== 'completed' } catch { return false }
            }).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                {schedule.filter((s) => {
                  try { return isBefore(s.scheduledDate.toDate(), new Date()) && s.status !== 'completed' } catch { return false }
                }).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'devices' && <DeviceRegistry devices={devices} />}
      {activeTab === 'schedule' && <MaintenanceScheduleTab schedule={schedule} />}
      {activeTab === 'calibration' && <CalibrationTracker devices={devices} />}
    </div>
  )
}
