#!/usr/bin/env node
/**
 * SRD 5.1 verisini 5e-bits/5e-database deposundan alıp bu projenin şemasına
 * dönüştürür ve `src/data/srd/` altına yazar.
 *
 * Bu betik bir defalık (ve veri güncellemesi gerektiğinde) elle çalıştırılır;
 * üretilen JSON dosyaları depoya commit edilir. Uygulama çalışma anında hiçbir
 * dış kaynağa bağlanmaz.
 *
 * Kullanım:
 *   git clone --depth 1 https://github.com/5e-bits/5e-database /tmp/5e-database
 *   node scripts/build-srd-data.mjs /tmp/5e-database/src/2014/en
 *
 * Kaynak veri SRD 5.1 kaynaklıdır ve CC-BY-4.0 ile lisanslanmıştır; atıf için
 * ATTRIBUTION.md dosyasına bakın.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = process.argv[2]
if (!srcDir) {
  console.error('Kullanım: node scripts/build-srd-data.mjs <5e-database/src/2014/en yolu>')
  process.exit(1)
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/srd')
mkdirSync(outDir, { recursive: true })

const read = (name) => JSON.parse(readFileSync(join(srcDir, `5e-SRD-${name}.json`), 'utf8'))

/** Her kayda eklenen ortak alanlar. Kural: bkz. CLAUDE.md. */
const SOURCE = 'srd'

// --- yardımcılar -----------------------------------------------------------

const idsOf = (arr) => (arr ?? []).map((r) => r.index)

/**
 * `option_set_type: 'options_array'` biçimindeki seçim listesini id dizisine
 * çevirir. Yeterlilik seçeneklerinde `reference` varsa (ör. skill-arcana →
 * arcana) onu tercih eder, böylece beceri seçimleri beceri id'si olur.
 */
function choiceToIds(choice, profByIndex) {
  if (!choice) return undefined
  const from = choice.from
  if (from?.option_set_type !== 'options_array') return undefined
  const ids = from.options
    .map((o) => {
      const idx = o.item?.index
      if (!idx) return undefined
      const prof = profByIndex?.get(idx)
      return prof?.reference?.index ?? idx
    })
    .filter(Boolean)
  return { choose: choice.choose, from: ids }
}

/** Başlangıç ekipmanı seçeneklerini özyinelemeli olarak çözer. */
function toEquipmentOption(o) {
  switch (o.option_type) {
    case 'counted_reference':
      return { kind: 'item', itemId: o.of.index, count: o.count ?? 1 }
    case 'multiple':
      return { kind: 'bundle', items: o.items.map(toEquipmentOption) }
    case 'choice': {
      const c = o.choice
      const from = c.from
      if (from.option_set_type === 'equipment_category') {
        return {
          kind: 'choice',
          choose: c.choose,
          fromCategory: from.equipment_category.index,
          label: c.desc,
        }
      }
      return {
        kind: 'choice',
        choose: c.choose,
        fromOptions: (from.options ?? []).map(toEquipmentOption),
        label: c.desc,
      }
    }
    default:
      // Çözümlenemeyen seçenekler kaybolmasın; metni saklayıp UI'da gösteririz.
      return { kind: 'item', label: o.desc ?? o.option_type }
  }
}

function toEquipmentChoices(list) {
  return (list ?? []).map((c) => ({
    desc: c.desc ?? '',
    choose: c.choose,
    options:
      c.from?.option_set_type === 'equipment_category'
        ? [{ kind: 'choice', choose: c.choose, fromCategory: c.from.equipment_category.index, label: c.desc }]
        : (c.from?.options ?? []).map(toEquipmentOption),
  }))
}

const toStartingEquipment = (list) =>
  (list ?? []).map((e) => ({ itemId: e.equipment.index, count: e.quantity ?? 1 }))

const write = (name, data) => {
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 2) + '\n')
  const n = Array.isArray(data) ? data.length : Object.keys(data).length
  console.log(`  ${name}.json — ${n} kayıt`)
}

