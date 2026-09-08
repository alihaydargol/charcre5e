import { SourceBadge } from '../homebrew/fields.tsx'
import type { ChoiceOption } from '../../rules/choices.ts'

/**
 * Seçenek listesi. `getValidChoices` çıktısını doğrudan alır.
 *
 * Engellenmiş seçenekler gizlenmez; sönük gösterilip nedeni yazılır. Kullanıcı
 * neden seçemediğini görmeli — seçeneğin sessizce yok olması kafa karıştırır.
 */
export default function OptionGrid({
  options,
  selected,
  onToggle,
  columns = 2,
}: {
  options: ChoiceOption[]
  selected: string[]
  onToggle: (id: string) => void
  columns?: 1 | 2 | 3
}) {
  const gridClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns]

  return (
    <ul className={`grid gap-2 ${gridClass}`}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id)
        const disabled = Boolean(option.disabledReason) && !isSelected

        return (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onToggle(option.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                'w-full rounded-lg border p-3 text-left transition-colors',
                isSelected
                  ? 'border-accent bg-accent-soft ring-1 ring-accent'
                  : disabled
                    ? 'cursor-not-allowed border-border bg-surface-muted opacity-60'
                    : 'border-border bg-surface hover:border-accent hover:bg-accent-soft/40',
              ].join(' ')}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-1.5 font-medium">
                  {option.name}
                  {option.source && <SourceBadge source={option.source} />}
                </span>
                {isSelected && (
                  <span aria-hidden="true" className="text-accent">
                    ✓
                  </span>
                )}
              </span>
              {option.description && (
                <span className="mt-0.5 block text-sm text-muted">{option.description}</span>
              )}
              {disabled && (
                <span className="mt-1 block text-xs text-faint">{option.disabledReason}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
