import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useGetWwtpLogs } from '@/hooks/useWwtpLogs'
import type { WwtpLog } from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Eye, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  night: 'Đêm',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  compliant: { label: 'Đạt', cls: 'badge-success', icon: CheckCircle },
  marginal: { label: 'Biên', cls: 'badge-warning', icon: AlertTriangle },
  non_compliant: { label: 'Vi phạm', cls: 'badge-danger', icon: XCircle },
}

const PARAM_LABELS: Record<string, string> = {
  ph: 'pH', bod5: 'BOD₅', cod: 'COD', tss: 'TSS',
  coliform: 'Coliform', chlorineResidual: 'Clo dư', dissolvedOxygen: 'DO',
}

function DetailModal({ log, onClose }: { log: WwtpLog & { id: string }; onClose: () => void }) {
  const cfg = STATUS_CONFIG[log.overallStatus]

  return (
    <Modal open onClose={onClose} title="Chi tiết nhật ký WWTP" size="lg">
      <div className="space-y-4">
        <div className="card p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-t2">Ngày</span>
            <span className="text-sm font-medium text-gray-100">
              {log.logDate ? format(log.logDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Ca</span>
            <span className="text-sm text-gray-100">{SHIFT_LABELS[log.shift]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Người vận hành</span>
            <span className="text-sm text-gray-100">{log.operatorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Kết quả</span>
            <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
          </div>
          {log.issues && (
            <div>
              <span className="text-sm text-t2">Ghi chú: </span>
              <span className="text-sm text-gray-300">{log.issues}</span>
            </div>
          )}
        </div>

        {/* Readings */}
        <div className="grid grid-cols-2 gap-3">
          {(['inflowVolume', 'outflowVolume'] as const).map((key) => (
            <div key={key} className="card p-3">
              <p className="text-xs text-t3 mb-1">{key === 'inflowVolume' ? 'Lưu lượng vào' : 'Lưu lượng ra'}</p>
              <p className="text-lg font-bold text-blue-400">
                {log.readings[key].toLocaleString('vi-VN')}
                <span className="text-xs font-normal text-t3 ml-1">m³/ngày</span>
              </p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.07]">
            <h4 className="text-xs font-semibold text-amber-400 uppercase">Chất lượng nước thải</h4>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {(Object.keys(PARAM_LABELS) as (keyof typeof log.readings)[]).map((key) => {
              const val = log.readings[key]
              return (
                <div key={key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-t2">{PARAM_LABELS[key]}</span>
                  <span className="text-sm font-medium text-gray-100">
                    {val.toLocaleString('vi-VN')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {log.chemicalUsed && log.chemicalUsed.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.07]">
              <h4 className="text-xs font-semibold text-amber-400 uppercase">Hóa chất sử dụng</h4>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {log.chemicalUsed.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-200">{c.name}</span>
                  <span className="text-sm text-t2">{c.quantity} {c.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function WwtpDashboard() {
  const { logs, loading } = useGetWwtpLogs()
  const [detail, setDetail] = useState<WwtpLog & { id: string } | null>(null)

  const latest = logs[0] || null

  // 30-day BOD5 + COD trend
  const trendData = [...logs]
    .reverse()
    .slice(-30)
    .map((log) => ({
      date: log.logDate ? format(log.logDate.toDate(), 'dd/MM') : '',
      BOD5: log.readings.bod5,
      COD: log.readings.cod,
    }))

  // Count by status
  const compliantCount = logs.filter((l) => l.overallStatus === 'compliant').length
  const marginalCount = logs.filter((l) => l.overallStatus === 'marginal').length
  const violationCount = logs.filter((l) => l.overallStatus === 'non_compliant').length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 h-24 animate-pulse bg-white/[0.03]" />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{compliantCount}</p>
            <p className="text-[10px] text-t3">Đạt QCVN</p>
          </div>
          <div className="card p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-400">{marginalCount}</p>
            <p className="text-[10px] text-t3">Gần biên</p>
          </div>
          <div className="card p-4 text-center">
            <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-400">{violationCount}</p>
            <p className="text-[10px] text-t3">Vi phạm</p>
          </div>
        </div>

        {/* Latest reading */}
        {latest && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-100">Kết quả mới nhất</h4>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CONFIG[latest.overallStatus].cls}`}>
                  {STATUS_CONFIG[latest.overallStatus].label}
                </span>
                <button onClick={() => setDetail(latest)} className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Chi tiết
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['bod5', 'cod', 'tss', 'ph'] as const).map((key) => (
                <div key={key} className="text-center">
                  <p className="text-[10px] text-t3">{PARAM_LABELS[key]}</p>
                  <p className="text-sm font-bold text-gray-100">{latest.readings[key]}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-t3 mt-2 text-center">
              {latest.logDate ? format(latest.logDate.toDate(), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi }) : ''} · {SHIFT_LABELS[latest.shift]}
            </p>
          </div>
        )}

        {/* Trend chart */}
        {trendData.length > 1 && (
          <div className="card p-4">
            <h4 className="text-sm font-semibold text-gray-100 mb-4">Xu hướng BOD₅ & COD (30 ngày)</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <Line type="monotone" dataKey="BOD5" stroke="#f59e0b" strokeWidth={2} dot={false} name="BOD₅" />
                <Line type="monotone" dataKey="COD" stroke="#ef4444" strokeWidth={2} dot={false} name="COD" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Log table */}
        <div className="card overflow-hidden">
          <table className="table-desktop">
            <thead>
              <tr>
                <th className="text-left">Ngày</th>
                <th className="text-left hidden sm:table-cell">Ca</th>
                <th className="text-left hidden md:table-cell">Người vận hành</th>
                <th className="text-left hidden lg:table-cell">BOD₅ / COD</th>
                <th className="text-left">Kết quả</th>
                <th className="text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 20).map((log) => {
                const cfg = STATUS_CONFIG[log.overallStatus]
                return (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 text-sm text-gray-200">
                      {log.logDate ? format(log.logDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell text-sm text-t2">{SHIFT_LABELS[log.shift]}</td>
                    <td className="px-3 py-3 hidden md:table-cell text-sm text-t2">{log.operatorName}</td>
                    <td className="px-3 py-3 hidden lg:table-cell text-xs text-t2">
                      {log.readings.bod5} / {log.readings.cod} mg/L
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setDetail(log)} className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Chi tiết
                      </button>
                    </td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-t3 text-sm">Chưa có nhật ký WWTP</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <DetailModal log={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
