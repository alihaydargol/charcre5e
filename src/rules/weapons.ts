import { classes, getClassLevel, proficiencies } from '../data/registry.ts'
import type { AbilityId, Armor, Equipment, Weapon } from '../data/schema.ts'
import { levelIn, type Character } from './character.ts'
import { abilityModifiers, abilityScores } from './abilities.ts'
import { characterProficiencyBonus } from './progression.ts'

/**
 * Silah özelliklerinin mekanik karşılığı.
 *
 * SRD verisi özellikleri yalnızca isim olarak verir (`versatile`, `finesse`…);
 * ne yaptıklarını söylemez. Bu dosya o boşluğu doldurur: hangi yeteneğin
 * kullanılacağı, hangi zarın atılacağı, hangi kombinasyonların yasak olduğu.
 */

/** Silah özelliği id'leri — veride kullanılan kebab-case değerler. */
export const WEAPON_PROPERTY = {
  ammunition: 'ammunition',
  finesse: 'finesse',
  heavy: 'heavy',
  light: 'light',
  loading: 'loading',
  reach: 'reach',
  special: 'special',
  thrown: 'thrown',
  twoHanded: 'two-handed',
  versatile: 'versatile',
} as const

export function hasProperty(weapon: Weapon, property: string): boolean {
  return weapon.properties.includes(property)
}

/**
 * Saldırı ve hasarda kullanılacak yetenek.
 *
 * Kural: yakın dövüşte STR, menzillide DEX. *Finesse* silahlarda oyuncu
 * ikisinden birini seçebilir — biz yüksek olanı öneririz, çünkü oyuncunun
 * isteyeceği şey pratikte her zaman odur.
 */
export function attackAbility(
  weapon: Weapon,
  modifiers: Record<AbilityId, number>,
): { ability: AbilityId; alternatives: AbilityId[] } {
  if (weapon.weaponRange === 'Ranged') {
    return { ability: 'dex', alternatives: [] }
  }
  if (hasProperty(weapon, WEAPON_PROPERTY.finesse)) {
    const ability = modifiers.dex > modifiers.str ? 'dex' : 'str'
    return { ability, alternatives: ability === 'dex' ? ['str'] : ['dex'] }
  }
  return { ability: 'str', alternatives: [] }
}

/**
 * Fırlatılan yakın dövüş silahı, fırlatılırken de aynı yeteneği kullanır
 * (finesse'li bir dagger fırlatılırken DEX kullanabilir).
 */
export function canBeThrown(weapon: Weapon): boolean {
  return hasProperty(weapon, WEAPON_PROPERTY.thrown)
}

/** Silah iki elle mi tutulmak zorunda? */
export function requiresTwoHands(weapon: Weapon): boolean {
  return hasProperty(weapon, WEAPON_PROPERTY.twoHanded)
}

/** Silah iki elle tutulunca daha büyük zar atıyor mu (versatile)? */
export function isVersatile(weapon: Weapon): boolean {
  return hasProperty(weapon, WEAPON_PROPERTY.versatile) && weapon.twoHandedDamage !== undefined
}

// ---------------------------------------------------------------------------
// Yeterlilik
// ---------------------------------------------------------------------------

/**
 * Karakterin bu silahta yeterliliği var mı?
 *
 * Yeterlilik iki şekilde gelir: tek tek silah adıyla (`longswords`) ya da
 * kategori olarak (`simple-weapons`, `martial-weapons`).
 */
export function isProficientWithWeapon(character: Character, weapon: Weapon): boolean {
  const owned = new Set<string>()
  for (const cls of character.classes) {
    for (const id of classes.get(cls.classId)?.proficiencies ?? []) owned.add(id)
  }

  if (owned.has('simple-weapons') && weapon.weaponCategory === 'Simple') return true
  if (owned.has('martial-weapons') && weapon.weaponCategory === 'Martial') return true

  // Tekil yeterlilikler (ör. Wizard'ın "daggers"ı) çoğul adla saklanır.
  for (const id of owned) {
    const record = proficiencies.get(id)
    if (record?.reference === weapon.id) return true
  }
  return false
}

