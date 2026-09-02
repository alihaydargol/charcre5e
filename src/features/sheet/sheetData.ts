import {
  backgrounds,
  classes,
  languages,
  races,
  skills,
  subclasses,
  subraces,
  traits,
} from '../../data/registry.ts'
import { getClassLevelsUpTo } from '../../data/classLevels.ts'
import type { Equipment, Feature } from '../../data/schema.ts'
import { abilityScores } from '../../rules/abilities.ts'
import { ABILITY_IDS, subclassOf, totalLevel, type Character } from '../../rules/character.ts'
import {
  armorClass,
  carryingCapacity,
  initiative,
  knownLanguages,
  passivePerception,
  savingThrows,
  skillModifiers,
  skillProficiencies,
  walkingSpeed,
} from '../../rules/derived.ts'
import { maxHitPoints, hitDicePool } from '../../rules/hitpoints.ts'
import { characterProficiencyBonus } from '../../rules/progression.ts'
import { spellcasting } from '../../rules/spellcasting.ts'
import { armorPenalties, characterAttacks, martialArtsDie, rageDamageBonus, sneakAttackDice } from '../../rules/weapons.ts'
import { carriedWeight } from '../../rules/equipment.ts'

/**
 * Karakter sayfasının ihtiyaç duyduğu her şeyi tek yerde toplar.
 *
 * Ekran görünümü ile yazdırma görünümü aynı veriyi farklı düzenlerde gösterir;
 * hesaplamanın iki yerde tekrarlanmaması için burada toplanıyor.
 */
export function buildSheet(character: Character, equipment: Map<string, Equipment>, features?: Map<string, Feature>) {
  const level = totalLevel(character)
  const primary = character.classes[0]
  const cls = primary ? classes.get(primary.classId) : undefined
  const subclassId = primary ? subclassOf(character, primary.classId) : undefined

  const race = character.raceId ? races.get(character.raceId) : undefined
  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined

  const scores = abilityScores(character)
  const saves = savingThrows(character)
  const skillMods = skillModifiers(character)
  const proficientSkills = skillProficiencies(character)
  const hp = maxHitPoints(character)
  const ac = armorClass(character, equipment)
  const casting = spellcasting(character)

  // Kuşanılan zırhın cezaları (hız düşüşü, stealth dezavantajı).
  const wornArmor = character.equipment
    .filter((e) => e.equipped)
    .map((e) => equipment.get(e.itemId))
    .find((item) => item?.category === 'armor' && item.armorCategory !== 'Shield')
  const penalties = armorPenalties(character, wornArmor?.category === 'armor' ? wornArmor : undefined)

  const backgroundName =
    character.background?.kind === 'srd'
      ? backgrounds.get(character.background.id)?.name
      : character.background?.value.name

  const backgroundFeature =
    character.background?.kind === 'srd'
      ? backgrounds.get(character.background.id)?.feature
      : character.background?.kind === 'custom' && character.background.value.featureName
        ? {
            name: character.background.value.featureName,
            desc: [character.background.value.featureDesc],
          }
        : undefined

  // Irk özellikleri ve sınıf özellikleri, seviyeye göre.
  const racialTraits = [...(race?.traits ?? []), ...(subrace?.traits ?? [])]
    .map((id) => traits.get(id))
    .filter((t) => t !== undefined)

  const classFeatures = primary
    ? getClassLevelsUpTo(primary.classId, primary.level).flatMap((row) =>
        row.features.map((id) => ({
          level: row.level,
          name: features?.get(id)?.name ?? id.replaceAll('-', ' '),
          desc: features?.get(id)?.desc ?? [],
        })),
      )
    : []

  const subclassFeatures =
    subclassId && features
      ? [...features.values()]
          .filter((f) => f.subclassId === subclassId && f.level <= (primary?.level ?? 0))
          .sort((a, b) => a.level - b.level)
      : []

  return {
    level,
    className: cls?.name ?? '—',
    classId: primary?.classId,
    subclassName: subclassId ? subclasses.get(subclassId)?.name : undefined,
    raceName: subrace ? `${subrace.name} (${race?.name})` : (race?.name ?? '—'),
    backgroundName: backgroundName ?? '—',
    backgroundFeature,

    scores,
    saves,
    skillMods,
    proficientSkills,
    abilities: ABILITY_IDS,

    hp,
    ac,
    hitDice: hitDicePool(character),
    proficiencyBonus: characterProficiencyBonus(character),
    initiative: initiative(character),
    passivePerception: passivePerception(character),
    // Zırhın STR gereksinimi karşılanmıyorsa hız düşer.
    speed: Math.max(0, walkingSpeed(character) - penalties.speedPenalty),
    baseSpeed: walkingSpeed(character),
    penalties,

    attacks: characterAttacks(character, equipment),
    casting,
    carrying: carryingCapacity(character),
    weight: carriedWeight(character, equipment),

    racialTraits,
    classFeatures,
    subclassFeatures,

    languages: [...knownLanguages(character)]
      .map((id) => languages.get(id)?.name ?? id)
      .sort((a, b) => a.localeCompare(b, 'tr')),

    skillList: skills.all(),

    // Sneak Attack / Rage / Martial Arts gibi ölçekleyen değerler.
    scaling: [
      sneakAttackDice(character) && { label: 'Sneak Attack', value: sneakAttackDice(character)! },
      rageDamageBonus(character) !== undefined && {
        label: 'Rage hasar bonusu',
        value: `+${rageDamageBonus(character)}`,
      },
      martialArtsDie(character) && { label: 'Martial Arts', value: martialArtsDie(character)! },
    ].filter((v) => typeof v === 'object'),

    equipmentList: character.equipment.map((entry) => ({
      ...entry,
      item: equipment.get(entry.itemId),
    })),
  }
}

export type Sheet = ReturnType<typeof buildSheet>