// --- kaynak dosyalar -------------------------------------------------------

const rawAbilities = read('Ability-Scores')
const rawSkills = read('Skills')
const rawLanguages = read('Languages')
const rawConditions = read('Conditions')
const rawDamageTypes = read('Damage-Types')
const rawWeaponProps = read('Weapon-Properties')
const rawProficiencies = read('Proficiencies')
const rawMagicSchools = read('Magic-Schools')
const rawRaces = read('Races')
const rawSubraces = read('Subraces')
const rawTraits = read('Traits')
const rawClasses = read('Classes')
const rawSubclasses = read('Subclasses')
const rawLevels = read('Levels')
const rawFeatures = read('Features')
const rawBackgrounds = read('Backgrounds')
const rawFeats = read('Feats')
const rawSpells = read('Spells')
const rawEquipment = read('Equipment')
const rawEquipmentCategories = read('Equipment-Categories')
const rawMagicItems = read('Magic-Items')

const profByIndex = new Map(rawProficiencies.map((p) => [p.index, p]))

console.log('SRD 5.1 verisi dönüştürülüyor...')

// --- referans tabloları ----------------------------------------------------

write(
  'abilities',
  rawAbilities.map((a) => ({
    id: a.index,
    name: a.name,
    source: SOURCE,
    fullName: a.full_name,
    desc: a.desc,
    skills: idsOf(a.skills),
  })),
)

write(
  'skills',
  rawSkills.map((s) => ({
    id: s.index,
    name: s.name,
    source: SOURCE,
    ability: s.ability_score.index,
    desc: s.desc,
  })),
)

write(
  'languages',
  rawLanguages.map((l) => ({
    id: l.index,
    name: l.name,
    source: SOURCE,
    type: l.type,
    ...(l.script ? { script: l.script } : {}),
    typicalSpeakers: l.typical_speakers,
  })),
)

write('conditions', rawConditions.map((c) => ({ id: c.index, name: c.name, source: SOURCE, desc: c.desc })))
write('damage-types', rawDamageTypes.map((d) => ({ id: d.index, name: d.name, source: SOURCE, desc: d.desc })))
write(
  'weapon-properties',
  rawWeaponProps.map((w) => ({ id: w.index, name: w.name, source: SOURCE, desc: w.desc })),
)
write(
  'magic-schools',
  rawMagicSchools.map((s) => ({ id: s.index, name: s.name, source: SOURCE, desc: s.desc })),
)
write(
  'proficiencies',
  rawProficiencies.map((p) => ({
    id: p.index,
    name: p.name,
    source: SOURCE,
    type: p.type,
    ...(p.reference?.index ? { reference: p.reference.index } : {}),
  })),
)

// --- ırklar ----------------------------------------------------------------

write(
  'races',
  rawRaces.map((r) => {
    const abilityBonusChoice = r.ability_bonus_options
      ? {
          choose: r.ability_bonus_options.choose,
          bonus: r.ability_bonus_options.from.options[0].bonus,
          from: r.ability_bonus_options.from.options.map((o) => o.ability_score.index),
        }
      : undefined
    const languageChoice = choiceToIds(r.language_options, profByIndex)
    return {
      id: r.index,
      name: r.name,
      source: SOURCE,
      speed: r.speed,
      size: r.size,
      sizeDesc: r.size_description,
      ageDesc: r.age,
      alignmentDesc: r.alignment,
      abilityBonuses: r.ability_bonuses.map((b) => ({ ability: b.ability_score.index, bonus: b.bonus })),
      ...(abilityBonusChoice ? { abilityBonusChoice } : {}),
      languages: idsOf(r.languages),
      languageDesc: r.language_desc,
      ...(languageChoice ? { languageChoice } : {}),
      traits: idsOf(r.traits),
      subraces: idsOf(r.subraces),
    }
  }),
)

