import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { PcccInspection } from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Eye, FileText, Check, X, Minus } from 'lucide-react'

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  pass: { label: 'Đạt', cls: 'badge-success' },
  conditional: { label: 'Có điều kiện', cls: 'badge-warning' },
  fail: { label: 'Không đạt', cls: 'badge-danger' },
}

const RESULT_ICON: Record<string, React.ElementType> = {
  ok: Check,
  fail: X,
  na: Minus,
}

function DetailModal({ inspection, onClose }: { inspection: PcccInspection & { id: string }; onClose: () => void }) {
  const grouped = inspection.checklist.reduce<Record<string, typeof inspection.checklist>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const CATEGORY_LABELS: Record<string, string> = {
    extinguisher: 'Bình chữa cháy',
    detector: 'Đầu báo',
    pump: 'Bơm PCCC',
    exit: 'Lối thoát & Cửa',
    sprinkler: 'Sprinkler',
    hydrant: 'Họng chữa cháy',
    panel: 'Tủ điều khiển',
  }

  return (
    <Modal open onClose={onClose} title="Chi tiết biên bản PCCC" size="lg">
      <div className="space-y-4">
        <div className="card p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-t2">Tháng</span>
            <span className="text-sm font-medium text-gray-100">{inspection.month}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Ngày kiểm tra</span>
            <span className="text-sm text-gray-100">
              {inspection.inspectedAt ? format(inspection.inspectedAt.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Người kiểm tra</span>
            <span className="text-sm text-gray-100">{inspection.inspectorName}</span>
          </div>
          {inspection.locationNotes && (
            <div className="flex justify-between">
              <span className="text-sm text-t2">Địa điểm</span>
              <span className="text-sm text-gray-100">{inspection.locationNotes}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-t2">Kết quả</span>
            <span className={`badge ${RESULT_BADGE[inspection.overallResult]?.cls}`}>
              {RESULT_BADGE[inspection.overallResult]?.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-t2">Hạng mục không đạt</span>
            <span className={`text-sm font-medium ${inspection.failedItems > 0 ? 'text-red-400' : 'text-gray-100'}`}>
              {inspection.failedItems}
            </span>
          </div>
          {inspection.notes && (
            <div>
              <span className="text-sm text-t2">Ghi chú: </span>
              <span className="text-sm text-gray-300">{inspection.notes}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card overflow-hidden">
              <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.07]">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                  {CATEGORY_LABELS[category] || category}
                </h4>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {items.map((item) => {
                  const Icon = RESULT_ICON[item.result]
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        item.result === 'ok' ? 'bg-green-500/15 text-green-400' :
                        item.result === 'fail' ? 'bg-red-500/15 text-red-400' :
                        'bg-white/5 text-t2'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.result === 'fail' ? 'text-red-400' : 'text-gray-200'}`}>{item.label}</p>
                        <p className="text-xs text-t3">{item.location}</p>
                        {item.note && <p className="text-xs text-amber-400 mt-1">↳ {item.note}</p>}
                      </div>
                      <span className={`text-xs shrink-0 ${
                        item.result === 'ok' ? 'text-green-400' :
                        item.result === 'fail' ? 'text-red-400' :
                        'text-t2'
                      }`}>
                        {item.result === 'ok' ? 'Đạt' : item.result === 'fail' ? 'KĐ' : 'K/A'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

interface Props {
  inspections: (PcccInspection & { id: string })[]
}

export default function PcccInspectionHistoryTable({ inspections }: Props) {
  const [detail, setDetail] = useState<PcccInspection & { id: string } | null>(null)

  if (inspections.length === 0) {
    return (
      <div className="text-center py-12 text-t2 text-sm">
        <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p>Chưa có biên bản kiểm tra PCCC nào</p>
      </div>
    )
  }

  return (
    <>
      <div className="card overflow-hidden">
        <table className="table-desktop">
          <thead>
            <tr>
              <th className="text-left">Tháng</th>
              <th className="text-left hidden sm:table-cell">Ngày kiểm tra</th>
              <th className="text-left hidden md:table-cell">Người kiểm tra</th>
              <th className="text-left">Kết quả</th>
              <th className="text-left hidden lg:table-cell">Lỗi</th>
              <th className="text-left">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map((insp) => {
              const badge = RESULT_BADGE[insp.overallResult]
              return (
                <tr key={insp.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <span className="text-sm font-medium text-gray-200">{insp.month}</span>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-sm text-t2">
                      {insp.inspectedAt ? format(insp.inspectedAt.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-sm text-t2">{insp.inspectorName}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${badge?.cls}`}>{badge?.label}</span>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <span className={`text-sm font-medium ${insp.failedItems > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {insp.failedItems}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setDetail(insp)}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Chi tiết
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && <DetailModal inspection={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
