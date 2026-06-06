import { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { updatePmWorkOrder } from '@/firebase/db'
import { updateNextDueDateAfterCompletion } from '@/utils/pmEngine'
import { createNotification, createNotificationForRoles } from '@/utils/createNotification'
import { Timestamp } from 'firebase/firestore'
import { storage } from '@/firebase/config'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { format } from 'date-fns'
import {
  Clock, CheckCircle2, XCircle, Camera, Plus, Trash2,
  FileText, Wrench, X,
} from 'lucide-react'
import type { PMWorkOrder, PMWorkOrderTask, PMPartUsed, PMCompletionPhoto } from '@/types/firestore'

// ─── Photo upload ───────────────────────────────────────────────────────

interface PhotoUpload {
  localUrl: string
  file: File
  caption: string
  type: 'before' | 'after'
}

async function uploadPhoto(woId: string, upload: PhotoUpload): Promise<PMCompletionPhoto> {
  const filename = `${upload.type}_${Date.now()}.jpg`
  const storageRef = ref(storage, `pm/workorders/${woId}/${filename}`)
  await uploadBytes(storageRef, upload.file)
  const url = await getDownloadURL(storageRef)
  return {
    url,
    caption: upload.caption || (upload.type === 'before' ? 'Trước bảo trì' : 'Sau bảo trì'),
    type: upload.type,
    uploadedAt: Timestamp.now(),
  }
}

// ─── Timer ─────────────────────────────────────────────────────────────

function Timer({ startedAt }: { startedAt: Date | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  if (!startedAt) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return (
    <div className="flex items-center gap-1.5 bg-amber/10 border border-amber/20 rounded-lg px-3 py-1.5">
      <Clock className="w-4 h-4 text-amber" />
      <span className="text-sm font-mono text-amber">
        {h > 0 ? `${h}h ` : ''}{m}p {s < 10 ? '0' : ''}{s}''
      </span>
    </div>
  )
}

// ─── Task Card ──────────────────────────────────────────────────────────

function TaskCard({
  task,
  onUpdate,
}: {
  task: PMWorkOrderTask
  onUpdate: (updated: PMWorkOrderTask) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isFailed = task.note && task.note.startsWith('[THẤT BẠI]')

  return (
    <div className={`bg-white/[0.04] rounded-xl border transition-colors ${
      task.completed ? 'border-green-500/30' : isFailed ? 'border-red-500/30' : 'border-white/[0.07]'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${
          task.completed ? 'bg-green-500 border-green-500' : isFailed ? 'bg-red-500 border-red-500' : 'border-white/30'
        }`}>
          {task.completed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          {isFailed && <XCircle className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.completed ? 'text-green-300' : isFailed ? 'text-red-300' : 'text-gray-200'}`}>
            {task.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">~{task.estimatedMinutes}p</span>
            {task.requiresSpecialist && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">KTV chuyên</span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-600">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-white/[0.06]">
          {task.toolsRequired.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Dụng cụ:</p>
              <div className="flex flex-wrap gap-1">
                {task.toolsRequired.map((tool, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-gray-400">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onUpdate({ ...task, completed: !task.completed, note: task.completed ? '' : task.note })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                task.completed
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
              }`}
            >
              ✓ Hoàn thành
            </button>
            <button
              onClick={() => {
                if (!task.note.startsWith('[THẤT BẠI]') && !task.completed) {
                  onUpdate({ ...task, completed: false, note: '[THẤT BẠI] ' })
                } else if (task.completed) {
                  onUpdate({ ...task, completed: false, note: '[THẤT BẠI] ' })
                } else {
                  onUpdate({ ...task, completed: false, note: '' })
                }
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                isFailed
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
              }`}
            >
              ✗ Không làm được
            </button>
          </div>

          {(task.completed || isFailed) && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                {isFailed ? 'Lý do thất bại *' : 'Ghi chú (tùy chọn)'}
              </label>
              <textarea
                value={task.note.replace('[THẤT BẠI] ', '')}
                onChange={(e) => onUpdate({
                  ...task,
                  note: isFailed
                    ? '[THẤT BẠI] ' + e.target.value
                    : e.target.value,
                })}
                placeholder={isFailed ? 'Nhập lý do thất bại...' : 'Ghi chú thêm...'}
                rows={2}
                className="input-field text-sm resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Photo Section ─────────────────────────────────────────────────────

function PhotoSection({
  label,
  type,
  photos,
  uploads,
  onAdd,
  onRemove,
  onCaptionChange,
}: {
  label: string
  type: 'before' | 'after'
  photos: PMCompletionPhoto[]
  uploads: PhotoUpload[]
  onAdd: (u: PhotoUpload) => void
  onRemove: (idx: number) => void
  onCaptionChange: (idx: number, caption: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (files: FileList | null) => {
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const localUrl = URL.createObjectURL(file)
      onAdd({ localUrl, file, caption: type === 'before' ? 'Trước bảo trì' : 'Sau bảo trì', type })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-medium text-gray-300">{label}</h5>
        <span className="text-xs text-gray-500">
          {photos.length + uploads.length} ảnh
        </span>
      </div>

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full py-3 border border-dashed border-white/[0.15] rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:border-white/[0.3] transition-colors flex items-center justify-center gap-2"
      >
        <Camera className="w-4 h-4" />
        Chụp ảnh / Tải lên
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />

      {/* Existing photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {photos.filter((p) => p.type === type).map((photo, i) => (
            <div key={i} className="relative group">
              <img src={photo.url} alt={photo.caption} className="w-full h-20 object-cover rounded-lg" />
              <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-black/50 text-white truncate px-1 rounded-b-lg">
                {photo.caption}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pending uploads */}
      {uploads.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {uploads.map((up, i) => (
            <div key={i} className="relative group">
              <img src={up.localUrl} alt={up.caption} className="w-full h-20 object-cover rounded-lg" />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              <input
                value={up.caption}
                onChange={(e) => onCaptionChange(i, e.target.value)}
                placeholder="Mô tả..."
                className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/50 text-white px-1 rounded-b-lg border-none outline-none"
              />
              <div className="absolute top-1 left-1 w-4 h-4 bg-amber rounded-full flex items-center justify-center">
                <span className="text-[8px] text-ink font-bold">↑</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────

interface Props {
  woId: string
  pmWorkOrder: PMWorkOrder & { id: string }
  onClose: () => void
}

export default function PmExecutionModal({ woId, pmWorkOrder, onClose }: Props) {
  const { user } = useAuth()
  const [wo, setWo] = useState(pmWorkOrder)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [beforePhotos, setBeforePhotos] = useState<PhotoUpload[]>([])
  const [afterPhotos, setAfterPhotos] = useState<PhotoUpload[]>([])
  const [partsUsed, setPartsUsed] = useState<PMPartUsed[]>(wo.partsUsed ?? [])
  const [technicianNotes, setTechnicianNotes] = useState(wo.technicianNotes ?? '')
  const [signOffNote, setSignOffNote] = useState('')

  // Auto-start when modal opens and status is scheduled
  useEffect(() => {
    if (wo.status === 'scheduled') {
      updatePmWorkOrder(woId, {
        status: 'inProgress',
        startedAt: Timestamp.now(),
      }).then(() => {
        setWo((prev) => ({ ...prev, status: 'inProgress', startedAt: Timestamp.now() as unknown as null }))
      }).catch(console.error)
    }
  }, [])

  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isCompleted = wo.status === 'completed'
  const isInProgress = wo.status === 'inProgress'
  const startedDate = wo.startedAt ? wo.startedAt.toDate() : null

  const doneCount = wo.tasks.filter((t) => t.completed).length
  const totalCount = wo.tasks.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const updateTask = (taskId: string, updated: PMWorkOrderTask) => {
    setWo((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => t.id === taskId ? updated : t),
    }))
  }

  const handleTaskUpdate = (taskId: string) => (updated: PMWorkOrderTask) => {
    updateTask(taskId, updated)
  }

  const addPart = () => {
    setPartsUsed((prev) => [...prev, { name: '', quantity: 1, unit: 'cái' }])
  }
  const updatePart = (idx: number, field: keyof PMPartUsed, value: string | number) => {
    setPartsUsed((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }
  const removePart = (idx: number) => {
    setPartsUsed((prev) => prev.filter((_, i) => i !== idx))
  }

  const allPhotos = wo.completionPhotos ?? []

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await updatePmWorkOrder(woId, {
        tasks: wo.tasks,
        technicianNotes,
        partsUsed,
      })
      toast.success('Đã lưu nháp')
    } catch {
      toast.error('Lưu nháp thất bại')
    } finally {
      setSaving(false)
    }
  }

  const validateCompletion = (): string[] => {
    const errors: string[] = []
    const incomplete = wo.tasks.filter((t) => !t.completed && !t.note?.startsWith('[THẤT BẠI]'))
    if (incomplete.length > 0) errors.push(`${incomplete.length} hạng mục chưa được đánh dấu hoàn thành/thất bại`)
    if (allPhotos.filter((p) => p.type === 'before').length === 0 && beforePhotos.length === 0)
      errors.push('Cần ít nhất 1 ảnh trước bảo trì')
    if (allPhotos.filter((p) => p.type === 'after').length === 0 && afterPhotos.length === 0)
      errors.push('Cần ít nhất 1 ảnh sau bảo trì')
    return errors
  }

  const handleComplete = async () => {
    const errors = validateCompletion()
    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e))
      return
    }

    setUploading(true)
    setSaving(true)

    try {
      // Upload pending photos
      const newPhotos: PMCompletionPhoto[] = []
      for (const up of beforePhotos) {
        try { newPhotos.push(await uploadPhoto(woId, up)) } catch (e) { console.error('Photo upload failed', e) }
      }
      for (const up of afterPhotos) {
        try { newPhotos.push(await uploadPhoto(woId, up)) } catch (e) { console.error('Photo upload failed', e) }
      }

      const allPhotosFinal = [...allPhotos, ...newPhotos]
      const completedAt = Timestamp.now()
      const duration = startedDate ? Math.round((completedAt.toDate().getTime() - startedDate.getTime()) / 60000) : null

      // Update WO
      await updatePmWorkOrder(woId, {
        status: 'completed',
        completedAt,
        tasks: wo.tasks,
        completionPhotos: allPhotosFinal,
        technicianNotes,
        actualDuration: duration,
        partsUsed,
      })

      // Update next due date
      await updateNextDueDateAfterCompletion(wo.pmScheduleId, new Date())

      // Notify manager for sign-off
      await createNotificationForRoles(['admin', 'manager'], {
        title: `BT hoàn thành: ${wo.assetName}`,
        body: `KTV đã hoàn thành ${wo.scheduleName} — cần xác nhận`,
        type: 'workOrder',
        link: `/maintenance?tab=pm&wo=${woId}`,
        priority: 'medium',
      })

      toast.success('Đã hoàn thành bảo trì — chờ xác nhận')
      onClose()
    } catch (err) {
      toast.error('Hoàn thành thất bại')
      console.error(err)
    } finally {
      setUploading(false)
      setSaving(false)
    }
  }

  const handleSignOff = async () => {
    setSaving(true)
    try {
      await updatePmWorkOrder(woId, {
        signedOffBy: user?.uid ?? '',
        signedOffAt: Timestamp.now(),
        signedOffNote: signOffNote,
      })
      toast.success('Đã xác nhận bảo trì')
      onClose()
    } catch {
      toast.error('Xác nhận thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    const reason = prompt('Nhập lý do cần làm lại:')
    if (!reason) return
    setSaving(true)
    try {
      await updatePmWorkOrder(woId, {
        status: 'inProgress',
        technicianNotes: wo.technicianNotes + `\n[YÊU CẦU LÀM LẠI] ${reason}`,
      })
      if (wo.assignedTo) {
        await createNotification(wo.assignedTo, {
          title: `Yêu cầu làm lại: ${wo.assetName}`,
          body: `${reason}`,
          type: 'workOrder',
          link: `/maintenance?tab=pm&wo=${woId}`,
          priority: 'high',
        })
      }
      toast.info('Đã yêu cầu làm lại')
      onClose()
    } catch {
      toast.error('Thao tác thất bại')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex flex-wrap gap-2">
      {isInProgress && (
        <>
          <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary text-sm">
            {saving ? 'Đang lưu...' : 'Lưu nháp'}
          </button>
          <button onClick={handleComplete} disabled={saving || uploading} className="btn-primary text-sm">
            {uploading ? 'Đang tải ảnh...' : 'Hoàn thành BT'}
          </button>
        </>
      )}
      {isCompleted && isManager && !wo.signedOffBy && (
        <>
          <button onClick={handleReject} disabled={saving} className="btn-secondary text-sm text-red-400">
            ↩ Yêu cầu làm lại
          </button>
          <button onClick={handleSignOff} disabled={saving} className="btn-primary text-sm">
            ✓ Xác nhận & Đóng WO
          </button>
        </>
      )}
      <button onClick={onClose} className="btn-secondary text-sm ml-auto">
        Đóng
      </button>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title=""
      size="xl"
      footer={footer}
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.1]">
          <div>
            <h3 className="font-semibold text-gray-100 text-base">{wo.scheduleName}</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {wo.assetName} · {wo.assetCode || '—'} · {wo.location}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {wo.dueDate && (
              <span className={`badge ${wo.status === 'overdue' ? 'badge-danger' : 'badge-info'}`}>
                Hạn: {format(wo.dueDate.toDate(), 'dd/MM/yyyy')}
              </span>
            )}
            {startedDate && <Timer startedAt={startedDate} />}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">
              Tiến độ: {doneCount}/{totalCount} hạng mục
            </span>
            <span className={`text-xs font-medium ${progressPct === 100 ? 'text-green-400' : 'text-amber'}`}>
              {progressPct}%
            </span>
          </div>
          <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-green-500' : 'bg-amber'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tasks */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber" />
            Danh sách công việc
          </h4>
          <div className="space-y-2">
            {wo.tasks.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={handleTaskUpdate(task.id)} />
            ))}
          </div>
        </div>

        {/* Parts used */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Vật tư sử dụng</h4>
          <div className="space-y-2">
            {partsUsed.map((part, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  value={part.name}
                  onChange={(e) => updatePart(idx, 'name', e.target.value)}
                  placeholder="Tên vật tư"
                  className="input-field text-sm flex-1"
                />
                <input
                  type="number"
                  value={part.quantity}
                  onChange={(e) => updatePart(idx, 'quantity', Number(e.target.value))}
                  min={1}
                  className="input-field text-sm w-20"
                />
                <input
                  value={part.unit}
                  onChange={(e) => updatePart(idx, 'unit', e.target.value)}
                  placeholder="ĐVT"
                  className="input-field text-sm w-20"
                />
                <button onClick={() => removePart(idx)} className="p-1.5 text-gray-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addPart} className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Thêm vật tư
            </button>
          </div>
        </div>

        {/* Photos */}
        <div className="grid grid-cols-2 gap-4">
          <PhotoSection
            label="Ảnh TRƯỚC bảo trì"
            type="before"
            photos={allPhotos}
            uploads={beforePhotos}
            onAdd={(u) => setBeforePhotos((p) => [...p, u])}
            onRemove={(i) => setBeforePhotos((p) => p.filter((_, idx) => idx !== i))}
            onCaptionChange={(i, c) => setBeforePhotos((p) => p.map((x, idx) => idx === i ? { ...x, caption: c } : x))}
          />
          <PhotoSection
            label="Ảnh SAU bảo trì"
            type="after"
            photos={allPhotos}
            uploads={afterPhotos}
            onAdd={(u) => setAfterPhotos((p) => [...p, u])}
            onRemove={(i) => setAfterPhotos((p) => p.filter((_, idx) => idx !== i))}
            onCaptionChange={(i, c) => setAfterPhotos((p) => p.map((x, idx) => idx === i ? { ...x, caption: c } : x))}
          />
        </div>

        {/* Technician notes */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Ghi chú kỹ thuật viên</h4>
          <textarea
            value={technicianNotes}
            onChange={(e) => setTechnicianNotes(e.target.value)}
            placeholder="Mô tả công việc đã thực hiện, phát hiện bất thường..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {/* Manager sign-off section */}
        {isCompleted && isManager && !wo.signedOffBy && (
          <div className="bg-white/[0.04] rounded-xl border border-amber/20 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-amber flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Xác nhận bảo trì
            </h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-white/[0.04] rounded-lg p-2">
                <p className="text-xs text-gray-500">Hạng mục</p>
                <p className="text-gray-200 font-medium">{doneCount}/{totalCount}</p>
              </div>
              <div className="bg-white/[0.04] rounded-lg p-2">
                <p className="text-xs text-gray-500">Ảnh</p>
                <p className="text-gray-200 font-medium">{allPhotos.length + beforePhotos.length + afterPhotos.length}</p>
              </div>
              <div className="bg-white/[0.04] rounded-lg p-2">
                <p className="text-xs text-gray-500">Thời gian</p>
                <p className="text-gray-200 font-medium">
                  {wo.actualDuration ? `${wo.actualDuration} phút` : '—'}
                </p>
              </div>
            </div>
            {wo.technicianNotes && (
              <div className="bg-white/[0.04] rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Ghi chú KTV</p>
                <p className="text-sm text-gray-300">{wo.technicianNotes}</p>
              </div>
            )}
            {/* Photo thumbnails */}
            {allPhotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {allPhotos.slice(0, 6).map((photo, i) => (
                  <img key={i} src={photo.url} alt={photo.caption} className="w-12 h-12 object-cover rounded-lg" />
                ))}
                {allPhotos.length > 6 && (
                  <div className="w-12 h-12 bg-white/[0.08] rounded-lg flex items-center justify-center text-xs text-gray-400">
                    +{allPhotos.length - 6}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ghi chú xác nhận (tùy chọn)</label>
              <textarea
                value={signOffNote}
                onChange={(e) => setSignOffNote(e.target.value)}
                placeholder="Ghi chú thêm..."
                rows={2}
                className="input-field text-sm resize-none"
              />
            </div>
          </div>
        )}

        {/* Already signed off */}
        {isCompleted && wo.signedOffBy && (
          <div className="bg-green-500/5 rounded-xl border border-green-500/20 p-4">
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Đã xác nhận bởi {wo.signedOffBy}
              {wo.signedOffAt && ` ngày ${format(wo.signedOffAt.toDate(), 'dd/MM/yyyy HH:mm')}`}
            </p>
            {wo.signedOffNote && <p className="text-sm text-gray-400 mt-1">{wo.signedOffNote}</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}
