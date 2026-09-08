import type { ReactNode } from 'react'
import { Issues } from './fields.tsx'
import { btnPrimary, btnSecondary } from '../../components/ui.ts'

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
      className="space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children}
      <Issues issues={issues} />
      <div className="flex gap-2 border-t border-border pt-4">
        <button
          type="submit"
          disabled={issues.length > 0}
          className={btnPrimary}
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={btnSecondary}
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}
