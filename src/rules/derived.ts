import { backgrounds, classes, proficiencies, races, skills, subraces, traits } from '../data/registry.ts'
import type { AbilityId, Armor, Equipment } from '../data/schema.ts'
import { primaryClass, subclassOf, type Character } from './character.ts'
import { abilityModifiers, abilityScores } from './abilities.ts'
import { characterProficiencyBonus } from './progression.ts'

/**
 * Karakter kaydından türetilen değerler: AC, kurtarma atışları, beceriler,
 * initiative, pasif Perception, hız ve taşıma kapasitesi.
 *
 * Hiçbiri karakterde saklanmaz; hepsi her seferinde yeniden hesaplanır.
 */

// ---------------------------------------------------------------------------
// Yeterlilikler — ırk, alt ırk, sınıf ve geçmişten toplanır
// ---------------------------------------------------------------------------

/**
 * Karakterin sahip olduğu beceri yeterlilikleri.
 *
 * Sınıftan seçilenler `character.proficiencies.skills` içinde durur; ırk ve
 * geçmişten gelenler burada türetilir. Aynı beceri iki kaynaktan gelirse
 * tekrarlanmaz.
 */
export function skillProficiencies(character: Character): Set<string> {
  const result = new Set([
    ...character.proficiencies.skills,
    ...character.proficiencies.raceSkills,
  ])

  // Geçmişten gelen beceriler.
  if (character.background?.kind === 'srd') {
    const background = backgrounds.get(character.background.id)
    for (const id of background?.proficiencies ?? []) {
      if (skills.has(id)) result.add(id)
    }
  } else if (character.background?.kind === 'custom') {
    for (const id of character.background.value.skillIds) result.add(id)
  }

  // Alt ırktan gelen yeterlilikler (beceri olanlar).
  if (character.subraceId) {
    for (const id of subraces.get(character.subraceId)?.proficiencies ?? []) {
      const reference = proficiencies.get(id)?.reference
      if (reference && skills.has(reference)) result.add(reference)
    }
  }

  return result
}

