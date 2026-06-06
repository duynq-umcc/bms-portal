import { useState } from 'react'
import { X, Eye, Download, CheckCircle2, XCircle, Minus, Upload, FileText } from 'lucide-react'
import DocUploadZone, { type UploadedDoc } from '@/components/ui/DocUploadZone'
import type { InventoryTransaction, LegalDocs, ImportedDoc, ImportedInvoiceDoc, ImportedCustomsDoc } from '@/firebase/types'
import { updateInventoryTransaction } from '@/firebase/db'
import { format } from 'date-fns'

interface Props {
  transaction: InventoryTransaction
  onClose: () => void
  onUpdated: () => void
}

interface DocCard {
  key: keyof LegalDocs
  label: string
  required: boolean
  doc?: ImportedDoc | ImportedInvoiceDoc | ImportedCustomsDoc | null
}

const DOC_LABELS: Record<string, string> = {
  co: 'Chứng nhận xuất xứ (CO)',
  cq: 'Chứng nhận chất lượng (CQ)',
  invoice: 'Hóa đơn',
  customsDeclaration: 'Tờ khai hải quan',
  deliveryNote: 'Biên bản bàn giao',
}

export default function ImportDocViewer({ transaction, onClose, onUpdated }: Props) {
  const [uploadMode, setUploadMode] = useState<keyof LegalDocs | null>(null)

  const docs = transaction.legalDocs ?? {}
  const status = transaction.legalDocsStatus ?? 'missing'

  const allRequired = ['co', 'cq', 'invoice', 'customs']
  const uploadedRequired = allRequired.filter((k) => docs[k as keyof LegalDocs]?.fileUrl)
  const uploadedCount = uploadedRequired.length

  const statusLabel = {
    missing: 'Chưa có hồ sơ',
    partial: `Thiếu ${allRequired.length - uploadedCount} chứng từ`,
    complete: 'Đầy đủ',
    verified: 'Đã xác minh',
  }[status] ?? status

  const statusColor = {
    missing: 'badge-danger',
    partial: 'bg-amber-500/20 text-amber',
    complete: 'badge-success',
    verified: 'bg-teal-500/20 text-teal-400',
  }[status] ?? 'bg-white/10 text-gray-400'

  const handleUpload =
    (type: keyof LegalDocs) =>
    async (doc: UploadedDoc) => {
      try {
        await updateInventoryTransaction(transaction.id, {
          legalDocs: { ...docs, [type]: { fileUrl: doc.fileUrl, fileName: doc.fileName, uploadedAt: doc.uploadedAt, fileSize: doc.fileSize } },
        })
        setUploadMode(null)
        onUpdated()
      } catch (e: any) {
        console.error('Upload update failed:', e)
      }
    }

  const handleDelete =
    (type: keyof LegalDocs) =>
    async () => {
      const updated = { ...docs }
      delete updated[type]
      await updateInventoryTransaction(transaction.id, { legalDocs: updated })
      setUploadMode(null)
      onUpdated()
    }

  const docCards: DocCard[] = [
    { key: 'co', label: DOC_LABELS.co, required: false, doc: docs.co },
    { key: 'cq', label: DOC_LABELS.cq, required: true, doc: docs.cq },
    { key: 'invoice', label: DOC_LABELS.invoice, required: true, doc: docs.invoice },
    { key: 'customsDeclaration', label: DOC_LABELS.customsDeclaration, required: false, doc: docs.customsDeclaration },
    { key: 'deliveryNote', label: DOC_LABELS.deliveryNote, required: false, doc: docs.deliveryNote },
  ]

  const handlePrint = () => {
    const printContent = `
      <html><head><title>Hồ sơ nhập kho ${transaction.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        .doc { margin-bottom: 12px; padding: 12px; border-left: 3px solid #ccc; }
        .doc.uploaded { border-color: #22c55e; }
        .doc.missing { border-color: #ef4444; }
        .doc.missing-optional { border-color: #9ca3af; }
        .doc-name { font-weight: bold; margin-bottom: 4px; }
        .doc-file { color: #666; font-size: 13px; }
        .doc-link { color: #3b82f6; font-size: 13px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-top: 8px; }
        .badge.complete { background: #dcfce7; color: #16a34a; }
        .badge.partial { background: #fef3c7; color: #d97706; }
        .badge.missing { background: #fee2e2; color: #dc2626; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h1>Hồ sơ nhập kho — ${transaction.id}</h1>
        <p><strong>Vật tư:</strong> ${transaction.itemName ?? transaction.itemId}</p>
        <p><strong>Ngày:</strong> ${transaction.date ? format(transaction.date.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
        <p><strong>Nhà cung cấp:</strong> ${transaction.supplier ?? 'N/A'}</p>
        <p><strong>Tình trạng:</strong> <span class="badge ${status}">${statusLabel}</span></p>
        <hr style="margin: 20px 0;"/>
        ${docCards.map((card) => {
          const isUploaded = !!card.doc?.fileUrl
          const borderClass = isUploaded ? 'uploaded' : card.required ? 'missing' : 'missing-optional'
          return `
          <div class="doc ${borderClass}">
            <div class="doc-name">${card.label}${card.required ? ' (bắt buộc)' : ''}</div>
            ${isUploaded
              ? `<div class="doc-file">${card.doc!.fileName}</div>
                 <div class="doc-link">${card.doc!.fileUrl}</div>`
              : `<div class="doc-file" style="color: ${card.required ? '#dc2626' : '#9ca3af'}">Chưa có</div>`
            }
          </div>`
        }).join('')}
        <hr style="margin: 20px 0;"/>
        <p style="color:#666;font-size:11px;">In lúc: ${new Date().toLocaleString('vi-VN')}</p>
      </body></html>
    `
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(printContent)
      w.document.close()
      w.onload = () => w.print()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[#0f1419] border-l border-white/10 flex flex-col overflow-hidden"
        style={{ maxHeight: '100vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-xs font-mono text-t2">{transaction.id}</p>
            <p className="text-sm font-semibold text-gray-200 mt-0.5">
              {transaction.itemName ?? transaction.itemId}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-t3 hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-white/[0.06] shrink-0">
          <span className="text-xs text-t2">
            {transaction.date ? format(transaction.date.toDate(), 'dd/MM/yyyy HH:mm') : '—'}
          </span>
          <span className="text-xs text-t3">·</span>
          <span className="text-xs text-t2">{transaction.supplier ?? '—'}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Doc grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {docCards.map((card) => {
            const isUploaded = !!card.doc?.fileUrl
            const isUploading = uploadMode === card.key
            const borderColor = isUploaded
              ? 'border-l-amber'
              : card.required
              ? 'border-l-red-500'
              : 'border-l-gray-600'

            return (
              <div
                key={card.key}
                className={`rounded-xl border border-white/[0.06] border-l-[3px] ${borderColor} bg-white/[0.02] p-3`}
              >
                <div className="flex items-start gap-2 mb-1">
                  {isUploaded ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : card.required ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs font-medium text-gray-300">{card.label}</span>
                  {card.required && !isUploaded && (
                    <span className="text-[10px] text-red-400 ml-auto">Bắt buộc</span>
                  )}
                </div>

                {isUploaded ? (
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-gray-400 truncate" title={card.doc!.fileName}>
                      {card.doc!.fileName}
                    </p>
                    {card.doc!.uploadedAt && (
                      <p className="text-[11px] text-t3">
                        {format(card.doc!.uploadedAt.toDate(), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                    <div className="flex gap-2 mt-1.5">
                      <button
                        onClick={() => window.open(card.doc!.fileUrl, '_blank')}
                        className="flex items-center gap-1 text-[11px] text-amber hover:text-amber-400 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem file
                      </button>
                      <a
                        href={card.doc!.fileUrl}
                        download={card.doc!.fileName}
                        className="flex items-center gap-1 text-[11px] text-t2 hover:text-gray-200 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Tải xuống
                      </a>
                    </div>
                    {card.key === 'invoice' && (card.doc as ImportedInvoiceDoc)?.invoiceNumber && (
                      <div className="mt-1.5 text-[11px] text-t2 space-y-0.5">
                        {(card.doc as ImportedInvoiceDoc).invoiceNumber && (
                          <p>Số: {(card.doc as ImportedInvoiceDoc).invoiceNumber}</p>
                        )}
                        {(card.doc as ImportedInvoiceDoc).amount !== undefined && (
                          <p>Giá trị: {(card.doc as ImportedInvoiceDoc).amount?.toLocaleString('vi-VN')} đ</p>
                        )}
                      </div>
                    )}
                    {card.key === 'customsDeclaration' && (card.doc as ImportedCustomsDoc)?.declarationNumber && (
                      <p className="mt-1.5 text-[11px] text-t2">
                        Số tờ khai: {(card.doc as ImportedCustomsDoc).declarationNumber}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="ml-6">
                    <p className={`text-[11px] ${card.required ? 'text-red-400' : 'text-t3'}`}>
                      Chưa có
                    </p>
                    {status !== 'complete' && (
                      <button
                        onClick={() => setUploadMode(isUploading ? null : card.key)}
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-amber hover:text-amber-400 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Tải lên ngay
                      </button>
                    )}
                  </div>
                )}

                {isUploading && (
                  <div className="mt-3">
                    <DocUploadZone
                      docType={card.key as 'co' | 'cq' | 'invoice' | 'customs' | 'delivery'}
                      docLabel=""
                      required={false}
                      importId={transaction.id}
                      currentDoc={null}
                      onUploaded={handleUpload(card.key)}
                      onDeleted={handleDelete(card.key)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-t2">{uploadedCount}/4 chứng từ bắt buộc</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <button
            onClick={handlePrint}
            className="btn-secondary text-xs w-full flex items-center justify-center gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            Xuất PDF hồ sơ
          </button>
        </div>
      </div>
    </div>
  )
}
