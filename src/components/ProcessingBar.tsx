interface ProcessingBarProps {
  progress: number
  label: string
  sublabel?: string
  tileInfo?: { cur: number; total: number } | null
  cacheNote?: string
  variant?: 'load' | 'process'
}

export function ProcessingBar({ progress, label, sublabel, tileInfo, cacheNote, variant = 'load' }: ProcessingBarProps) {
  return (
    <div className="w-full space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-tx-primary">{label}</p>
          {tileInfo && (
            <p className="text-xs text-brand font-mono mt-0.5">{tileInfo.cur} / {tileInfo.total} tiles</p>
          )}
          {!tileInfo && sublabel && (
            <p className="text-xs text-tx-muted font-mono mt-0.5 truncate max-w-xs">{sublabel}</p>
          )}
        </div>
        <span className="font-mono text-brand text-sm tabular-nums">{Math.round(progress)}%</span>
      </div>

      <div className="relative h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-brand rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${Math.max(0, progress - 20)}%`,
            width: '20%',
            background: 'linear-gradient(to right, transparent, rgba(0,229,255,0.4), transparent)',
            transition: 'left 0.3s ease-out',
          }}
        />
      </div>

      {variant === 'load' && cacheNote && (
        <p className="text-xs text-tx-muted leading-relaxed">{cacheNote}</p>
      )}
    </div>
  )
}
