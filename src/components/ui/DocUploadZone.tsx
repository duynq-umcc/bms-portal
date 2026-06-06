import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Image, Eye, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react'
import { uploadImportDoc, deleteImportDoc, formatFileSize, isAllowedFileType } from '@/utils/storageUpload'
import type { ImportedDoc } from '@/firebase/types'
import { toast } from '@/components/ui/Toast'

export type DocType = 'co' | 'cq' | 'invoice' | 'customs' | 'delivery'

export interface UploadedDoc extends ImportedDoc {
  fileSize?: number
}

interface Props {
  docType: DocType
  docLabel: string
  required?: boolean
  importId: string
  currentDoc?: UploadedDoc | null
  onUploaded: (doc: UploadedDoc) => void
  onDeleted: () => void
  disabled?: boolean
  extraFields?: React.ReactNode
}

type State = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'

export default function DocUploadZone({
  docType,
  docLabel,
  required = false,
  importId,
  currentDoc,
  onUploaded,
  onDeleted,
  disabled = false,
  extraFields,
}: Props) {
  const [state, setState] = useState<State>(currentDoc ? 'done' : 'idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [retryDoc, setRetryDoc] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const taskRef = useRef<{ cancel: () => void } | null>(null)

  const triggerPick = () => {
    if (!disabled && state !== 'uploading') inputRef.current?.click()
  }

  const handleFile = useCallback(async (file: File) => {
    if (!isAllowedFileType(file)) {
      setErrorMsg('Chỉ chấp nhận file PDF, JPG, PNG, WebP')
      setState('error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(`File quá lớn — tối đa 10MB (hiện tại: ${formatFileSize(file.size)})`)
      setState('error')
      return
    }

    setErrorMsg('')
    setProgress(0)
    setState('uploading')

    try {
      const url = await uploadImportDoc(importId, docType, file, (pct) => {
        setProgress(pct)
      })
      const doc: UploadedDoc = {
        fileUrl: url,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: undefined,
      }
      onUploaded(doc)
      setState('done')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Tải lên thất bại')
      setRetryDoc(file)
      setState('error')
    }
  }, [importId, docType, onUploaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDelete = async () => {
    if (!currentDoc) return
    try {
      // Store full storage path as a custom field so we can delete
      const filename = currentDoc.fileUrl.split('/').slice(-2).join('/')
      await deleteImportDoc(importId, filename)
      onDeleted()
      setState('idle')
      setProgress(0)
      setErrorMsg('')
      setRetryDoc(null)
    } catch {
      toast.error('Xóa file thất bại')
    }
  }

  const handleRetry = () => {
    if (retryDoc) handleFile(retryDoc)
  }

  const isImage = currentDoc?.fileName && /\.(jpg|jpeg|png|webp)$/i.test(currentDoc.fileName)

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-300">
          {docLabel}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      </div>

      {/* Idle / Dragging */}
      {(state === 'idle' || state === 'dragging') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setState('dragging') }}
          onDragLeave={() => setState('idle')}
          onDrop={handleDrop}
          onClick={triggerPick}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors cursor-pointer
            ${state === 'dragging'
              ? 'border-amber bg-amber-500/10'
              : 'border-white/15 hover:border-white/25 bg-white/[0.02]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ minHeight: 80 }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled}
          />
          <Upload className={`w-5 h-5 ${state === 'dragging' ? 'text-amber' : 'text-t2'}`} />
          <span className={`text-xs ${state === 'dragging' ? 'text-amber' : 'text-t2'}`}>
            {state === 'dragging' ? 'Thả file vào đây' : 'Kéo thả hoặc click để chọn file'}
          </span>
          <span className="text-[11px] text-t3">PDF, JPG, PNG — tối đa 10MB</span>
        </div>
      )}

      {/* Uploading */}
      {state === 'uploading' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-t2">Đang tải lên... {progress}%</span>
            <button
              onClick={() => {
                taskRef.current?.cancel()
                setState('idle')
                setProgress(0)
              }}
              className="p-1 text-t3 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Done */}
      {state === 'done' && currentDoc && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              <Image className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-green-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate" title={currentDoc.fileName}>
                {currentDoc.fileName}
              </p>
              <p className="text-[11px] text-t2">
                {currentDoc.fileSize ? formatFileSize(currentDoc.fileSize) : ''}
                {currentDoc.uploadedAt
                  ? ` · ${currentDoc.uploadedAt.toDate().toLocaleString('vi-VN')}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => window.open(currentDoc.fileUrl, '_blank')}
                className="p-1.5 text-t3 hover:text-gray-200 transition-colors"
                title="Xem file"
              >
                <Eye className="w-4 h-4" />
              </button>
              {!disabled && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-t3 hover:text-red-400 transition-colors"
                  title="Xóa file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {extraFields && <div className="mt-3 pt-3 border-t border-white/[0.06]">{extraFields}</div>}
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-400">Tải lên thất bại: {errorMsg}</p>
              <button
                onClick={handleRetry}
                className="mt-2 flex items-center gap-1.5 text-xs text-amber hover:text-amber-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Thử lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
