import { useState, useEffect, useRef } from 'react'
import { useUpscaler } from './hooks/useUpscaler'
import { ImageDropZone } from './components/ImageDropZone'
import { UpscaleResultView } from './components/UpscaleResult'
import { ProcessingBar } from './components/ProcessingBar'
import { useI18n } from './i18n/I18nContext'
import type { Lang } from './i18n/translations'
import type { ScaleMode, ModelType, ExecMode } from './hooks/useUpscaler'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

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
  const [model, setModel] = useState<ModelType>('general')
  const [exec, setExec] = useState<ExecMode>('auto')
  const [showLangMenu, setShowLangMenu] = useState(false)
  const prevOriginalUrl = useRef<string | null>(null)

  useEffect(() => { loadModel(model, exec) }, [])

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
    await upscale(selectedFile, scale, model, exec)
  }

  const handleReset = () => {
    reset()
    setSelectedFile(null)
    if (prevOriginalUrl.current) { URL.revokeObjectURL(prevOriginalUrl.current); prevOriginalUrl.current = null }
    setOriginalUrl(null)
  }

  const isLoading = status === 'loading'
  const isReady = status === 'ready'
  const isProcessing = status === 'processing'
  const isDone = status === 'done'
  const canUpscale = isReady && !!selectedFile

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-surface-float/60 bg-ink/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-raised border border-surface-float flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="#00E5FF" strokeWidth="1.3"/>
                <path d="M5 11L8 5l3 6" stroke="#00E5FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.2 8.5h3.6" stroke="#00E5FF" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-tx-primary text-sm tracking-tight">{t.appName}</span>
            <span className="hidden sm:block font-mono text-tx-muted text-xs">{t.version}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Backend indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-xs text-tx-muted">{execBackend}</span>
            </div>

            {/* Lang switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="badge hover:border-brand/40 hover:text-tx-primary transition-colors cursor-pointer"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5"/>
                  <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13"/>
                </svg>
                {LANGS.find(l => l.code === lang)?.label}
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-surface-raised border border-surface-float rounded-xl overflow-hidden shadow-card min-w-[120px]">
                    {LANGS.map(l => (
                      <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false) }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors
                          ${lang === l.code ? 'text-brand bg-brand/5' : 'text-tx-secondary hover:text-tx-primary hover:bg-surface-float'}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* GitHub */}
            <a href="https://github.com/theo-one-ai/ai-image-upscale" target="_blank" rel="noopener noreferrer"
              className="badge hover:border-brand/40 hover:text-tx-primary transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-8">

        {/* Hero */}
        <div className="space-y-4 animate-fade-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-tx-primary leading-[1.15] tracking-tight">
            {t.heroTitle1}<br />
            <span className="text-brand">{t.heroTitle2}</span>
          </h1>
          <p className="text-tx-secondary text-base leading-relaxed max-w-xl">{t.heroDesc}</p>
          <div className="flex flex-wrap gap-2">
            {[t.badge1, t.badge2, t.badge3].map((text, i) => (
              <span key={i} className="badge text-xs">{['🔒', '⚡', '✦'][i]} {text}</span>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="card p-6 animate-fade-in">
            <ProcessingBar
              progress={loadProgress}
              label={t.modelLoading}
              cacheNote={t.modelCacheNote}
              variant="load"
            />
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 flex items-start gap-3 animate-fade-in">
            <span className="text-red-400 mt-0.5">⚠</span>
            <div className="space-y-2">
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={() => loadModel(model, exec)} className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2">
                {t.retryBtn}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {(isReady || isProcessing || isDone) && (
          <div className="space-y-5 animate-fade-up">

            {isDone && result && originalUrl ? (
              <UpscaleResultView
                result={result}
                originalUrl={originalUrl}
                onReset={handleReset}
                t={t}
              />
            ) : (
              <>
                <ImageDropZone
                  onFileAccepted={handleFileAccepted}
                  disabled={isProcessing}
                  currentFile={selectedFile}
                  t={t}
                />

                {isProcessing && (
                  <div className="card p-6">
                    <ProcessingBar
                      progress={processProgress}
                      label={t.processing}
                      tileInfo={processingTile}
                      variant="process"
                    />
                    <div className="mt-4 flex justify-end">
                      <button onClick={cancel} className="btn-secondary px-4 py-2 text-xs">
                        {t.cancelBtn}
                      </button>
                    </div>
                  </div>
                )}

                {selectedFile && !isProcessing && (
                  <div className="card p-5 space-y-6">
                    <h2 className="text-sm font-semibold text-tx-primary">{t.upscaleOptions}</h2>

                    {/* Scale */}
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

                    {/* Model */}
                    <div className="space-y-2.5">
                      <label className="section-label">{t.modelLabel}</label>
                      <div className="flex flex-col gap-2">
                        {([
                          { value: 'general' as ModelType, label: t.modelGeneral },
                          { value: 'anime' as ModelType, label: t.modelAnime },
                        ]).map(opt => (
                          <button key={opt.value} onClick={() => setModel(opt.value)}
                            className={`toggle-item text-left ${model === opt.value ? 'toggle-item-active' : 'toggle-item-inactive'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Execution mode */}
                    <div className="space-y-2.5">
                      <label className="section-label">{t.executionLabel}</label>
                      <div className="flex gap-2">
                        {([
                          { value: 'auto' as ExecMode, label: t.execAuto },
                          { value: 'wasm' as ExecMode, label: t.execWasm },
                        ]).map(opt => (
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
                    <button onClick={handleUpscale} disabled={!canUpscale} className="btn-primary px-8 py-3">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

        {/* How to use */}
        {!selectedFile && (isReady || isDone) && (
          <div className="space-y-4 pt-2 animate-fade-up">
            <p className="section-label">{t.howToUse}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: '01', title: t.step1Title, desc: t.step1Desc },
                { step: '02', title: t.step2Title, desc: t.step2Desc },
                { step: '03', title: t.step3Title, desc: t.step3Desc },
              ].map(({ step, title, desc }) => (
                <div key={step} className="card p-4 space-y-2 hover:border-brand/20 transition-colors">
                  <span className="font-mono text-brand text-xs font-medium">{step}</span>
                  <p className="font-semibold text-tx-primary text-sm">{title}</p>
                  <p className="text-tx-muted text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Link to Last Frame Extractor */}
            <div className="flex justify-center pt-2">
              <a href="https://last-frame-extractor.vercel.app" target="_blank" rel="noopener noreferrer"
                className="badge hover:border-brand/40 hover:text-brand transition-colors text-xs">
                🎬 {t.linkToExtractor}
              </a>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-float/60 py-5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-tx-muted text-xs">{t.footerNote}</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/theo-one-ai/ai-image-upscale" target="_blank" rel="noopener noreferrer"
              className="text-tx-muted hover:text-brand text-xs transition-colors">GitHub</a>
            <span className="text-tx-muted text-xs">{t.mitLicense}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
