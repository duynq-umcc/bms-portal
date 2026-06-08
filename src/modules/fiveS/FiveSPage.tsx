import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { listenFiveSLogs, addFiveSLog, listenStaff } from '@/firebase/db'
import type { FiveSLog, FiveSCheckItem, FiveSScore } from '@/types/firestore'
import type { StaffDoc } from '@/firebase/types'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import {
  ClipboardCheck, Plus, Calendar,
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { DEFAULT_FIVE_S_ITEMS, FIVE_S_AREAS } from '@/types/firestore'


const SCORE_COLORS: Record<number, string> = {
  0: 'text-red-400',
  1: 'text-red-500',
  2: 'text-amber',
  3: 'text-yellow-400',
  4: 'text-green-400',
  5: 'text-green-500',
}

function ScoreButton({
  value,
  selected,
  onClick,
}: {
  value: FiveSScore
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-md text-xs font-semibold transition-all ${
        selected
          ? `bg-amber text-black ${SCORE_COLORS[value]}`
          : 'bg-white/5 text-t3 hover:bg-white/10'
      }`}
    >
      {value}
    </button>
  )
}

function FiveSDetailModal({
  log,
  onClose,
}: {
  log: FiveSLog
  onClose: () => void
}) {
  const areaGroups = FIVE_S_AREAS.map((area) => ({
    ...area,
    items: log.items.filter((i) => i.area === area.value),
  }))

  const totalPossible = log.items.length * 5
  const scorePct = totalPossible > 0 ? Math.round((log.overallScore / totalPossible) * 100) : 0

  return (
    <Modal open onClose={onClose} title="Chi tiết kiểm tra 5S" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-t3 mb-1">Ngày kiểm tra</p>
            <p className="font-semibold text-gray-100">{format(log.checkDate.toDate(), 'dd/MM/yyyy', { locale: vi })}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-t3 mb-1">Người kiểm tra</p>
            <p className="font-semibold text-gray-100">{log.inspectorName}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-t3 mb-1">Khu vực</p>
            <p className="font-semibold text-gray-100">{log.area}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-t3 mb-1">Điểm tổng</p>
            <p className={`font-bold text-2xl ${scorePct >= 75 ? 'text-green-400' : scorePct >= 50 ? 'text-amber' : 'text-red-400'}`}>
              {scorePct}%
            </p>
          </div>
        </div>

        {areaGroups.map((group) => (
          group.items.length > 0 && (
            <div key={group.value} className="card overflow-hidden">
              <div className={`flex items-center gap-2 px-4 py-3 ${group.color}`}>
                <span className="font-semibold">{group.vi}</span>
                <span className="text-xs opacity-70">({group.label})</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {group.items.map((item) => (
                  <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">{item.label}</p>
                      {item.note && <p className="text-xs text-t3 mt-0.5">{item.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${SCORE_COLORS[item.score]}`}>
                        {item.score}/5
                      </span>
                      {item.score >= 3 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        {log.notes && (
          <div className="card p-3">
            <p className="text-xs text-t3 mb-1">Ghi chú</p>
            <p className="text-sm text-gray-200">{log.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function AddFiveSModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffDoc[]>([])
  const [area, setArea] = useState('')
  const [inspectorName, setInspectorName] = useState(user?.displayName ?? '')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<FiveSCheckItem[]>(
    DEFAULT_FIVE_S_ITEMS.map((i) => ({ ...i, score: 0 as FiveSScore, note: '' }))
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsub = listenStaff(setStaff as (docs: (StaffDoc & { uid: string; id: string })[]) => void)
    return () => unsub()
  }, [])

  const setScore = (index: number, score: FiveSScore) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, score } : item)))
  }

  const setNote = (index: number, note: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, note } : item)))
  }

  const overallScore = items.reduce((s, i) => s + i.score, 0)
  const passed = items.filter((i) => i.score >= 3).length
  const failed = items.filter((i) => i.score < 3 && i.score > 0).length
  const totalPossible = items.length * 5
  const scorePct = totalPossible > 0 ? Math.round((overallScore / totalPossible) * 100) : 0

  const handleSubmit = async () => {
    if (!area.trim()) { toast.error('Khu vực kiểm tra là bắt buộc'); return }
    if (!inspectorName.trim()) { toast.error('Người kiểm tra là bắt buộc'); return }
    const scoredItems = items.filter((i) => i.score > 0)
    if (scoredItems.length === 0) { toast.error('Cần chấm điểm ít nhất 1 tiêu chí'); return }
    setSaving(true)
    try {
      await addFiveSLog({
        checkDate: Timestamp.now(),
        area: area.trim(),
        inspectorId: user!.uid,
        inspectorName: inspectorName.trim(),
        items: scoredItems,
        overallScore,
        passed,
        failed,
        notes: notes.trim(),
      })
      toast.success('Đã lưu kết quả kiểm tra 5S')
      onSuccess()
      onClose()
      // Reset
      setArea('')
      setNotes('')
      setItems(DEFAULT_FIVE_S_ITEMS.map((i) => ({ ...i, score: 0 as FiveSScore, note: '' })))
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const areaGroups = FIVE_S_AREAS.map((a) => ({
    ...a,
    items: items.filter((i) => i.area === a.value),
  }))

  return (
    <Modal open={open} onClose={onClose} title="Biên bản kiểm tra 5S" size="lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Khu vực kiểm tra *</label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="input-field"
              placeholder="VD: Phòng Server A, Kho vật tư..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Người kiểm tra *</label>
            <input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="input-field"
              list="five-s-inspectors"
            />
            <datalist id="five-s-inspectors">
              {staff.map((s) => <option key={s.id} value={s.displayName} />)}
            </datalist>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap text-xs">
          <span className="text-t3">Điểm: </span>
          <span className={`font-bold ${scorePct >= 75 ? 'text-green-400' : scorePct >= 50 ? 'text-amber' : 'text-red-400'}`}>
            {overallScore}/{totalPossible} ({scorePct}%)
          </span>
          <span className="text-green-400">✓ {passed} đạt</span>
          {failed > 0 && <span className="text-red-400">✗ {failed} chưa đạt</span>}
        </div>

        {areaGroups.map((group) => (
          group.items.length > 0 && (
            <div key={group.value} className="card overflow-hidden">
              <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${group.color}`}>
                <span>{group.vi}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {group.items.map((item) => {
                  const globalIdx = items.findIndex((i) => i.id === item.id)
                  return (
                    <div key={item.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-300 flex-1 pr-2">{item.label}</p>
                        <div className="flex items-center gap-1">
                          {([0, 1, 2, 3, 4, 5] as FiveSScore[]).map((v) => (
                            <ScoreButton
                              key={v}
                              value={v}
                              selected={item.score === v}
                              onClick={() => setScore(globalIdx, v)}
                            />
                          ))}
                        </div>
                      </div>
                      {item.score > 0 && (
                        <input
                          value={item.note}
                          onChange={(e) => setNote(globalIdx, e.target.value)}
                          className="input-field w-full text-xs"
                          placeholder="Ghi chú (tùy chọn)..."
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        ))}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Ghi chú / Kiến nghị</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full text-sm"
            rows={3}
            placeholder="Nhận xét chung, đề xuất cải tiến..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-3 border-t border-white/[0.07]">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Đang lưu...' : 'Lưu kết quả 5S'}
        </button>
        <button onClick={onClose} className="btn-secondary">Đóng</button>
      </div>
    </Modal>
  )
}

export default function FiveSPage() {
  const [logs, setLogs] = useState<FiveSLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedLog, setSelectedLog] = useState<FiveSLog | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    const unsub = listenFiveSLogs(setLogs as (docs: any[]) => void)
    setLoading(false)
    return () => unsub()
  }, [])

  const grouped = logs.reduce<Record<string, FiveSLog[]>>((acc, log) => {
    const month = format(log.checkDate.toDate(), 'yyyy-MM')
    if (!acc[month]) acc[month] = []
    acc[month].push(log)
    return acc
  }, {})

  const sortedMonths = Object.keys(grouped).sort().reverse()

  const avgScorePct = (monthLogs: FiveSLog[]) => {
    if (!monthLogs.length) return 0
    const total = monthLogs.reduce((s, l) => {
      const max = l.items.length * 5
      return s + (max > 0 ? (l.overallScore / max) * 100 : 0)
    }, 0)
    return Math.round(total / monthLogs.length)
  }

  if (loading) return <div className="p-4 text-t3">Đang tải...</div>

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-amber" />
            Kiểm tra 5S
          </h1>
          <p className="text-xs text-t3 mt-0.5">Biên bản kiểm tra vệ sinh, sắp xếp theo tiêu chuẩn 5S</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Kiểm tra mới
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Tổng số lần kiểm tra</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{logs.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-t3">Lần gần nhất</p>
          <p className="text-lg font-bold text-amber mt-1">
            {logs.length > 0 ? format(logs[0].checkDate.toDate(), 'dd/MM') : '—'}
          </p>
        </div>
      </div>

      {/* Grouped by month */}
      {sortedMonths.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-8 h-8" />}
          title="Chưa có biên bản 5S"
          description="Bắt đầu bằng cách tạo biên bản kiểm tra đầu tiên."
          action={() => setShowAdd(true)}
          actionLabel="Tạo biên bản 5S"
        />
      ) : (
        <div className="space-y-2">
          {sortedMonths.map((month) => {
            const monthLogs = grouped[month]
            const scorePct = avgScorePct(monthLogs)
            const isOpen = expandedMonth === month
            return (
              <div key={month} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedMonth(isOpen ? null : month)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-t3" />
                    <span className="font-semibold text-gray-100">
                      {format(new Date(month + '-01'), 'MMMM yyyy', { locale: vi })}
                    </span>
                    <span className="badge-gray">{monthLogs.length} lần</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${scorePct >= 75 ? 'text-green-400' : scorePct >= 50 ? 'text-amber' : 'text-red-400'}`}>
                      {scorePct}%
                    </span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-t3" /> : <ChevronRight className="w-4 h-4 text-t3" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="divide-y divide-white/[0.05]">
                    {monthLogs.map((log) => {
                      const max = log.items.length * 5
                      const pct = max > 0 ? Math.round((log.overallScore / max) * 100) : 0
                      return (
                        <button
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{log.area}</p>
                            <p className="text-xs text-t3 mt-0.5">
                              {format(log.checkDate.toDate(), 'dd/MM/yyyy')} · {log.inspectorName}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${pct >= 75 ? 'text-green-400' : pct >= 50 ? 'text-amber' : 'text-red-400'}`}>
                                {pct}%
                              </p>
                              <p className="text-xs text-t3">{log.passed}/{log.items.length} đạt</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-t3" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddFiveSModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setLogs((prev) => prev)}
      />
      {selectedLog && (
        <FiveSDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}
