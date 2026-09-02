import { useState } from 'react'
import type { AbilityId } from '../../data/schema.ts'
import {
  abilityScores,
  evaluatePointBuy,
  formatModifier,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  pointBuyIncreaseCost,
  rollAbilityScores,
  STANDARD_ARRAY,
} from '../../rules/abilities.ts'
import { ABILITY_IDS, type AbilityMethod, type Character } from '../../rules/character.ts'
import { createRng, randomSeed } from '../../rules/dice.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import Section from './Section.tsx'

const METHODS: { id: AbilityMethod; label: string; hint: string }[] = [
  {
    id: 'pointbuy',
    label: 'Point Buy',
    hint: '27 puanı dağıt. Dengeli ve en yaygın yöntem; masaların çoğu bunu kullanır.',
  },
  {
    id: 'standard',
    label: 'Standart Dizi',
    hint: '15, 14, 13, 12, 10, 8 değerlerini yeteneklere dağıt. En hızlı yol.',
  },
  {
    id: 'roll',
    label: 'Zar At',
    hint: '4d6 at, en düşüğü çıkar. Şansa bağlı; çok güçlü ya da çok zayıf çıkabilir.',
  },
  { id: 'manual', label: 'Elle Gir', hint: 'Değerleri doğrudan yaz. Masan kendi kuralını uyguluyorsa.' },
]

const ABILITY_NAMES: Record<AbilityId, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export default function StepAbilities({ character }: { character: Character }) {
  const { setAbilityMethod, setAbility, setAbilities } = useCharacterStore()
  const [rolls, setRolls] = useState<{ total: number; dice: number[]; dropped: number }[]>()

  const scores = abilityScores(character)
  const pointBuy = evaluatePointBuy(character.abilities)

  const rollNew = () => {
    const seed = randomSeed()
    const result = rollAbilityScores(createRng(seed))
    setRolls(result)
    // Atılan değerleri büyükten küçüğe sırayla yerleştiririz; kullanıcı ister
    // sonra elle değiştirir.
    const sorted = [...result].sort((a, b) => b.total - a.total).map((r) => r.total)
    setAbilities({
      str: sorted[0],
      dex: sorted[1],
      con: sorted[2],
      int: sorted[3],
      wis: sorted[4],
      cha: sorted[5],
    })
  }

  return (
    <div className="space-y-6">
      <Section title="Yöntem" hint="Yetenek puanlarını nasıl belirlemek istersin?">
        <ul className="grid gap-2 sm:grid-cols-2">
          {METHODS.map((method) => (
            <li key={method.id}>
              <button
                type="button"
                onClick={() => setAbilityMethod(method.id)}
                aria-pressed={character.abilityMethod === method.id}
                className={[
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  character.abilityMethod === method.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="font-medium">{method.label}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{method.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {character.abilityMethod === 'pointbuy' && (
        <p
          role="status"
          className={[
            'rounded-md px-3 py-2 text-sm',
            pointBuy.remaining === 0
              ? 'bg-emerald-50 text-emerald-800'
              : pointBuy.remaining < 0
                ? 'bg-accent-soft text-accent'
                : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {pointBuy.remaining >= 0
            ? `${pointBuy.remaining} / ${POINT_BUY_BUDGET} puan kaldı`
            : `Bütçeyi ${-pointBuy.remaining} puan aştın`}
          {' · '}Puanlar {POINT_BUY_MIN}-{POINT_BUY_MAX} arasında olmalı
        </p>
      )}

      {character.abilityMethod === 'standard' && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Dağıtılacak değerler: {STANDARD_ARRAY.join(', ')}
        </p>
      )}

      {character.abilityMethod === 'roll' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={rollNew}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {rolls ? 'Yeniden at' : '4d6 at (en düşüğü çıkar)'}
          </button>
          {rolls && (
            <ul className="flex flex-wrap gap-2 text-xs text-slate-500">
              {rolls.map((roll, i) => (
                <li key={i} className="rounded border border-slate-200 px-2 py-1">
                  {roll.dice.map((d, j) => (
                    <span key={j} className={d === roll.dropped && roll.dice.indexOf(d) === j ? 'line-through opacity-50' : ''}>
                      {d}
                      {j < 3 && ' '}
                    </span>
                  ))}
                  <span className="ml-1 font-semibold text-slate-700">= {roll.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section title="Puanlar" hint="Sağdaki değer ırk bonusu eklenmiş hâlidir.">
        <ul className="space-y-2">
          {ABILITY_IDS.map((ability) => {
            const base = character.abilities[ability]
            const score = scores[ability]
            const increaseCost =
              character.abilityMethod === 'pointbuy' ? pointBuyIncreaseCost(base) : null
            const canIncrease =
              character.abilityMethod !== 'pointbuy'
                ? base < 20
                : increaseCost !== null && pointBuy.remaining >= increaseCost
            const minimum = character.abilityMethod === 'pointbuy' ? POINT_BUY_MIN : 1

            return (
              <li
                key={ability}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <span className="w-32 shrink-0">
                  <span className="block font-medium">{ABILITY_NAMES[ability]}</span>
                  <span className="block text-xs text-slate-400">{ability.toUpperCase()}</span>
                </span>

                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAbility(ability, base - 1)}
                    disabled={base <= minimum}
                    aria-label={`${ABILITY_NAMES[ability]} azalt`}
                    className="size-8 rounded border border-slate-300 text-slate-600 disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={base}
                    onChange={(e) => setAbility(ability, Number(e.target.value))}
                    aria-label={`${ABILITY_NAMES[ability]} puanı`}
                    className="w-14 rounded border border-slate-300 px-2 py-1 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setAbility(ability, base + 1)}
                    disabled={!canIncrease}
                    aria-label={`${ABILITY_NAMES[ability]} artır`}
                    className="size-8 rounded border border-slate-300 text-slate-600 disabled:opacity-30"
                  >
                    +
                  </button>
                </span>

                <span className="ml-auto text-right text-sm">
                  {score.racial > 0 && (
                    <span className="block text-xs text-accent">ırk +{score.racial}</span>
                  )}
                  <span className="block font-semibold">
                    {score.total} ({formatModifier(score.modifier)})
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
