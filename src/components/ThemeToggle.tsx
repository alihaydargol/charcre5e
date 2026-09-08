import { useEffect, useState } from 'react'
import {
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '../state/theme.ts'

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Aydınlık tema', icon: '☀' },
  { value: 'dark', label: 'Karanlık tema', icon: '☾' },
  { value: 'system', label: 'Sistem temasını kullan', icon: '◐' },
]

/**
 * Tema seçici.
 *
 * Üç durumlu bir düğme grubu; açılır liste değil. Üç seçenek de tek bakışta
 * görünür ve hangisinin etkin olduğu `aria-pressed` ile de bildirilir.
 */
export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => loadThemePreference())

  // "Sistem" seçiliyken işletim sistemi teması değişirse sayfa da dönmeli.
  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [preference])

  const choose = (value: ThemePreference) => {
    setPreference(value)
    saveThemePreference(value)
  }

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            title={option.label}
            aria-label={option.label}
            className={`rounded-md px-2 py-1 text-sm leading-none transition-colors ${
              active
                ? 'bg-accent-soft text-accent'
                : 'text-faint hover:bg-surface-hover hover:text-ink'
            }`}
          >
            <span aria-hidden="true">{option.icon}</span>
          </button>
        )
      })}
    </div>
  )
}
