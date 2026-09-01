/**
 * Uzun listeler için sayfalama. Sayfa numaralarını, aradaki boşlukları "…" ile
 * kısaltarak gösterir; böylece 14 sayfalık bir listede bile tek satırda kalır.
 */

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** Ekran okuyucular için listenin ne olduğunu söyler ("Büyü listesi" gibi). */
  label: string
}

/** Gösterilecek sayfa numaraları; araya girecek boşluklar için `null` döner. */
function pageItems(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)

  const items = new Set([1, pageCount, page, page - 1, page + 1])
  const pages = [...items].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)

  const withGaps: (number | null)[] = []
  let previous = 0
  for (const p of pages) {
    if (previous && p - previous > 1) withGaps.push(null)
    withGaps.push(p)
    previous = p
  }
  return withGaps
}

export default function Pagination({ page, pageCount, onChange, label }: Props) {
  if (pageCount <= 1) return null

  const buttonClass = (active: boolean) =>
    [
      'min-w-9 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-accent text-white'
        : 'border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent',
    ].join(' ')

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1 pt-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={buttonClass(false)}
      >
        ‹ Önceki
      </button>

      {pageItems(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Sayfa ${p}`}
            className={buttonClass(p === page)}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        className={buttonClass(false)}
      >
        Sonraki ›
      </button>
    </nav>
  )
}
