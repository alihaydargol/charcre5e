import { useMemo, useState } from 'react'
import type { Collection } from '../../data/registry.ts'
import { weaponProperties } from '../../data/registry.ts'
import type { Equipment } from '../../data/schema.ts'
import Pagination from '../../components/Pagination.tsx'
import { SourceBadge } from '../homebrew/fields.tsx'

const PAGE_SIZE = 16

const CATEGORIES = [
  { id: 'all', label: 'Tümü' },
  { id: 'weapon', label: 'Silahlar' },
  { id: 'armor', label: 'Zırhlar' },
  { id: 'gear', label: 'Eşyalar' },
  { id: 'tool', label: 'Aletler' },
  { id: 'vehicle', label: 'Taşıtlar' },
] as const

/** Kart başlığının altında görünen tek satırlık özet. */
function summarize(item: Equipment): string {
  switch (item.category) {
    case 'weapon': {
      if (!item.damage) return `${item.weaponCategory} ${item.weaponRange}`
      // Versatile silahlar iki elle tutulunca daha büyük zar atar (Longsword
      // 1d8 → 1d10). Bu, kartı açmadan görülmesi gereken bir bilgi.
      const versatile = item.twoHandedDamage ? ` — iki elle ${item.twoHandedDamage.dice}` : ''
      return `${item.weaponCategory} ${item.weaponRange} · ${item.damage.dice} ${item.damage.type}${versatile}`
    }
    case 'armor': {
      if (item.armorCategory === 'Shield') return `Shield · AC +${item.armorClass.base}`
      const dex = item.armorClass.dexBonus
        ? item.armorClass.maxDexBonus !== null
          ? ` + DEX (en fazla ${item.armorClass.maxDexBonus})`
          : ' + DEX'
        : ''
      return `${item.armorCategory} · AC ${item.armorClass.base}${dex}`
    }
    default:
      return item.gearCategory?.replaceAll('-', ' ') ?? 'Eşya'
  }
}

export default function EquipmentBrowser({ equipment }: { equipment: Collection<Equipment> }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string>()

  const all = useMemo(() => equipment.all(), [equipment])

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return all.filter((item) => {
      if (q && !item.name.toLocaleLowerCase('tr').includes(q)) return false
      if (category !== 'all' && item.category !== category) return false
      return true
    })
  }, [all, query, category])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-48 flex-1">
          <span className="sr-only">Eşya ara</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Eşya ara (ör. Longsword)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Türe göre filtrele</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500" role="status">
        {matches.length === all.length
          ? `${all.length} eşya`
          : `${matches.length} sonuç (toplam ${all.length} eşya)`}
        {matches.length > 0 && ` · sayfa ${currentPage}/${pageCount}`}
      </p>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Bu filtrelere uyan eşya yok.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId(openId === item.id ? undefined : item.id)}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={setPage}
        label="Ekipman listesi sayfaları"
      />
    </div>
  )
}

function EquipmentCard({
  item,
  open,
  onToggle,
}: {
  item: Equipment
  open: boolean
  onToggle: () => void
}) {
  const hasDetail =
    item.desc.length > 0 ||
    item.category === 'weapon' ||
    item.category === 'armor' ||
    item.weight !== undefined

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={!hasDetail}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 disabled:hover:bg-transparent"
      >
        <span>
          <span className="flex items-baseline gap-1.5 font-semibold">
            {item.name}
            <SourceBadge source={item.source} />
          </span>
          <span className="mt-0.5 block text-sm capitalize text-slate-500">{summarize(item)}</span>
        </span>
        <span className="shrink-0 text-right text-xs text-slate-500">
          {item.cost && (
            <span className="block">
              {item.cost.quantity} {item.cost.unit}
            </span>
          )}
          {hasDetail && (
            <span aria-hidden="true" className="mt-1 block text-slate-400">
              {open ? '−' : '+'}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          {item.weight !== undefined && (
            <p className="text-slate-500">Ağırlık: {item.weight} lb</p>
          )}

          {item.category === 'weapon' && (
            <>
              {item.twoHandedDamage && (
                <p>
                  İki elle: {item.twoHandedDamage.dice} {item.twoHandedDamage.type}
                </p>
              )}
              {item.range && (
                <p>
                  Menzil: {item.range.normal}
                  {item.range.long !== null && `/${item.range.long}`} ft
                </p>
              )}
              {item.throwRange && (
                <p>
                  Fırlatma menzili: {item.throwRange.normal}/{item.throwRange.long} ft
                </p>
              )}
              {item.properties.length > 0 && (
                <p>
                  Özellikler:{' '}
                  {item.properties.map((id) => weaponProperties.get(id)?.name ?? id).join(', ')}
                </p>
              )}
            </>
          )}

          {item.category === 'armor' && (
            <>
              {item.strMinimum > 0 && <p>Gereken STR: {item.strMinimum}</p>}
              {item.stealthDisadvantage && <p>Stealth kontrollerinde dezavantaj.</p>}
            </>
          )}

          {item.desc.map((paragraph, i) => (
            <p key={i} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </li>
  )
}
