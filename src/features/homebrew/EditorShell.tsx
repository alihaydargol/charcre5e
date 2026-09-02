import type { ReactNode } from 'react'
import { Issues } from './fields.tsx'

/**
 * Tüm homebrew düzenleyicilerinin ortak çerçevesi: başlık, alanlar, eksik
 * listesi ve kaydet/vazgeç. Eksik varken kaydet kilitlidir — sihirbazdaki
 * davranışın aynısı, nedeni de yazılı.
 */
export default function EditorShell({
  title,
  issues,
  onSave,
  onCancel,
  children,
}: {
  title: string
  issues: string[]
  onSave: () => void
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (issues.length === 0) onSave()
      }}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
      <Issues issues={issues} />
      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={issues.length > 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}