write(
  'subraces',
  rawSubraces.map((s) => ({
    id: s.index,
    name: s.name,
    source: SOURCE,
    raceId: s.race.index,
    desc: s.desc,
    abilityBonuses: s.ability_bonuses.map((b) => ({ ability: b.ability_score.index, bonus: b.bonus })),
    traits: idsOf(s.racial_traits),
    proficiencies: idsOf(s.starting_proficiencies),
  })),
)

write(
  'traits',
  rawTraits.map((t) => {
    const proficiencyChoice = choiceToIds(t.proficiency_choices, profByIndex)
    return {
      id: t.index,
      name: t.name,
      source: SOURCE,
      desc: t.desc,
      proficiencies: idsOf(t.proficiencies),
      ...(proficiencyChoice ? { proficiencyChoice } : {}),
    }
  }),
)

// --- sınıflar --------------------------------------------------------------

/**
 * Alt sınıfın seçildiği seviye sınıfa göre değişir (Cleric 1, Druid/Wizard 2,
 * çoğu sınıf 3). Bunu alt sınıf özelliklerinin en düşük seviyesinden türetiriz
 * — elle tabloya yazmaktansa veriden hesaplamak daha güvenilir.
 */
const subclassLevelByClass = new Map()
for (const f of rawFeatures) {
  if (!f.subclass) continue
  const classId = f.class.index
  const current = subclassLevelByClass.get(classId)
  if (current === undefined || f.level < current) subclassLevelByClass.set(classId, f.level)
}

write(
  'classes',
  rawClasses.map((c) => {
    // İlk yeterlilik seçimi beceri seçimidir; kalanlar alet/enstrüman seçimidir.
    const allChoices = (c.proficiency_choices ?? [])
      .map((ch) => choiceToIds(ch, profByIndex))
      .filter(Boolean)
    const skillIds = new Set(rawSkills.map((s) => s.index))
    const skillChoice = allChoices.find((ch) => ch.from.every((id) => skillIds.has(id)))
    const proficiencyChoices = allChoices.filter((ch) => ch !== skillChoice)

    return {
      id: c.index,
      name: c.name,
      source: SOURCE,
      hitDie: c.hit_die,
      savingThrows: idsOf(c.saving_throws),
      proficiencies: idsOf(c.proficiencies),
      ...(skillChoice ? { skillChoice } : {}),
      proficiencyChoices,
      subclasses: idsOf(c.subclasses),
      subclassLevel: subclassLevelByClass.get(c.index) ?? 3,
      ...(c.spellcasting
        ? {
            spellcasting: {
              startLevel: c.spellcasting.level,
              ability: c.spellcasting.spellcasting_ability.index,
              pactMagic: c.index === 'warlock',
              info: c.spellcasting.info.map((i) => ({ name: i.name, desc: i.desc })),
            },
          }
        : {}),
      startingEquipment: toStartingEquipment(c.starting_equipment),
      startingEquipmentChoices: toEquipmentChoices(c.starting_equipment_options),
    }
  }),
)

write(
  'subclasses',
  rawSubclasses.map((s) => ({
    id: s.index,
    name: s.name,
    source: SOURCE,
    classId: s.class.index,
    flavor: s.subclass_flavor,
    desc: s.desc,
  })),
)

write(
  'features',
  rawFeatures.map((f) => ({
    id: f.index,
    name: f.name,
    source: SOURCE,
    classId: f.class.index,
    ...(f.subclass ? { subclassId: f.subclass.index } : {}),
    level: f.level,
    desc: f.desc,
  })),
)

/**
 * ASI seviyeleri. Kaynaktaki `ability_score_bonuses` alanı KÜMÜLATİF bir
 * sayaçtır ve Rogue için bozuktur (10. seviyede 3, 11. seviyede 2 gibi monoton
 * olmayan değerler içerir). Bunun yerine "Ability Score Improvement" adlı sınıf
 * özelliklerinin seviyelerinden türetiyoruz — bu veri doğrudur ve Fighter'ın
 * 6/14, Rogue'un 10. seviyedeki fazladan haklarını doğru verir.
 */
