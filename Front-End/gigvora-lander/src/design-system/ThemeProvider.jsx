import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { tokens as designTokens } from './tokens'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'gigvora.theme'

const defaultTheme = (() => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
})()

const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(defaultTheme)

  useEffect(() => {
    applyThemeToDocument(theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme)
    }
  }, [theme])

  useEffect(() => {
    const listener = (event) => {
      if (event.matches) {
        setTheme((current) => (current === 'system' ? 'dark' : current))
      }
    }

    if (window.matchMedia) {
      const query = window.matchMedia('(prefers-color-scheme: dark)')
      query.addEventListener('change', listener)
      return () => query.removeEventListener('change', listener)
    }
    return undefined
  }, [])

  const value = useMemo(
    () => ({
      theme,
      tokens: designTokens,
      setTheme: (next) => {
        if (next !== 'light' && next !== 'dark') return
        setTheme(next)
      },
      toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const useTokens = () => useTheme().tokens
