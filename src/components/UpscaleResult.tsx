import { useState } from 'react'
import { CompareSlider } from './CompareSlider'
import type { UpscaleResult } from '../hooks/useUpscaler'
import type { T } from '../i18n/translations'

interface UpscaleResultProps {
  result: UpscaleResult
  originalUrl: string
  onReset: () => void
  t: T
}

export function UpscaleResultView({ result, originalUrl, onReset, t }: UpscaleResultProps) {
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.fileName
    a.click()
  }

  const handleCopy = async () => {
    try {
      const res = await fetch(result.url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not supported */ }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-tx-primary text-sm">{t.resultTitle}</span>
        </div>
        <button onClick={onReset} className="text-xs text-tx-muted hover:text-tx-primary transition-colors">
          ← {t.resetBtn}
        </button>
      </div>

      {/* Compare slider */}
      <div className="card overflow-hidden">
        <CompareSlider
          beforeUrl={originalUrl}
          afterUrl={result.url}
          beforeLabel={t.beforeLabel}
          afterLabel={t.afterLabel}
        />
        <div className="px-4 py-3 border-t border-surface-float flex items-center justify-between">
          <p className="text-xs text-tx-muted">{t.dragToCompare}</p>
          <div className="flex items-center gap-2">
            <span className="badge text-xs font-mono">{t.originalSize}: {result.originalWidth}×{result.originalHeight}</span>
            <span className="badge text-xs font-mono text-brand">{t.upscaledSize}: {result.width}×{result.height}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleDownload} className="btn-primary flex-1 min-w-[120px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v8M4 6l3 3 3-3M2 11h10"/>
          </svg>
          {t.downloadBtn}
        </button>
        <button onClick={handleCopy} className="btn-secondary px-4">
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 7l4 4 6-6"/>
              </svg>
              <span className="text-brand">{t.copied}</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="4" y="4" width="8" height="8" rx="1.5"/>
                <path d="M2 10V2h8"/>
              </svg>
              {t.copyBtn}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
