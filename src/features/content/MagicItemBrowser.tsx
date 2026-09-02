import { useMemo, useState } from 'react'
import type { Collection } from '../../data/registry.ts'
import type { MagicItem } from '../../data/schema.ts'
import Pagination from '../../components/Pagination.tsx'
import { SourceBadge } from '../homebrew/fields.tsx'

const PAGE_SIZE = 12

/** Nadirlik sırası — alfabetik değil, oyundaki güç sırası. */
const RARITY_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies',
] as const

/** Nadirliğe göre renk; kartın kenarında ince bir şerit olarak görünür. */
const RARITY_COLOR: Record<string, string> = {
  Common: 'bg-slate-300',
  Uncommon: 'bg-emerald-500',
  Rare: 'bg-sky-500',
  'Very Rare': 'bg-violet-500',
  Legendary: 'bg-amber-500',
  Artifact: 'bg-rose-600',
  Varies: 'bg-slate-400',
}

export default function MagicItemBrowser({ magicItems }: { magicItems: Collection<MagicItem> }) {
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string>()

  const all = useMemo(() => magicItems.all(), [magicItems])

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return all.filter((item) => {
      if (q && !item.name.toLocaleLowerCase('tr').includes(q)) return false
      if (rarity !== 'all' && item.rarity !== rarity) return false
      return true
    })
  }, [all, query, rarity])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-48 flex-1">
          <span className="sr-only">Sihirli eşya ara</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Sihirli eşya ara (ör. Flame Tongue)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Nadirliğe göre filtrele</span>
          <select
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">Tüm nadirlikler</option>
            {RARITY_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500" role="status">
        {matches.length === all.length
          ? `${all.length} sihirli eşya`
          : `${matches.length} sonuç (toplam ${all.length})`}
        {matches.length > 0 && ` · sayfa ${currentPage}/${pageCount}`}
      </p>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Bu filtrelere uyan sihirli eşya yok.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(openId === item.id ? undefined : item.id)}
                aria-expanded={openId === item.id}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 h-8 w-1 shrink-0 rounded-full ${RARITY_COLOR[item.rarity] ?? 'bg-slate-300'}`}
                />
                <span className="flex-1">
                  <span className="flex items-baseline gap-1.5 font-semibold">
                    {item.name}
                    <SourceBadge source={item.source} />
                  </span>
                  <span className="mt-0.5 block text-sm capitalize text-slate-500">
                    {item.rarity} · {item.category.replaceAll('-', ' ')}
                    {item.variants.length > 0 && ` · ${item.variants.length} varyant`}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 pt-1 text-slate-400">
                  {openId === item.id ? '−' : '+'}
                </span>
              </button>

              {openId === item.id && (
                <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  {item.desc.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={setPage}
        label="Sihirli eşya listesi sayfaları"
      />
    </div>
  )
}
