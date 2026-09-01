import { classes, races, subraces } from '../data/registry.ts'
import { primaryClass, totalLevel, type Character } from './character.ts'
import { abilityModifiers } from './abilities.ts'
import { rollDie, type Rng } from './dice.ts'

/**
 * Hit point hesabı.
 *
 * 1. seviyede hit die'ın en yüksek değeri + CON modifier alınır. Sonraki her
 * seviyede ya ortalama (zar/2 + 1) ya da atılan zar eklenir, yine + CON.
 */

/** Bir hit die'ın "ortalama" değeri: d8 → 5, d10 → 6, d12 → 7. */
export function averageHitDie(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1
}

/**
 * Seviye başına ek HP veren özellikler.
 *
 * SRD verisi mekanikleri kodlamaz — özellik metni düzyazıdır. Bu yüzden
 * mekanik etkiyi burada açıkça eşleştiriyoruz. Liste kısa ve kapalıdır;
 * homebrew içerik için Aşama 10'da genişletilebilir bir alan eklenecek.
 */
const HP_PER_LEVEL_TRAITS: Record<string, number> = {
  /** Hill Dwarf: "Hit point maksimumun 1 artar ve her seviyede 1 daha artar." */
  'dwarven-toughness': 1,
}

/** Karakterin ırk/alt ırk özelliklerinden gelen seviye başına HP bonusu. */
export function hpPerLevelBonus(character: Character): number {
  const traitIds = [
    ...(character.raceId ? (races.get(character.raceId)?.traits ?? []) : []),
    ...(character.subraceId ? (subraces.get(character.subraceId)?.traits ?? []) : []),
  ]
  return traitIds.reduce((sum, id) => sum + (HP_PER_LEVEL_TRAITS[id] ?? 0), 0)
}

export interface HitPointBreakdown {
  total: number
  /** 1. seviyeden gelen taban (hit die max). */
  firstLevel: number
  /** 2+ seviyelerden gelen toplam (ortalama ya da zar). */
  laterLevels: number
  /** Tüm seviyeler için CON katkısı. */
  constitution: number
  /** Dwarven Toughness gibi seviye başına bonuslar. */
  traits: number
  hitDie: number
}

/**
 * Karakterin maksimum HP'si.
 *
 * `manual` yönteminde kullanıcının girdiği toplam aynen kullanılır — bazı
 * masalar kendi kurallarını uygular ve aracın buna karışmaması gerekir.
 */
export function maxHitPoints(character: Character): HitPointBreakdown {
  const primary = primaryClass(character)
  const level = totalLevel(character)

  if (!primary || level === 0) {
    return { total: 0, firstLevel: 0, laterLevels: 0, constitution: 0, traits: 0, hitDie: 0 }
  }

  const hitDie = classes.require(primary.classId).hitDie
  const conMod = abilityModifiers(character).con
  const traits = hpPerLevelBonus(character) * level

  const firstLevel = hitDie
  let laterLevels = 0

  for (let l = 2; l <= level; l += 1) {
    if (character.hp.method === 'roll') {
      // Zar atılmamışsa ortalamaya düşeriz; kullanıcı henüz atmamış olabilir.
      laterLevels += character.hp.rolls[l - 2] ?? averageHitDie(hitDie)
    } else {
      laterLevels += averageHitDie(hitDie)
    }
  }

  const constitution = conMod * level
  const computed = firstLevel + laterLevels + constitution + traits

  return {
    // CON negatifken bile karakter seviye başına en az 1 HP alır.
    total: character.hp.method === 'manual' && character.hp.manualTotal !== undefined
      ? character.hp.manualTotal
      : Math.max(level, computed),
    firstLevel,
    laterLevels,
    constitution,
    traits,
    hitDie,
  }
}

/** Seviye atlarken atılacak hit die. Sonuç `character.hp.rolls` içine yazılır. */
export function rollHitDie(character: Character, rng: Rng): number {
  const primary = primaryClass(character)
  if (!primary) throw new Error('Sınıfı olmayan karakter için hit die atılamaz')
  return rollDie(classes.require(primary.classId).hitDie, rng)
}

/** Kısa dinlenmede harcanabilecek hit dice sayısı (seviye kadar). */
export function hitDicePool(character: Character): { count: number; die: number } {
  const primary = primaryClass(character)
  return {
    count: totalLevel(character),
    die: primary ? classes.require(primary.classId).hitDie : 0,
  }
}
