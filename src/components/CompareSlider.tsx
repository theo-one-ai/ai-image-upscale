import { useRef, useState, useCallback } from 'react'

interface CompareSliderProps {
  beforeUrl: string
  afterUrl: string
  beforeLabel: string
  afterLabel: string
}

export function CompareSlider({ beforeUrl, afterUrl, beforeLabel, afterLabel }: CompareSliderProps) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const p = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setPos(p)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    updatePos(e.clientX)
    const onMove = (e: MouseEvent) => { if (dragging.current) updatePos(e.clientX) }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true
    updatePos(e.touches[0].clientX)
    const onMove = (e: TouchEvent) => { if (dragging.current) updatePos(e.touches[0].clientX) }
    const onEnd = () => { dragging.current = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onEnd)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none cursor-col-resize"
      style={{ aspectRatio: 'auto' }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* After (full width) */}
      <img src={afterUrl} alt="After" className="w-full h-full object-contain block" draggable={false} />

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={beforeUrl} alt="Before" className="w-full h-full object-contain block" draggable={false} />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-brand shadow-brand z-10"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-9 h-9 rounded-full bg-brand border-2 border-white shadow-brand
          flex items-center justify-center gap-0.5 cursor-col-resize">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#09090B" strokeWidth="2" strokeLinecap="round">
            <path d="M5 3L2 7l3 4M9 3l3 4-3 4"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 z-20">
        <span className="badge text-xs bg-ink/80 text-tx-secondary backdrop-blur-sm">{beforeLabel}</span>
      </div>
      <div className="absolute top-2 right-2 z-20">
        <span className="badge text-xs bg-ink/80 text-brand backdrop-blur-sm">{afterLabel}</span>
      </div>
    </div>
  )
}
