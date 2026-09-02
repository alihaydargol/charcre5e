import { races, skills, traits } from '../../data/registry.ts'
import { getValidChoices } from '../../rules/choices.ts'
import type { Character } from '../../rules/character.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import OptionGrid from './OptionGrid.tsx'
import Section from './Section.tsx'

export default function StepRace({ character }: { character: Character }) {
  const { setRace, setSubrace, toggleRaceAbilityBonus, toggleTool, toggleRaceSkill, toggleRaceLanguage } =
    useCharacterStore()

  const race = character.raceId ? races.get(character.raceId) : undefined
  const raceChoices = getValidChoices(character, { kind: 'race' })
  const subraceChoices = getValidChoices(character, { kind: 'subrace' })
  const bonusChoices = getValidChoices(character, { kind: 'raceAbilityBonus' })
  const languageChoices = getValidChoices(character, { kind: 'raceLanguages' })

  return (
    <div className="space-y-6">
      <Section
        title="Irk"
        hint="Irkın yetenek bonuslarını, hızını ve doğuştan gelen özelliklerini belirler."
      >
        <OptionGrid
          options={raceChoices.options}
          selected={character.raceId ? [character.raceId] : []}
          onToggle={setRace}
          columns={3}
        />
      </Section>

      {race && (
        <Section title={`${race.name} özellikleri`}>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-900">Hız:</span> {race.speed} ft ·{' '}
              <span className="font-medium text-slate-900">Boyut:</span> {race.size}
            </li>
            {race.traits.map((id) => {
              const trait = traits.get(id)
              if (!trait) return null
              return (
                <li key={id}>
                  <span className="font-medium text-slate-900">{trait.name}:</span>{' '}
                  {trait.desc[0]}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {subraceChoices.applicable && (
        <Section title="Alt ırk" hint="Alt ırk ek yetenek bonusu ve özellik getirir.">
          <OptionGrid
            options={subraceChoices.options}
            selected={character.subraceId ? [character.subraceId] : []}
            onToggle={setSubrace}
          />
        </Section>
      )}

      {bonusChoices.applicable && (
        <Section
          title="Yetenek bonusu seçimi"
          hint={`${bonusChoices.choose} farklı yeteneğe +1 dağıt.`}
        >
          <OptionGrid
            options={bonusChoices.options}
            selected={character.raceAbilityChoice}
            onToggle={(id) =>
              toggleRaceAbilityBonus(id as 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', bonusChoices.choose)
            }
            columns={3}
          />
        </Section>
      )}

      {languageChoices.applicable && (
        <Section title="Ek dil" hint={`${languageChoices.choose} dil seç.`}>
          <OptionGrid
            options={languageChoices.options}
            selected={character.proficiencies.raceLanguages}
            onToggle={(id) => toggleRaceLanguage(id, languageChoices.choose)}
            columns={3}
          />
        </Section>
      )}

      {race?.traits.map((traitId) => {
        const trait = traits.get(traitId)
        if (!trait?.proficiencyChoice) return null
        const choices = getValidChoices(character, { kind: 'traitProficiency', traitId })
        const pool = choices.options.map((o) => o.id)
        // Havuz becerilerden mi oluşuyor (Half-Elf) yoksa aletlerden mi (Dwarf)?
        // Beceri seçimleri raceSkills'e yazılır ki sınıf seçimiyle karışmasın.
        const isSkillChoice = pool.every((id) => skills.has(id))
        const selected = isSkillChoice
          ? character.proficiencies.raceSkills
          : character.proficiencies.tools

        return (
          <Section
            key={traitId}
            title={trait.name}
            hint={`${choices.choose} seçim yap. ${trait.desc[0]}`}
          >
            <OptionGrid
              options={choices.options}
              selected={selected.filter((id) => pool.includes(id))}
              onToggle={(id) =>
                isSkillChoice
                  ? toggleRaceSkill(id, choices.choose)
                  : toggleTool(id, choices.choose, pool)
              }
              columns={3}
            />
          </Section>
        )
      })}
    </div>
  )
}
