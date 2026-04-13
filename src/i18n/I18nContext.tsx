import { createContext, useContext, useState, ReactNode } from 'react'
import { translations, Lang, T } from './translations'

interface I18nContextType { lang: Lang; setLang: (l: Lang) => void; t: T }
const I18nContext = createContext<I18nContextType | null>(null)

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('ko')) return 'ko'
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('zh')) return 'zh'
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang)
  const t = translations[lang] as T
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