/**
 * Karakterin bu zırhta yeterliliği var mı?
 *
 * 5e'de ağır zırh yeterliliği hafif zırhı kapsamaz; sınıflar hangi kategorilere
 * yeterli olduklarını tek tek sayar (Fighter'da bu `all-armor` olarak gelir).
 * Kalkan ayrı bir yeterliliktir.
 */
export function isProficientWithArmor(character: Character, armor: Armor): boolean {
  const owned = new Set<string>()
  for (const cls of character.classes) {
    for (const id of classes.get(cls.classId)?.proficiencies ?? []) owned.add(id)
  }

  if (armor.armorCategory === 'Shield') return owned.has('shields')
  if (owned.has('all-armor')) return true
  if (owned.has(`${armor.armorCategory.toLowerCase()}-armor`)) return true

  // Tekil zırh yeterlilikleri (ör. Druid'in belirli zırhları).
  return owned.has(armor.id)
}

// ---------------------------------------------------------------------------
// Fighting Style etkileri
// ---------------------------------------------------------------------------

function fightingStyles(character: Character): Set<string> {
  return new Set(
    character.levelChoices.filter((c) => c.kind === 'fightingStyle').map((c) => c.styleId),
  )
}

// ---------------------------------------------------------------------------
// Saldırı hesabı
// ---------------------------------------------------------------------------

export interface AttackOptions {
  /** Versatile silahı iki elle tutuyor mu? */
  twoHanded?: boolean
  /** Fırlatma saldırısı mı (thrown silahlar için)? */
  thrown?: boolean
  /** İki silahla dövüşte ikinci (bonus aksiyon) saldırısı mı? */
  offHand?: boolean
  /** Kalkan takılı mı — iki elli silahla çakışmayı bildirmek için. */
  shieldEquipped?: boolean
}

export interface Attack {
  weaponId: string
  name: string
  ability: AbilityId
  attackBonus: number
  /** "1d8+3" biçiminde. */
  damage: string
  damageType: string
  damageDice: string
  damageBonus: number
  proficient: boolean
  range: string
  properties: string[]
  /** Kullanıcıya gösterilecek uyarılar (yeterlilik yok, kalkan çakışması…). */
  warnings: string[]
  /** Hesabın nasıl oluştuğu — arayüzde "neden bu sayı?" için. */
  notes: string[]
}

/**
 * Bir silahla yapılan saldırının bonusu ve hasarı.
 *
 * Fighting Style etkileri burada uygulanır: Archery menzilli saldırıya +2,
 * Dueling tek elli silaha +2 hasar. Great Weapon Fighting zar yeniden atma
 * kuralıdır — sabit bir sayıya dönüşmediği için not olarak gösterilir.
 */
