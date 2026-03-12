import { useState, useEffect, useRef } from 'react'
import { useUpscaler, MODEL_DEFAULT_TILE, TILE_SIZES } from './hooks/useUpscaler'
import { ImageDropZone } from './components/ImageDropZone'
import { UpscaleResultView } from './components/UpscaleResult'
import { ProcessingBar } from './components/ProcessingBar'
import { useI18n } from './i18n/I18nContext'
import type { Lang } from './i18n/translations'
import type { ScaleMode, ModelType, ExecMode, TileMode } from './hooks/useUpscaler'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

const MODEL_OPTIONS: {
  value: ModelType
  label: string
  desc: string
  badge: string
  badgeColor: string
}[] = [
  { value: 'fast',     label: '⚡ 고속',      desc: '빠른 처리 · Compact 모델',       badge: '4.7MB',  badgeColor: 'text-emerald-400' },
  { value: 'balanced', label: '⚖️ 일반',      desc: '균형 · 권장 (Compact)',           badge: '4.7MB',  badgeColor: 'text-brand'       },
  { value: 'quality',  label: '💎 고화질',    desc: '최고 품질 · 매우 느림',           badge: '67MB',   badgeColor: 'text-amber-400'   },
  { value: 'anime',    label: '🎨 애니/일러', desc: '만화·일러스트 최적화',             badge: '18MB',   badgeColor: 'text-purple-400'  },
]

const TILE_OPTIONS: {
  value: TileMode
  label: string
  desc: string
  color: string
}[] = [
  { value: 'turbo',   label: '🚀 터보',  desc: '512px 타일 · 가장 빠름 · 화질 약간 저하', color: 'text-emerald-400' },
  { value: 'normal',  label: '⚡ 보통',  desc: '256px 타일 · 속도·화질 균형',              color: 'text-brand'       },
  { value: 'precise', label: '🔍 정밀',  desc: '128px 타일 · 최고 화질 · 느림',            color: 'text-amber-400'   },
]

// // 예상 타일 수 계산 (UI 힌트용)
// export function calcTiles(file: File | null, tileSize: number): number | null {
//   // 파일만으로는 해상도를 알 수 없어서 파일 크기로 대략 추정
//   // 실제 해상도는 처리 시작 전까지 알 수 없으므로 null 반환
//   return null
// }

