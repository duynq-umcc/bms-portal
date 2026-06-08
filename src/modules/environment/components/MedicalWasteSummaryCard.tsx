import { useGetMedicalWasteLogs } from '@/hooks/useMedicalWasteLogs'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TableSkeleton } from '@/components/ui/Table'

const GROUP_COLORS: Record<string, string> = {
  groupB: '#ef4444',
  groupC: '#6b7280',
  groupD: '#f59e0b',
  groupE: '#22c55e',
}

const GROUP_LABELS: Record<string, string> = {
  groupB: 'Nhóm B (Đỏ)',
  groupC: 'Nhóm C (Đen)',
  groupD: 'Nhóm D (Vàng)',
  groupE: 'Nhóm E (Xanh)',
}

export default function MedicalWasteSummaryCard() {
  const { logs, loading } = useGetMedicalWasteLogs()

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={5} />
      </div>
    )
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const thisMonthLogs = logs.filter((log) => {
    if (!log.logDate) return false
    const d = log.logDate.toDate()
    return d >= monthStart && d <= monthEnd
  })

  const monthlyTotals = {
    groupB: thisMonthLogs.reduce((s, l) => s + l.waste.groupB, 0),
    groupC: thisMonthLogs.reduce((s, l) => s + l.waste.groupC, 0),
    groupD: thisMonthLogs.reduce((s, l) => s + l.waste.groupD, 0),
    groupE: thisMonthLogs.reduce((s, l) => s + l.waste.groupE, 0),
  }

  const monthlyTotal = Object.values(monthlyTotals).reduce((a, b) => a + b, 0)

  const allTimeTotals = {
    groupB: logs.reduce((s, l) => s + l.waste.groupB, 0),
    groupC: logs.reduce((s, l) => s + l.waste.groupC, 0),
    groupD: logs.reduce((s, l) => s + l.waste.groupD, 0),
    groupE: logs.reduce((s, l) => s + l.waste.groupE, 0),
  }

  const chartData = [
    { name: 'Nhóm B', weight: monthlyTotals.groupB, fill: GROUP_COLORS.groupB },
    { name: 'Nhóm C', weight: monthlyTotals.groupC, fill: GROUP_COLORS.groupC },
    { name: 'Nhóm D', weight: monthlyTotals.groupD, fill: GROUP_COLORS.groupD },
    { name: 'Nhóm E', weight: monthlyTotals.groupE, fill: GROUP_COLORS.groupE },
  ]

  return (
    <div className="space-y-4">
      {/* Monthly summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-100">
            Tổng hợp tháng {format(now, 'MM/yyyy', { locale: vi })}
          </h4>
          <span className="text-lg font-bold text-gray-100">{monthlyTotal.toFixed(1)} kg</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(GROUP_LABELS) as (keyof typeof monthlyTotals)[]).map((key) => (
            <div key={key} className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-1`} style={{ backgroundColor: GROUP_COLORS[key] }} />
              <p className="text-xs font-medium text-gray-100">{monthlyTotals[key].toFixed(1)} kg</p>
              <p className="text-[10px] text-t3">{key === 'groupB' ? 'Đỏ' : key === 'groupC' ? 'Đen' : key === 'groupD' ? 'Vàng' : 'Xanh'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked bar chart */}
      {monthlyTotal > 0 && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-gray-100 mb-4">Biểu đồ theo nhóm (tháng này)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" kg" />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)} kg`, 'Khối lượng']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <Bar dataKey="weight" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(GROUP_LABELS) as (keyof typeof allTimeTotals)[]).map((key) => (
          <div key={key} className="card p-3 flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full shrink-0`} style={{ backgroundColor: GROUP_COLORS[key] }} />
            <div>
              <p className="text-xs font-medium text-gray-200">{GROUP_LABELS[key]}</p>
              <p className="text-[10px] text-t3">
                Tổng: {allTimeTotals[key].toFixed(1)} kg
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        <table className="table-desktop">
          <thead>
            <tr>
              <th className="text-left">Ngày</th>
              <th className="text-right hidden sm:table-cell">B (Đỏ)</th>
              <th className="text-right hidden sm:table-cell">C (Đen)</th>
              <th className="text-right hidden md:table-cell">D (Vàng)</th>
              <th className="text-right hidden md:table-cell">E (Xanh)</th>
              <th className="text-right">Tổng</th>
              <th className="text-left hidden lg:table-cell">Số phiếu</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 30).map((log) => {
              const total = log.waste.groupB + log.waste.groupC + log.waste.groupD + log.waste.groupE
              return (
                <tr key={log.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-3 text-sm text-gray-200">
                    {log.logDate ? format(log.logDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell text-xs text-red-400">
                    {log.waste.groupB > 0 ? `${log.waste.groupB.toFixed(1)} kg` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell text-xs text-gray-400">
                    {log.waste.groupC > 0 ? `${log.waste.groupC.toFixed(1)} kg` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right hidden md:table-cell text-xs text-yellow-400">
                    {log.waste.groupD > 0 ? `${log.waste.groupD.toFixed(1)} kg` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right hidden md:table-cell text-xs text-green-400">
                    {log.waste.groupE > 0 ? `${log.waste.groupE.toFixed(1)} kg` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium text-gray-100">
                    {total.toFixed(1)} kg
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-xs text-t2 font-mono">
                    {log.collectionReceiptNo || '—'}
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-t3 text-sm">Chưa có dữ liệu chất thải y tế</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
