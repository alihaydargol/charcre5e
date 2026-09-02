import { backgrounds, classes, languages, races, skills, subraces } from '../../data/registry.ts'
import type { Equipment } from '../../data/schema.ts'
import { abilityScores, formatModifier } from '../../rules/abilities.ts'
import { ABILITY_IDS, totalLevel, type Character } from '../../rules/character.ts'
import {
  armorClass,
  knownLanguages,
  passivePerception,
  racialTraitIds,
  savingThrows,
  skillModifiers,
  skillProficiencies,
} from '../../rules/derived.ts'
import { maxHitPoints } from '../../rules/hitpoints.ts'
import { spellcasting } from '../../rules/spellcasting.ts'
import { isCharacterComplete } from './steps.ts'
import Section from './Section.tsx'

export default function StepSummary({
  character,
  equipment,
  onSave,
}: {
  character: Character
  equipment: Map<string, Equipment>
  onSave: () => void
}) {
  const { ready, issues } = isCharacterComplete(character)

  const race = character.raceId ? races.get(character.raceId) : undefined
  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined
  const scores = abilityScores(character)
  const hp = maxHitPoints(character)
  const ac = armorClass(character, equipment)
  const saves = savingThrows(character)
  const mods = skillModifiers(character)
  const proficient = [...skillProficiencies(character)]
  const casting = spellcasting(character)

  const backgroundName =
    character.background?.kind === 'srd'
      ? backgrounds.get(character.background.id)?.name
      : character.background?.value.name

  return (
    <div className="space-y-6">
      {ready ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-900">Karakterin hazır.</p>
          <p className="mt-1 text-sm text-emerald-800">
            Kaydettiğinde tarayıcına yazılacak; hiçbir yere gönderilmiyor.
          </p>
          <button
            type="button"
            onClick={onSave}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Karakteri kaydet
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Kaydetmeden önce şunlar eksik:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Kimlik">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="İSİM" value={character.name || '—'} />
          <Row
            label="IRK"
            value={subrace ? `${subrace.name} (${race?.name})` : (race?.name ?? '—')}
          />
          <Row
            label="SINIF"
            value={cls ? `${cls.name} · ${totalLevel(character)}. seviye` : '—'}
          />
          <Row label="GEÇMİŞ" value={backgroundName ?? '—'} />
          {character.notes.alignment && (
            <Row label="ALIGNMENT" value={character.notes.alignment} />
          )}
        </dl>
      </Section>

      <Section title="Temel değerler">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="HIT POINTS" value={hp.total} />
          <Tile label="ARMOR CLASS" value={ac.value} />
          <Tile label="PASİF ALGI" value={passivePerception(character)} />
          <Tile label="HIZ" value={`${race?.speed ?? 30} ft`} />
        </dl>
      </Section>

      <Section title="Yetenekler ve kurtarma atışları">
        <ul className="grid gap-2 sm:grid-cols-3">
          {ABILITY_IDS.map((ability) => (
            <li key={ability} className="rounded-lg border border-slate-200 bg-white p-3">
              <span className="text-xs font-semibold text-slate-400">{ability.toUpperCase()}</span>
              <span className="block text-xl font-semibold">
                {scores[ability].total}{' '}
                <span className="text-base font-normal text-slate-500">
                  ({formatModifier(scores[ability].modifier)})
                </span>
              </span>
              <span
                className={
                  saves[ability].proficient
                    ? 'text-xs font-medium text-accent'
                    : 'text-xs text-slate-400'
                }
              >
                Save {formatModifier(saves[ability].value)}
                {saves[ability].proficient && ' ●'}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {proficient.length > 0 && (
        <Section title="Yeterlilik kazanılan beceriler">
          <ul className="flex flex-wrap gap-2">
            {proficient
              .map((id) => skills.get(id))
              .filter((s) => s !== undefined)
              .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
              .map((skill) => (
                <li
                  key={skill.id}
                  className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent"
                >
                  {skill.name} {formatModifier(mods[skill.id].value)}
                </li>
              ))}
          </ul>
        </Section>
      )}

      {racialTraitIds(character).length > 0 && (
        <Section title="Irk özellikleri">
          <p className="text-sm text-slate-600">
            {racialTraitIds(character)
              .map((id) => id.replaceAll('-', ' '))
              .join(', ')}
          </p>
        </Section>
      )}

      <Section title="Diller">
        <p className="text-sm text-slate-600">
          {[...knownLanguages(character)]
            .map((id) => languages.get(id)?.name ?? id)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .join(', ') || '—'}
        </p>
      </Section>

      {casting.length > 0 && (
        <Section title="Büyücülük">
          {casting.map((info) => (
            <p key={info.classId} className="text-sm text-slate-600">
              Save DC <strong>{info.saveDC}</strong> · Saldırı{' '}
              <strong>{formatModifier(info.spellAttackBonus)}</strong> ·{' '}
              {character.spells.cantrips.length} cantrip, {character.spells.known.length} büyü
            </p>
          ))}
        </Section>
      )}

      {character.equipment.length > 0 && (
        <Section title="Ekipman">
          <p className="text-sm text-slate-600">
            {character.equipment
              .map((entry) => {
                const item = equipment.get(entry.itemId)
                return entry.quantity > 1
                  ? `${item?.name ?? entry.itemId} ×${entry.quantity}`
                  : (item?.name ?? entry.itemId)
              })
              .join(', ')}
          </p>
        </Section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <dt className="text-xs tracking-wide text-slate-400">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  )
}
