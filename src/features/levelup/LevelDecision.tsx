import { useState } from 'react'
import { feats, subclasses, type Collection } from '../../data/registry.ts'
import type { Spell } from '../../data/schema.ts'
import type { AbilityId } from '../../data/schema.ts'
import { abilityScores } from '../../rules/abilities.ts'
import { ABILITY_IDS, type Character } from '../../rules/character.ts'
import { chooseRandomly, getValidChoices, randomAbilityIncreases } from '../../rules/choices.ts'
import { createRng, randomSeed } from '../../rules/dice.ts'
import type { PendingDecision } from '../../rules/progression.ts'
import { useCharacterStore } from '../../state/characterStore.ts'

/**
 * Bir seviyedeki tek karar noktasının arayüzü.
 *
 * Seçenekler her zaman `getValidChoices` üzerinden gelir; bu bileşen hiçbir
 * kural bilgisi içermez. "Benim yerime seç" de aynı katmanı kullanır
 * (`chooseRandomly`), bu yüzden rastgele seçim de tanım gereği geçerlidir.
 */
export default function LevelDecision({
  character,
  decision,
  spells,
}: {
  character: Character
  decision: PendingDecision
  spells?: Collection<Spell>
}) {
  switch (decision.kind) {
    case 'subclass':
      return <SubclassDecision character={character} decision={decision} />
    case 'asiOrFeat':
      return <AsiOrFeatDecision character={character} decision={decision} />
    case 'fightingStyle':
      return <SimpleDecision character={character} decision={decision} title="Fighting Style" />
    case 'expertise':
      return <ExpertiseDecision character={character} decision={decision} />
    default:
      void spells
      return null
  }
}

function Header({
  title,
  hint,
  onRandom,
}: {
  title: string
  hint?: string
  onRandom?: () => void
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {onRandom && (
        <button
          type="button"
          onClick={onRandom}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Benim yerime seç
        </button>
      )}
    </div>
  )
}

