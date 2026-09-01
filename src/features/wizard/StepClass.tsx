import { classes, getClassLevel } from '../../data/registry.ts'
import { getValidChoices } from '../../rules/choices.ts'
import type { Character } from '../../rules/character.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import OptionGrid from './OptionGrid.tsx'
import Section from './Section.tsx'

export default function StepClass({ character }: { character: Character }) {
  const { setClass } = useCharacterStore()
  const choices = getValidChoices(character, { kind: 'class' })
  const selected = character.classes[0] ? classes.get(character.classes[0].classId) : undefined

  return (
    <div className="space-y-6">
      <Section
        title="Sınıf"
        hint="Sınıf karakterin ne yaptığını belirler: dövüş tarzı, büyü, beceriler."
      >
        <OptionGrid
          options={choices.options}
          selected={character.classes[0] ? [character.classes[0].classId] : []}
          onToggle={setClass}
          columns={3}
        />
      </Section>

      {selected && (
        <Section title={`${selected.name} — 1. seviye`}>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-900">Hit die:</span> d{selected.hitDie} ·{' '}
              <span className="font-medium text-slate-900">Kurtarma atışı:</span>{' '}
              {selected.savingThrows.map((s) => s.toUpperCase()).join(', ')}
            </li>
            <li>
              <span className="font-medium text-slate-900">Alt sınıf:</span>{' '}
              {selected.subclassLevel}. seviyede seçilir
              {selected.subclassLevel > 1 && ' (şimdi değil)'}
            </li>
            {selected.spellcasting && (
              <li>
                <span className="font-medium text-slate-900">Büyü:</span>{' '}
                {selected.spellcasting.ability.toUpperCase()} kullanır,{' '}
                {selected.spellcasting.startLevel}. seviyede başlar
                {selected.spellcasting.pactMagic && ' (Pact Magic)'}
              </li>
            )}
            <li>
              <span className="font-medium text-slate-900">1. seviye özellikleri:</span>{' '}
              {getClassLevel(selected.id, 1)?.features.length
                ? getClassLevel(selected.id, 1)!
                    .features.map((id) => id.replace(`${selected.id}-`, '').replaceAll('-', ' '))
                    .join(', ')
                : 'yok'}
            </li>
          </ul>
          {selected.subclassLevel === 1 && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              {selected.name} alt sınıfını 1. seviyede seçer. Alt sınıf seçimi seviye atlama
              ekranında yapılacak.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}
