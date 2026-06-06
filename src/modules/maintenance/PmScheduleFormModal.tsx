import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { addPmSchedule, updatePmSchedule } from '@/firebase/db'
import { listenVendors } from '@/firebase/db'
import { computeNextDueDate } from '@/utils/pmEngine'
import { Timestamp } from 'firebase/firestore'
import type { PMSchedule, PMFrequencyType, PMTask, Vendor } from '@/types/firestore'

// ─── Frequency labels ───────────────────────────────────────────────────

const FREQ_LABELS: Record<PMFrequencyType, string> = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  biannual: 'Nửa năm',
  annual: 'Hàng năm',
}

const MONTH_NAMES = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
]

const DEPT_OPTIONS = [
  'Kỹ thuật', 'Chẩn đoán hình ảnh', 'ICU', 'Cấp cứu',
  'Tim mạch', 'Khoa Nhi', 'Phòng mổ', 'Hành chính', 'Kho Dược',
]

// ─── Default task ───────────────────────────────────────────────────────

function makeTask(): PMTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    estimatedMinutes: 30,
    requiresSpecialist: false,
    toolsRequired: [],
  }
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  existingSchedule?: PMSchedule & { id: string }
  defaultAsset?: {
    id: string
    name: string
    code: string
    location: string
    department?: string
    assetType?: 'device' | 'system' | 'equipment'
  }
}

// ─── Component ──────────────────────────────────────────────────────────

