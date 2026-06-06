import { useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import DocUploadZone, { type UploadedDoc } from '@/components/ui/DocUploadZone'
import type { LegalDocs, ImportedInvoiceDoc, ImportedCustomsDoc } from '@/firebase/types'
import { Timestamp } from 'firebase/firestore'

interface Props {
  importId: string
  isImported: boolean
  onDocsChange: (docs: LegalDocs, complete: boolean, status: string) => void
  onSkip: () => void
  initialDocs?: Partial<LegalDocs>
}

interface InvoiceMeta {
  invoiceNumber: string
  invoiceDate: string
  amount: string
}

interface CustomsMeta {
  declarationNumber: string
  customsDate: string
}

const REQUIRED_IMPORTED = ['co', 'cq', 'invoice', 'customs']
const REQUIRED_DOMESTIC = ['cq', 'invoice']

export default function ImportDocPanel({
  importId,
  isImported,
  onDocsChange,
  onSkip,
  initialDocs,
}: Props) {
  const [docs, setDocs] = useState<Partial<LegalDocs>>(initialDocs ?? {})
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>({ invoiceNumber: '', invoiceDate: '', amount: '' })
  const [customsMeta, setCustomsMeta] = useState<CustomsMeta>({ declarationNumber: '', customsDate: '' })
  const [domesticNoCustoms, setDomesticNoCustoms] = useState(false)

  const requiredDocs = isImported ? REQUIRED_IMPORTED : REQUIRED_DOMESTIC

  const uploadedCount = requiredDocs.filter((t) => {
    const doc = docs[t as keyof Partial<LegalDocs>]
    return doc && 'fileUrl' in doc && !!doc.fileUrl
  }).length
  const complete = uploadedCount === requiredDocs.length

  const status = complete
    ? 'complete'
    : uploadedCount > 0
    ? 'partial'
    : 'missing'

  const notify = () => onDocsChange(docs as LegalDocs, complete, status)

  const handleUpload = (type: keyof LegalDocs) => (doc: UploadedDoc) => {
    setDocs((prev) => ({ ...prev, [type]: doc }))
    notify()
  }

  const handleDelete = (type: keyof LegalDocs) => () => {
    setDocs((prev) => {
      const updated = { ...prev }
      delete updated[type]
      return updated
    })
    notify()
  }

  const handleInvoiceMeta = (field: keyof InvoiceMeta) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoiceMeta((m) => ({ ...m, [field]: e.target.value }))
  }

  const handleInvoiceUpload = (doc: UploadedDoc) => {
    const fullDoc: ImportedInvoiceDoc = {
      ...doc,
      uploadedAt: Timestamp.now(),
      invoiceNumber: invoiceMeta.invoiceNumber,
      invoiceDate: invoiceMeta.invoiceDate
        ? Timestamp.fromDate(new Date(invoiceMeta.invoiceDate))
        : undefined,
      amount: invoiceMeta.amount ? parseFloat(invoiceMeta.amount) : undefined,
    }
    const updated = { ...docs, invoice: fullDoc }
    setDocs(updated)
    notify()
  }

  const handleCustomsUpload = (doc: UploadedDoc) => {
    const fullDoc: ImportedCustomsDoc = {
      ...doc,
      uploadedAt: Timestamp.now(),
      declarationNumber: customsMeta.declarationNumber,
      customsDate: customsMeta.customsDate
        ? Timestamp.fromDate(new Date(customsMeta.customsDate))
        : undefined,
    }
    const updated = { ...docs, customsDeclaration: fullDoc }
    setDocs(updated)
    notify()
  }

  const invoiceExtraFields = (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-[11px] text-t2 mb-0.5 block">Số hóa đơn *</label>
        <input
          value={invoiceMeta.invoiceNumber}
          onChange={handleInvoiceMeta('invoiceNumber')}
          className="input-field text-xs py-1.5"
          placeholder="Số hóa đơn"
        />
      </div>
      <div>
        <label className="text-[11px] text-t2 mb-0.5 block">Ngày hóa đơn *</label>
        <input
          type="date"
          value={invoiceMeta.invoiceDate}
          onChange={handleInvoiceMeta('invoiceDate')}
          className="input-field text-xs py-1.5"
        />
      </div>
      <div className="col-span-2">
        <label className="text-[11px] text-t2 mb-0.5 block">Giá trị (VNĐ)</label>
        <input
          type="number"
          value={invoiceMeta.amount}
          onChange={handleInvoiceMeta('amount')}
          className="input-field text-xs py-1.5"
          placeholder="Giá trị hóa đơn"
        />
      </div>
    </div>
  )

  const customsExtraFields = (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-[11px] text-t2 mb-0.5 block">Số tờ khai *</label>
        <input
          value={customsMeta.declarationNumber}
          onChange={(e) => setCustomsMeta((m) => ({ ...m, declarationNumber: e.target.value }))}
          className="input-field text-xs py-1.5"
          placeholder="Số tờ khai"
        />
      </div>
      <div>
        <label className="text-[11px] text-t2 mb-0.5 block">Ngày thông quan</label>
        <input
          type="date"
          value={customsMeta.customsDate}
          onChange={(e) => setCustomsMeta((m) => ({ ...m, customsDate: e.target.value }))}
          className="input-field text-xs py-1.5"
        />
      </div>
    </div>
  )

  const progressPct = requiredDocs.length > 0
    ? Math.round((uploadedCount / requiredDocs.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-200">Hồ sơ pháp lý nhập kho</h3>
        <p className="text-xs text-t2 mt-0.5">Đính kèm chứng từ theo quy định nhập khẩu</p>
      </div>

      {/* Completeness indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-t2">{uploadedCount}/{requiredDocs.length} chứng từ</span>
          {complete ? (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đầy đủ
            </span>
          ) : (
            <span className="text-amber flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {requiredDocs.length - uploadedCount} còn thiếu
            </span>
          )}
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              complete ? 'bg-green-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Document upload zones */}
      <div className="space-y-3">
        {/* CO */}
        <DocUploadZone
          docType="co"
          docLabel="Chứng nhận xuất xứ (CO)"
          required={isImported}
          importId={importId}
          currentDoc={docs.co}
          onUploaded={handleUpload('co')}
          onDeleted={handleDelete('co')}
        />

        {/* CQ */}
        <DocUploadZone
          docType="cq"
          docLabel="Chứng nhận chất lượng / Phiếu kiểm nghiệm"
          required={true}
          importId={importId}
          currentDoc={docs.cq}
          onUploaded={handleUpload('cq')}
          onDeleted={handleDelete('cq')}
        />

        {/* Invoice */}
        <DocUploadZone
          docType="invoice"
          docLabel="Hóa đơn GTGT / Commercial Invoice"
          required={true}
          importId={importId}
          currentDoc={docs.invoice}
          onUploaded={handleInvoiceUpload}
          onDeleted={handleDelete('invoice')}
          extraFields={docs.invoice?.fileUrl ? invoiceExtraFields : undefined}
        />

        {/* Customs Declaration */}
        {isImported && !domesticNoCustoms && (
          <DocUploadZone
            docType="customs"
            docLabel="Tờ khai hải quan"
            required={true}
            importId={importId}
            currentDoc={docs.customsDeclaration}
            onUploaded={handleCustomsUpload}
            onDeleted={handleDelete('customsDeclaration')}
            extraFields={docs.customsDeclaration?.fileUrl ? customsExtraFields : undefined}
          />
        )}

        {isImported && !domesticNoCustoms && !docs.customsDeclaration && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-t2 cursor-pointer">
              <input
                type="checkbox"
                checked={domesticNoCustoms}
                onChange={(e) => setDomesticNoCustoms(e.target.checked)}
                className="accent-amber"
              />
              Hàng nội địa — không cần tờ khai hải quan
            </label>
          </div>
        )}

        {/* Delivery Note */}
        <DocUploadZone
          docType="delivery"
          docLabel="Biên bản bàn giao / Phiếu xuất kho nhà cung cấp"
          required={false}
          importId={importId}
          currentDoc={docs.deliveryNote}
          onUploaded={handleUpload('deliveryNote')}
          onDeleted={handleDelete('deliveryNote')}
        />
      </div>

      {/* Skip option */}
      {!complete && (
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={onSkip}
            className="flex items-center gap-2 text-xs text-amber hover:text-amber-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Bỏ qua — nộp sau
          </button>
          <p className="text-[11px] text-t3 mt-1">
            Cần bổ sung trong vòng 3 ngày làm việc
          </p>
        </div>
      )}
    </div>
  )
}
