import { races, subraces } from '../data/registry.ts'
import type { AbilityId } from '../data/schema.ts'
import { ABILITY_IDS, type Character } from './character.ts'
import { roll4d6DropLowest, type Rng } from './dice.ts'

/** Yetenek puanı → modifier. 10-11 → +0, her 2 puan ±1. */
export function modifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** "+3" / "-1" biçiminde işaretli gösterim. */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

// ---------------------------------------------------------------------------
// Puan dağıtma yöntemleri
// ---------------------------------------------------------------------------

/** Standart dizi: oyuncu bu altı değeri yeteneklere dağıtır. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15

/**
 * Point-buy maliyet tablosu. 14 ve 15 ekstra pahalıdır — bu, tek bir yeteneği
 * uç noktaya çekmeyi caydırmak içindir.
 */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

export function pointBuyCost(score: number): number {
  const cost = POINT_BUY_COST[score]
  if (cost === undefined) {
    throw new Error(`Point-buy ${POINT_BUY_MIN}-${POINT_BUY_MAX} aralığını destekler, verilen: ${score}`)
  }
  return cost
}

export interface PointBuyState {
  spent: number
  remaining: number
  valid: boolean
  errors: string[]
}

/** Bir puan dağılımının point-buy kurallarına uyup uymadığını değerlendirir. */
export function evaluatePointBuy(scores: Record<AbilityId, number>): PointBuyState {
  const errors: string[] = []
  let spent = 0

  for (const ability of ABILITY_IDS) {
    const score = scores[ability]
    if (score < POINT_BUY_MIN || score > POINT_BUY_MAX) {
      errors.push(
        `${ability.toUpperCase()} ${score} olamaz; point-buy ${POINT_BUY_MIN}-${POINT_BUY_MAX} arası izin verir.`,
      )
      continue
    }
    spent += pointBuyCost(score)
  }

  const remaining = POINT_BUY_BUDGET - spent
  if (remaining < 0) {
    errors.push(`${POINT_BUY_BUDGET} puanlık bütçe ${-remaining} puan aşıldı.`)
  }

  return { spent, remaining, valid: errors.length === 0, errors }
}

/** Point-buy'da bir yeteneği bir puan artırmanın maliyeti (artırılamıyorsa null). */
export function pointBuyIncreaseCost(score: number): number | null {
  if (score >= POINT_BUY_MAX) return null
  return pointBuyCost(score + 1) - pointBuyCost(score)
}

/** Altı yetenek için 4d6-en-düşüğü-çıkar atar. */
export function rollAbilityScores(rng: Rng): { total: number; dice: number[]; dropped: number }[] {
  return ABILITY_IDS.map(() => roll4d6DropLowest(rng))
}

// ---------------------------------------------------------------------------
// Nihai puanlar — ırk, alt ırk ve ASI bonusları uygulanmış
// ---------------------------------------------------------------------------

export interface AbilityBreakdown {
  base: number
  racial: number
  asi: number
  total: number
  modifier: number
}

/**
 * Bir karakterin nihai yetenek puanları.
 *
 * Sıra: ham puan + ırk bonusu + alt ırk bonusu + ırkın seçmeli bonusu + ASI.
 * Feat'lerin verdiği puan artışları Aşama 3B'de eklenecek (SRD'deki tek feat
 * olan Grappler puan vermez).
 */
export function abilityScores(character: Character): Record<AbilityId, AbilityBreakdown> {
  const racial: Record<string, number> = {}

  const race = character.raceId ? races.get(character.raceId) : undefined
  for (const bonus of race?.abilityBonuses ?? []) {
    racial[bonus.ability] = (racial[bonus.ability] ?? 0) + bonus.bonus
  }

  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined
  for (const bonus of subrace?.abilityBonuses ?? []) {
    racial[bonus.ability] = (racial[bonus.ability] ?? 0) + bonus.bonus
  }

  // Half-Elf gibi ırklarda oyuncunun seçtiği ek bonuslar.
  if (race?.abilityBonusChoice) {
    for (const ability of character.raceAbilityChoice) {
      racial[ability] = (racial[ability] ?? 0) + race.abilityBonusChoice.bonus
    }
  }

  const asi: Record<string, number> = {}
  for (const choice of character.levelChoices) {
    if (choice.kind !== 'asi') continue
    for (const increase of choice.increases) {
      asi[increase.ability] = (asi[increase.ability] ?? 0) + increase.amount
    }
  }

  const result = {} as Record<AbilityId, AbilityBreakdown>
  for (const ability of ABILITY_IDS) {
    const base = character.abilities[ability]
    const racialBonus = racial[ability] ?? 0
    const asiBonus = asi[ability] ?? 0
    // 5e'de yetenek puanı üst sınırı 20'dir (feat/sihirli eşya istisnaları hariç).
    const total = Math.min(20, base + racialBonus + asiBonus)
    result[ability] = {
      base,
      racial: racialBonus,
      asi: asiBonus,
      total,
      modifier: modifier(total),
    }
  }
  return result
}

/** Kısayol: yalnızca modifier'lar. */
export function abilityModifiers(character: Character): Record<AbilityId, number> {
  const scores = abilityScores(character)
  const result = {} as Record<AbilityId, number>
  for (const ability of ABILITY_IDS) result[ability] = scores[ability].modifier
  return result
}