export default function PmScheduleFormModal({ open, onClose, existingSchedule, defaultAsset }: Props) {
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<'device' | 'system' | 'equipment'>('device')
  const [assetId, setAssetId] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetCode, setAssetCode] = useState('')
  const [location, setLocation] = useState('')
  const [department, setDepartment] = useState('Kỹ thuật')
  const [frequencyType, setFrequencyType] = useState<PMFrequencyType>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState<number>(15)
  const [monthsOfYear, setMonthsOfYear] = useState<number[]>([])
  const [assignedTo, setAssignedTo] = useState('')
  const [assignedToName, setAssignedToName] = useState('')
  const [requiresContractor, setRequiresContractor] = useState(false)
  const [contractorId, setContractorId] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState(120)
  const [autoCreateWO, setAutoCreateWO] = useState(true)
  const [autoCreateDaysBefore, setAutoCreateDaysBefore] = useState(7)
  const [tasks, setTasks] = useState<PMTask[]>([makeTask()])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Load vendors
  useEffect(() => {
    const unsub = listenVendors(setVendors as (docs: (Vendor & { id: string })[]) => void)
    return () => unsub()
  }, [])

  // Pre-fill from existing or default asset
  useEffect(() => {
    if (existingSchedule) {
      setName(existingSchedule.name)
      setAssetType(existingSchedule.assetType)
      setAssetId(existingSchedule.assetId)
      setAssetName(existingSchedule.assetName)
      setAssetCode(existingSchedule.assetCode)
      setLocation(existingSchedule.location)
      setDepartment(existingSchedule.department)
      setFrequencyType(existingSchedule.frequency.type)
      setDayOfMonth(existingSchedule.frequency.dayOfMonth ?? 15)
      setMonthsOfYear(existingSchedule.frequency.monthsOfYear ?? [])
      setAssignedTo(existingSchedule.assignedTo ?? '')
      setAssignedToName(existingSchedule.assignedToName ?? '')
      setRequiresContractor(existingSchedule.requiresContractor)
      setContractorId(existingSchedule.contractorId ?? '')
      setEstimatedDuration(existingSchedule.estimatedDuration)
      setAutoCreateWO(existingSchedule.autoCreateWO)
      setAutoCreateDaysBefore(existingSchedule.autoCreateDaysBefore)
      setTasks(existingSchedule.tasks.length > 0 ? existingSchedule.tasks : [makeTask()])
    } else if (defaultAsset) {
      setAssetId(defaultAsset.id)
      setAssetName(defaultAsset.name)
      setAssetCode(defaultAsset.code)
      setLocation(defaultAsset.location)
      setDepartment(defaultAsset.department ?? 'Kỹ thuật')
      setAssetType(defaultAsset.assetType ?? 'device')
    }
  }, [existingSchedule, defaultAsset, open])

  // Task management
  const addTask = () => setTasks((t) => [...t, makeTask()])
  const removeTask = (id: string) => setTasks((t) => t.filter((x) => x.id !== id))
  const updateTask = (id: string, field: keyof PMTask, value: unknown) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, [field]: value } : x)))
  const updateTaskTools = (id: string, value: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const tools = value.split(',').map((s) => s.trim()).filter(Boolean)
    updateTask(id, 'toolsRequired', tools)
  }

  const toggleMonth = (m: number) => {
    setMonthsOfYear((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    )
  }

  const handleClose = () => {
    onClose()
    // Reset form
    setName(''); setAssetType('device'); setAssetId(''); setAssetName(''); setAssetCode('')
    setLocation(''); setDepartment('Kỹ thuật'); setFrequencyType('monthly'); setDayOfMonth(15)
    setMonthsOfYear([]); setAssignedTo(''); setAssignedToName(''); setRequiresContractor(false)
    setContractorId(''); setEstimatedDuration(120); setAutoCreateWO(true); setAutoCreateDaysBefore(7)
    setTasks([makeTask()])
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nhập tên lịch bảo trì'); return }
    if (!assetName.trim()) { toast.error('Chọn tài sản'); return }
    if (!tasks.some((t) => t.description.trim())) { toast.error('Thêm ít nhất 1 công việc'); return }

    setSubmitting(true)
    try {
      const frequency = {
        type: frequencyType,
        intervalDays: frequencyType === 'monthly' ? 30 : frequencyType === 'quarterly' ? 90 : frequencyType === 'biannual' ? 180 : 365,
        dayOfMonth: frequencyType === 'monthly' ? dayOfMonth : null,
        monthsOfYear: ['quarterly', 'biannual', 'annual'].includes(frequencyType) ? monthsOfYear : null,
      }

      const nextDueDate = Timestamp.fromDate(computeNextDueDate({ frequency }))

      const payload = {
        name: name.trim(),
        assetType,
        assetId,
        assetName: assetName.trim(),
        assetCode: assetCode.trim(),
        department,
        location: location.trim(),
        frequency,
        tasks: tasks.filter((t) => t.description.trim()),
        assignedTo: assignedTo || null,
        assignedToName: assignedToName.trim() || null,
        estimatedDuration,
        requiresContractor,
        contractorId: contractorId || null,
        isActive: true,
        lastExecutedDate: null,
        nextDueDate,
        autoCreateWO,
        autoCreateDaysBefore,
        createdBy: user?.uid || 'unknown',
        createdAt: existingSchedule ? existingSchedule.createdAt : Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      if (existingSchedule) {
        await updatePmSchedule(existingSchedule.id, payload)
        toast.success('Đã cập nhật lịch bảo trì phòng ngừa')
      } else {
        await addPmSchedule(payload as Omit<PMSchedule, 'id'>)
        toast.success('Đã lưu lịch bảo trì phòng ngừa')
      }
      handleClose()
    } catch (err) {
      toast.error('Lưu thất bại, vui lòng thử lại')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={existingSchedule ? 'Sửa lịch BT phòng ngừa' : 'Thêm lịch BT phòng ngừa'}
      size="xl"
      footer={
        <div className="flex gap-3">
          <button onClick={handleClose} className="btn-secondary flex-1">Hủy</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Đang lưu...' : 'Lưu lịch BT'}
          </button>
        </div>
      }
    >
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basic info */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.07] pb-1">
            Thông tin cơ bản
          </h4>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tên lịch bảo trì <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: BT định kỳ AHU-3 (ICU)"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Loại tài sản</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as typeof assetType)}
                className="input-field"
              >
                <option value="device">Thiết bị Y tế</option>
                <option value="system">Hệ thống M&E</option>
                <option value="equipment">Thiết bị khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phòng ban</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input-field"
              >
                {DEPT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tên tài sản <span className="text-red-400">*</span>
            </label>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="VD: AHU-3 — ICU + Phòng mổ"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mã tài sản</label>
              <input
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                placeholder="VD: AHU-003"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Vị trí</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VD: Tầng 3 — ICU"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Frequency */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.07] pb-1">
            Chu kỳ bảo trì
          </h4>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tần suất</label>
            <select
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value as PMFrequencyType)}
              className="input-field"
            >
              {Object.entries(FREQ_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {frequencyType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ngày thực hiện trong tháng (1-28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="input-field w-32"
              />
            </div>
          )}

          {['quarterly', 'biannual', 'annual'].includes(frequencyType) && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Các tháng thực hiện
              </label>
              <div className="flex flex-wrap gap-2">
                {MONTH_NAMES.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleMonth(i + 1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      monthsOfYear.includes(i + 1)
                        ? 'bg-amber text-ink font-semibold'
                        : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assignment */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.07] pb-1">
            Phân công
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mã nhân viên (uid)</label>
              <input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="uid từ Firestore users"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tên nhân viên</label>
              <input
                value={assignedToName}
                onChange={(e) => setAssignedToName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresContractor}
                onChange={(e) => setRequiresContractor(e.target.checked)}
                className="w-4 h-4 accent-amber"
              />
              <span className="text-sm text-gray-300">Cần nhà thầu</span>
            </label>
          </div>

          {requiresContractor && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Chọn nhà thầu</label>
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="input-field"
              >
                <option value="">— Chọn nhà thầu —</option>
                {vendors.filter((v) => v.type === 'contractor').map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Thời gian ước tính (phút)
              </label>
              <input
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                min={1}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Auto WO */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.07] pb-1">
            Tự động tạo Work Order
          </h4>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateWO}
                onChange={(e) => setAutoCreateWO(e.target.checked)}
                className="w-4 h-4 accent-amber"
              />
              <span className="text-sm text-gray-300">Tự động tạo Work Order trước hạn</span>
            </label>
          </div>
          {autoCreateWO && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tạo trước bao nhiêu ngày
              </label>
              <input
                type="number"
                value={autoCreateDaysBefore}
                onChange={(e) => setAutoCreateDaysBefore(Number(e.target.value))}
                min={1}
                max={60}
                className="input-field w-32"
              />
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.07] pb-1">
            Danh sách công việc <span className="text-red-400">*</span>
          </h4>

          <div className="space-y-2">
            {tasks.map((task, idx) => (
              <div
                key={task.id}
                className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-600 mt-2.5 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input
                      value={task.description}
                      onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                      placeholder="Mô tả công việc (VD: Vệ sinh bộ lọc sơ cấp G4)"
                      className="input-field text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Thời gian (phút)</label>
                        <input
                          type="number"
                          value={task.estimatedMinutes}
                          onChange={(e) => updateTask(task.id, 'estimatedMinutes', Number(e.target.value))}
                          min={1}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 mt-5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={task.requiresSpecialist}
                            onChange={(e) => updateTask(task.id, 'requiresSpecialist', e.target.checked)}
                            className="w-3.5 h-3.5 accent-amber"
                          />
                          <span className="text-xs text-gray-400">KTV chuyên</span>
                        </label>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Dụng cụ</label>
                        <input
                          value={task.toolsRequired.join(', ')}
                          onChange={(e) => updateTaskTools(task.id, e.target.value)}
                          placeholder="Máy hút bụi,..."
                          className="input-field text-xs"
                        />
                      </div>
                    </div>
                  </div>
                  {tasks.length > 1 && (
                    <button
                      onClick={() => removeTask(task.id)}
                      className="mt-1 p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTask}
            className="w-full py-2 border border-dashed border-white/[0.15] rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:border-white/[0.3] transition-colors"
          >
            + Thêm công việc
          </button>
        </div>
      </div>
    </Modal>
  )
}
