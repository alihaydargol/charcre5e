import { classes, races, subraces, traits } from '../data/registry.ts'
import { type Character } from './character.ts'
import { levelTrack } from './multiclass.ts'
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
 * SRD verisi mekanikleri kodlamaz — özellik metni düzyazıdır. Bu yüzden SRD
 * özelliklerinin mekanik etkisi burada elle eşleştiriliyor.
 *
 * Homebrew özellikler bu listeye giremez (kod değişikliği gerekirdi); onlar
 * mekaniği kendi kayıtlarında `hpPerLevel` alanıyla taşır. İki kaynağın
 * birlikte var olması bilinçli: SRD'de mekanik düzyazıda, homebrew'de veride.
 */
const HP_PER_LEVEL_TRAITS: Record<string, number> = {
  /** Hill Dwarf: "Hit point maksimumun 1 artar ve her seviyede 1 daha artar." */
  'dwarven-toughness': 1,
}

/**
 * Karakterin ırk/alt ırk özelliklerinden gelen seviye başına HP bonusu.
 *
 * Hem SRD eşleştirmesine hem özelliğin kendi `hpPerLevel` alanına bakar;
 * ikisi de doluysa büyüğü alınır (aynı mekaniği iki kez saymamak için).
 */
export function hpPerLevelBonus(character: Character): number {
  const traitIds = [
    ...(character.raceId ? (races.get(character.raceId)?.traits ?? []) : []),
    ...(character.subraceId ? (subraces.get(character.subraceId)?.traits ?? []) : []),
  ]
  return traitIds.reduce((sum, id) => {
    const srd = HP_PER_LEVEL_TRAITS[id] ?? 0
    const declared = traits.get(id)?.hpPerLevel ?? 0
    return sum + Math.max(srd, declared)
  }, 0)
}

/**
 * Karakter seviyesi sırasına göre hit dice — index 0 = 1. seviye.
 *
 * Multiclass'ta her seviye, o seviyenin verildiği sınıfın zarını kullanır.
 * Seviyelerin hangi SIRAYLA alındığı karakterde saklanmıyor; `classes`
 * dizisinin sırası kanonik kabul ediliyor (önce ilk sınıfın tüm seviyeleri,
 * sonra ikincininki).
 *
 * Bu bir basitleştirme ama toplam HP'yi etkilemiyor: hangi sırayla alınırsa
 * alınsın aynı zarlardan aynı sayıda atılır. Yalnızca "7. seviyede hangi zarı
 * atacağım" sorusunun cevabı sıraya bağlı.
 */
export function hitDiceByLevel(character: Character): number[] {
  return levelTrack(character).map((entry) => classes.get(entry.classId)?.hitDie ?? 0)
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
  const dice = hitDiceByLevel(character)
  const level = dice.length

  if (level === 0) {
    return { total: 0, firstLevel: 0, laterLevels: 0, constitution: 0, traits: 0, hitDie: 0 }
  }

  const conMod = abilityModifiers(character).con
  const traits = hpPerLevelBonus(character) * level

  // 1. seviye her zaman ilk sınıfın zarının maksimumu.
  const firstLevel = dice[0]
  let laterLevels = 0

  for (let i = 1; i < dice.length; i += 1) {
    if (character.hp.method === 'roll') {
      // Zar atılmamışsa ortalamaya düşeriz; kullanıcı henüz atmamış olabilir.
      laterLevels += character.hp.rolls[i - 1] ?? averageHitDie(dice[i])
    } else {
      laterLevels += averageHitDie(dice[i])
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
    hitDie: dice[0],
  }
}

/**
 * Belirli bir karakter seviyesinde atılacak hit die.
 * Seviye verilmezse en son kazanılan seviye kullanılır.
 */
export function rollHitDie(character: Character, rng: Rng, level?: number): number {
  const dice = hitDiceByLevel(character)
  if (dice.length === 0) throw new Error('Sınıfı olmayan karakter için hit die atılamaz')
  const die = dice[(level ?? dice.length) - 1] ?? dice[dice.length - 1]
  return rollDie(die, rng)
}

/**
 * Kısa dinlenmede harcanabilecek hit dice.
 *
 * Multiclass'ta tek bir havuz değil, zar boyutuna göre ayrı havuzlar vardır:
 * Fighter 3 / Wizard 2 bir karakterin 3d10 ve 2d6'sı olur, 5 tane aynı zarı
 * değil.
 */
export function hitDicePool(character: Character): { die: number; count: number }[] {
  const counts = new Map<number, number>()
  for (const die of hitDiceByLevel(character)) {
    if (die > 0) counts.set(die, (counts.get(die) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([die, count]) => ({ die, count }))
}