export function weaponAttack(
  character: Character,
  weapon: Weapon,
  options: AttackOptions = {},
): Attack {
  const mods = abilityModifiers(character)
  const pb = characterProficiencyBonus(character)
  const styles = fightingStyles(character)
  const warnings: string[] = []
  const notes: string[] = []

  const { ability, alternatives } = attackAbility(weapon, mods)
  const abilityMod = mods[ability]

  if (alternatives.length > 0) {
    notes.push(`Finesse: ${ability.toUpperCase()} veya ${alternatives[0].toUpperCase()} kullanılabilir.`)
  }

  const proficient = isProficientWithWeapon(character, weapon)
  if (!proficient) {
    warnings.push('Bu silahta yeterliliğin yok; saldırıya proficiency bonusu eklenmez.')
  }

  let attackBonus = abilityMod + (proficient ? pb : 0)

  // Archery yalnızca menzilli silahlara uygulanır.
  if (styles.has('archery') && weapon.weaponRange === 'Ranged') {
    attackBonus += 2
    notes.push('Fighting Style — Archery: saldırıya +2.')
  }

  // İki elle tutma yalnızca versatile silahlarda zar değiştirir.
  const useTwoHanded =
    (options.twoHanded && isVersatile(weapon)) || requiresTwoHands(weapon)
  const damageSource = useTwoHanded && weapon.twoHandedDamage ? weapon.twoHandedDamage : weapon.damage

  if (options.twoHanded && !isVersatile(weapon) && !requiresTwoHands(weapon)) {
    notes.push('Bu silah versatile değil; iki elle tutmak hasarı değiştirmez.')
  }
  if (options.shieldEquipped && requiresTwoHands(weapon)) {
    warnings.push('İki elli silah kalkanla birlikte kullanılamaz.')
  }
  if (options.shieldEquipped && options.twoHanded && isVersatile(weapon)) {
    warnings.push('Kalkan takılıyken versatile silah tek elle tutulur; büyük zar geçerli değil.')
  }

  let damageBonus = abilityMod

  // İkinci el saldırısında yetenek modifier'ı normalde hasara eklenmez.
  if (options.offHand && !styles.has('two-weapon-fighting')) {
    damageBonus = 0
    notes.push('İkinci el saldırısında yetenek modifier’ı hasara eklenmez.')
  } else if (options.offHand) {
    notes.push('Fighting Style — Two-Weapon Fighting: ikinci el hasarına modifier eklenir.')
  }

  // Dueling: tek elli silah, başka silah taşınmıyor.
  const oneHanded = !useTwoHanded && !requiresTwoHands(weapon)
  if (styles.has('dueling') && oneHanded && !options.offHand && weapon.weaponRange === 'Melee') {
    damageBonus += 2
    notes.push('Fighting Style — Dueling: hasara +2.')
  }

  if (styles.has('great-weapon-fighting') && (requiresTwoHands(weapon) || useTwoHanded)) {
    notes.push('Fighting Style — Great Weapon Fighting: 1 ve 2 gelen hasar zarları yeniden atılır.')
  }

  if (hasProperty(weapon, WEAPON_PROPERTY.loading)) {
    notes.push('Loading: turda yalnızca bir kez ateşlenebilir.')
  }
  if (hasProperty(weapon, WEAPON_PROPERTY.ammunition)) {
    notes.push('Ammunition: mühimmat gerektirir.')
  }

  const damageDice = damageSource?.dice ?? '—'
  const damageType = damageSource?.type ?? ''

  return {
    weaponId: weapon.id,
    name: weapon.name,
    ability,
    attackBonus,
    damageDice,
    damageBonus,
    damage: damageBonus === 0 ? damageDice : `${damageDice}${damageBonus > 0 ? '+' : ''}${damageBonus}`,
    damageType,
    proficient,
    range: describeRange(weapon, options),
    properties: weapon.properties,
    warnings,
    notes,
  }
}

function describeRange(weapon: Weapon, options: AttackOptions): string {
  if (options.thrown && weapon.throwRange) {
    return `${weapon.throwRange.normal}/${weapon.throwRange.long} ft (fırlatma)`
  }
  if (weapon.weaponRange === 'Ranged' && weapon.range) {
    return `${weapon.range.normal}/${weapon.range.long ?? '—'} ft`
  }
  return hasProperty(weapon, WEAPON_PROPERTY.reach) ? '10 ft (reach)' : '5 ft'
}

// ---------------------------------------------------------------------------
// Zırhın hıza ve gizliliğe etkisi
// ---------------------------------------------------------------------------

export interface ArmorPenalties {
  /** Zırhın STR gereksinimi karşılanmıyorsa hız kaybı (ft). */
  speedPenalty: number
  stealthDisadvantage: boolean
  /** Yeterlilik yoksa: dezavantaj ve büyü yapamama. */
  notProficient: boolean
  warnings: string[]
}

