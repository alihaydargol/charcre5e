import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadEquipment, loadFeatures, loadSpells, type Collection } from '../../data/registry.ts'
import type { Equipment, Feature, Spell } from '../../data/schema.ts'
import { formatModifier } from '../../rules/abilities.ts'
import type { Character } from '../../rules/character.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import { buildExport, downloadJson, safeFileName } from '../../state/transfer.ts'
import { buildSheet } from './sheetData.ts'

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
        <h1 className="text-2xl font-semibold">Karakter bulunamadı</h1>
        <p className="text-slate-600">
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
      <div className="grid gap-6 print:gap-3 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6 print:space-y-3">
          <Abilities sheet={sheet} />
          <Skills sheet={sheet} />
        </div>
        <div className="space-y-6 print:space-y-3">
          <Attacks sheet={sheet} />
          {sheet.casting.length > 0 && (
            <Spellcasting character={character} sheet={sheet} spells={spells} />
          )}
          <Features sheet={sheet} />
          <Inventory sheet={sheet} />
          <Notes character={character} />
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
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight print:text-xl">
          {character.name || 'İsimsiz karakter'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {sheet.raceName} · {sheet.className}
          {sheet.subclassName && ` (${sheet.subclassName})`} · {sheet.level}. seviye
        </p>
        <p className="text-sm text-slate-500">
          {sheet.backgroundName}
          {character.notes.alignment && ` · ${character.notes.alignment}`}
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Link
          to={`/seviye/${character.id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Seviye atla
        </Link>
        <button
          type="button"
          onClick={() =>
            downloadJson(`${safeFileName(character.name)}.json`, buildExport([character]))
          }
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          JSON indir
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center print:p-1.5">
      {/* Etiket İngilizce oyun terimi olabilir; CSS uppercase Türkçe kurala göre
          i→İ yapardı ("HİT POİNTS"). Bu yüzden metin olduğu gibi yazılır. */}
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400">{label}</dt>
      <dd className="text-2xl font-semibold leading-tight print:text-lg">{value}</dd>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function CoreStats({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 print:gap-1.5 sm:grid-cols-6">
        <Box label="ARMOR CLASS" value={sheet.ac.value} hint={sheet.ac.options[0]?.label} />
        <Box label="HIT POINTS" value={sheet.hp.total} />
        <Box label="HIT DICE" value={`${sheet.hitDice.count}d${sheet.hitDice.die}`} />
        <Box label="INITIATIVE" value={formatModifier(sheet.initiative)} />
        <Box
          label="HIZ"
          value={`${sheet.speed} ft`}
          hint={sheet.penalties.speedPenalty > 0 ? `${sheet.baseSpeed} ft − zırh` : undefined}
        />
        <Box label="PASİF ALGI" value={sheet.passivePerception} />
      </dl>

      {sheet.penalties.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
    <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4 print:p-2">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
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
            <span className="w-10 text-xs font-semibold text-slate-400">{ability.toUpperCase()}</span>
            <span className="w-8 text-right font-semibold">{sheet.scores[ability].total}</span>
            <span className="w-10 text-right">{formatModifier(sheet.scores[ability].modifier)}</span>
            <span
              className={[
                'ml-auto text-right',
                sheet.saves[ability].proficient ? 'font-semibold text-accent' : 'text-slate-500',
              ].join(' ')}
            >
              save {formatModifier(sheet.saves[ability].value)}
              {sheet.saves[ability].proficient && ' ●'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
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
                      : 'border border-slate-300',
                ].join(' ')}
              />
              <span className={mod.proficient ? 'font-medium' : 'text-slate-600'}>
                {skill.name}
              </span>
              <span className="text-[10px] text-slate-400">{skill.ability.toUpperCase()}</span>
              <span className="ml-auto font-semibold">{formatModifier(mod.value)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        ● yeterlilik · ◎ uzmanlık (proficiency bonus iki katı)
      </p>
    </Section>
  )
}

function Attacks({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Saldırılar">
      {sheet.attacks.length === 0 ? (
        <p className="text-sm text-slate-500">Kuşanılmış silah yok.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] tracking-wide text-slate-400">
              <th className="pb-1 font-medium">SİLAH</th>
              <th className="pb-1 font-medium">SALDIRI</th>
              <th className="pb-1 font-medium">HASAR</th>
              <th className="pb-1 font-medium">MENZİL</th>
            </tr>
          </thead>
          <tbody>
            {sheet.attacks.map((attack) => (
              <tr key={attack.weaponId} className="border-t border-slate-100">
                <td className="py-1 font-medium">{attack.name}</td>
                <td className="py-1">{formatModifier(attack.attackBonus)}</td>
                <td className="py-1">
                  {attack.damage} {attack.damageType}
                </td>
                <td className="py-1 text-slate-500">{attack.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sheet.scaling.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 text-sm">
          {sheet.scaling.map((s) => (
            <li key={s.label} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">
              {s.label}: {s.value}
            </li>
          ))}
        </ul>
      )}

      {sheet.attacks.some((a) => a.warnings.length > 0 || a.notes.length > 0) && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
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
          <p className="mt-1 text-slate-600">
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
      {known.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">Büyüler:</p>
          <ul className="mt-1 space-y-0.5">
            {known.map((spell) => (
              <li key={spell.id} className="flex gap-2">
                <span className="w-6 shrink-0 text-slate-400">{spell.level}.</span>
                <span>{spell.name}</span>
                {spell.concentration && (
                  <span className="text-xs text-slate-400">(conc.)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

function Features({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Özellikler">
      {sheet.racialTraits.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-slate-500">Irk</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {sheet.racialTraits.map((trait) => (
              <li key={trait.id}>
                <span className="font-medium">{trait.name}:</span>{' '}
                <span className="text-slate-600">{trait.desc[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.backgroundFeature && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-slate-500">Geçmiş</h3>
          <p className="mt-1 text-sm">
            <span className="font-medium">{sheet.backgroundFeature.name}:</span>{' '}
            <span className="text-slate-600">{sheet.backgroundFeature.desc[0]}</span>
          </p>
        </div>
      )}

      {sheet.classFeatures.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-slate-500">{sheet.className}</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {sheet.classFeatures.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="text-slate-400">sv{f.level}</span> {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.subclassFeatures.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-500">{sheet.subclassName}</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {sheet.subclassFeatures.map((f) => (
              <li key={f.id}>
                <span className="text-slate-400">sv{f.level}</span> {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

function Inventory({ sheet }: { sheet: ReturnType<typeof buildSheet> }) {
  return (
    <Section title="Ekipman ve diller">
      {sheet.equipmentList.length === 0 ? (
        <p className="text-sm text-slate-500">Envanter boş.</p>
      ) : (
        <>
          <ul className="grid gap-x-4 text-sm sm:grid-cols-2">
            {sheet.equipmentList.map((entry) => (
              <li key={entry.itemId} className="flex gap-2">
                <span>{entry.item?.name ?? entry.itemId}</span>
                {entry.quantity > 1 && <span className="text-slate-400">×{entry.quantity}</span>}
                {entry.equipped && <span className="text-xs text-accent">kuşanılı</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            {sheet.weight.total} lb / {sheet.carrying.capacity} lb
            {sheet.weight.effect && ` — ${sheet.weight.effect}`}
          </p>
        </>
      )}

      <p className="mt-3 border-t border-slate-100 pt-2 text-sm">
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
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
