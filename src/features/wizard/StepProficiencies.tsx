import { classes, languages, skills } from '../../data/registry.ts'
import { formatModifier } from '../../rules/abilities.ts'
import type { Character } from '../../rules/character.ts'
import { getValidChoices } from '../../rules/choices.ts'
import { knownLanguages, skillModifiers, skillProficiencies } from '../../rules/derived.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import OptionGrid from './OptionGrid.tsx'
import Section from './Section.tsx'

export default function StepProficiencies({ character }: { character: Character }) {
  const { toggleSkill, toggleLanguage } = useCharacterStore()

  const skillChoices = getValidChoices(character, { kind: 'classSkills' })
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined
  const mods = skillModifiers(character)
  const proficient = skillProficiencies(character)
  const known = knownLanguages(character)

  // Sınıf listesindeki seçimler ayrı sayılır; ırk/geçmiş becerileri buraya girmez.
  const selectableIds = new Set(skillChoices.options.map((o) => o.id))
  const chosenFromClass = character.proficiencies.skills.filter((id) => selectableIds.has(id))

  // Geçmişin verdiği ek dil seçimi (Acolyte: istediğin iki dil).
  const backgroundLanguageCount =
    character.background?.kind === 'srd'
      ? (character.background.id === 'acolyte' ? 2 : 0)
      : (character.background?.value.languageCount ?? 0)

  const raceLanguagePool = getValidChoices(character, { kind: 'raceLanguages' }).options.map(
    (o) => o.id,
  )
  const extraLanguagePool = languages
    .all()
    .filter((l) => !known.has(l.id) || character.proficiencies.languages.includes(l.id))
    .filter((l) => !raceLanguagePool.includes(l.id))

  return (
    <div className="space-y-6">
      {skillChoices.applicable ? (
        <Section
          title="Sınıf becerileri"
          hint={`${cls?.name} ${skillChoices.choose} beceri seçer. ${chosenFromClass.length}/${skillChoices.choose} seçildi.`}
        >
          <OptionGrid
            options={skillChoices.options}
            selected={character.proficiencies.skills}
            onToggle={(id) => toggleSkill(id, skillChoices.choose)}
            columns={3}
          />
        </Section>
      ) : (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {skillChoices.reason}
        </p>
      )}

      {backgroundLanguageCount > 0 && (
        <Section
          title="Geçmişten gelen diller"
          hint={`Geçmişin ${backgroundLanguageCount} ek dil veriyor.`}
        >
          <OptionGrid
            options={extraLanguagePool.map((l) => ({
              id: l.id,
              name: l.name,
              description: l.type === 'Exotic' ? 'Exotic' : undefined,
            }))}
            selected={character.proficiencies.languages}
            onToggle={(id) =>
              toggleLanguage(
                id,
                backgroundLanguageCount,
                extraLanguagePool.map((l) => l.id),
              )
            }
            columns={3}
          />
        </Section>
      )}

      <Section title="Tüm beceriler" hint="Yeterliliğin olanlar vurgulanmıştır.">
        <ul className="grid gap-1 sm:grid-cols-2">
          {skills.all().map((skill) => (
            <li
              key={skill.id}
              className={[
                'flex items-center justify-between rounded-md px-3 py-1.5 text-sm',
                proficient.has(skill.id) ? 'bg-accent-soft font-medium' : 'text-slate-600',
              ].join(' ')}
            >
              <span>
                {skill.name}{' '}
                <span className="text-xs text-slate-400">{skill.ability.toUpperCase()}</span>
              </span>
              <span className="font-semibold">{formatModifier(mods[skill.id].value)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bildiğin diller">
        <p className="text-sm text-slate-600">
          {[...known]
            .map((id) => languages.get(id)?.name ?? id)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .join(', ') || 'Henüz dil yok'}
        </p>
      </Section>
    </div>
  )
}
