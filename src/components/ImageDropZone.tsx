import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import type { T } from '../i18n/translations'

interface ImageDropZoneProps {
  onFileAccepted: (file: File) => void
  disabled?: boolean
  currentFile?: File | null
  t: T
}

const ACCEPTED_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}
const MAX_SIZE = 20 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ImageDropZone({ onFileAccepted, disabled, currentFile, t }: ImageDropZoneProps) {
  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) onFileAccepted(files[0])
  }, [onFileAccepted])

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxSize: MAX_SIZE, maxFiles: 1, disabled,
  })

  const rejectionMsg = fileRejections[0]?.errors[0]?.code === 'file-too-large'
    ? t.errTooLarge
    : fileRejections[0]?.errors[0]?.code === 'file-invalid-type'
      ? t.errInvalidType
      : fileRejections[0]?.errors[0]?.message

  const borderColor = isDragReject ? 'border-red-500'
    : isDragActive ? 'border-brand'
    : currentFile ? 'border-brand/40'
    : 'border-surface-float'

  const bgColor = isDragReject ? 'bg-red-500/5'
    : isDragActive ? 'bg-brand/5'
    : 'bg-surface/50'

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center
          transition-all duration-200 cursor-pointer
          ${borderColor} ${bgColor}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand/50 hover:bg-brand/5'}`}
      >
        <input {...getInputProps()} />

        {isDragActive && !isDragReject && (
          <div className="absolute inset-0 rounded-2xl bg-brand/8 flex items-center justify-center">
            <p className="text-xl font-bold text-brand">{t.dropzoneActive}</p>
          </div>
        )}

        <div className={`space-y-4 ${isDragActive ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-surface-float flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
              {currentFile && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="#09090B" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {currentFile ? (
            <div className="space-y-1">
              <p className="font-medium text-tx-primary text-sm truncate max-w-xs mx-auto">{currentFile.name}</p>
              <p className="text-tx-muted text-xs font-mono">{formatSize(currentFile.size)}</p>
              <p className="text-tx-muted text-xs pt-1">{t.dropzoneReplace}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-tx-primary">{t.dropzoneTitle}</p>
              <p className="text-tx-muted text-sm">{t.dropzoneHint}</p>
            </div>
          )}
        </div>
      </div>

      {rejectionMsg && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <span>⚠</span><span>{rejectionMsg}</span>
        </p>
      )}
    </div>
  )
}
