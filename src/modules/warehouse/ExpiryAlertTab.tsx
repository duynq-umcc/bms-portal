import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { ExpiryAlert, ExpiryAlertLevel } from '@/firebase/types'
import { resolveExpiryAlert } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Truck,
  Trash2,
  Warehouse,
} from 'lucide-react'

function alertLevelLabel(level: ExpiryAlertLevel): string {
  return level === 'critical' ? 'Cận hạn' : level === 'warning' ? 'Cảnh báo' : 'Chú ý'
}

function alertLevelColor(level: ExpiryAlertLevel): string {
  return level === 'critical' ? 'badge-danger' : level === 'warning' ? 'badge-warning' : 'badge-info'
}

function daysColor(days: number): string {
  if (days <= 0) return 'text-red-400 font-medium line-through'
  if (days <= 30) return 'text-red-400 font-medium'
  if (days <= 90) return 'text-amber'
  return 'text-blue-400'
}

function DaysBadge({ days }: { days: number }) {
  if (days <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        Đã hết hạn
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        {days} ngày
      </span>
    )
  }
  if (days <= 90) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
        </span>
        {days} ngày
      </span>
    )
  }
  return <span className="text-xs text-blue-400">{days} ngày</span>
}

type ExpiryAction = 'urgent_export' | 'return_supplier' | 'dispose' | 'transfer'

// ─── Expiry Action Modal ───────────────────────────────────────────────────────

function ExpiryActionModal({
  alert,
  open,
  onClose,
  onResolved,
}: {
  alert: ExpiryAlert | null
  open: boolean
  onClose: () => void
  onResolved: () => void
}) {
  const [action, setAction] = useState<ExpiryAction>('urgent_export')
  const [returnSupplier, setReturnSupplier] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [disposeReason, setDisposeReason] = useState('')
  const [disposeApprover, setDisposeApprover] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferQty, setTransferQty] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!alert) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      // Record transaction
      await addDoc(collection(db, 'inventoryTransactions'), {
        itemId: alert.itemId,
        itemName: alert.itemName,
        itemCode: alert.itemId,
        type: 'export',
        quantity: 1,
        user: 'system',
        notes: `Xử lý hết hạn: ${action}`,
        expiryDate: alert.expiryDate,
        batchNumber: alert.batchNumber,
        fifoWarning: false,
        date: serverTimestamp(),
      })

      // Handle disposal work order
      if (action === 'dispose') {
        await addDoc(collection(db, 'workOrders'), {
          title: `[Hủy VT] ${alert.itemName} — Lô ${alert.batchNumber}`,
          description: `Lý do hủy: ${disposeReason}\nNgười phê duyệt: ${disposeApprover}\nNgày hết hạn: ${format(alert.expiryDate.toDate(), 'dd/MM/yyyy')}`,
          system: 'warehouse',
          location: 'Kho vật tư',
          priority: 'high' as const,
          status: 'pending' as const,
          createdBy: 'system',
          notes: 'Yêu cầu hủy vật tư hết hạn tự động tạo',
        })
      }

      // Mark alert resolved
      await resolveExpiryAlert(alert.id)
      toast.success('Đã ghi nhận xử lý hàng cận date')
      onResolved()
      onClose()
    } catch {
      toast.error('Xử lý thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Xử lý hàng cận date" size="lg">
      {/* Item header */}
      <div className="bg-white/[0.05] rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-t2" />
          <span className="font-medium text-gray-200">{alert.itemName}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-t2">
          <div>
            <span className="text-t3">Số lô:</span>{' '}
            <span className="text-gray-300">{alert.batchNumber}</span>
          </div>
          <div>
            <span className="text-t3">Hạn dùng:</span>{' '}
            <span className="text-gray-300">
              {format(alert.expiryDate.toDate(), 'dd/MM/yyyy')}
            </span>
          </div>
          <div>
            <span className="text-t3">Còn lại:</span>{' '}
            <span className={daysColor(alert.daysRemaining)}>
              {alert.daysRemaining <= 0
                ? 'Đã hết hạn'
                : `${alert.daysRemaining} ngày`}
            </span>
          </div>
        </div>
      </div>

      {/* Action radio group */}
      <div className="space-y-2 mb-5">
        {[
          {
            value: 'urgent_export',
            label: 'Xuất khẩu cấp (ưu tiên dùng trước)',
            icon: AlertTriangle,
            desc: 'Đánh dấu vật tư ưu tiên xuất kho trước các lô khác',
          },
          {
            value: 'return_supplier',
            label: 'Trả nhà cung cấp',
            icon: Truck,
            desc: 'Liên hệ nhà cung cấp để đổi/trả hàng',
          },
          {
            value: 'dispose',
            label: 'Hủy bỏ (xin phép)',
            icon: Trash2,
            desc: 'Tạo phiếu yêu cầu hủy vật tư',
          },
          {
            value: 'transfer',
            label: 'Chuyển kho khác',
            icon: Warehouse,
            desc: 'Chuyển sang kho khác có nhu cầu sử dụng',
          },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              action === opt.value
                ? 'border-amber/50 bg-amber/10'
                : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <input
              type="radio"
              name="expiry-action"
              value={opt.value}
              checked={action === opt.value}
              onChange={() => setAction(opt.value as ExpiryAction)}
              className="mt-0.5 accent-amber"
            />
            <opt.icon className="w-4 h-4 text-t2 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-200">{opt.label}</div>
              <div className="text-xs text-t2 mt-0.5">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Action-specific fields */}
      {action === 'return_supplier' && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-sm text-t2 mb-1">Nhà cung cấp</label>
            <input
              value={returnSupplier}
              onChange={(e) => setReturnSupplier(e.target.value)}
              className="input-field"
              placeholder="Tên nhà cung cấp..."
            />
          </div>
          <div>
            <label className="block text-sm text-t2 mb-1">Ngày trả</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-t2 mb-1">Lý do</label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="input-field"
              rows={2}
              placeholder="Lý do trả hàng..."
            />
          </div>
        </div>
      )}

      {action === 'dispose' && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-sm text-t2 mb-1">Lý do hủy</label>
            <textarea
              value={disposeReason}
              onChange={(e) => setDisposeReason(e.target.value)}
              className="input-field"
              rows={2}
              placeholder="Mô tả lý do hủy..."
            />
          </div>
          <div>
            <label className="block text-sm text-t2 mb-1">Người phê duyệt</label>
            <input
              value={disposeApprover}
              onChange={(e) => setDisposeApprover(e.target.value)}
              className="input-field"
              placeholder="Tên người phê duyệt..."
            />
          </div>
        </div>
      )}

      {action === 'transfer' && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-sm text-t2 mb-1">Kho đích</label>
            <input
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="input-field"
              placeholder="Tên kho đích..."
            />
          </div>
          <div>
            <label className="block text-sm text-t2 mb-1">Số lượng chuyển</label>
            <input
              type="number"
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
              className="input-field"
              placeholder="Số lượng..."
            />
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-4 h-4" />
        {submitting ? 'Đang xử lý...' : 'Xác nhận xử lý'}
      </button>
    </Modal>
  )
}