export default function App() {
  const { t, lang, setLang } = useI18n()
  const {
    status, loadProgress, processProgress, processingTile,
    error, result, execBackend,
    loadModel, upscale, cancel, reset,
  } = useUpscaler()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [scale, setScale] = useState<ScaleMode>(4)
  const [model, setModel] = useState<ModelType>('balanced')
  const [exec, setExec] = useState<ExecMode>('auto')
  // tileMode는 모델 선택 시 자동으로 권장값으로 바뀌지만 사용자가 오버라이드 가능
  const [tileMode, setTileMode] = useState<TileMode>('normal')
  const [tileModeManual, setTileModeManual] = useState(false) // 사용자가 직접 바꿨는지
  const [showLangMenu, setShowLangMenu] = useState(false)
  const prevOriginalUrl = useRef<string | null>(null)

  useEffect(() => { loadModel(model, exec) }, [])

  // 모델 변경 시 tileMode를 권장값으로 자동 업데이트 (사용자가 직접 변경하지 않은 경우)
  const handleModelChange = (m: ModelType) => {
    setModel(m)
    if (!tileModeManual) {
      setTileMode(MODEL_DEFAULT_TILE[m])
    }
  }

  const handleTileModeChange = (tm: TileMode) => {
    setTileMode(tm)
    setTileModeManual(true)
  }

  const handleFileAccepted = (file: File) => {
    setSelectedFile(file)
    if (prevOriginalUrl.current) URL.revokeObjectURL(prevOriginalUrl.current)
    const url = URL.createObjectURL(file)
    setOriginalUrl(url)
    prevOriginalUrl.current = url
    if (status === 'done' || status === 'error') reset()
  }

  const handleUpscale = async () => {
    if (!selectedFile) return
    await upscale(selectedFile, scale, model, exec, tileMode)
  }

  const handleReset = () => {
    reset(); setSelectedFile(null)
    if (prevOriginalUrl.current) { URL.revokeObjectURL(prevOriginalUrl.current); prevOriginalUrl.current = null }
    setOriginalUrl(null)
    setTileModeManual(false)
  }

  const isLoading = status === 'loading'
  const isReady = status === 'ready'
  const isProcessing = status === 'processing'
  const isDone = status === 'done'
  const canUpscale = isReady && !!selectedFile

  const currentTileConfig = TILE_SIZES[tileMode]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-surface-float/60 bg-ink/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-float flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="#00E5FF" strokeWidth="1.3"/>
                <path d="M5 11L8 5l3 6" stroke="#00E5FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.2 8.5h3.6" stroke="#00E5FF" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-tx-primary text-sm tracking-tight">{t.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-xs text-tx-muted">{execBackend}</span>
            </div>
            <div className="relative">
              <button onClick={() => setShowLangMenu(v => !v)} className="badge hover:border-brand/40 cursor-pointer">
                {LANGS.find(l => l.code === lang)?.label}
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-8 z-20 bg-surface-raised border border-surface-float rounded-xl overflow-hidden min-w-[120px]">
                  {LANGS.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false) }}
                      className={`w-full text-left px-3 py-2 text-sm ${lang === l.code ? 'text-brand bg-brand/5' : 'text-tx-secondary hover:bg-surface-float'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
        <div className="space-y-4 animate-fade-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-tx-primary leading-[1.15]">
            {t.heroTitle1}<br /><span className="text-brand">{t.heroTitle2}</span>
          </h1>
          <p className="text-tx-secondary text-base max-w-xl">{t.heroDesc}</p>
          <div className="flex flex-wrap gap-2">
            {['🔒 서버 업로드 없음', '⚡ 브라우저 내 처리', '✦ 완전 무료'].map(b => (
              <span key={b} className="badge">{b}</span>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="card p-6 animate-fade-in">
            <ProcessingBar progress={loadProgress} label={t.modelLoading} variant="load" />
          </div>
        )}
        {status === 'error' && error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-red-300 text-sm">{error}</div>
        )}

        {(isReady || isProcessing || isDone) && (
          <div className="space-y-5 animate-fade-up">
            {isDone && result && originalUrl ? (
              <UpscaleResultView result={result} originalUrl={originalUrl} onReset={handleReset} t={t} />
            ) : (
              <>
                <ImageDropZone onFileAccepted={handleFileAccepted} disabled={isProcessing} currentFile={selectedFile} t={t} />

                {isProcessing && (
                  <div className="card p-6">
                    <ProcessingBar progress={processProgress} label={t.processing} tileInfo={processingTile} variant="process" />
                    <div className="mt-4 flex justify-end">
                      <button onClick={cancel} className="btn-secondary px-4 py-2 text-xs">{t.cancelBtn}</button>
                    </div>
                  </div>
                )}

                {selectedFile && !isProcessing && (
                  <div className="card p-5 space-y-6">
                    <h2 className="text-sm font-semibold text-tx-primary">{t.upscaleOptions}</h2>

                    {/* 배율 */}
                    <div className="space-y-2.5">
                      <label className="section-label">{t.scaleLabel}</label>
                      <div className="flex gap-2">
                        {([2, 4] as ScaleMode[]).map(s => (
                          <button key={s} onClick={() => setScale(s)}
                            className={`toggle-item font-mono ${scale === s ? 'toggle-item-active' : 'toggle-item-inactive'}`}>
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI 모델 */}
                    <div className="space-y-2.5">
                      <label className="section-label">AI 모델</label>
                      <div className="grid grid-cols-2 gap-2">
                        {MODEL_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => handleModelChange(opt.value)}
                            className={`toggle-item flex flex-col items-start p-3 h-auto text-left gap-1 ${model === opt.value ? 'toggle-item-active' : 'toggle-item-inactive'}`}>
                            <span className="font-semibold text-sm">{opt.label}</span>
                            <span className="text-[11px] text-tx-muted leading-snug">{opt.desc}</span>
                            <span className={`text-[10px] font-mono mt-0.5 ${opt.badgeColor}`}>{opt.badge}</span>
                          </button>
                        ))}
                      </div>
                      {model === 'quality' && (
                        <p className="text-[11px] text-amber-300 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20 leading-relaxed">
                          ⚠️ 67MB 대용량 모델입니다. 저사양 PC에서 8분 이상 소요되거나 브라우저가 응답하지 않을 수 있습니다.
                        </p>
                      )}
                    </div>

                    {/* 처리 속도 (타일 크기) */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="section-label">처리 속도</label>
                        {/* 권장 표시 */}
                        <span className="text-[10px] text-tx-muted">
                          권장: <span className="text-brand">{MODEL_DEFAULT_TILE[model] === tileMode ? '현재 선택' : MODEL_DEFAULT_TILE[model]}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {TILE_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => handleTileModeChange(opt.value)}
                            className={`toggle-item flex flex-col items-start p-3 h-auto text-left gap-1 ${tileMode === opt.value ? 'toggle-item-active' : 'toggle-item-inactive'}`}>
                            <span className="font-semibold text-sm">{opt.label}</span>
                            <span className={`text-[10px] font-mono ${opt.color}`}>
                              {opt.value === 'turbo' ? '512px' : opt.value === 'normal' ? '256px' : '128px'} 타일
                            </span>
                          </button>
                        ))}
                      </div>
                      {/* 선택된 옵션 설명 */}
                      <p className="text-[11px] text-tx-muted px-0.5">
                        {TILE_OPTIONS.find(o => o.value === tileMode)?.desc}
                        {' — '}
                        <span className="text-tx-secondary">
                          overlap {currentTileConfig.overlap}px
                        </span>
                      </p>
                      {tileMode === 'turbo' && (
                        <p className="text-[11px] text-sky-300 bg-sky-400/10 p-2.5 rounded-lg border border-sky-400/20 leading-relaxed">
                          💡 터보 모드는 타일당 처리 면적이 16배 커서 속도가 크게 빨라지지만, 타일 경계 부근에서 미세한 패턴 차이가 생길 수 있습니다.
                        </p>
                      )}
                    </div>

                    {/* 처리 방식 */}
                    <div className="space-y-2.5">
                      <label className="section-label">{t.executionLabel}</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'auto' as ExecMode, label: '자동 (권장)' },
                          { value: 'wasm' as ExecMode, label: 'CPU (느리지만 안정적)' },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => setExec(opt.value)}
                            className={`toggle-item text-xs ${exec === opt.value ? 'toggle-item-active' : 'toggle-item-inactive'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedFile && !isProcessing && (
                  <div className="flex justify-end">
                    <button onClick={handleUpscale} disabled={!canUpscale} className="btn-primary px-8 py-3 flex items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 13V3M3 8l5-5 5 5"/>
                      </svg>
                      {t.upscaleBtn}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-surface-float/60 py-5">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-tx-muted text-xs">{t.footerNote}</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/theo-one-ai/ai-image-upscale" target="_blank" className="text-tx-muted hover:text-brand text-xs">GitHub</a>
            <span className="text-tx-muted text-xs">MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
