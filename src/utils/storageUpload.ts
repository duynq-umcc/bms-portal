import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from 'firebase/storage'
import { storage } from '../firebase/config'

export interface UploadProgress {
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

export async function uploadImportDoc(
  importId: string,
  docType: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const ext = file.name.split('.').pop()
  const filename = `${docType}_${Date.now()}.${ext}`
  const path = `documents/imports/${importId}/${filename}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        docType,
        originalName: file.name,
        importId,
      },
    })

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        onProgress?.(pct)
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

export async function deleteImportDoc(
  _importId: string,
  _filename: string
): Promise<void> {
  // Path is constructed from importId + filename — we store full path in filename
  const path = _filename
  await deleteObject(ref(storage, path))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export function isAllowedFileType(file: File): boolean {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  return allowed.includes(file.type)
}

// ──────────────────────────────────────────────────────────────────────────────
// Disposal Workflow Storage (P2.2)
// ──────────────────────────────────────────────────────────────────────────────

export async function uploadDisposalRequestDoc(
  requestId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const path = `disposal/requests/${requestId}/${filename}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: { originalName: file.name, requestId },
    })
    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        onProgress?.(pct)
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

export async function uploadDisposalCouncilDoc(
  councilId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const path = `disposal/councils/${councilId}/${filename}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: { originalName: file.name, councilId },
    })
    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        onProgress?.(pct)
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

export async function deleteDisposalStorageFile(fullPath: string): Promise<void> {
  await deleteObject(ref(storage, fullPath))
}