/**
 * Giyilen zırhın cezaları.
 *
 * STR gereksinimi karşılanmazsa hız 10 ft düşer — bu, ağır zırhı düşük STR ile
 * giymeyi caydırır. Yeterlilik yoksa daha ağır bir ceza vardır: STR ve DEX
 * kullanan her atışta dezavantaj ve büyü yapamama.
 */
export function armorPenalties(character: Character, armor: Armor | undefined): ArmorPenalties {
  const result: ArmorPenalties = {
    speedPenalty: 0,
    stealthDisadvantage: false,
    notProficient: false,
    warnings: [],
  }
  if (!armor) return result

  // STR gereksinimi karşılanmazsa hız 10 ft düşer. Modifier değil, ham puan.
  if (armor.strMinimum > 0) {
    const strength = abilityScores(character).str.total
    if (strength < armor.strMinimum) {
      result.speedPenalty = 10
      result.warnings.push(
        `${armor.name} için STR ${armor.strMinimum} gerekir (senin STR ${strength}): hızın 10 ft düşer.`,
      )
    }
  }

  if (armor.stealthDisadvantage) {
    result.stealthDisadvantage = true
    result.warnings.push(`${armor.name}: Stealth kontrollerinde dezavantaj.`)
  }

  if (!isProficientWithArmor(character, armor)) {
    result.notProficient = true
    result.warnings.push(
      `${armor.name} için yeterliliğin yok: STR ve DEX kullanan atışlarda dezavantaj alırsın ve büyü yapamazsın.`,
    )
  }

  return result
}

/** Karakterin sahip olduğu silahlardan üretilen saldırı listesi. */
export function characterAttacks(
  character: Character,
  equipment: Map<string, Equipment>,
): Attack[] {
  const shieldEquipped = character.equipment.some((entry) => {
    const item = equipment.get(entry.itemId)
    return entry.equipped && item?.category === 'armor' && item.armorCategory === 'Shield'
  })

  const attacks: Attack[] = []
  for (const entry of character.equipment) {
    const item = equipment.get(entry.itemId)
    if (item?.category !== 'weapon') continue
    attacks.push(weaponAttack(character, item, { shieldEquipped }))
  }
  return attacks
}

// ---------------------------------------------------------------------------
// Sınıfa özel hasar eklemeleri
// ---------------------------------------------------------------------------

/**
 * Rogue'un Sneak Attack zarı. Veriden okunur (`classSpecific.sneak_attack`),
 * elle tabloya yazılmaz.
 */
export function sneakAttackDice(character: Character): string | undefined {
  const level = levelIn(character, 'rogue')
  if (level === 0) return undefined
  const specific = classSpecificAt('rogue', level)
  const sneak = specific?.sneak_attack as { dice_count: number; dice_value: number } | undefined
  return sneak ? `${sneak.dice_count}d${sneak.dice_value}` : undefined
}

/** Barbarian'ın Rage hasar bonusu. */
export function rageDamageBonus(character: Character): number | undefined {
  const level = levelIn(character, 'barbarian')
  if (level === 0) return undefined
  const specific = classSpecificAt('barbarian', level)
  return typeof specific?.rage_damage_bonus === 'number' ? specific.rage_damage_bonus : undefined
}

/** Monk'un Martial Arts zarı. */
export function martialArtsDie(character: Character): string | undefined {
  const level = levelIn(character, 'monk')
  if (level === 0) return undefined
  const specific = classSpecificAt('monk', level)
  const martial = specific?.martial_arts as { dice_count: number; dice_value: number } | undefined
  return martial ? `${martial.dice_count}d${martial.dice_value}` : undefined
}

function classSpecificAt(classId: string, level: number): Record<string, unknown> | undefined {
  return getClassLevel(classId, level)?.classSpecific
}
