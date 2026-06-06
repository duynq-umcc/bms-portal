import { useState } from 'react'
import { X, Clock, CheckCircle2, FileText, Eye, ExternalLink } from 'lucide-react'
import type {
  DisposalRequest,
  DisposalCouncil,
  CouncilVote,
  DisposalExecution,
} from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatVND = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n.toLocaleString('vi-VN') + ' đ'

const REASON_LABELS: Record<string, string> = {
  broken_unrepairable: 'Hư hỏng không sửa được',
  obsolete: 'Lỗi thời công nghệ',
  end_of_life: 'Hết khấu hao, lạc hậu',
  damaged_beyond_repair: 'Hư hỏng nặng do sự cố',
  regulatory_compliance: 'Không đáp ứng quy định pháp lý',
  other: 'Lý do khác',
}

const METHOD_LABELS: Record<string, string> = {
  auction: 'Đấu giá công khai',
  sell_fixed_price: 'Bán giá cố định',
  transfer_to_dept: 'Điều chuyển nội bộ',
  donate: 'Hiến tặng / Chuyển giao',
  scrap: 'Thanh lý phế liệu',
  destroy: 'Tiêu hủy',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Nháp', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  pending_review: { label: 'Chờ xem xét', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  in_council: { label: 'Đang họp HĐ', bg: 'bg-amber/15', text: 'text-amber' },
  approved: { label: 'Được duyệt', bg: 'bg-green-500/15', text: 'text-green-400' },
  rejected: { label: 'Từ chối', bg: 'bg-red-500/15', text: 'text-red-400' },
  executed: { label: 'Đã thanh lý', bg: 'bg-teal-500/15', text: 'text-teal-400' },
  cancelled: { label: 'Đã hủy', bg: 'bg-gray-500/15', text: 'text-gray-500' },
}

const DECISION_LABELS: Record<string, string> = {
  approve: 'Phê duyệt',
  reject: 'Từ chối',
  defer: 'Hoãn',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  request: DisposalRequest & { id: string }
  council?: DisposalCouncil & { id: string }
  votes?: (CouncilVote & { id: string })[]
  execution?: DisposalExecution & { id: string }
  onAddToCouncil: () => void
  onExecute: () => void
  userRole: string
}

// ─── timeline ────────────────────────────────────────────────────────────────

interface TimelineEvent {
  label: string
  date?: Date
  actor?: string
  icon: 'draft' | 'submit' | 'council' | 'decision' | 'execute'
  color: string
}

function buildTimeline(req: DisposalRequest & { id: string }, council?: DisposalCouncil & { id: string }, execution?: DisposalExecution & { id: string }): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    label: 'Tạo đề xuất',
    date: req.createdAt?.toDate(),
    actor: req.requestedByName,
    icon: 'draft',
    color: 'bg-gray-500',
  })

  if (req.status !== 'draft') {
    events.push({
      label: 'Nộp đề xuất',
      date: req.requestedAt?.toDate(),
      actor: req.requestedByName,
      icon: 'submit',
      color: 'bg-blue-500',
    })
  }

  if (council) {
    events.push({
      label: `HĐ: ${council.title}`,
      date: council.meetingDate?.toDate(),
      actor: council.chairperson?.name,
      icon: 'council',
      color: 'bg-amber-500',
    })
  }

  if (req.status === 'approved' || req.status === 'executed') {
    events.push({
      label: 'Được HĐ phê duyệt',
      date: council?.completedAt?.toDate(),
      icon: 'decision',
      color: 'bg-green-500',
    })
  } else if (req.status === 'rejected') {
    events.push({
      label: 'HĐ từ chối',
      date: council?.completedAt?.toDate(),
      icon: 'decision',
      color: 'bg-red-500',
    })
  }

  if (execution) {
    events.push({
      label: 'Thực hiện thanh lý',
      date: execution.executionDate?.toDate(),
      actor: execution.executedByName,
      icon: 'execute',
      color: 'bg-teal-500',
    })
  }

  return events
}

// ─── photo viewer ────────────────────────────────────────────────────────────