const asiLevelsByClass = new Map()
for (const f of rawFeatures) {
  if (f.subclass || !/Ability Score Improvement/.test(f.name)) continue
  const classId = f.class.index
  if (!asiLevelsByClass.has(classId)) asiLevelsByClass.set(classId, new Map())
  const byLevel = asiLevelsByClass.get(classId)
  byLevel.set(f.level, (byLevel.get(f.level) ?? 0) + 1)
}

/**
 * Seviye tablosu. Kaynakta alt sınıf seviyeleri de aynı dosyada durur; bunları
 * (`subclass` alanı olanları) ayıklıyoruz — sınıf tablosu yalnızca sınıfın
 * kendi ilerlemesidir.
 */
write(
  'class-levels',
  rawLevels
    .filter((l) => !l.subclass)
    .map((l) => {
      const sc = l.spellcasting
      return {
        classId: l.class.index,
        level: l.level,
        profBonus: l.prof_bonus,
        abilityScoreBonuses: asiLevelsByClass.get(l.class.index)?.get(l.level) ?? 0,
        features: idsOf(l.features),
        ...(sc
          ? {
              spellcasting: {
                ...(sc.cantrips_known !== undefined ? { cantripsKnown: sc.cantrips_known } : {}),
                ...(sc.spells_known !== undefined ? { spellsKnown: sc.spells_known } : {}),
                spellSlots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => sc[`spell_slots_level_${n}`] ?? 0),
              },
            }
          : {}),
        classSpecific: l.class_specific ?? {},
        source: SOURCE,
      }
    })
    .sort((a, b) => a.classId.localeCompare(b.classId) || a.level - b.level),
)

// --- geçmiş ve feat --------------------------------------------------------

write(
  'backgrounds',
  rawBackgrounds.map((b) => ({
    id: b.index,
    name: b.name,
    source: SOURCE,
    feature: { name: b.feature.name, desc: b.feature.desc },
    proficiencies: idsOf(b.starting_proficiencies).map((id) => profByIndex.get(id)?.reference?.index ?? id),
    languageChoiceCount: b.language_options?.choose ?? 0,
    startingEquipment: toStartingEquipment(b.starting_equipment),
    startingEquipmentChoices: toEquipmentChoices(b.starting_equipment_options),
    startingGold: b.starting_gold?.quantity ?? 0,
    personalityTraits: b.personality_traits?.from?.options?.map((o) => o.string) ?? [],
    ideals:
      b.ideals?.from?.options?.map((o) => ({
        desc: o.desc,
        alignments: idsOf(o.alignments),
      })) ?? [],
    bonds: b.bonds?.from?.options?.map((o) => o.string) ?? [],
    flaws: b.flaws?.from?.options?.map((o) => o.string) ?? [],
  })),
)

write(
  'feats',
  rawFeats.map((f) => ({
    id: f.index,
    name: f.name,
    source: SOURCE,
    desc: f.desc,
    prerequisites: (f.prerequisites ?? []).map((p) => ({
      ability: p.ability_score.index,
      minimumScore: p.minimum_score,
    })),
  })),
)

// --- büyüler ---------------------------------------------------------------

