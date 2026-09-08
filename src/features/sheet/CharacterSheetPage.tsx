import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadEquipment, loadFeatures, loadSpells, type Collection } from '../../data/registry.ts'
import type { Equipment, Feature, Spell } from '../../data/schema.ts'
import { formatModifier } from '../../rules/abilities.ts'
import { levelIn, type Character } from '../../rules/character.ts'
import {
  maxSpellLevelFor,
  spellListClassId,
  usesSpellbook,
} from '../../rules/spellcasting.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import { buildExport, downloadJson, safeFileName } from '../../state/transfer.ts'
import { buildSheet } from './sheetData.ts'
import { btnSmallPrimary, btnSmallSecondary, sectionLabel } from '../../components/ui.ts'

/**
 * Karakter sayfası.
 *
 * Ekranda katlanabilir bölümler hâlinde; yazdırırken (`@media print`) sekmeler
 * açılır, gezinme ve butonlar gizlenir ve A4'e sığacak biçimde daralır. Ayrı
 * bir yazdırma rotası yerine aynı sayfayı kullanıyoruz ki iki görünüm
 * birbirinden ayrışmasın.
 */
export default function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>()
  const saved = useCharacterStore((s) => s.saved)
  const character = saved.find((c) => c.id === id)

  const [equipment, setEquipment] = useState<Map<string, Equipment>>(new Map())
  const [features, setFeatures] = useState<Map<string, Feature>>()
  const [spells, setSpells] = useState<Collection<Spell>>()

  useEffect(() => {
    let active = true
    loadEquipment().then((c) => {
      if (active) setEquipment(new Map(c.all().map((i) => [i.id, i])))
    })
    loadFeatures().then((c) => {
      if (active) setFeatures(new Map(c.all().map((f) => [f.id, f])))
    })
    loadSpells().then((c) => active && setSpells(c))
    return () => {
      active = false
    }
  }, [])

  if (!character) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Karakter bulunamadı</h1>
        <p className="text-muted">
          Bu bağlantıdaki karakter kayıtlı değil. Silinmiş olabilir.
        </p>
        <Link to="/" className="text-accent underline">
          Karakterlerime dön
        </Link>
      </div>
    )
  }

  return (
    <Sheet character={character} equipment={equipment} features={features} spells={spells} />
  )
}

function Sheet({
  character,
  equipment,
  features,
  spells,
}: {
  character: Character
  equipment: Map<string, Equipment>
  features?: Map<string, Feature>
  spells?: Collection<Spell>
}) {
  const sheet = useMemo(
    () => buildSheet(character, equipment, features),
    [character, equipment, features],
  )

  return (
    <article className="space-y-6 print:space-y-3 print:text-[10pt]">
      <SheetHeader character={character} sheet={sheet} />
      <CoreStats sheet={sheet} />
      {/*
        Sol sütun kısa referans blokları, sağ sütun uzun metinler. Envanter ve
        notlar sola alındı: yalnızca yetenek ve becerilerle sol sütun sağın
        yarısı kadar bile sürmüyor ve ekranın altı boş kalıyordu.
      */}
      <div className="grid gap-6 print:gap-3 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="space-y-6 print:space-y-3">
          <Abilities sheet={sheet} />
          <Skills sheet={sheet} />
          <Inventory character={character} sheet={sheet} />
          <Notes character={character} />
        </div>
        <div className="space-y-6 print:space-y-3">
          <Attacks sheet={sheet} />
          {sheet.casting.length > 0 && (
            <Spellcasting character={character} sheet={sheet} spells={spells} />
          )}
          <Features sheet={sheet} />
        </div>
      </div>
    </article>
  )
}