function OptionButtons({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; name: string; description?: string; disabledReason?: string }[]
  selected: string[]
  onSelect: (id: string) => void
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.id)
        const disabled = Boolean(option.disabledReason) && !isSelected
        return (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                'w-full rounded-md border p-2.5 text-left text-sm transition-colors',
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : disabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                    : 'border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="font-medium">{option.name}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
              )}
              {disabled && (
                <span className="mt-0.5 block text-xs text-slate-400">{option.disabledReason}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SubclassDecision({
  character,
  decision,
}: {
  character: Character
  decision: Extract<PendingDecision, { kind: 'subclass' }>
}) {
  const setLevelChoice = useCharacterStore((s) => s.setLevelChoice)
  const choices = getValidChoices(character, { kind: 'subclass', classId: decision.classId })
  const current = character.levelChoices.find(
    (c) => c.kind === 'subclass' && c.classId === decision.classId,
  )
  const selected = current?.kind === 'subclass' ? [current.subclassId] : []

  const pick = (subclassId: string) =>
    setLevelChoice({ kind: 'subclass', classId: decision.classId, level: decision.level, subclassId })

  if (!choices.applicable) {
    return <p className="text-sm text-slate-500">{choices.reason}</p>
  }

  return (
    <div className="space-y-2">
      <Header
        title="Alt sınıf"
        hint={subclasses.get(selected[0])?.flavor ?? 'Kalıcı bir seçim; sınıfının yönünü belirler.'}
        onRandom={() => {
          const [id] = chooseRandomly(
            character,
            { kind: 'subclass', classId: decision.classId },
            createRng(randomSeed()),
          )
          if (id) pick(id)
        }}
      />
      <OptionButtons options={choices.options} selected={selected} onSelect={pick} />
    </div>
  )
}

function AsiOrFeatDecision({
  character,
  decision,
}: {
  character: Character
  decision: Extract<PendingDecision, { kind: 'asiOrFeat' }>
}) {
  const setLevelChoice = useCharacterStore((s) => s.setLevelChoice)
  const clearLevelChoice = useCharacterStore((s) => s.clearLevelChoice)

  const existing = character.levelChoices.find(
    (c) =>
      (c.kind === 'asi' || c.kind === 'feat') &&
      c.classId === decision.classId &&
      c.level === decision.level,
  )
  const [mode, setMode] = useState<'asi' | 'feat'>(existing?.kind === 'feat' ? 'feat' : 'asi')

  const scores = abilityScores(character)
  const increases = existing?.kind === 'asi' ? existing.increases : []
  const spent = increases.reduce((sum, i) => sum + i.amount, 0)

  const setIncreases = (next: { ability: AbilityId; amount: number }[]) =>
    setLevelChoice({
      kind: 'asi',
      classId: decision.classId,
      level: decision.level,
      increases: next.filter((i) => i.amount > 0),
    })

  /** Bir yeteneği +1 artırır; toplam 2 puanı geçmez ve 20 sınırını aşmaz. */
  const bump = (ability: AbilityId) => {
    const current = increases.find((i) => i.ability === ability)?.amount ?? 0
    if (scores[ability].total + 1 > 20) return
    if (spent >= 2) return
    const next = increases.filter((i) => i.ability !== ability)
    next.push({ ability, amount: Math.min(2, current + 1) as 1 | 2 })
    setIncreases(next)
  }

  const featChoices = getValidChoices(character, {
    kind: 'feat',
    classId: decision.classId,
    level: decision.level,
  })
  const selectedFeat = existing?.kind === 'feat' ? [existing.featId] : []

  return (
    <div className="space-y-2">
      <Header
        title="Yetenek artışı veya feat"
        hint="Bir yeteneğe +2 ya da iki yeteneğe +1; alternatif olarak bir feat."
        onRandom={() => {
          const rng = createRng(randomSeed())
          setMode('asi')
          setIncreases(randomAbilityIncreases(character, rng))
        }}
      />

      <div className="flex gap-2">
        {(['asi', 'feat'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              clearLevelChoice(m === 'asi' ? 'feat' : 'asi', decision.classId, decision.level)
            }}
            aria-pressed={mode === m}
            className={[
              'rounded-md border px-3 py-1.5 text-sm',
              mode === m ? 'border-accent bg-accent-soft text-accent' : 'border-slate-300',
            ].join(' ')}
          >
            {m === 'asi' ? 'Yetenek artışı' : 'Feat'}
          </button>
        ))}
      </div>

      {mode === 'asi' ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{2 - spent} puan kaldı</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITY_IDS.map((ability) => {
              const added = increases.find((i) => i.ability === ability)?.amount ?? 0
              const atCap = scores[ability].total >= 20
              return (
                <li key={ability}>
                  <button
                    type="button"
                    onClick={() => bump(ability)}
                    disabled={atCap || spent >= 2}
                    title={atCap ? 'Yetenek puanı 20 üst sınırında' : undefined}
                    className={[
                      'w-full rounded-md border p-2 text-center transition-colors',
                      added > 0 ? 'border-accent bg-accent-soft' : 'border-slate-200',
                      atCap || spent >= 2 ? 'opacity-40' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="block text-[10px] font-semibold text-slate-400">
                      {ability.toUpperCase()}
                    </span>
                    <span className="block font-semibold">
                      {scores[ability].total}
                      {added > 0 && <span className="text-accent"> +{added}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {increases.length > 0 && (
            <button
              type="button"
              onClick={() => setIncreases([])}
              className="text-xs text-slate-500 underline"
            >
              Seçimi temizle
            </button>
          )}
        </div>
      ) : (
        <>
          {feats.size === 1 && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
              SRD yalnızca bir feat içerir (Grappler). Kendi feat’lerini tanımlayabilmen için
              homebrew desteği planlanıyor.
            </p>
          )}
          <OptionButtons
            options={featChoices.options}
            selected={selectedFeat}
            onSelect={(featId) =>
              setLevelChoice({
                kind: 'feat',
                classId: decision.classId,
                level: decision.level,
                featId,
              })
            }
          />
        </>
      )}
    </div>
  )
}

function SimpleDecision({
  character,
  decision,
  title,
}: {
  character: Character
  decision: Extract<PendingDecision, { kind: 'fightingStyle' }>
  title: string
}) {
  const setLevelChoice = useCharacterStore((s) => s.setLevelChoice)
  const choices = getValidChoices(character, {
    kind: 'fightingStyle',
    classId: decision.classId,
    level: decision.level,
  })
  const current = character.levelChoices.find(
    (c) => c.kind === 'fightingStyle' && c.level === decision.level,
  )
  const selected = current?.kind === 'fightingStyle' ? [current.styleId] : []

  const pick = (styleId: string) =>
    setLevelChoice({
      kind: 'fightingStyle',
      classId: decision.classId,
      level: decision.level,
      styleId,
    })

  if (!choices.applicable) return null

  return (
    <div className="space-y-2">
      <Header
        title={title}
        hint="Dövüş tarzın saldırı ve hasar hesabını değiştirir."
        onRandom={() => {
          const [id] = chooseRandomly(
            character,
            { kind: 'fightingStyle', classId: decision.classId, level: decision.level },
            createRng(randomSeed()),
          )
          if (id) pick(id)
        }}
      />
      <OptionButtons options={choices.options} selected={selected} onSelect={pick} />
    </div>
  )
}

function ExpertiseDecision({
  character,
  decision,
}: {
  character: Character
  decision: Extract<PendingDecision, { kind: 'expertise' }>
}) {
  const setLevelChoice = useCharacterStore((s) => s.setLevelChoice)
  const choices = getValidChoices(character, {
    kind: 'expertise',
    classId: decision.classId,
    level: decision.level,
  })

  const current = character.levelChoices.find(
    (c) => c.kind === 'expertise' && c.level === decision.level,
  )
  const selected = current?.kind === 'expertise' ? current.proficiencyIds : []

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : selected.length < choices.choose
        ? [...selected, id]
        : selected
    setLevelChoice({
      kind: 'expertise',
      classId: decision.classId,
      level: decision.level,
      proficiencyIds: next,
    })
  }

  if (!choices.applicable) {
    return <p className="text-sm text-slate-500">{choices.reason}</p>
  }

  return (
    <div className="space-y-2">
      <Header
        title="Expertise"
        hint={`Yeterliliğin olan ${choices.choose} beceride proficiency bonusun iki katına çıkar. ${selected.length}/${choices.choose} seçildi.`}
        onRandom={() => {
          const ids = chooseRandomly(
            character,
            { kind: 'expertise', classId: decision.classId, level: decision.level },
            createRng(randomSeed()),
          )
          setLevelChoice({
            kind: 'expertise',
            classId: decision.classId,
            level: decision.level,
            proficiencyIds: ids,
          })
        }}
      />
      <OptionButtons options={choices.options} selected={selected} onSelect={toggle} />
    </div>
  )
}