write(
  'spells',
  rawSpells.map((s) => ({
    id: s.index,
    name: s.name,
    source: SOURCE,
    level: s.level,
    school: s.school.index,
    castingTime: s.casting_time,
    range: s.range,
    components: s.components,
    ...(s.material ? { material: s.material } : {}),
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    ...(s.attack_type ? { attackType: s.attack_type } : {}),
    ...(s.damage
      ? {
          damage: {
            ...(s.damage.damage_type ? { type: s.damage.damage_type.index } : {}),
            ...(s.damage.damage_at_slot_level ? { atSlotLevel: s.damage.damage_at_slot_level } : {}),
            ...(s.damage.damage_at_character_level
              ? { atCharacterLevel: s.damage.damage_at_character_level }
              : {}),
          },
        }
      : {}),
    ...(s.heal_at_slot_level ? { healAtSlotLevel: s.heal_at_slot_level } : {}),
    ...(s.dc ? { dc: { ability: s.dc.dc_type.index, successType: s.dc.dc_success } } : {}),
    ...(s.area_of_effect ? { areaOfEffect: { type: s.area_of_effect.type, size: s.area_of_effect.size } } : {}),
    classes: idsOf(s.classes),
    subclasses: idsOf(s.subclasses),
    desc: s.desc,
    higherLevel: s.higher_level ?? [],
  })),
)

// --- ekipman ---------------------------------------------------------------

const CATEGORY_MAP = {
  weapon: 'weapon',
  armor: 'armor',
  tools: 'tool',
  'mounts-and-vehicles': 'vehicle',
  'adventuring-gear': 'gear',
}

write(
  'equipment',
  rawEquipment.map((e) => {
    const category = CATEGORY_MAP[e.equipment_category.index] ?? 'gear'
    const base = {
      id: e.index,
      name: e.name,
      source: SOURCE,
      ...(e.cost ? { cost: { quantity: e.cost.quantity, unit: e.cost.unit } } : {}),
      ...(e.weight !== undefined ? { weight: e.weight } : {}),
      desc: e.desc ?? [],
    }

    if (category === 'weapon') {
      return {
        ...base,
        category: 'weapon',
        weaponCategory: e.weapon_category,
        weaponRange: e.weapon_range,
        ...(e.damage
          ? { damage: { dice: e.damage.damage_dice, type: e.damage.damage_type.index } }
          : {}),
        ...(e.two_handed_damage
          ? {
              twoHandedDamage: {
                dice: e.two_handed_damage.damage_dice,
                type: e.two_handed_damage.damage_type.index,
              },
            }
          : {}),
        ...(e.range ? { range: { normal: e.range.normal, long: e.range.long ?? null } } : {}),
        ...(e.throw_range ? { throwRange: { normal: e.throw_range.normal, long: e.throw_range.long } } : {}),
        properties: idsOf(e.properties),
      }
    }

    if (category === 'armor') {
      return {
        ...base,
        category: 'armor',
        armorCategory: e.armor_category,
        armorClass: {
          base: e.armor_class.base,
          dexBonus: e.armor_class.dex_bonus,
          maxDexBonus: e.armor_class.max_bonus ?? null,
        },
        strMinimum: e.str_minimum ?? 0,
        stealthDisadvantage: e.stealth_disadvantage ?? false,
      }
    }

    return {
      ...base,
      category,
      ...(e.gear_category ? { gearCategory: e.gear_category.index } : {}),
      ...(e.quantity !== undefined ? { quantity: e.quantity } : {}),
    }
  }),
)

/**
 * Ekipman kategorileri. Başlangıç ekipmanı seçenekleri bunlara atıf yapar
 * ("bir martial silah seç", "bir kutsal sembol seç"). holy-symbols gibi
 * gruplamalar eşyanın kendi alanlarından türetilemez; yalnızca burada durur.
 */
write(
  'equipment-categories',
  rawEquipmentCategories.map((c) => ({
    id: c.index,
    name: c.name,
    source: SOURCE,
    items: idsOf(c.equipment),
  })),
)

write(
  'magic-items',
  rawMagicItems.map((m) => ({
    id: m.index,
    name: m.name,
    source: SOURCE,
    category: m.equipment_category.index,
    rarity: m.rarity.name,
    hasVariants: Boolean(m.variant === false && (m.variants ?? []).length > 0),
    variants: idsOf(m.variants),
    desc: m.desc ?? [],
  })),
)

console.log('Tamamlandı.')
