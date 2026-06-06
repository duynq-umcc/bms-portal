import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import Modal from '@/components/ui/Modal'
import { FileText, Eye } from 'lucide-react'
import type { OperationLog, OperationLogShift } from '@/firebase/types'

const SHIFT_LABELS: Record<OperationLogShift, string> = {
  morning: 'Ca sáng',
  afternoon: 'Ca chiều',
  night: 'Ca đêm',
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-warning',
  submitted: 'badge-success',
  handedOver: 'bg-teal-500/20 text-teal-400',
}

function LogRow({ log, onView }: { log: OperationLog; onView: () => void }) {
  const checklistDone = log.checklist
    ? Object.values(log.checklist).filter(Boolean).length
    : 0

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
      <td className="px-3 py-2.5 text-xs text-gray-400">{log.date}</td>
      <td className="px-3 py-2.5">
        <span className="badge badge-ghost text-xs">{SHIFT_LABELS[log.shift]}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-300">{log.loggedByName}</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">
        {log.readings?.electricity?.totalCurrent
          ? `${log.readings.electricity.totalCurrent} A`
          : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400">
        {log.readings?.water?.rooftankLevel
          ? `${log.readings.water.rooftankLevel} m³`
          : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400">
        {log.readings?.medicalGas?.o2Pressure
          ? `${log.readings.medicalGas.o2Pressure} bar`
          : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span className={`badge ${STATUS_BADGE[log.status] ?? 'badge-ghost'}`}>
          {log.status === 'submitted' ? 'Đã nộp'
           : log.status === 'draft' ? 'Nháp'
           : 'Đã bàn giao'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{checklistDone}/10</span>
          <button
            onClick={onView}
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg transition-colors"
            title="Xem chi tiết"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function LogDetailModal({ log, open, onClose }: { log: OperationLog | null; open: boolean; onClose: () => void }) {
  if (!log) return null
  const e = log.readings?.electricity
  const w = log.readings?.water
  const h = log.readings?.hvac
  const m = log.readings?.medicalGas
  const checklistDone = log.checklist
    ? Object.values(log.checklist).filter(Boolean).length
    : 0

  const fmt = (v?: number | string | null) =>
    v === undefined || v === null ? '—' : String(v)

  return (
    <Modal open={open} onClose={onClose} title="Chi tiết nhật ký vận hành" size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 text-sm text-gray-400 border-b border-white/5 pb-3">
          <FileText className="w-4 h-4" />
          <span>{log.date}</span>
          <span>·</span>
          <span>{SHIFT_LABELS[log.shift]}</span>
          <span>·</span>
          <span>{log.loggedByName}</span>
          <span className={`ml-auto badge ${STATUS_BADGE[log.status] ?? 'badge-ghost'}`}>
            {log.status === 'submitted' ? 'Đã nộp'
             : log.status === 'draft' ? 'Nháp'
             : 'Đã bàn giao'}
          </span>
        </div>

        {/* Readings grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Electricity */}
          <div className="bg-white/[0.04] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Điện</p>
            <div className="space-y-1 text-xs">
              {[
                ['Dòng điện', `${fmt(e?.totalCurrent)} A`],
                ['Điện áp', `${fmt(e?.voltage)} V`],
                ['Hệ số công suất', fmt(e?.powerFactor)],
                ['kWh tổng', fmt(e?.totalKwh)],
                ['MPĐ', `${fmt(e?.generatorFuelPct)}%`],
                ['Trạng thái MPĐ', fmt(e?.generatorStatus)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Water */}
          <div className="bg-white/[0.04] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Nước</p>
            <div className="space-y-1 text-xs">
              {[
                ['Bể mái', `${fmt(w?.rooftankLevel)} m³`],
                ['Mức bể', `${fmt(w?.rooftankPct)}%`],
                ['Áp suất bơm', `${fmt(w?.boosterPressure)} bar`],
                ['Tiêu thụ hôm nay', `${fmt(w?.dailyConsumption)} m³`],
                ['Lưu lượng XLNT', `${fmt(w?.wastewaterFlow)} m³/h`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HVAC */}
          <div className="bg-white/[0.04] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">HVAC</p>
            <div className="space-y-1 text-xs">
              {[
                ['AHU-3 nhiệt độ', `${fmt(h?.ahu3Temp)}°C`],
                ['AHU-3 công suất', `${fmt(h?.ahu3Capacity)}%`],
                ['AHU-1 nhiệt độ', `${fmt(h?.ahu1Temp)}°C`],
                ['AHU-2 nhiệt độ', `${fmt(h?.ahu2Temp)}°C`],
                ['Chilled cấp', `${fmt(h?.chillerSupplyTemp)}°C`],
                ['Chilled hồi', `${fmt(h?.chillerReturnTemp)}°C`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Medical Gas */}
          <div className="bg-white/[0.04] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Khí y tế</p>
            <div className="space-y-1 text-xs">
              {[
                ['O₂', `${fmt(m?.o2Pressure)} bar`],
                ['Trạng thái O₂', fmt(m?.o2Status)],
                ['Khí nén', `${fmt(m?.airPressure)} bar`],
                ['Chân không', `${fmt(m?.vacuumPressure)} bar`],
                ['N₂O', `${fmt(m?.n2oPressure)} bar`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Handover */}
        {log.handover && (
          <div className="bg-white/[0.04] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Bàn giao ca</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Người nhận', fmt(log.handover.receivedByName)],
                ['Sự cố', fmt(log.handover.incidentsThisShift)],
                ['Công việc dang dở', fmt(log.handover.pendingTasks)],
                ['Thiết bị cần theo dõi', fmt(log.handover.equipmentIssues)],
                ['Lưu ý ca sau', fmt(log.handover.nextShiftNotes)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{k}</span>
                  <span className="text-gray-300 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist */}
        {log.checklist && (
          <div className="bg-white/[0.04] rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-gray-300">Checklist</p>
              <span className="text-xs text-gray-400">{checklistDone}/10</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(log.checklist).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${v ? 'bg-green-500' : 'bg-white/10'}`}>
                    {v ? <span className="w-1 h-1 bg-white rounded-full" /> : null}
                  </span>
                  <span className={v ? 'text-gray-300' : 'text-gray-600'}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface Props {
  refreshKey?: number
}

export default function OperationLogList({ refreshKey }: Props) {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [filterDateTo, setFilterDateTo] = useState(() =>
    new Date().toISOString().split('T')[0]
  )
  const [filterShift, setFilterShift] = useState<'all' | OperationLogShift>('all')
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'operationLogs'),
      orderBy('createdAt', 'desc'),
      limit(30),
    )
    const unsub = onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as OperationLog)),
      )
      setLoading(false)
    })
    return () => unsub()
  }, [refreshKey])

  const today = new Date().toISOString().split('T')[0]
  const todayLogs = logs.filter((l) => l.date === today)
  const lastLog = todayLogs[0]

  const filtered = logs.filter((l) => {
    if (l.date < filterDateFrom || l.date > filterDateTo) return false
    if (filterShift !== 'all' && l.shift !== filterShift) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">Ca hôm nay</p>
          <p className="text-lg font-bold text-gray-200">
            {todayLogs.length}/3 ca
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">Last logged</p>
          <p className="text-sm font-semibold text-gray-200">
            {lastLog
              ? `${SHIFT_LABELS[lastLog.shift]} lúc ${lastLog.createdAt
                  ? new Date(lastLog.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—'} — ${lastLog.loggedByName}`
              : 'Chưa có'}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">Tổng nhật ký</p>
          <p className="text-lg font-bold text-gray-200">{logs.length}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="input-field text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="input-field text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ca</label>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value as 'all' | OperationLogShift)}
            className="input-field text-xs"
          >
            <option value="all">Tất cả</option>
            <option value="morning">Ca sáng</option>
            <option value="afternoon">Ca chiều</option>
            <option value="night">Ca đêm</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-gray-500 self-center">
          {filtered.length} nhật ký
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {['Ngày', 'Ca', 'Người ghi', 'Điện (A)', 'Nước bể', 'O₂ (bar)', 'Trạng thái', 'Checklist'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                    Không có nhật ký nào
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <LogRow key={log.id} log={log} onView={() => setSelectedLog(log)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LogDetailModal log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}
