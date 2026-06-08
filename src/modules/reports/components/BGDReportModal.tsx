import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { addReport, listenReports } from '@/firebase/db'
import { toast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { Save, Printer, Info } from 'lucide-react'
import { format } from 'date-fns'
import { useSystemKpis } from '@/hooks/useSystemKpis'

interface BGDReportModalProps {
  open: boolean
  onClose: () => void
  defaultMonth?: string
  defaultYear?: number
  existingReportId?: string
}

export default function BGDReportModal({ open, onClose, defaultMonth, defaultYear }: BGDReportModalProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'general' | 'kpi' | 'cost' | 'notes'>('general')

  const now = new Date()
  const [month, setMonth] = useState(defaultMonth ?? String(now.getMonth() + 1))
  const [year, setYear] = useState(defaultYear ?? now.getFullYear())

  const { kpis: systemKpis } = useSystemKpis({ month, year })

  const [general, setGeneral] = useState({
    hospitalName: 'Bệnh viện đa khoa',
    department: 'Phòng Vật tư - Tài chính',
    reportCode: '',
    preparedBy: user?.displayName ?? '',
    reviewedBy: '',
    approvedBy: '',
  })

  const [kpis, setKpis] = useState({
    uptime: 99,
    workOrderCompletion: 95,
    energyEfficiency: 95,
    complianceRate: 100,
    assetUtilization: 95,
    incidentCount: 0,
    deviceOnTime: 98,
    workOrderOnTime: 95,
    inventoryAccuracy: 99,
    fireIncidents: 100,
  })

  const [costs, setCosts] = useState({
    electricity: 0,
    water: 0,
    medicalDevices: 0,
    maintenance: 0,
    civilWorks: 0,
    other: 0,
  })

  const [notes, setNotes] = useState('')

  // P2.1: Pre-fill KPIs and costs when system data or month/year changes
  useEffect(() => {
    setKpis({
      uptime: systemKpis.uptime,
      workOrderCompletion: systemKpis.workOrderCompletion,
      energyEfficiency: 95,
      complianceRate: systemKpis.complianceRate,
      assetUtilization: 95,
      incidentCount: systemKpis.totalIncidents,
      deviceOnTime: systemKpis.deviceOnTime,
      workOrderOnTime: systemKpis.workOrderOnTime,
      inventoryAccuracy: systemKpis.inventoryAccuracy,
      fireIncidents: systemKpis.fireIncidents,
    })
  }, [systemKpis])

  // P2.1: Pre-fill costs from existing report if one exists for this period
  useEffect(() => {
    const unsub = listenReports((reports) => {
      const existing = reports.find(
        (r) => r.month === month && String(r.year) === String(year)
      )
      if (existing) {
        setCosts({
          electricity: existing.costs.electricity ?? 0,
          water: existing.costs.water ?? 0,
          medicalDevices: existing.costs.medicalDevices ?? 0,
          maintenance: existing.costs.maintenance ?? 0,
          civilWorks: existing.costs.civilWorks ?? 0,
          other: existing.costs.other ?? 0,
        })
      }
    })
    return unsub
  }, [month, year])

  // P2.1: Keep report code in sync with month/year
  useEffect(() => {
    setGeneral((g) => ({ ...g, reportCode: `BGĐ-${year}-${month.padStart(2, '0')}` }))
  }, [month, year])

  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0)

  const handleSave = async () => {
    if (!general.preparedBy.trim()) { toast.error('Người lập không được để trống'); return }
    if (!general.reportCode.trim()) { toast.error('Mã báo cáo không được để trống'); return }
    setSaving(true)
    try {
      await addReport({
        month,
        year,
        kpis,
        costs: { ...costs, total: totalCost },
        notes,
      })
      toast.success('Đã lưu báo cáo BGĐ')
      onClose()
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { id: 'general' as const, label: 'Thông tin chung' },
    { id: 'kpi' as const, label: 'Chỉ số KPI' },
    { id: 'cost' as const, label: 'Chi phí' },
    { id: 'notes' as const, label: 'Ghi chú' },
  ]

  const formatVND = (n: number) => n.toLocaleString('vi-VN')

  return (
    <Modal open={open} onClose={onClose} title="Lập Báo cáo BGĐ" size="lg">
      <div className="space-y-4">
        {/* Section tabs */}
        <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeSection === s.id ? 'bg-amber/15 text-amber' : 'text-t2 hover:text-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── General ── */}
        {activeSection === 'general' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber/5 border border-amber/20 rounded-lg">
              <Info className="w-4 h-4 text-amber shrink-0 mt-0.5" />
              <p className="text-xs text-amber/80">
                Báo cáo BGĐ (Báo cáo Định kỳ) được lập hàng tháng theo quy định của bệnh viện.
                Dữ liệu KPI và chi phí sẽ được tự động điền từ hệ thống BMS.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tên bệnh viện</label>
                <input
                  value={general.hospitalName}
                  onChange={(e) => setGeneral((g) => ({ ...g, hospitalName: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Khoa/Phòng</label>
                <input
                  value={general.department}
                  onChange={(e) => setGeneral((g) => ({ ...g, department: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tháng *</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="input-field"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0')
                    return <option key={m} value={m}>{m}/{year}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Năm *</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="input-field"
                  min={2020}
                  max={2100}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Mã báo cáo</label>
                <input
                  value={general.reportCode}
                  onChange={(e) => setGeneral((g) => ({ ...g, reportCode: e.target.value }))}
                  className="input-field font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ngày lập</label>
                <input value={format(now, 'dd/MM/yyyy')} className="input-field" readOnly />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Người lập *</label>
                <input
                  value={general.preparedBy}
                  onChange={(e) => setGeneral((g) => ({ ...g, preparedBy: e.target.value }))}
                  className="input-field"
                  placeholder="Họ tên người lập..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Người kiểm tra</label>
                <input
                  value={general.reviewedBy}
                  onChange={(e) => setGeneral((g) => ({ ...g, reviewedBy: e.target.value }))}
                  className="input-field"
                  placeholder="Họ tên người kiểm tra..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Người duyệt</label>
                <input
                  value={general.approvedBy}
                  onChange={(e) => setGeneral((g) => ({ ...g, approvedBy: e.target.value }))}
                  className="input-field"
                  placeholder="Họ tên người duyệt..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ── KPI ── */}
        {activeSection === 'kpi' && (
          <div className="space-y-3">
            <p className="text-xs text-t3">Điền các chỉ số KPI đạt được trong tháng {month}/{year}.</p>
            {[
              { key: 'uptime', label: 'Uptime hệ thống kỹ thuật', target: 99 },
              { key: 'deviceOnTime', label: 'TTBYT hoạt động đúng hẹn', target: 98 },
              { key: 'workOrderOnTime', label: 'Work orders hoàn thành đúng hạn', target: 95 },
              { key: 'inventoryAccuracy', label: 'Độ chính xác tồn kho', target: 99 },
              { key: 'fireIncidents', label: 'Không có sự cố PCCC', target: 100 },
              { key: 'complianceRate', label: 'Tỷ lệ tuân thủ quy định', target: 100 },
            ].map((item) => (
              <div key={item.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-300">{item.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={kpis[item.key as keyof typeof kpis]}
                      onChange={(e) => setKpis((k) => ({ ...k, [item.key]: Number(e.target.value) }))}
                      className="input-field w-20 text-right text-sm"
                    />
                    <span className="text-xs text-t3">% (mục tiêu: {item.target}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${kpis[item.key as keyof typeof kpis] >= item.target ? 'bg-green-500' : 'bg-amber'}`}
                    style={{ width: `${kpis[item.key as keyof typeof kpis]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cost ── */}
        {activeSection === 'cost' && (
          <div className="space-y-3">
            <p className="text-xs text-t3">Điền chi phí phát sinh trong tháng {month}/{year} (VNĐ).</p>
            {[
              { key: 'electricity', label: 'Chi phí điện' },
              { key: 'water', label: 'Chi phí nước' },
              { key: 'medicalDevices', label: 'Vật tư Y tế / TTBYT' },
              { key: 'maintenance', label: 'Chi phí bảo trì' },
              { key: 'civilWorks', label: 'Chi phí xây dựng / sửa chữa' },
              { key: 'other', label: 'Chi phí khác' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <label className="text-sm text-gray-300 w-48 shrink-0">{item.label}</label>
                <input
                  type="number"
                  min={0}
                  value={costs[item.key as keyof typeof costs]}
                  onChange={(e) => setCosts((c) => ({ ...c, [item.key]: Number(e.target.value) }))}
                  className="input-field flex-1 text-right"
                  placeholder="0"
                />
                <span className="text-xs text-t3 w-8">VNĐ</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
              <span className="text-sm font-semibold text-gray-100">TỔNG CHI PHÍ</span>
              <span className="text-lg font-bold text-amber">{formatVND(totalCost)} đ</span>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {activeSection === 'notes' && (
          <div className="space-y-3">
            <p className="text-xs text-t3">Ghi chú, nhận xét hoặc kiến nghị (nếu có).</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full"
              rows={8}
              placeholder="Nhập ghi chú hoặc để trống..."
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu Báo cáo'}
          </button>
          <button
            onClick={window.print}
            className="btn-secondary flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            In
          </button>
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>

        {/* P2.2: Print-only layout — rendered in a hidden div, shown via @media print */}
        <div className="hidden print:block p-8 bg-white text-black">
          <style>{`
            @media print {
              .print-report * { color: black !important; background: white !important; }
              .print-report { font-family: 'Times New Roman', serif; }
              .print-report h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 8pt; }
              .print-report h2 { font-size: 12pt; font-weight: bold; margin-top: 12pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
              .print-report table { width: 100%; border-collapse: collapse; margin-top: 6pt; }
              .print-report th, .print-report td { border: 1px solid #ccc; padding: 4pt 6pt; font-size: 10pt; }
              .print-report th { background: #f0f0f0; }
              .print-report .sign-row { display: flex; justify-content: space-between; margin-top: 24pt; }
              .print-report .sign-cell { width: 30%; text-align: center; }
              .print-report .sign-cell p { margin-top: 40pt; font-size: 10pt; }
            }
          `}</style>
          <div className="print-report">
            <h1>BÁO CÁO ĐỊNH KỲ</h1>
            <p style={{ textAlign: 'center', marginBottom: 12 }}>{general.hospitalName} — {general.department}</p>
            <p style={{ textAlign: 'center', marginBottom: 12 }}>Tháng {month}/{year} · Mã: {general.reportCode}</p>

            <h2>I. THÔNG TIN CHUNG</h2>
            <table>
              <tbody>
                <tr><td style={{ fontWeight: 'bold', width: '30%' }}>Người lập</td><td>{general.preparedBy}</td></tr>
                <tr><td style={{ fontWeight: 'bold' }}>Người kiểm tra</td><td>{general.reviewedBy || '—'}</td></tr>
                <tr><td style={{ fontWeight: 'bold' }}>Người duyệt</td><td>{general.approvedBy || '—'}</td></tr>
                <tr><td style={{ fontWeight: 'bold' }}>Ngày lập</td><td>{format(now, 'dd/MM/yyyy')}</td></tr>
              </tbody>
            </table>

            <h2>II. CHỈ SỐ KPI ĐẠT ĐƯỢC</h2>
            <table>
              <thead><tr><th>Chỉ số</th><th>Đạt được</th><th>Mục tiêu</th></tr></thead>
              <tbody>
                {[
                  { label: 'Uptime hệ thống kỹ thuật', actual: kpis.uptime, target: 99 },
                  { label: 'TTBYT hoạt động đúng hẹn', actual: kpis.deviceOnTime, target: 98 },
                  { label: 'Work orders hoàn thành đúng hạn', actual: kpis.workOrderOnTime, target: 95 },
                  { label: 'Độ chính xác tồn kho', actual: kpis.inventoryAccuracy, target: 99 },
                  { label: 'Không có sự cố PCCC', actual: kpis.fireIncidents, target: 100 },
                  { label: 'Tỷ lệ tuân thủ quy định', actual: kpis.complianceRate, target: 100 },
                ].map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td style={{ textAlign: 'center' }}>{item.actual}%</td>
                    <td style={{ textAlign: 'center' }}>{item.target}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>III. CHI PHÍ VÀ NGUỒN LỰC</h2>
            <table>
              <tbody>
                {([
                  { label: 'Chi phí điện', value: costs.electricity },
                  { label: 'Chi phí nước', value: costs.water },
                  { label: 'Vật tư Y tế / TTBYT', value: costs.medicalDevices },
                  { label: 'Chi phí bảo trì', value: costs.maintenance },
                  { label: 'Chi phí xây dựng / sửa chữa', value: costs.civilWorks },
                  { label: 'Chi phí khác', value: costs.other },
                ] as { label: string; value: number }[]).map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(item.value)} đ</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold' }}>
                  <td>TỔNG CHI PHÍ</td>
                  <td style={{ textAlign: 'right' }}>{formatVND(totalCost)} đ</td>
                </tr>
              </tbody>
            </table>

            {notes && (
              <>
                <h2>IV. GHI CHÚ</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{notes}</p>
              </>
            )}

            <div className="sign-row">
              <div className="sign-cell"><p>Người lập</p><p>{general.preparedBy}</p></div>
              <div className="sign-cell"><p>Người kiểm tra</p><p>{general.reviewedBy || ' '}</p></div>
              <div className="sign-cell"><p>Người duyệt</p><p>{general.approvedBy || ' '}</p></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
