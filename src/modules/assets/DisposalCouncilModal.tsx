import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Check, Users, FileText, Vote, Play, Square, User, Upload, ExternalLink } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/config'
import { useAuth } from '@/contexts/AuthContext'
import {
  addDisposalCouncil,
  updateDisposalCouncil,
  updateDisposalRequest,
  updateAsset,
  setDisposalCouncilVote,
  listenDisposalRequests,
  listenDisposalCouncilVotes,
  getAllStaff,
} from '@/firebase/db'
import { createNotification } from '@/utils/createNotification'
import { toast } from '@/components/ui/Toast'
import type {
  DisposalRequest,
  DisposalCouncil,
  CouncilMember,
  CouncilChairperson,
  CouncilVote,
  VoteDecision,
  IndividualVote,
} from '@/types/firestore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

// ─── helpers ─────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  auction: 'Đấu giá công khai',
  sell_fixed_price: 'Bán giá cố định',
  transfer_to_dept: 'Điều chuyển nội bộ',
  donate: 'Hiến tặng',
  scrap: 'Thanh lý phế liệu',
  destroy: 'Tiêu hủy',
}

const REASON_LABELS: Record<string, string> = {
  broken_unrepairable: 'Hư hỏng không sửa được',
  obsolete: 'Lỗi thời',
  end_of_life: 'Hết khấu hao',
  damaged_beyond_repair: 'Hư hỏng nặng',
  regulatory_compliance: 'Không đáp ứng quy định',
  other: 'Khác',
}

const formatVND = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n.toLocaleString('vi-VN') + ' đ'

interface UserOption {
  uid: string
  displayName: string
  position: string
  dept: string
  role: string
}

// ─── member picker ────────────────────────────────────────────────────────────

