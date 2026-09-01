import { classes, races, subraces } from '../../data/registry.ts'
import type { Equipment } from '../../data/schema.ts'
import { abilityScores, formatModifier } from '../../rules/abilities.ts'
import { ABILITY_IDS, totalLevel, type Character } from '../../rules/character.ts'
import { armorClass, initiative, passivePerception, savingThrows, walkingSpeed } from '../../rules/derived.ts'
import { maxHitPoints } from '../../rules/hitpoints.ts'
import { characterProficiencyBonus } from '../../rules/progression.ts'
import { spellcasting } from '../../rules/spellcasting.ts'

/**
 * Sihirbazın yanında duran canlı önizleme.
 *
 * Her seçim anında burada karşılığını gösterir — kullanıcı "CON +2 ne işe
 * yarıyor" sorusunu sormak zorunda kalmaz, HP'nin arttığını görür.
 */
export default function LivePreview({
  character,
  equipment,
}: {
  character: Character
  equipment: Map<string, Equipment>
}) {
  const level = totalLevel(character)
  const hasClass = character.classes.length > 0
  const scores = abilityScores(character)
  const hp = maxHitPoints(character)
  const ac = armorClass(character, equipment)
  const saves = savingThrows(character)
  const casting = spellcasting(character)

  const race = character.raceId ? races.get(character.raceId) : undefined
  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined

  const heading = [subrace?.name ?? race?.name, cls?.name].filter(Boolean).join(' ')

  return (
    <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Canlı önizleme
        </h2>
        <p className="mt-1 font-semibold">
          {character.name || 'İsimsiz karakter'}
        </p>
        <p className="text-sm text-slate-500">
          {heading ? `${heading}${hasClass ? ` · ${level}. seviye` : ''}` : 'Henüz ırk ve sınıf seçilmedi'}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="HP" value={hasClass ? hp.total : '—'} />
        <Stat label="AC" value={ac.value} />
        <Stat label="Hız" value={`${walkingSpeed(character)} ft`} />
        <Stat label="Initiative" value={formatModifier(initiative(character))} />
        <Stat label="PB" value={formatModifier(characterProficiencyBonus(character))} />
        <Stat label="Pas. Alg." value={passivePerception(character)} />
      </dl>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Yetenekler
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {ABILITY_IDS.map((ability) => {
            const score = scores[ability]
            return (
              <li
                key={ability}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-center"
              >
                <span className="block text-[10px] font-semibold uppercase text-slate-400">
                  {ability}
                </span>
                <span className="block text-lg font-semibold leading-tight">
                  {formatModifier(score.modifier)}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {score.total}
                  {score.racial > 0 && (
                    <span className="text-accent"> (+{score.racial})</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {hasClass && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kurtarma atışları
          </h3>
          <ul className="grid grid-cols-3 gap-1 text-sm">
            {ABILITY_IDS.map((ability) => (
              <li
                key={ability}
                className={saves[ability].proficient ? 'font-semibold text-accent' : 'text-slate-500'}
              >
                {ability.toUpperCase()} {formatModifier(saves[ability].value)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {casting.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Büyücülük
          </h3>
          {casting.map((info) => (
            <div key={info.classId} className="text-sm text-slate-600">
              <p>
                Save DC <span className="font-semibold">{info.saveDC}</span> · Saldırı{' '}
                <span className="font-semibold">{formatModifier(info.spellAttackBonus)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {info.pactMagic ? 'Pact Magic: ' : 'Slotlar: '}
                {info.spellSlots
                  .map((count, i) => (count > 0 ? `${count}×${i + 1}.sv` : null))
                  .filter(Boolean)
                  .join(' · ') || 'yok'}
              </p>
            </div>
          ))}
        </div>
      )}

      {hasClass && hp.total > 0 && (
        <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
          HP: d{hp.hitDie} maks {hp.firstLevel}
          {hp.laterLevels > 0 && ` + ${hp.laterLevels}`}
          {hp.constitution !== 0 && ` + CON ${formatModifier(hp.constitution)}`}
          {hp.traits > 0 && ` + ırk ${hp.traits}`}
        </p>
      )}
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold leading-tight">{value}</dd>
    </div>
  )
}