/** Uzmanlık (expertise) kazanılmış yeterlilikler — bonus iki katına çıkar. */
export function expertiseProficiencies(character: Character): Set<string> {
  const result = new Set<string>()
  for (const choice of character.levelChoices) {
    if (choice.kind === 'expertise') {
      for (const id of choice.proficiencyIds) result.add(id)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Kurtarma atışları ve beceriler
// ---------------------------------------------------------------------------

export interface Modifier {
  value: number
  proficient: boolean
  expertise?: boolean
}

/**
 * Kurtarma atışı yeterlilikleri **yalnızca birincil sınıftan** gelir.
 * Multiclass'ta sonradan alınan sınıflar kurtarma atışı yeterliliği vermez.
 */
export function savingThrows(character: Character): Record<AbilityId, Modifier> {
  const mods = abilityModifiers(character)
  const pb = characterProficiencyBonus(character)
  const primary = primaryClass(character)
  const proficient = new Set(primary ? classes.get(primary.classId)?.savingThrows : [])

  const result = {} as Record<AbilityId, Modifier>
  for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
    const isProficient = proficient.has(ability)
    result[ability] = {
      value: mods[ability] + (isProficient ? pb : 0),
      proficient: isProficient,
    }
  }
  return result
}

/** Tüm becerilerin modifier'ları, yeterlilik ve uzmanlık uygulanmış. */
export function skillModifiers(character: Character): Record<string, Modifier> {
  const mods = abilityModifiers(character)
  const pb = characterProficiencyBonus(character)
  const proficient = skillProficiencies(character)
  const expertise = expertiseProficiencies(character)

  const result: Record<string, Modifier> = {}
  for (const skill of skills.all()) {
    const isProficient = proficient.has(skill.id)
    const hasExpertise = isProficient && expertise.has(skill.id)
    const bonus = hasExpertise ? pb * 2 : isProficient ? pb : 0
    result[skill.id] = {
      value: mods[skill.ability] + bonus,
      proficient: isProficient,
      expertise: hasExpertise,
    }
  }
  return result
}

export function initiative(character: Character): number {
  return abilityModifiers(character).dex
}

/** Pasif Perception = 10 + Perception modifier. */
export function passivePerception(character: Character): number {
  return 10 + (skillModifiers(character).perception?.value ?? 0)
}

/**
 * Taşıma ve kaldırma sınırları. Modifier değil, ham STR puanı kullanılır.
 * Small ırklar (Halfling, Gnome) ağır silahlarda dezavantajlıdır ama taşıma
 * kapasiteleri SRD'de aynıdır.
 */
export function carryingCapacity(character: Character): {
  capacity: number
  pushDragLift: number
  encumbered: number
  heavilyEncumbered: number
} {
  const str = abilityScores(character).str.total
  return {
    capacity: str * 15,
    pushDragLift: str * 30,
    // Encumbrance isteğe bağlı kuraldır; değerleri gösterip kararı masaya bırakıyoruz.
    encumbered: str * 5,
    heavilyEncumbered: str * 10,
  }
}

/** Karakterin yürüme hızı (ft). Irktan gelir. */
export function walkingSpeed(character: Character): number {
  return character.raceId ? (races.get(character.raceId)?.speed ?? 30) : 30
}

// ---------------------------------------------------------------------------
// Zırh sınıfı
// ---------------------------------------------------------------------------

export interface ArmorClassOption {
  /** "Chain Mail", "Unarmored Defense (Barbarian)" gibi. */
  label: string
  value: number
  /** Bu seçenekle kalkan takılabilir mi? */
  allowsShield: boolean
}

export interface ArmorClassResult {
  /** Uygulanabilir seçeneklerin en yükseği (kalkan dahil). */
  value: number
  /** Kullanıcının seçebilmesi için tüm seçenekler. */
  options: ArmorClassOption[]
  shieldBonus: number
}

/**
 * Karakterin sahip olduğu ve kuşandığı zırh/kalkan.
 * Ekipman koleksiyonu lazy yüklendiği için çağıran taraf geçirir.
 */
function equippedArmor(character: Character, equipment: Map<string, Equipment>) {
  let armor: Armor | undefined
  let shield: Armor | undefined

  for (const entry of character.equipment) {
    if (!entry.equipped) continue
    const item = equipment.get(entry.itemId)
    if (item?.category !== 'armor') continue
    if (item.armorCategory === 'Shield') shield = item
    else armor = item
  }

  return { armor, shield }
}

/**
 * Zırh sınıfı.
 *
 * 5e'de birden fazla AC hesabı uygulanabilir (zırh giymeyen bir Barbarian hem
 * 10+DEX hem 10+DEX+CON kullanabilir); oyuncu birini seçer. Biz hepsini
 * döneriz ve en yükseğini varsayılan yaparız.
 *
 * Unarmored Defense yalnızca zırh giyilmediğinde geçerlidir. Barbarian'ınki
 * kalkanla birlikte kullanılabilir, Monk'unki kullanılamaz.
 */
export function armorClass(
  character: Character,
  equipment: Map<string, Equipment> = new Map(),
): ArmorClassResult {
  const mods = abilityModifiers(character)
  const { armor, shield } = equippedArmor(character, equipment)
  const shieldBonus = shield ? shield.armorClass.base : 0

  const options: ArmorClassOption[] = []

  if (armor) {
    const dexBonus = armor.armorClass.dexBonus
      ? armor.armorClass.maxDexBonus !== null
        ? Math.min(mods.dex, armor.armorClass.maxDexBonus)
        : mods.dex
      : 0
    options.push({
      label: armor.name,
      value: armor.armorClass.base + dexBonus,
      allowsShield: true,
    })
  } else {
    options.push({ label: 'Zırhsız', value: 10 + mods.dex, allowsShield: true })

    const hasClass = (id: string) => character.classes.some((c) => c.classId === id)

    if (hasClass('barbarian')) {
      options.push({
        label: 'Unarmored Defense (Barbarian)',
        value: 10 + mods.dex + mods.con,
        allowsShield: true,
      })
    }
    if (hasClass('monk')) {
      // Monk'un Unarmored Defense'i kalkan takılıysa çalışmaz.
      options.push({
        label: 'Unarmored Defense (Monk)',
        value: 10 + mods.dex + mods.wis,
        allowsShield: false,
      })
    }
    if (hasClass('sorcerer') && subclassOf(character, 'sorcerer') === 'draconic') {
      options.push({ label: 'Draconic Resilience', value: 13 + mods.dex, allowsShield: true })
    }
  }

  const best = options.reduce((max, option) => {
    const total = option.value + (option.allowsShield ? shieldBonus : 0)
    return Math.max(max, total)
  }, 0)

  return { value: best, options, shieldBonus }
}

// ---------------------------------------------------------------------------
// Diller
// ---------------------------------------------------------------------------

/** Karakterin bildiği diller: ırk, geçmiş ve kullanıcı seçimlerinden. */
export function knownLanguages(character: Character): Set<string> {
  const result = new Set([
    ...character.proficiencies.languages,
    ...character.proficiencies.raceLanguages,
  ])

  if (character.raceId) {
    for (const id of races.get(character.raceId)?.languages ?? []) result.add(id)
  }
  return result
}

/** Karakterin ırk ve alt ırktan gelen tüm özellik id'leri. */
export function racialTraitIds(character: Character): string[] {
  const ids = [
    ...(character.raceId ? (races.get(character.raceId)?.traits ?? []) : []),
    ...(character.subraceId ? (subraces.get(character.subraceId)?.traits ?? []) : []),
  ]
  return ids.filter((id) => traits.has(id))
}
