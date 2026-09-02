import type { ReactNode } from 'react'
import { splitParagraphs } from './text.ts'

/**
 * Homebrew düzenleyicilerinin ortak form parçaları.
 *
 * Yedi ayrı düzenleyici (ırk, sınıf, geçmiş, feat, büyü, alt sınıf, eşya) aynı
 * girdi türlerini kullanıyor; burada tek noktada tanımlıdır ki görünüm ve
 * erişilebilirlik davranışı hepsinde aynı olsun.
 */

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 ' +
  'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  )
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </Field>
  )
}

/**
 * Çok satırlı metin. Şemada `desc` alanları paragraf dizisidir; boş satırla
 * ayrılan bloklar ayrı paragraf olur.
 */
export function ParagraphsField({
  label,
  hint,
  value,
  onChange,
  rows = 5,
}: {
  label: string
  hint?: string
  value: string[]
  onChange: (value: string[]) => void
  rows?: number
}) {
  return (
    <Field label={label} hint={hint ?? 'Boş satır bırakarak paragraf ayırabilirsin.'}>
      <textarea
        rows={rows}
        value={value.join('\n\n')}
        onChange={(e) => onChange(splitParagraphs(e.target.value))}
        className={inputClass}
      />
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  hint?: string
  value: T | ''
  onChange: (value: T | '') => void
  options: { value: T; label: string }[]
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className={inputClass}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/**
 * Onay kutusu havuzu — beceri, yeterlilik, dil, sınıf listesi gibi çoklu
 * seçimler için. `max` verilirse sınıra ulaşınca seçilmemişler kilitlenir;
 * listeden çıkarılmaz ki kullanıcı neyin var olduğunu görebilsin.
 */
export function CheckboxPool({
  label,
  hint,
  options,
  selected,
  onToggle,
  max,
  columns = 3,
}: {
  label: string
  hint?: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  max?: number
  columns?: number
}) {
  const full = max !== undefined && selected.length >= max

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-slate-500">
        {label}
        {max !== undefined && (
          <span className="ml-1 text-slate-400">
            ({selected.length}/{max})
          </span>
        )}
      </legend>
      {hint && <p className="mb-1.5 text-xs text-slate-400">{hint}</p>}
      <div
        className="grid gap-x-4 gap-y-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label
              key={option.value}
              className={`flex items-center gap-2 text-sm ${
                !checked && full ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && full}
                onChange={() => onToggle(option.value)}
                className="accent-accent"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Kaydetmeyi engelleyen eksiklerin listesi. */
export function Issues({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  )
}

/** SRD / homebrew ayrımını gösteren rozet. */
export function SourceBadge({ source }: { source: 'srd' | 'homebrew' }) {
  if (source === 'srd') return null
  return (
    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      Homebrew
    </span>
  )
}

