import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { listenTrainingRecords, addTrainingRecord, listenStaff } from '@/firebase/db'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import type { TrainingRecord, TrainingAttendee, TrainingType } from '@/types/firestore'
import type { StaffMember } from '@/firebase/types'
import {
  GraduationCap, Plus, Users, Calendar, Clock, Award,
  CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { TRAINING_TYPES } from '@/types/firestore'

const TYPE_COLORS: Record<string, string> = {
  safety: 'badge-danger',
  technical: 'badge-info',
  compliance: 'badge-warning',
  orientation: 'badge-success',
  refresher: 'badge-primary',
  emergency: 'badge-danger',
}

function AttendanceModal({
  record,
  onClose,
}: {
  record: TrainingRecord
  onClose: () => void
}) {
  return (
    <Modal open onClose={onClose} title="Điểm danh" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-amber" />
          <div>
            <p className="font-semibold text-gray-100">{record.sessionTitle}</p>
            <p className="text-xs text-t3">
              {format(record.sessionDate.toDate(), "dd/MM/yyyy, HH:mm", { locale: vi })}
              {record.endDate && ` – ${format(record.endDate.toDate(), 'HH:mm')}`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="card p-2 text-center">
            <p className="text-xs text-t3">Tổng</p>
            <p className="text-xl font-bold text-gray-100">{record.totalAttendees}</p>
          </div>
          <div className="card p-2 text-center">
            <p className="text-xs text-t3">Có mặt</p>
            <p className="text-xl font-bold text-green-400">{record.presentCount}</p>
          </div>
          <div className="card p-2 text-center">
            <p className="text-xs text-t3">Vắng</p>
            <p className="text-xl font-bold text-red-400">{record.totalAttendees - record.presentCount}</p>
          </div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {record.attendees.map((a) => (
            <div key={a.uid} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-200">{a.name}</p>
                <p className="text-xs text-t3">{a.department}</p>
              </div>
              {a.present ? (
                <span className="badge-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Có mặt</span>
              ) : (
                <span className="badge-danger flex items-center gap-1"><XCircle className="w-3 h-3" />Vắng</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function AddTrainingModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user: _user } = useAuth()
  const [staff, setStaff] = useState<(StaffMember & { uid: string; id: string })[]>([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [type, setType] = useState<TrainingType>('safety')
  const [instructorName, setInstructorName] = useState('')
  const [instructorOrg, setInstructorOrg] = useState('')
  const [durationHours, setDurationHours] = useState(1)
  const [topics, setTopics] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedAttendees, setSelectedAttendees] = useState<TrainingAttendee[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsub = listenStaff(setStaff)
    return () => unsub()
  }, [])

  const toggleAttendee = (s: StaffMember) => {
    setSelectedAttendees((prev) => {
      const existing = prev.find((a) => a.uid === s.uid)
      if (existing) return prev.filter((a) => a.uid !== s.uid)
      return [...prev, {
        uid: s.uid,
        name: s.displayName,
        department: s.dept || '',
        present: false,
      }]
    })
  }

  const handleSubmit = async () => {
    if (!sessionTitle.trim()) { toast.error('Tên buổi đào tạo là bắt buộc'); return }
    if (!sessionDate) { toast.error('Ngày đào tạo là bắt buộc'); return }
    setSaving(true)
    try {
      const [year, month, day] = sessionDate.split('-').map(Number)
      const sessionTs = Timestamp.fromDate(new Date(year, month - 1, day, ...(sessionTime || '08:00').split(':').map(Number)))

      await addTrainingRecord({
        sessionTitle: sessionTitle.trim(),
        sessionDate: sessionTs,
        endDate: endTime ? (() => {
          if (!/^\d{2}:\d{2}$/.test(endTime)) return undefined
          const [eh, em] = endTime.split(':').map(Number)
          return Timestamp.fromDate(new Date(year, month - 1, day, eh, em))
        })() : undefined,
        location: location.trim(),
        type,
        instructorName: instructorName.trim(),
        instructorOrg: instructorOrg.trim(),
        durationHours,
        attendees: selectedAttendees,
        totalAttendees: selectedAttendees.length,
        presentCount: 0,
        certificateIssued: !!certificateNumber.trim(),
        certificateNumber: certificateNumber.trim() || undefined,
        topics: topics.split('\n').map((t) => t.trim()).filter(Boolean),
        notes: notes.trim(),
      })
      toast.success('Đã lưu đào tạo')
      onSuccess()
      onClose()
      // Reset
      setSessionTitle(''); setSessionDate(''); setSessionTime(''); setEndTime('')
      setLocation(''); setType('safety'); setInstructorName(''); setInstructorOrg('')
      setDurationHours(1); setTopics(''); setCertificateNumber(''); setNotes('')
      setSelectedAttendees([])
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Đăng ký buổi đào tạo" size="lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Tên buổi đào tạo *</label>
            <input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="input-field"
              placeholder="VD: Bồi dưỡng an toàn PCCC..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ngày *</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bắt đầu</label>
              <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kết thúc</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Địa điểm</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-field" placeholder="VD: Hội trường A" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Loại</label>
            <select value={type} onChange={(e) => setType(e.target.value as TrainingType)} className="input-field">
              {TRAINING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Giảng viên</label>
            <input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} className="input-field" placeholder="Họ tên..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Đơn vị giảng viên</label>
            <input value={instructorOrg} onChange={(e) => setInstructorOrg(e.target.value)} className="input-field" placeholder="Tổ chức..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Thời lượng (giờ)</label>
            <input type="number" min={0.5} max={40} step={0.5} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Số chứng chỉ</label>
            <input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} className="input-field" placeholder="Nếu có..." />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Nội dung / Chủ đề (mỗi dòng 1 chủ đề)</label>
          <textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            className="input-field w-full text-sm"
            rows={4}
            placeholder="1. Giới thiệu quy định PCCC&#10;2. Thực hành sử dụng bình chữa cháy&#10;3. Kiểm tra thiết bị PCCC..."
          />
        </div>

        {/* Attendees */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">
              Người tham dự ({selectedAttendees.length} đã chọn)
            </label>
          </div>
          {staff.length === 0 ? (
            <p className="text-xs text-t3 text-center py-3">Đang tải danh sách nhân viên...</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-white/[0.07] rounded-lg">
              {staff.map((s) => {
                const selected = selectedAttendees.some((a) => a.uid === s.uid)
                return (
                  <button
                    key={s.uid}
                    onClick={() => toggleAttendee(s)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors ${
                      selected ? 'bg-amber/5' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selected ? 'bg-amber border-amber' : 'border-white/20'
                    }`}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{s.displayName}</p>
                      <p className="text-xs text-t3">{s.dept || ''} · {s.position || ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Ghi chú</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full text-sm"
            rows={2}
            placeholder="Ghi chú thêm..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-3 border-t border-white/[0.07]">
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
          {saving ? 'Đang lưu...' : 'Lưu đào tạo'}
        </button>
        <button onClick={onClose} className="btn-secondary">Đóng</button>
      </div>
    </Modal>
  )
}

export default function TrainingPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    const unsub = listenTrainingRecords(setRecords as (docs: any[]) => void)
    setLoading(false)
    return () => unsub()
  }, [])

  const filtered = filterType === 'all' ? records : records.filter((r) => r.type === filterType)

  if (loading) return <div className="p-4 text-t3">Đang tải...</div>

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-amber" />
            Đào tạo & Chứng chỉ
          </h1>
          <p className="text-xs text-t3 mt-0.5">Quản lý buổi đào tạo, danh sách tham dự, và chứng chỉ</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Thêm buổi đào tạo
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Tổng buổi đào tạo</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{records.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Đã cấp chứng chỉ</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {records.filter((r) => r.certificateIssued).length}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Tổng tham dự</p>
          <p className="text-2xl font-bold text-amber mt-1">
            {records.reduce((s, r) => s + r.totalAttendees, 0)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filterType === 'all' ? 'bg-amber/15 text-amber' : 'bg-white/5 text-t3'}`}
        >
          Tất cả
        </button>
        {TRAINING_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filterType === t.value ? 'bg-amber/15 text-amber' : 'bg-white/5 text-t3'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="w-8 h-8" />}
          title="Chưa có buổi đào tạo"
          description="Đăng ký buổi đào tạo đầu tiên cho nhân viên."
          actionLabel="Thêm buổi đào tạo"
          action={() => setShowAdd(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <div key={record.id} className="card overflow-hidden">
              <button
                onClick={() => setSelectedRecord(record)}
                className="w-full text-left"
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-100">{record.sessionTitle}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`badge-sm ${TYPE_COLORS[record.type] ?? 'badge-gray'}`}>
                          {TRAINING_TYPES.find((t) => t.value === record.type)?.label ?? record.type}
                        </span>
                        {record.certificateIssued && (
                          <span className="badge-success badge-sm flex items-center gap-1">
                            <Award className="w-3 h-3" /> Chứng chỉ
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-t3 shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-t3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(record.sessionDate.toDate(), 'dd/MM/yyyy', { locale: vi })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.durationHours > 0 ? `${record.durationHours}h` : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {record.presentCount}/{record.totalAttendees} tham dự
                    </span>
                    {record.location && (
                      <span>{record.location}</span>
                    )}
                  </div>
                  {record.instructorName && (
                    <p className="text-xs text-t3 mt-1">
                      Giảng viên: {record.instructorName}
                      {record.instructorOrg && ` — ${record.instructorOrg}`}
                    </p>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      <AddTrainingModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setRecords((prev) => prev)}
      />
      {selectedRecord && (
        <AttendanceModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  )
}
