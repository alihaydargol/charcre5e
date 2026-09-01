import { useMemo, useState } from 'react'
import type { Collection } from '../../data/registry.ts'
import { classes } from '../../data/registry.ts'
import type { Spell } from '../../data/schema.ts'
import Pagination from '../../components/Pagination.tsx'

const PAGE_SIZE = 12

/** 0 = cantrip; 1-9 normal büyü seviyeleri. */
const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

function levelLabel(level: number) {
  return level === 0 ? 'Cantrip' : `${level}. seviye`
}

/** "V, S, M (bir yarasa gübresi ve kükürt)" biçiminde bileşen satırı. */
function componentLine(spell: Spell) {
  const letters = spell.components.join(', ')
  return spell.material ? `${letters} — ${spell.material}` : letters
}

export default function SpellBrowser({ spells }: { spells: Collection<Spell> }) {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const [classId, setClassId] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string>()

  const all = useMemo(() => spells.all(), [spells])

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return all.filter((spell) => {
      if (q && !spell.name.toLocaleLowerCase('tr').includes(q)) return false
      if (level !== 'all' && spell.level !== level) return false
      if (classId !== 'all' && !spell.classes.includes(classId)) return false
      return true
    })
  }, [all, query, level, classId])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  // Filtre değişince kullanıcı boş bir sayfada kalabilir; son sayfaya sabitliyoruz.
  const currentPage = Math.min(page, pageCount)
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  /** Her filtre değişikliğinde başa dönülür, yoksa sonuç boş görünür. */
  const resetTo = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const selectClass =
    'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-48 flex-1">
          <span className="sr-only">Büyü ara</span>
          <input
            type="search"
            value={query}
            onChange={(e) => resetTo(setQuery)(e.target.value)}
            placeholder="Büyü ara (ör. Fireball)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label>
          <span className="sr-only">Seviyeye göre filtrele</span>
          <select
            value={String(level)}
            onChange={(e) =>
              resetTo(setLevel)(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className={selectClass}
          >
            <option value="all">Tüm seviyeler</option>
            {SPELL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Sınıfa göre filtrele</span>
          <select
            value={classId}
            onChange={(e) => resetTo(setClassId)(e.target.value)}
            className={selectClass}
          >
            <option value="all">Tüm sınıflar</option>
            {classes
              .all()
              .filter((c) => c.spellcasting)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500" role="status">
        {matches.length === all.length
          ? `${all.length} büyü`
          : `${matches.length} sonuç (toplam ${all.length} büyü)`}
        {matches.length > 0 && ` · sayfa ${currentPage}/${pageCount}`}
      </p>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Bu filtrelere uyan büyü yok. Aramayı veya filtreleri gevşetmeyi dene.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((spell) => (
            <SpellCard
              key={spell.id}
              spell={spell}
              open={openId === spell.id}
              onToggle={() => setOpenId(openId === spell.id ? undefined : spell.id)}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={setPage}
        label="Büyü listesi sayfaları"
      />
    </div>
  )
}

function SpellCard({
  spell,
  open,
  onToggle,
}: {
  spell: Spell
  open: boolean
  onToggle: () => void
}) {
  const classNames = spell.classes.map((id) => classes.get(id)?.name ?? id).join(', ')

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50"
      >
        <span>
          <span className="block font-semibold">{spell.name}</span>
          <span className="mt-0.5 block text-sm capitalize text-slate-500">
            {levelLabel(spell.level)} · {spell.school}
            {spell.concentration && ' · Concentration'}
            {spell.ritual && ' · Ritual'}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 pt-1 text-slate-400">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-4 py-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Casting Time" value={spell.castingTime} />
            <Field label="Range" value={spell.range} />
            <Field label="Components" value={componentLine(spell)} />
            <Field label="Duration" value={spell.duration} />
            {spell.attackType && (
              <Field label="Saldırı" value={`${spell.attackType} spell attack`} />
            )}
            {spell.dc && (
              <Field
                label="Kurtarma atışı"
                value={`${spell.dc.ability.toUpperCase()} — başarılıysa ${spell.dc.successType}`}
              />
            )}
            {spell.areaOfEffect && (
              <Field
                label="Etki alanı"
                value={`${spell.areaOfEffect.size} ft ${spell.areaOfEffect.type}`}
              />
            )}
            <Field label="Sınıflar" value={classNames} />
          </dl>

          <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
            {spell.desc.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {spell.higherLevel.length > 0 && (
            <div className="mt-4 rounded-md bg-accent-soft/60 p-3 text-sm leading-relaxed text-slate-700">
              <p className="mb-1 font-semibold">Daha yüksek seviyede</p>
              {spell.higherLevel.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          )}

          {spell.damage?.atSlotLevel && (
            <DamageTable
              caption="Slot seviyesine göre hasar"
              rows={spell.damage.atSlotLevel}
              rowLabel={(k) => `${k}. seviye slot`}
            />
          )}
          {spell.damage?.atCharacterLevel && (
            <DamageTable
              caption="Karakter seviyesine göre hasar"
              rows={spell.damage.atCharacterLevel}
              rowLabel={(k) => `${k}. seviye karakter`}
            />
          )}
          {spell.healAtSlotLevel && (
            <DamageTable
              caption="Slot seviyesine göre iyileştirme"
              rows={spell.healAtSlotLevel}
              rowLabel={(k) => `${k}. seviye slot`}
            />
          )}
        </div>
      )}
    </li>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  )
}

function DamageTable({
  caption,
  rows,
  rowLabel,
}: {
  caption: string
  rows: Record<string, string>
  rowLabel: (key: string) => string
}) {
  const entries = Object.entries(rows).sort((a, b) => Number(a[0]) - Number(b[0]))
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-64 text-sm">
        <caption className="mb-1 text-left text-xs uppercase tracking-wide text-slate-400">
          {caption}
        </caption>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-t border-slate-100">
              <th scope="row" className="py-1 pr-4 text-left font-normal text-slate-500">
                {rowLabel(key)}
              </th>
              <td className="py-1 font-medium text-slate-700">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