function SheetHeader({
  character,
  sheet,
}: {
  character: Character
  sheet: ReturnType<typeof buildSheet>
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink print:text-xl">
          {character.name || 'İsimsiz karakter'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {sheet.raceName} · {sheet.className}
          {sheet.subclassName && ` (${sheet.subclassName})`} · {sheet.level}. seviye
        </p>
        <p className="text-sm text-muted">
          {sheet.backgroundName}
          {character.notes.alignment && ` · ${character.notes.alignment}`}
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Link
          to={`/seviye/${character.id}`}
          className={btnSmallSecondary}
        >
          Seviye atla
        </Link>
        <button
          type="button"
          onClick={() =>
            downloadJson(`${safeFileName(character.name)}.json`, buildExport([character]))
          }
          className={btnSmallSecondary}
        >
          JSON indir
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={btnSmallPrimary}
        >
          Yazdır / PDF
        </button>
      </div>
    </header>
  )
}

function Box({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center print:p-1.5">
      {/* Etiket İngilizce oyun terimi olabilir; CSS uppercase Türkçe kurala göre
          i→İ yapardı ("HİT POİNTS"). Bu yüzden metin olduğu gibi yazılır. */}
      <dt className="text-[10px] font-semibold tracking-wide text-faint">{label}</dt>
      <dd className="text-2xl font-semibold leading-tight print:text-lg">{value}</dd>
      {hint && <p className="text-[10px] text-faint">{hint}</p>}
    </div>
  )
}

function CoreStats({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 print:gap-1.5 sm:grid-cols-6">
        <Box label="ARMOR CLASS" value={sheet.ac.value} hint={sheet.ac.options[0]?.label} />
        <Box label="HIT POINTS" value={sheet.hp.total} />
        {/* Multiclass'ta zar boyutuna göre ayrı havuzlar: "3d10 + 2d6". */}
        <Box
          label="HIT DICE"
          value={sheet.hitDice.map((p) => `${p.count}d${p.die}`).join(' + ') || '—'}
        />
        <Box label="INITIATIVE" value={formatModifier(sheet.initiative)} />
        <Box
          label="HIZ"
          value={`${sheet.speed} ft`}
          hint={sheet.penalties.speedPenalty > 0 ? `${sheet.baseSpeed} ft − zırh` : undefined}
        />
        <Box label="PASİF ALGI" value={sheet.passivePerception} />
      </dl>

      {sheet.penalties.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
          {sheet.penalties.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-border bg-surface p-4 print:rounded-none print:p-2">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Abilities({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Yetenekler ve kurtarma atışları">
      <ul className="space-y-1.5">
        {sheet.abilities.map((ability) => (
          <li key={ability} className="flex items-center gap-3 text-sm">
            <span className="w-10 text-xs font-semibold text-faint">{ability.toUpperCase()}</span>
            <span className="w-8 text-right font-semibold">{sheet.scores[ability].total}</span>
            <span className="w-10 text-right">{formatModifier(sheet.scores[ability].modifier)}</span>
            <span
              className={[
                'ml-auto text-right',
                sheet.saves[ability].proficient ? 'font-semibold text-accent' : 'text-muted',
              ].join(' ')}
            >
              save {formatModifier(sheet.saves[ability].value)}
              {sheet.saves[ability].proficient && ' ●'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
        Proficiency bonus {formatModifier(sheet.proficiencyBonus)}
      </p>
    </Section>
  )
}

function Skills({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Beceriler">
      <ul className="space-y-1">
        {sheet.skillList.map((skill) => {
          const mod = sheet.skillMods[skill.id]
          return (
            <li key={skill.id} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={[
                  'inline-block size-2 shrink-0 rounded-full',
                  mod.expertise
                    ? 'bg-accent ring-2 ring-accent/30'
                    : mod.proficient
                      ? 'bg-accent'
                      : 'border border-border-strong',
                ].join(' ')}
              />
              <span className={mod.proficient ? 'font-medium' : 'text-muted'}>
                {skill.name}
              </span>
              <span className="text-[10px] text-faint">{skill.ability.toUpperCase()}</span>
              <span className="ml-auto font-semibold">{formatModifier(mod.value)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 border-t border-border pt-2 text-[10px] text-faint">
        ● yeterlilik · ◎ uzmanlık (proficiency bonus iki katı)
      </p>
    </Section>
  )
}

function Attacks({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Saldırılar">
      {sheet.attacks.length === 0 ? (
        <p className="text-sm text-muted">Kuşanılmış silah yok.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] tracking-wide text-faint">
              <th className="pb-1 font-medium">SİLAH</th>
              <th className="pb-1 font-medium">SALDIRI</th>
              <th className="pb-1 font-medium">HASAR</th>
              <th className="pb-1 font-medium">MENZİL</th>
            </tr>
          </thead>
          <tbody>
            {sheet.attacks.map((attack) => (
              <tr key={attack.weaponId} className="border-t border-border">
                <td className="py-1 font-medium">{attack.name}</td>
                <td className="py-1">{formatModifier(attack.attackBonus)}</td>
                <td className="py-1">
                  {attack.damage} {attack.damageType}
                </td>
                <td className="py-1 text-muted">{attack.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sheet.scaling.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2 text-sm">
          {sheet.scaling.map((s) => (
            <li key={s.label} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">
              {s.label}: {s.value}
            </li>
          ))}
        </ul>
      )}

      {sheet.attacks.some((a) => a.warnings.length > 0 || a.notes.length > 0) && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {sheet.attacks.flatMap((a) =>
            [...a.warnings, ...a.notes].map((note, i) => (
              <li key={`${a.weaponId}-${i}`}>
                <span className="font-medium">{a.name}:</span> {note}
              </li>
            )),
          )}
        </ul>
      )}
    </Section>
  )
}

function Spellcasting({
  character,
  sheet,
  spells,
}: {
  character: Character
  sheet: ReturnType<typeof buildSheet>
  spells?: Collection<Spell>
}) {
  const byId = (id: string) => spells?.get(id)
  const cantrips = character.spells.cantrips.map(byId).filter((s) => s !== undefined)
  const known = character.spells.known
    .map(byId)
    .filter((s) => s !== undefined)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  return (
    <Section title="Büyücülük">
      {sheet.casting.map((info) => (
        <div key={info.classId} className="mb-2 text-sm">
          <p>
            Save DC <strong>{info.saveDC}</strong> · Saldırı{' '}
            <strong>{formatModifier(info.spellAttackBonus)}</strong> · Yetenek{' '}
            {info.ability.toUpperCase()}
            {info.preparedCount !== undefined && ` · ${info.preparedCount} büyü hazırlar`}
          </p>
          <p className="mt-1 text-muted">
            {info.pactMagic ? 'Pact Magic' : 'Slotlar'}:{' '}
            {info.spellSlots
              .map((count, i) => (count > 0 ? `${i + 1}. sv ${'○'.repeat(count)}` : null))
              .filter(Boolean)
              .join(' · ') || 'yok'}
          </p>
        </div>
      ))}

      {cantrips.length > 0 && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Cantrip:</span> {cantrips.map((s) => s.name).join(', ')}
        </p>
      )}

      {/*
        Hazırlık günlük bir karardır, karakterin kalıcı bir özelliği değil —
        bu yüzden sihirbazda değil burada. Sayfa masada açık durur.
      */}
      {spells &&
        sheet.casting
          .filter((info) => info.preparedCount !== undefined)
          .map((info) => (
            <PreparedSpells
              key={`prepared-${info.classId}`}
              character={character}
              info={info}
              spells={spells}
            />
          ))}
      {known.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">Büyüler:</p>
          <ul className="mt-1 space-y-0.5">
            {known.map((spell) => (
              <li key={spell.id} className="flex gap-2">
                <span className="w-6 shrink-0 text-faint">{spell.level}.</span>
                <span>{spell.name}</span>
                {spell.concentration && (
                  <span className="text-xs text-faint">(conc.)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

/**
 * Hazırlanan büyüler.
 *
 * Wizard defterinden hazırlar (bildiği büyüler), Cleric/Druid/Paladin sınıf
 * listesinin tamamından. İki farklı kaynak ama aynı seçim mekaniği.
 *
 * Liste uzun olabildiği için (Cleric'in listesi 100+ büyü) arama var; yazdırma
 * çıktısında yalnızca seçilenler kalır.
 */
function PreparedSpells({
  character,
  info,
  spells,
}: {
  character: Character
  info: ReturnType<typeof buildSheet>['casting'][number]
  spells: Collection<Spell>
}) {
  const togglePrepared = useCharacterStore((s) => s.togglePrepared)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const max = info.preparedCount ?? 0
  const maxLevel = maxSpellLevelFor(info.classId, levelIn(character, info.classId))
  const listId = spellListClassId(info.classId)

  const pool = useMemo(() => {
    const source = usesSpellbook(info.classId)
      ? character.spells.known
          .map((id) => spells.get(id))
          .filter((s) => s !== undefined)
      : spells.all().filter((s) => s.classes.includes(listId))
    return source
      .filter((s) => s.level > 0 && s.level <= maxLevel)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }, [character.spells.known, spells, info.classId, listId, maxLevel])

  const prepared = character.spells.prepared.filter((id) => pool.some((s) => s.id === id))
  const visible = query.trim()
    ? pool.filter((s) => s.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
    : pool

  return (
    <div className="mt-3 border-t border-border pt-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          Hazırlanan büyüler{' '}
          <span className="font-normal text-faint">
            ({prepared.length}/{max})
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="no-print text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
        >
          {open ? 'Kapat' : 'Değiştir'}
        </button>
      </div>

      {prepared.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {pool
            .filter((s) => prepared.includes(s.id))
            .map((spell) => (
              <li key={spell.id} className="flex gap-2">
                <span className="w-6 shrink-0 text-faint">{spell.level}.</span>
                <span>{spell.name}</span>
                {spell.concentration && <span className="text-xs text-faint">(conc.)</span>}
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted">Henüz büyü hazırlamadın.</p>
      )}

      {open && (
        <div className="no-print mt-3 space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Büyü ara"
            aria-label="Hazırlanacak büyü ara"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
          />
          <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
            {visible.map((spell) => {
              const checked = prepared.includes(spell.id)
              const full = prepared.length >= max
              return (
                <li key={spell.id}>
                  <label
                    className={`flex items-center gap-2 ${
                      !checked && full ? 'text-disabled' : 'text-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => togglePrepared(character.id, spell.id, max)}
                      className="accent-accent"
                    />
                    <span className="w-6 shrink-0 text-faint">{spell.level}.</span>
                    {spell.name}
                  </label>
                </li>
              )
            })}
            {visible.length === 0 && (
              <li className="px-1 py-2 text-muted">Aramaya uyan büyü yok.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function Features({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Özellikler">
      {sheet.racialTraits.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted">Irk</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {sheet.racialTraits.map((trait) => (
              <li key={trait.id}>
                <span className="font-medium">{trait.name}:</span>{' '}
                <span className="text-muted">{trait.desc[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.backgroundFeature && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted">Geçmiş</h3>
          <p className="mt-1 text-sm">
            <span className="font-medium">{sheet.backgroundFeature.name}:</span>{' '}
            <span className="text-muted">{sheet.backgroundFeature.desc[0]}</span>
          </p>
        </div>
      )}

      {sheet.classFeatures.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted">{sheet.className}</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {sheet.classFeatures.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="text-faint">sv{f.level}</span> {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.subclassFeatures.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted">{sheet.subclassName}</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {sheet.subclassFeatures.map((f) => (
              <li key={f.id}>
                <span className="text-faint">sv{f.level}</span> {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

const CURRENCY_UNITS = [
  { id: 'pp', label: 'pp' },
  { id: 'gp', label: 'gp' },
  { id: 'ep', label: 'ep' },
  { id: 'sp', label: 'sp' },
  { id: 'cp', label: 'cp' },
] as const

/**
 * Para kesesi.
 *
 * Doğrudan düzenlenebilir: masa oynarken para harcanır ve kazanılır, ayrı bir
 * ekrana gitmek gereksiz sürtünme olurdu.
 */
function Purse({ character }: { character: Character }) {
  const setCurrency = useCharacterStore((s) => s.setCurrency)

  return (
    <div className="mt-3 border-t border-border pt-2">
      <p className={sectionLabel}>Para</p>
      <div className="mt-1.5 grid grid-cols-5 gap-2">
        {CURRENCY_UNITS.map((unit) => (
          <label key={unit.id} className="text-center">
            <span className="mb-1 block text-[11px] font-semibold text-faint">{unit.label}</span>
            <input
              type="number"
              min={0}
              value={character.currency[unit.id]}
              onChange={(e) => setCurrency(character.id, unit.id, Number(e.target.value))}
              aria-label={`${unit.label} miktarı`}
              className="w-full rounded-md border border-border-strong bg-surface px-1 py-1 text-center text-sm print:border-0"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function Inventory({
  character,
  sheet,
}: {
  character: Character
  sheet: ReturnType<typeof buildSheet>
}) {
  return (
    <Section title="Ekipman ve diller">
      {sheet.equipmentList.length === 0 ? (
        <p className="text-sm text-muted">Envanter boş.</p>
      ) : (
        <>
          <ul className="grid gap-x-4 text-sm">
            {sheet.equipmentList.map((entry) => (
              <li key={entry.itemId} className="flex gap-2">
                <span>{entry.item?.name ?? entry.itemId}</span>
                {entry.quantity > 1 && <span className="text-faint">×{entry.quantity}</span>}
                {entry.equipped && <span className="text-xs text-accent">kuşanılı</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {sheet.weight.total} lb / {sheet.carrying.capacity} lb
            {sheet.weight.effect && ` — ${sheet.weight.effect}`}
          </p>
        </>
      )}

      <Purse character={character} />

      <p className="mt-3 border-t border-border pt-2 text-sm">
        <span className="font-medium">Diller:</span> {sheet.languages.join(', ') || '—'}
      </p>
    </Section>
  )
}

function Notes({ character }: { character: Character }) {
  const entries = [
    ['Görünüş', character.notes.appearance],
    ['Kişilik', character.notes.personality],
    ['Geçmiş hikâyesi', character.notes.backstory],
  ].filter(([, value]) => value)

  if (entries.length === 0) return null

  return (
    <Section title="Notlar">
      <dl className="space-y-2 text-sm">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="whitespace-pre-wrap text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