// ─── Main Expiry Alert Tab ─────────────────────────────────────────────────────

export default function ExpiryAlertTab() {
  const [alerts, setAlerts] = useState<(ExpiryAlert & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<ExpiryAlertLevel | 'all'>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<(ExpiryAlert & { id: string }) | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)

  useEffect(() => {
    const q = showResolved
      ? query(
          collection(db, 'expiryAlerts'),
          orderBy('daysRemaining', 'asc'),
        )
      : query(
          collection(db, 'expiryAlerts'),
          where('isRead', '==', false),
          orderBy('daysRemaining', 'asc'),
        )

    const unsub = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpiryAlert & { id: string })))
      setLoading(false)
    })
    return unsub
  }, [showResolved])

  const filtered = levelFilter === 'all' ? alerts : alerts.filter((a) => a.alertLevel === levelFilter)

  const criticalCount = alerts.filter((a) => a.alertLevel === 'critical').length
  const warningCount = alerts.filter((a) => a.alertLevel === 'warning').length
  const noticeCount = alerts.filter((a) => a.alertLevel === 'notice').length

  const handleMarkResolved = async (alertId: string) => {
    try {
      await resolveExpiryAlert(alertId)
      toast.success('Đã đánh dấu đã xử lý')
    } catch {
      toast.error('Thao tác thất bại')
    }
  }

  const openActionModal = (alert: ExpiryAlert & { id: string }) => {
    setSelectedAlert(alert)
    setShowActionModal(true)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-white/[0.06]" />
          ))}
        </div>
        <div className="card h-48 animate-pulse bg-white/[0.06]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-red-400">Nghiêm trọng (&lt;30d)</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{criticalCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-amber">Cảnh báo (&lt;90d)</p>
          <p className="text-2xl font-bold text-amber mt-1">{warningCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-blue-400">Chú ý (&lt;180d)</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{noticeCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-t2">Mức:</span>
        {(['all', 'critical', 'warning', 'notice'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              levelFilter === l
                ? 'bg-amber text-ink'
                : 'bg-white/[0.06] text-t2 hover:text-gray-200'
            }`}
          >
            {l === 'all' ? 'Tất cả' : l === 'critical' ? 'Nghiêm trọng' : l === 'warning' ? 'Cảnh báo' : 'Chú ý'}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-t2 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-amber"
          />
          Hiện đã xử lý
        </label>
      </div>

      {/* Alert table */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2 opacity-50" />
          <p className="text-t2 text-sm">Không có cảnh báo nào</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-desktop">
              <thead>
                <tr>
                  <th className="text-left">Mã VT</th>
                  <th className="text-left">Tên vật tư</th>
                  <th className="text-left hidden md:table-cell">Số lô</th>
                  <th className="text-left hidden lg:table-cell">Hạn dùng</th>
                  <th className="text-center">Còn lại</th>
                  <th className="text-center">Mức</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => (
                  <tr key={alert.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">{alert.itemId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-200 text-sm">{alert.itemName}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{alert.batchNumber}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs ${alert.daysRemaining <= 0 ? 'text-red-400' : 'text-t2'}`}>
                        {format(alert.expiryDate.toDate(), 'dd/MM/yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DaysBadge days={alert.daysRemaining} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge text-xs ${alertLevelColor(alert.alertLevel)}`}>
                        {alertLevelLabel(alert.alertLevel)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openActionModal(alert)}
                          className="px-2 py-1 text-xs rounded-lg bg-amber/20 text-amber hover:bg-amber/30 transition-colors"
                        >
                          Xử lý
                        </button>
                        <button
                          onClick={() => handleMarkResolved(alert.id)}
                          className="p-1.5 rounded-lg text-t3 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Đánh dấu đã xử lý"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action modal */}
      <ExpiryActionModal
        alert={selectedAlert}
        open={showActionModal}
        onClose={() => { setShowActionModal(false); setSelectedAlert(null) }}
        onResolved={() => { setSelectedAlert(null) }}
      />
    </div>
  )
}