function PhotoGrid({ photos, title }: { photos: { url: string; fileName?: string; type?: string }[]; title: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  if (photos.length === 0) return null
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-t3 uppercase tracking-wider">{title}</h4>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative group rounded-lg overflow-hidden border border-white/10 cursor-pointer" onClick={() => setLightbox(p.url)}>
            {p.type?.includes('pdf') || p.fileName?.endsWith('.pdf') ? (
              <div className="w-full aspect-square bg-white/5 flex flex-col items-center justify-center">
                <FileText className="w-6 h-6 text-t3" />
                <span className="text-[9px] text-t3 mt-1 truncate px-1">{p.fileName?.slice(0, 10) || 'file'}</span>
              </div>
            ) : (
              <img src={p.url} alt="" className="w-full aspect-square object-cover" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Eye className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-8" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export default function DisposalRequestDetail({
  isOpen,
  onClose,
  request,
  council,
  votes = [],
  execution,
  onAddToCouncil,
  onExecute,
  userRole,
}: Props) {
  if (!isOpen) return null

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.draft
  const timeline = buildTimeline(request, council, execution)
  const isAdminManager = ['admin', 'manager'].includes(userRole)
  const repairUneconomical = request.repairCostToDate > request.currentBookValue

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-ink-2 shadow-2xl border-l border-white/[0.1] flex flex-col animate-slide-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-ink-2 border-b border-white/[0.1] px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold text-gray-100">Chi tiết đề xuất thanh lý</h3>
            <p className="text-xs text-t3 mt-0.5 font-mono">{request.assetCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <span className="text-xs text-t3">
              Ngày đề xuất: {request.requestedAt ? format(request.requestedAt.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
            </span>
          </div>

          {/* Asset card */}
          <div className="card p-4 space-y-2">
            <h4 className="font-semibold text-gray-100 text-base">{request.assetName}</h4>
            <p className="text-xs text-t3 font-mono">{request.assetCode} · {request.assetCategory}</p>
            <div className="flex gap-2">
              <span className="badge-info text-xs">{request.department}</span>
              <span className="text-xs text-t3">{request.location}</span>
            </div>
          </div>

          {/* Financial */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card p-3">
              <p className="text-xs text-t3">Nguyên giá</p>
              <p className="font-bold text-gray-100 text-sm mt-1">{formatVND(request.purchasePrice)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-t3">Giá trị còn lại</p>
              <p className="font-bold text-amber text-sm mt-1">{formatVND(request.currentBookValue)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-t3">Chi phí sửa đến nay</p>
              <p className={`font-bold text-sm mt-1 ${repairUneconomical ? 'text-red-400' : 'text-gray-400'}`}>
                {formatVND(request.repairCostToDate)}
              </p>
            </div>
          </div>

          {repairUneconomical && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-400">
              Chi phí sửa chữa vượt giá trị tài sản — hợp lý để thanh lý
            </div>
          )}

          {/* Condition */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.06] pb-2">Tình trạng hư hỏng</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="badge-warning text-xs shrink-0">Lý do</span>
                <span className="text-sm text-gray-300">{REASON_LABELS[request.requestReason] || request.requestReason}</span>
              </div>
              <div>
                <p className="text-xs text-t3 mb-1">Mô tả:</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{request.conditionDescription || '—'}</p>
              </div>
              {request.repairAttempts && (
                <div>
                  <p className="text-xs text-t3 mb-1">Lịch sử sửa chữa:</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{request.repairAttempts}</p>
                </div>
              )}
            </div>
          </div>

          {/* Proposal */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.06] pb-2">Đề xuất thanh lý</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="badge-info text-xs shrink-0">Hình thức</span>
                <span className="text-sm text-gray-300">{METHOD_LABELS[request.proposedDisposalMethod] || request.proposedDisposalMethod}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-info text-xs shrink-0">Giá trị đề xuất</span>
                <span className="text-sm text-amber font-semibold">{formatVND(request.proposedDisposalValue)}</span>
              </div>
              {request.justification && (
                <div>
                  <p className="text-xs text-t3 mb-1">Lý do chi tiết:</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{request.justification}</p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <PhotoGrid
              photos={request.attachments.map((a) => ({ url: a.url, fileName: a.fileName, type: a.type }))}
              title="Hình ảnh & Tài liệu"
            />
          )}

          {/* Council decision */}
          {council && (request.status === 'in_council' || request.status === 'approved' || request.status === 'rejected' || request.status === 'executed') && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.06] pb-2">Quyết định Hội đồng</h4>
              <div className="card p-3 space-y-2">
                <p className="text-sm text-gray-200 font-medium">{council.title}</p>
                <p className="text-xs text-t3">
                  Ngày họp: {council.meetingDate ? format(council.meetingDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}
                </p>
                <p className="text-xs text-t3">Chủ tịch: {council.chairperson?.name}</p>
              </div>
              {votes.length > 0 && (
                <div className="space-y-2">
                  {votes.filter((v) => v.requestId === request.id).map((v) => (
                    <div key={v.id} className="border border-white/[0.06] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold ${
                          v.finalDecision === 'approve' ? 'text-green-400'
                          : v.finalDecision === 'reject' ? 'text-red-400'
                          : 'text-amber'
                        }`}>
                          {DECISION_LABELS[v.finalDecision]}
                        </p>
                        {v.approvedValue > 0 && (
                          <span className="text-sm text-amber">{formatVND(v.approvedValue)}</span>
                        )}
                      </div>
                      {v.conditions && <p className="text-xs text-t3 mt-1">Điều kiện: {v.conditions}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(v.votes || []).map((vv, i) => (
                          <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${
                            vv.vote === 'approve' ? 'bg-green-500/15 text-green-400'
                            : vv.vote === 'reject' ? 'bg-red-500/15 text-red-400'
                            : 'bg-white/10 text-gray-400'
                          }`}>
                            {vv.memberName} {vv.vote === 'approve' ? '✓' : vv.vote === 'reject' ? '✗' : '○'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Execution */}
          {execution && request.status === 'executed' && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.06] pb-2">Thực hiện thanh lý</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-t3">Ngày thực hiện</p>
                  <p className="text-gray-200">{execution.executionDate ? format(execution.executionDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-t3">Người thực hiện</p>
                  <p className="text-gray-200">{execution.executedByName}</p>
                </div>
                <div>
                  <p className="text-xs text-t3">Hình thức</p>
                  <p className="text-gray-200">{METHOD_LABELS[execution.disposalMethod] || execution.disposalMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-t3">Giá trị thực tế</p>
                  <p className="text-amber font-semibold">{formatVND(execution.actualDisposalValue)}</p>
                </div>
              </div>
              {execution.buyerInfo && (
                <div>
                  <p className="text-xs text-t3">Người mua / Đơn vị</p>
                  <p className="text-sm text-gray-300">{execution.buyerInfo}</p>
                </div>
              )}
              {execution.revenueReceived > 0 && (
                <div>
                  <p className="text-xs text-t3">Đã nộp kế toán</p>
                  <p className="text-sm text-green-400 font-medium">{formatVND(execution.revenueReceived)}</p>
                  {execution.revenueHandedTo && <p className="text-xs text-t3">Người nhận: {execution.revenueHandedTo}</p>}
                </div>
              )}
              {execution.executionReport && (
                <div>
                  <p className="text-xs text-t3">Mô tả</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{execution.executionReport}</p>
                </div>
              )}
              <PhotoGrid photos={execution.photos} title="Ảnh thực hiện" />
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300 border-b border-white/[0.06] pb-2">Lịch sử xử lý</h4>
            <div className="space-y-3">
              {timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${event.color}`}>
                      {event.icon === 'draft' && <FileText className="w-3.5 h-3.5 text-white" />}
                      {event.icon === 'submit' && <ExternalLink className="w-3.5 h-3.5 text-white" />}
                      {event.icon === 'council' && <Clock className="w-3.5 h-3.5 text-white" />}
                      {event.icon === 'decision' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      {event.icon === 'execute' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm text-gray-200">{event.label}</p>
                    {event.date && (
                      <p className="text-xs text-t3">{format(event.date, 'dd/MM/yyyy HH:mm', { locale: vi })}</p>
                    )}
                    {event.actor && <p className="text-xs text-t3">bởi {event.actor}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {request.status === 'draft' && (
              <>
                <button className="btn-primary w-full text-sm">Sửa đề xuất</button>
                <button className="btn-primary w-full text-sm">Nộp đề xuất</button>
                <button className="w-full px-4 py-2 rounded-xl text-sm border border-red-500/30 text-red-400 hover:bg-red-500/5 transition-colors">Xóa</button>
              </>
            )}
            {request.status === 'pending_review' && isAdminManager && (
              <button onClick={onAddToCouncil} className="btn-primary w-full text-sm flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4" /> Thêm vào HĐ thanh lý
              </button>
            )}
            {request.status === 'approved' && isAdminManager && (
              <button onClick={onExecute} className="btn-primary w-full text-sm flex items-center gap-2 justify-center">
                <CheckCircle2 className="w-4 h-4" /> Thực hiện thanh lý
              </button>
            )}
            {request.status === 'rejected' && (
              <button className="w-full px-4 py-2 rounded-xl text-sm border border-white/15 text-gray-400 hover:bg-white/[0.06] transition-colors">
                Nộp lại đề xuất mới
              </button>
            )}
            {request.status === 'executed' && (
              <button className="w-full px-4 py-2 rounded-xl text-sm border border-white/15 text-gray-400 hover:bg-white/[0.06] transition-colors">
                In biên bản thanh lý
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