function MemberPicker({ onAdd }: { onAdd: (m: CouncilMember) => void }) {
  const [staff, setStaff] = useState<UserOption[]>([])
  const [role, setRole] = useState<'member' | 'secretary' | 'appraiser'>('member')

  useEffect(() => {
    getAllStaff().then((snap) => {
      const users = snap.docs
        .map((d) => d.data() as UserOption)
        .filter((u) => u.displayName)
      setStaff(users)
    })
  }, [])

  const [selected, setSelected] = useState<UserOption | null>(null)

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="block text-xs text-t3 mb-1">Thành viên</label>
        <select
          className="input-field w-full text-sm"
          value={selected?.uid || ''}
          onChange={(e) => {
            const u = staff.find((s) => s.uid === e.target.value)
            setSelected(u || null)
          }}
        >
          <option value="">-- Chọn người --</option>
          {staff.map((s) => (
            <option key={s.uid} value={s.uid}>{s.displayName} — {s.position || s.dept}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-t3 mb-1">Vai trò</label>
        <select className="input-field text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="member">Thành viên</option>
          <option value="secretary">Thư ký</option>
          <option value="appraiser">Cán bộ định giá</option>
        </select>
      </div>
      <button
        onClick={() => {
          if (!selected) return
          onAdd({ uid: selected.uid, name: selected.displayName, position: selected.position || '', department: selected.dept, role })
          setSelected(null)
        }}
        disabled={!selected}
        className="btn-primary text-sm disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── voting section ───────────────────────────────────────────────────────────

interface MemberVotes {
  vote: IndividualVote
  comment: string
}

interface VoteState {
  [requestId: string]: Record<string, MemberVotes>
}

function VotingSection({
  request,
  members,
  councilId,
  existingVotes,
  onVoteSaved,
}: {
  request: DisposalRequest
  members: CouncilMember[]
  councilId: string
  existingVotes: CouncilVote[]
  onVoteSaved: (r: string) => void
}) {
  const [votes, setVotes] = useState<VoteState>({})
  const [decision, setDecision] = useState<VoteDecision>('approve')
  const [approvedMethod, setApprovedMethod] = useState<string>(request.proposedDisposalMethod)
  const [approvedValue, setApprovedValue] = useState(request.proposedDisposalValue)
  const [conditions, setConditions] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const existing = existingVotes.find((v) => v.requestId === request.id)

  useEffect(() => {
    if (existing) {
      const v: VoteState = {}
      v[request.id] = {}
      for (const m of members) {
        const found = existing.votes.find((vv) => vv.memberId === m.uid)
        v[request.id][m.uid] = { vote: found?.vote || 'abstain', comment: found?.comment || '' }
      }
      setVotes(v)
      setDecision(existing.finalDecision)
      setApprovedMethod(existing.method)
      setApprovedValue(existing.approvedValue)
      setConditions(existing.conditions)
      setSaved(true)
    }
  }, [existing])

  const setVote = (memberId: string, vote: IndividualVote) => {
    setVotes((prev) => ({
      ...prev,
      [request.id]: { ...(prev[request.id] || {}), [memberId]: { vote, comment: prev[request.id]?.[memberId]?.comment || '' } },
    }))
  }

  const setComment = (memberId: string, comment: string) => {
    setVotes((prev) => ({
      ...prev,
      [request.id]: { ...(prev[request.id] || {}), [memberId]: { vote: prev[request.id]?.[memberId]?.vote || 'abstain', comment } },
    }))
  }

  const voteCounts = members.reduce(
    (acc, m) => {
      const mv = votes[request.id]?.[m.uid]
      const v = mv?.vote || 'abstain'
      acc[v] = (acc[v] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const total = members.length
  const approveCount = voteCounts['approve'] || 0
  const rejectCount = voteCounts['reject'] || 0
  const abstainCount = voteCounts['abstain'] || 0

  const handleSave = async () => {
    setSaving(true)
    try {
      const voteMembers = members.map((m) => ({
        memberId: m.uid,
        memberName: m.name,
        vote: (votes[request.id]?.[m.uid]?.vote || 'abstain') as IndividualVote,
        comment: votes[request.id]?.[m.uid]?.comment || '',
        votedAt: Timestamp.now(),
      }))

      await setDisposalCouncilVote(councilId, request.id, {
        requestId: request.id,
        assetName: request.assetName,
        decision,
        method: approvedMethod,
        approvedValue,
        conditions,
        votes: voteMembers,
        finalDecision: decision,
        decisionNote: conditions,
        decidedAt: Timestamp.now(),
      })
      setSaved(true)
      onVoteSaved(request.id)
      toast.success('Đã ghi kết luận cho tài sản này')
    } catch {
      toast.error('Lưu kết luận thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-white/[0.08] rounded-xl p-4 space-y-4">
      {/* Asset summary */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold text-gray-100">{request.assetName}</p>
          <p className="text-xs text-t3 font-mono">{request.assetCode}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="badge-info text-xs">{REASON_LABELS[request.requestReason]}</span>
            <span className="badge-gray text-xs">{METHOD_LABELS[request.proposedDisposalMethod]}</span>
            <span className="text-xs text-amber font-semibold">{formatVND(request.proposedDisposalValue)}</span>
          </div>
        </div>
        {saved && <Check className="w-5 h-5 text-green-400 shrink-0 mt-1" />}
      </div>

      {/* Voting per member */}
      <div className="space-y-2">
        <h5 className="text-xs font-medium text-t3 uppercase tracking-wider">Biểu quyết</h5>
        {members.map((m) => (
          <div key={m.uid} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-medium">{m.name}</p>
              <p className="text-[10px] text-t3">{m.position} · {m.role}</p>
            </div>
            <div className="flex gap-1">
              {(['approve', 'reject', 'abstain'] as IndividualVote[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVote(m.uid, v)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    (votes[request.id]?.[m.uid]?.vote || 'abstain') === v
                      ? v === 'approve' ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                      : v === 'reject' ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                      : 'bg-white/10 text-gray-400 border border-white/20'
                      : 'bg-white/5 text-t3 hover:bg-white/10'
                  }`}
                  title={v === 'approve' ? 'Đồng ý' : v === 'reject' ? 'Từ chối' : 'Bỏ phiếu trắng'}
                >
                  {v === 'approve' ? '✓' : v === 'reject' ? '✗' : '○'}
                </button>
              ))}
            </div>
            <input
              value={votes[request.id]?.[m.uid]?.comment || ''}
              onChange={(e) => setComment(m.uid, e.target.value)}
              placeholder="Ý kiến..."
              className="input-field text-xs w-32"
            />
          </div>
        ))}
      </div>

      {/* Tally */}
      <div className="flex gap-4 text-xs">
        <span className="text-green-400">Đồng ý: {approveCount}/{total}</span>
        <span className="text-red-400">Từ chối: {rejectCount}/{total}</span>
        <span className="text-gray-400">Trắng: {abstainCount}</span>
      </div>

      {/* Decision */}
      <div className="grid grid-cols-3 gap-2">
        {(['approve', 'reject', 'defer'] as VoteDecision[]).map((d) => (
          <label
            key={d}
            className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
              decision === d
                ? d === 'approve' ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : d === 'reject' ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-amber/50 bg-amber/10 text-amber'
                : 'border-white/10 bg-white/[0.02] text-gray-400'
            }`}
          >
            <input type="radio" name={`decision_${request.id}`} value={d} checked={decision === d} onChange={() => setDecision(d)} className="hidden" />
            {d === 'approve' ? 'Phê duyệt' : d === 'reject' ? 'Từ chối' : 'Hoãn'}
          </label>
        ))}
      </div>

      {decision === 'approve' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-t3 mb-1">Hình thức thanh lý được duyệt</label>
            <select value={approvedMethod} onChange={(e) => setApprovedMethod(e.target.value)} className="input-field text-sm w-full">
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-t3 mb-1">Giá trị được duyệt (VNĐ)</label>
            <input type="number" value={approvedValue || ''} onChange={(e) => setApprovedValue(Number(e.target.value))} className="input-field text-sm w-full" />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-t3 mb-1">Điều kiện / Ghi chú của HĐ</label>
        <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} className="input-field text-sm w-full" placeholder="Điều kiện kèm theo..." />
      </div>

      <button onClick={handleSave} disabled={saving || saved} className="btn-primary text-sm disabled:opacity-40">
        {saved ? <><Check className="w-4 h-4" /> Đã ghi kết luận</> : saving ? 'Đang lưu...' : 'Ghi kết luận'}
      </button>
    </div>
  )
}

// ─── minutes preview ─────────────────────────────────────────────────────────

function MinutesPreview({ council, requests, votesMap }: {
  council: DisposalCouncil
  requests: DisposalRequest[]
  votesMap: Record<string, CouncilVote>
}) {
  return (
    <div className="bg-white text-gray-900 p-8 rounded-xl space-y-6 print:shadow-none shadow-lg" id="council-minutes">
      <div className="text-center border-b pb-4">
        <h2 className="font-bold text-base">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
        <p className="text-sm font-semibold mt-1">Độc lập – Tự do – Hạnh phúc</p>
      </div>
      <div className="text-center">
        <h1 className="font-bold text-lg">BIÊN BẢN HỌP HỘI ĐỒNG THANH LÝ TÀI SẢN</h1>
        <p className="text-sm mt-1">{council.title}</p>
      </div>
      <div className="text-sm space-y-2">
        <p><strong>Ngày họp:</strong> {council.meetingDate ? format(council.meetingDate.toDate(), 'dd/MM/yyyy', { locale: vi }) : ''}</p>
        <p><strong>Địa điểm:</strong> {council.meetingLocation}</p>
        <p><strong>Chủ tịch HĐ:</strong> {council.chairperson?.name} — {council.chairperson?.position}</p>
        <p><strong>Thành viên:</strong> {council.members.map((m) => `${m.name} (${m.role === 'secretary' ? 'Thư ký' : m.role === 'appraiser' ? 'Cán bộ định giá' : 'Thành viên'})`).join(', ')}</p>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Danh sách tài sản xem xét:</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">STT</th>
              <th className="border p-2 text-left">Mã TS</th>
              <th className="border p-2 text-left">Tên tài sản</th>
              <th className="border p-2 text-left">Lý do</th>
              <th className="border p-2 text-left">Quyết định</th>
              <th className="border p-2 text-left">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => {
              const vote = votesMap[r.id]
              return (
                <tr key={r.id}>
                  <td className="border p-2">{i + 1}</td>
                  <td className="border p-2 font-mono">{r.assetCode}</td>
                  <td className="border p-2">{r.assetName}</td>
                  <td className="border p-2">{REASON_LABELS[r.requestReason]}</td>
                  <td className="border p-2 font-semibold">
                    {vote?.finalDecision === 'approve' ? 'Phê duyệt'
                      : vote?.finalDecision === 'reject' ? 'Từ chối'
                      : vote?.finalDecision === 'defer' ? 'Hoãn' : '—'}
                  </td>
                  <td className="border p-2">{vote?.approvedValue ? formatVND(vote.approvedValue) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {council.councilDecision && (
        <div>
          <h3 className="font-semibold text-sm mb-1">Kết luận chung của Hội đồng:</h3>
          <p className="text-sm whitespace-pre-wrap">{council.councilDecision}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-8 pt-8">
        <div className="text-center">
          <p className="text-sm font-semibold">CHỦ TỊCH HỘI ĐỒNG</p>
          <p className="text-xs text-gray-500 mt-1">{council.chairperson?.name}</p>
          <div className="h-12 mt-8" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">THƯ KÝ</p>
          <p className="text-xs text-gray-500 mt-1">
            {council.members.find((m) => m.role === 'secretary')?.name || '—'}
          </p>
          <div className="h-12 mt-8" />
        </div>
      </div>
    </div>
  )
}

// ─── main modal ───────────────────────────────────────────────────────────────

type Tab = 'info' | 'voting' | 'minutes'

interface Props {
  isOpen: boolean
  onClose: () => void
  existingCouncil?: DisposalCouncil & { id: string }
}

export default function DisposalCouncilModal({ isOpen, onClose, existingCouncil }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('info')
  const [pendingRequests, setPendingRequests] = useState<(DisposalRequest & { id: string })[]>([])
  const [councilVotes, setCouncilVotes] = useState<(CouncilVote & { id: string })[]>([])
  const [staff, setStaff] = useState<UserOption[]>([])

  // Tab 1 state
  const [title, setTitle] = useState(existingCouncil?.title || `Biên bản họp HĐ thanh lý ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`)
  const [meetingDate, setMeetingDate] = useState(() => {
    if (existingCouncil?.meetingDate) {
      return format(existingCouncil.meetingDate.toDate(), "yyyy-MM-dd'T'HH:mm")
    }
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [meetingLocation, setMeetingLocation] = useState(existingCouncil?.meetingLocation || 'Phòng họp Ban Giám đốc')
  const [chairperson, setChairperson] = useState<CouncilChairperson | null>(existingCouncil?.chairperson || null)
  const [members, setMembers] = useState<CouncilMember[]>(existingCouncil?.members || [])
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>(existingCouncil?.requestIds || [])
  const [saving, setSaving] = useState(false)
  const [council, setCouncil] = useState<(DisposalCouncil & { id: string }) | null>(existingCouncil || null)

  // Tab 2 state
  const [conclusion, setConclusion] = useState(existingCouncil?.councilDecision || '')

  // Signed minutes upload
  const [signedMinutesUrl, setSignedMinutesUrl] = useState(existingCouncil?.minutesSignedUrl || '')
  const [signedMinutesUploading, setSignedMinutesUploading] = useState(false)
  const signedMinutesInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAllStaff().then((snap) => {
      setStaff(snap.docs.map((d) => d.data() as UserOption))
    })
  }, [])

  useEffect(() => {
    const unsub = listenDisposalRequests((docs) => {
      setPendingRequests(docs.filter((d) => d.status === 'pending_review' || d.status === 'in_council'))
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!council) return
    const unsub = listenDisposalCouncilVotes(council.id, (votes) => setCouncilVotes(votes))
    return unsub
  }, [council?.id])

  const addMember = (m: CouncilMember) => setMembers((prev) => [...prev, m])
  const removeMember = (uid: string) => setMembers((prev) => prev.filter((m) => m.uid !== uid))

  const handleSignedMinutesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !council) return
    setSignedMinutesUploading(true)
    try {
      const filename = `signed_minutes_${Date.now()}.${file.name.split('.').pop()}`
      const path = `disposal/councils/${council.id}/${filename}`
      const storageRef = ref(storage, path)
      const snap = await uploadBytesResumable(storageRef, file)
      const url = await getDownloadURL(snap.ref)
      await updateDisposalCouncil(council.id, { minutesSignedUrl: url })
      setSignedMinutesUrl(url)
      toast.success('Đã tải lên biên bản đã ký')
    } catch {
      toast.error('Tải lên thất bại')
    } finally {
      setSignedMinutesUploading(false)
      e.target.value = ''
    }
  }

  const handleCreateCouncil = async () => {
    if (!chairperson) { toast.error('Vui lòng chọn Chủ tịch HĐ'); return }
    if (members.length < 3) { toast.error('Cần ít nhất 3 thành viên'); return }
    if (selectedRequestIds.length === 0) { toast.error('Cần chọn ít nhất 1 tài sản để xem xét'); return }
    setSaving(true)
    try {
      const docRef = await addDisposalCouncil({
        title,
        meetingDate: Timestamp.fromDate(new Date(meetingDate)),
        meetingLocation,
        chairperson,
        members,
        requestIds: selectedRequestIds,
        status: 'scheduled',
        councilDecision: '',
        minutesUrl: null,
        minutesSignedUrl: null,
        createdBy: user!.uid,
        createdAt: Timestamp.now(),
        completedAt: null,
      })

      const newCouncil: DisposalCouncil & { id: string } = {
        id: docRef.id,
        title,
        meetingDate: Timestamp.fromDate(new Date(meetingDate)),
        meetingLocation,
        chairperson,
        members,
        requestIds: selectedRequestIds,
        status: 'scheduled',
        councilDecision: '',
        minutesUrl: null,
        minutesSignedUrl: null,
        createdBy: user!.uid,
        createdAt: Timestamp.now(),
        completedAt: null,
      }
      setCouncil(newCouncil)

      for (const reqId of selectedRequestIds) {
        await updateDisposalRequest(reqId, { status: 'in_council', councilId: docRef.id })
      }

      // Notify requesters that their request is in a council meeting
      for (const reqId of selectedRequestIds) {
        const req = pendingRequests.find((r) => r.id === reqId)
        if (req && req.requestedBy) {
          await createNotification(req.requestedBy, {
            title: `Đề xuất thanh lý: ${req.assetName}`,
            body: `Đề xuất thanh lý ${req.assetName} đã được đưa vào HĐ thanh lý ngày ${format(new Date(meetingDate), 'dd/MM/yyyy', { locale: vi })}`,
            type: 'system',
            link: `/assets?tab=disposal&req=${reqId}`,
            priority: 'medium',
          })
        }
      }

      toast.success('Hội đồng thanh lý đã được tạo')
      setTab('voting')
    } catch {
      toast.error('Tạo HĐ thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleStartMeeting = async () => {
    if (!council) return
    try {
      await updateDisposalCouncil(council.id, { status: 'in_progress' })
      setCouncil((c) => c ? { ...c, status: 'in_progress' } : c)
    } catch { toast.error('Cập nhật thất bại') }
  }

  const handleEndMeeting = async () => {
    if (!council) return
    const requestsInCouncil = pendingRequests.filter((r) => council.requestIds.includes(r.id))
    const missingVotes = requestsInCouncil.filter((r) => !councilVotes.find((v) => v.requestId === r.id))
    if (missingVotes.length > 0) {
      toast.error(`Còn ${missingVotes.length} tài sản chưa ghi kết luận`)
      return
    }

    setSaving(true)
    try {
      await updateDisposalCouncil(council.id, {
        status: 'completed',
        councilDecision: conclusion,
        completedAt: Timestamp.now(),
      })

      for (const vote of councilVotes) {
        const finalStatus = vote.finalDecision === 'approve' ? 'approved'
          : vote.finalDecision === 'reject' ? 'rejected'
          : 'pending_review'
        await updateDisposalRequest(vote.requestId, { status: finalStatus })

        // QW-8: revert asset status on rejection
        const req = requestsInCouncil.find((r) => r.id === vote.requestId)
        if (vote.finalDecision === 'reject' && req?.assetId) {
          await updateAsset(req.assetId, { status: 'active', disposalRequestId: null })
        }

        // Notify requester
        if (req && req.requestedBy) {
          await createNotification(req.requestedBy, {
            title: `Kết quả thanh lý: ${req.assetName}`,
            body: vote.finalDecision === 'approve' ? 'Đề xuất thanh lý đã được phê duyệt'
              : vote.finalDecision === 'reject' ? 'Đề xuất thanh lý bị từ chối'
              : 'Đề xuất thanh lý bị hoãn',
            type: 'system',
            link: `/assets?tab=disposal&req=${req.id}`,
            priority: 'medium',
          })
        }
      }

      toast.success('Cuộc họp đã kết thúc')
      setTab('minutes')
    } catch {
      toast.error('Kết thúc cuộc họp thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => window.print()

  if (!isOpen) return null

  const votesMap = Object.fromEntries(councilVotes.map((v) => [v.requestId, v]))
  const requestsInCouncil = council ? pendingRequests.filter((r) => council.requestIds.includes(r.id)) : []
  const allVoted = requestsInCouncil.every((r) => councilVotes.find((v) => v.requestId === r.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ink-2 rounded-2xl shadow-2xl border border-white/[0.1] w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.1] shrink-0">
          <div>
            <h3 className="font-semibold text-gray-100 text-base">Hội đồng thanh lý tài sản</h3>
            <p className="text-xs text-t3">{council ? council.title : 'Tạo cuộc họp mới'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-t3 hover:text-gray-200 hover:bg-white/[0.08] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        {council && (
          <div className="flex gap-1 px-5 py-2 border-b border-white/[0.06] shrink-0">
            {([
              { key: 'info' as Tab, label: 'Thông tin cuộc họp', icon: FileText },
              { key: 'voting' as Tab, label: 'Tiến hành xem xét', icon: Vote },
              { key: 'minutes' as Tab, label: 'Biên bản', icon: Users },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === key ? 'bg-amber/20 text-amber' : 'text-t3 hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* TAB 1: Info */}
          {tab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tên biên bản</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" placeholder="Biên bản họp HĐ thanh lý..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ngày họp</label>
                  <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Địa điểm</label>
                  <input value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} className="input-field w-full" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Chủ tịch HĐ <span className="text-red-400">*</span>
                </label>
                <select
                  className="input-field w-full"
                  value={chairperson?.uid || ''}
                  onChange={(e) => {
                    const u = staff.find((s) => s.uid === e.target.value)
                    setChairperson(u ? { uid: u.uid, name: u.displayName, position: u.position || '' } : null)
                  }}
                >
                  <option value="">-- Chọn Chủ tịch HĐ --</option>
                  {staff.map((s) => (
                    <option key={s.uid} value={s.uid}>{s.displayName} — {s.position || s.dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Thành viên (ít nhất 3)</label>
                <div className="space-y-2 mb-2">
                  {members.map((m) => (
                    <div key={m.uid} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <User className="w-4 h-4 text-t3 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200">{m.name}</p>
                        <p className="text-[10px] text-t3">{m.position} · {
                          m.role === 'secretary' ? 'Thư ký' : m.role === 'appraiser' ? 'Cán bộ định giá' : 'Thành viên'
                        }</p>
                      </div>
                      <button onClick={() => removeMember(m.uid)} className="p-1 text-t3 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <MemberPicker onAdd={addMember} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tài sản đưa vào xem xét <span className="text-red-400">*</span>
                </label>
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-t3 py-4 text-center">Không có đề xuất nào đang chờ xem xét</p>
                ) : (
                  <div className="space-y-1">
                    {pendingRequests.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedRequestIds.includes(r.id)
                            ? 'border-amber/50 bg-amber/5'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRequestIds((prev) => [...prev, r.id])
                            else setSelectedRequestIds((prev) => prev.filter((id) => id !== r.id))
                          }}
                          className="accent-amber"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium">{r.assetName}</p>
                          <p className="text-[10px] text-t3 font-mono">{r.assetCode} · {r.requestedByName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="badge-gray text-xs">{METHOD_LABELS[r.proposedDisposalMethod]}</span>
                          <p className="text-xs text-amber mt-0.5">{formatVND(r.proposedDisposalValue)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {!council && (
                <button
                  onClick={handleCreateCouncil}
                  disabled={saving || !chairperson || members.length < 3 || selectedRequestIds.length === 0}
                  className="btn-primary w-full disabled:opacity-40"
                >
                  {saving ? 'Đang tạo...' : 'Tạo Hội đồng'}
                </button>
              )}
              {council && council.status === 'scheduled' && (
                <button onClick={handleStartMeeting} className="btn-primary w-full flex items-center gap-2 justify-center">
                  <Play className="w-4 h-4" /> Bắt đầu cuộc họp
                </button>
              )}
            </div>
          )}

          {/* TAB 2: Voting */}
          {tab === 'voting' && council && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-200">Xem xét tài sản ({requestsInCouncil.length})</h4>
                <span className={`badge text-xs ${
                  council.status === 'in_progress' ? 'badge-info' : council.status === 'completed' ? 'badge-success' : 'badge-gray'
                }`}>
                  {council.status === 'in_progress' ? 'Đang họp' : council.status === 'completed' ? 'Đã hoàn thành' : 'Đã lên lịch'}
                </span>
              </div>

              {council.status === 'scheduled' && (
                <div className="p-4 rounded-xl bg-amber/5 border border-amber/20 text-sm text-amber">
                  Nhấn "Bắt đầu cuộc họp" để kích hoạt biểu quyết
                </div>
              )}

              {requestsInCouncil.map((r) => (
                <VotingSection
                  key={r.id}
                  request={r}
                  members={members}
                  councilId={council.id}
                  existingVotes={councilVotes}
                  onVoteSaved={() => {}}
                />
              ))}

              {council.status === 'in_progress' && (
                <>
                  {!allVoted && (
                    <div className="p-3 rounded-xl bg-amber/5 border border-amber/20 text-sm text-amber">
                      Cần ít nhất 3 thành viên biểu quyết trước khi kết thúc cuộc họp
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Kết luận chung của Hội đồng</label>
                    <textarea
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      rows={3}
                      className="input-field w-full text-sm"
                      placeholder="Tổng kết các quyết định của HĐ thanh lý..."
                    />
                  </div>
                  <button
                    onClick={handleEndMeeting}
                    disabled={saving || !allVoted}
                    className="btn-primary w-full disabled:opacity-40 flex items-center gap-2 justify-center"
                  >
                    <Square className="w-4 h-4" />
                    {saving ? 'Đang kết thúc...' : 'Kết thúc cuộc họp'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* TAB 3: Minutes */}
          {tab === 'minutes' && council && (
            <div className="space-y-4">
              <MinutesPreview council={council} requests={requestsInCouncil} votesMap={votesMap} />
              <div className="flex gap-2">
                <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" /> In biên bản
                </button>
              </div>

              {/* Signed document upload */}
              <div className="card p-4 border border-amber/20 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Biên bản đã ký</h4>
                {signedMinutesUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-green-400 font-medium">Đã tải lên</p>
                      <a
                        href={signedMinutesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Xem / Tải về biên bản đã ký
                      </a>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => signedMinutesInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber/30 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-t3" />
                    <p className="text-sm text-t3">Tải lên biên bản đã ký (PDF hoặc ảnh)</p>
                    <p className="text-xs text-t3">PDF, PNG, JPG — tối đa 10MB</p>
                    {signedMinutesUploading && (
                      <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin mt-2" />
                    )}
                  </div>
                )}
                <input
                  ref={signedMinutesInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleSignedMinutesUpload}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
