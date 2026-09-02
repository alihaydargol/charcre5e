import { classes } from '../data/registry.ts'
import { getClassLevel } from '../data/classLevels.ts'
import type { AbilityId } from '../data/schema.ts'
import type { Character } from './character.ts'
import { abilityModifiers } from './abilities.ts'
import { characterProficiencyBonus } from './progression.ts'

/**
 * Büyücülük: slotlar, save DC, büyü saldırı bonusu ve hazırlanabilir büyü
 * sayısı.
 *
 * 5e'de üç ayrı ilerleme vardır ve bunlar birbirinin yerine geçmez:
 *  - Tam kaster (Bard, Cleric, Druid, Sorcerer, Wizard) — 9. seviye slota kadar
 *  - Yarı kaster (Paladin, Ranger) — 2. sınıf seviyesinde başlar, 5. slota kadar
 *  - Pact Magic (Warlock) — az sayıda ama hep en yüksek seviyeden slot,
 *    kısa dinlenmede yenilenir
 *
 * Slot tabloları veriden okunur (bkz. `class-levels.json`); burada yalnızca
 * yorumlanırlar.
 */

export interface SpellcastingInfo {
  classId: string
  ability: AbilityId
  /** Warlock'un Pact Magic'i ayrı bir kaynaktır; slotları karışmaz. */
  pactMagic: boolean
  /** 9 elemanlı dizi; index 0 = 1. seviye slot. */
  spellSlots: number[]
  /** Pact Magic'te tüm slotlar bu seviyededir. */
  pactSlotLevel?: number
  cantripsKnown?: number
  spellsKnown?: number
  saveDC: number
  spellAttackBonus: number
  /** Hazırlayan sınıflarda (Cleric, Druid, Paladin, Wizard) hazırlanabilir sayı. */
  preparedCount?: number
}

/**
 * Büyü hazırlayan sınıflar; diğerleri bildiği büyüleri sabit tutar.
 *
 * Homebrew sınıflar için karşılaştırma büyü listesi sınıfı üzerinden yapılır:
 * "Cleric gibi büyü yapar" demek hazırlamak demektir.
 */
const PREPARING_CLASSES = new Set(['cleric', 'druid', 'paladin', 'wizard'])

function prepares(classId: string): boolean {
  return PREPARING_CLASSES.has(spellListClassId(classId))
}

/**
 * Bir sınıfın büyü listesini veren sınıf id'si.
 *
 * SRD büyüleri hangi sınıfların kullanabileceğini kendi kayıtlarında taşır;
 * hiçbiri homebrew bir sınıfı listelemez. Homebrew sınıf bu yüzden hangi SRD
 * sınıfının listesini kullandığını söyler ("Wizard gibi büyü yapar") ve büyü
 * seçimi o listeden yapılır.
 */
export function spellListClassId(classId: string): string {
  return classes.get(classId)?.spellcasting?.spellList ?? classId
}

/**
 * Sınıf büyülerini defterden mi kullanıyor?
 *
 * Wizard bildiği büyüleri bir deftere yazar ve defter seviyeyle büyür; diğer
 * hazırlayan sınıflar (Cleric, Druid, Paladin) listenin tamamından hazırlar ve
 * "bilinen büyü" tutmaz. Wizard'ı model alan homebrew sınıflar da deftere
 * yazar.
 */
export function usesSpellbook(classId: string): boolean {
  return spellListClassId(classId) === 'wizard'
}

/** Save DC = 8 + proficiency bonus + büyü yeteneği modifier'ı. */
export function spellSaveDC(proficiencyBonus: number, abilityModifier: number): number {
  return 8 + proficiencyBonus + abilityModifier
}

/** Büyü saldırı bonusu = proficiency bonus + büyü yeteneği modifier'ı. */
export function spellAttackBonus(proficiencyBonus: number, abilityModifier: number): number {
  return proficiencyBonus + abilityModifier
}

/**
 * Bir karakterin her büyü yapan sınıfı için büyücülük bilgisi.
 * Büyü yapmayan karakterlerde boş dizi döner.
 */
export function spellcasting(character: Character): SpellcastingInfo[] {
  const pb = characterProficiencyBonus(character)
  const mods = abilityModifiers(character)
  const result: SpellcastingInfo[] = []

  for (const cls of character.classes) {
    const definition = classes.get(cls.classId)
    const casting = definition?.spellcasting
    if (!definition || !casting) continue
    // Paladin ve Ranger 1. seviyede henüz büyü yapamaz.
    if (cls.level < casting.startLevel) continue

    const row = getClassLevel(cls.classId, cls.level)
    const slots = row?.spellcasting?.spellSlots ?? new Array<number>(9).fill(0)
    const abilityMod = mods[casting.ability]

    const info: SpellcastingInfo = {
      classId: cls.classId,
      ability: casting.ability,
      pactMagic: casting.pactMagic,
      spellSlots: slots,
      cantripsKnown: row?.spellcasting?.cantripsKnown,
      spellsKnown: row?.spellcasting?.spellsKnown,
      saveDC: spellSaveDC(pb, abilityMod),
      spellAttackBonus: spellAttackBonus(pb, abilityMod),
    }

    if (casting.pactMagic) {
      info.pactSlotLevel = highestSlotLevel(slots)
    }
    if (prepares(cls.classId)) {
      info.preparedCount = preparedSpellCount(cls.classId, cls.level, abilityMod)
    }

    result.push(info)
  }

  return result
}

/** Slot dizisindeki en yüksek dolu seviye; hiç slot yoksa 0. */
export function highestSlotLevel(spellSlots: number[]): number {
  let highest = 0
  spellSlots.forEach((count, index) => {
    if (count > 0) highest = index + 1
  })
  return highest
}

/**
 * Hazırlanabilir büyü sayısı = büyü yeteneği modifier + sınıf seviyesi
 * (Paladin ve Ranger için seviyenin yarısı, aşağı yuvarlanır). En az 1.
 */
export function preparedSpellCount(classId: string, classLevel: number, abilityMod: number): number {
  const casting = classes.require(classId).spellcasting
  const effectiveLevel = casting && casting.startLevel > 1 ? Math.floor(classLevel / 2) : classLevel
  return Math.max(1, abilityMod + effectiveLevel)
}

/**
 * Karakterin kullanabildiği en yüksek büyü seviyesi. Warlock'ta Pact Magic
 * slot seviyesi, diğerlerinde en yüksek dolu slot.
 */
export function highestSpellLevel(character: Character): number {
  return spellcasting(character).reduce(
    (max, info) => Math.max(max, highestSlotLevel(info.spellSlots)),
    0,
  )
}

/**
 * Wizard'ın büyü defterindeki büyü sayısı.
 *
 * 1. seviyede altı büyüyle başlar, sonraki her seviyede iki büyü daha ekler.
 * Bu, "bilinen büyü" tablosundan farklıdır ve SRD verisinde tablo olarak
 * bulunmaz; formül olarak burada durur.
 */
export function wizardSpellbookSize(classLevel: number): number {
  return 6 + Math.max(0, classLevel - 1) * 2
}

/**
 * Bir sınıfın belirli seviyede öğrenebileceği büyülerin seviye üst sınırı.
 * Sihirbazın büyü seçimi adımında listeyi daraltmak için kullanılır.
 */
export function maxSpellLevelFor(classId: string, classLevel: number): number {
  const row = getClassLevel(classId, classLevel)
  return row?.spellcasting ? highestSlotLevel(row.spellcasting.spellSlots) : 0
}
