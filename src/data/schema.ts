import { z } from 'zod'

/**
 * Tüm SRD ve homebrew içeriğinin şeması.
 *
 * TypeScript tipleri bu zod şemalarından türetilir (`z.infer`), böylece şema ve
 * tip birbirinden ayrışamaz. Şemalar aynı zamanda geliştirme modunda veriyi
 * yükleme anında doğrulamak için kullanılır — bozuk veri sessizce geçmesin.
 *
 * Kural (bkz. CLAUDE.md): her kayıt `source` alanı taşır. Kural motoru bir
 * içeriğin SRD'den mi kullanıcıdan mı geldiğini umursamaz; ikisi de aynı şemayı
 * kullanır.
 */

export const sourceSchema = z.enum(['srd', 'homebrew'])
export type Source = z.infer<typeof sourceSchema>

export const abilityIdSchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])
export type AbilityId = z.infer<typeof abilityIdSchema>

/** Yetenekler her zaman bu sırada gösterilir (karakter sayfası düzeni). */
export const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export const sizeSchema = z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'])

/** Her kaydın taşıdığı ortak alanlar. */
const recordBase = {
  id: z.string().min(1),
  name: z.string().min(1),
  source: sourceSchema,
}

const abilityBonusSchema = z.object({
  ability: abilityIdSchema,
  bonus: z.number().int(),
})

/** Kullanıcının n seçenek arasından k tane seçtiği durumlar. */
const choiceSchema = z.object({
  choose: z.number().int().positive(),
  from: z.array(z.string()),
})
export type Choice = z.infer<typeof choiceSchema>

// ---------------------------------------------------------------------------
// Yetenek, beceri, dil, koşul — küçük referans tabloları
// ---------------------------------------------------------------------------

export const abilitySchema = z.object({
  ...recordBase,
  id: abilityIdSchema,
  fullName: z.string(),
  desc: z.array(z.string()),
  skills: z.array(z.string()),
})
export type Ability = z.infer<typeof abilitySchema>

export const skillSchema = z.object({
  ...recordBase,
  ability: abilityIdSchema,
  desc: z.array(z.string()),
})
export type Skill = z.infer<typeof skillSchema>

export const languageSchema = z.object({
  ...recordBase,
  type: z.enum(['Standard', 'Exotic']),
  script: z.string().optional(),
  typicalSpeakers: z.array(z.string()),
})
export type Language = z.infer<typeof languageSchema>

export const conditionSchema = z.object({
  ...recordBase,
  desc: z.array(z.string()),
})
export type Condition = z.infer<typeof conditionSchema>

export const damageTypeSchema = z.object({
  ...recordBase,
  desc: z.array(z.string()),
})
export type DamageType = z.infer<typeof damageTypeSchema>

export const weaponPropertySchema = z.object({
  ...recordBase,
  desc: z.array(z.string()),
})
export type WeaponProperty = z.infer<typeof weaponPropertySchema>

/**
 * Yeterlilik (proficiency). SRD bunları tek listede tutar: zırh, silah, alet,
 * kurtarma atışı ve beceri yeterlilikleri. `reference` alanı, yeterliliğin
 * işaret ettiği beceri/ekipman kaydının id'sidir (varsa).
 */
export const proficiencySchema = z.object({
  ...recordBase,
  type: z.enum([
    'Armor',
    'Weapons',
    "Artisan's Tools",
    'Gaming Sets',
    'Musical Instruments',
    'Vehicles',
    'Saving Throws',
    'Skills',
    'Other',
  ]),
  reference: z.string().optional(),
})
export type Proficiency = z.infer<typeof proficiencySchema>

// ---------------------------------------------------------------------------
// Irk, alt ırk, özellik (trait)
// ---------------------------------------------------------------------------

export const traitSchema = z.object({
  ...recordBase,
  desc: z.array(z.string()),
  /** Bazı özellikler yeterlilik kazandırır (ör. Dwarven Combat Training). */
  proficiencies: z.array(z.string()),
  /** Bazı özellikler kullanıcıya seçim yaptırır (ör. Tool Proficiency). */
  proficiencyChoice: choiceSchema.optional(),
})
export type Trait = z.infer<typeof traitSchema>

export const raceSchema = z.object({
  ...recordBase,
  speed: z.number().int().positive(),
  size: sizeSchema,
  sizeDesc: z.string(),
  ageDesc: z.string(),
  alignmentDesc: z.string(),
  abilityBonuses: z.array(abilityBonusSchema),
  /** Half-Elf: CHA dışındaki iki yetenekten +1 seçer. */
  abilityBonusChoice: z
    .object({
      choose: z.number().int().positive(),
      bonus: z.number().int(),
      from: z.array(abilityIdSchema),
    })
    .optional(),
  languages: z.array(z.string()),
  languageDesc: z.string(),
  /** Half-Elf ek dil seçer. */
  languageChoice: choiceSchema.optional(),
  traits: z.array(z.string()),
  subraces: z.array(z.string()),
  /**
   * Not: Irkın beceri seçimi (Half-Elf'in Skill Versatility'si) burada değil,
   * ilgili trait kaydının `proficiencyChoice` alanında durur. Böylece homebrew
   * bir ırk aynı mekanizmayı trait üzerinden kullanabilir.
   */
})
export type Race = z.infer<typeof raceSchema>

export const subraceSchema = z.object({
  ...recordBase,
  raceId: z.string(),
  desc: z.string(),
  abilityBonuses: z.array(abilityBonusSchema),
  traits: z.array(z.string()),
  proficiencies: z.array(z.string()),
})
export type Subrace = z.infer<typeof subraceSchema>

// ---------------------------------------------------------------------------
// Ekipman
// ---------------------------------------------------------------------------

export const costSchema = z.object({
  quantity: z.number(),
  unit: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']),
})

const equipmentBase = {
  ...recordBase,
  cost: costSchema.optional(),
  weight: z.number().optional(),
  desc: z.array(z.string()),
}

export const weaponSchema = z.object({
  ...equipmentBase,
  category: z.literal('weapon'),
  weaponCategory: z.enum(['Simple', 'Martial']),
  weaponRange: z.enum(['Melee', 'Ranged']),
  damage: z
    .object({ dice: z.string(), type: z.string() })
    .optional(),
  twoHandedDamage: z.object({ dice: z.string(), type: z.string() }).optional(),
  range: z.object({ normal: z.number(), long: z.number().nullable() }).optional(),
  throwRange: z.object({ normal: z.number(), long: z.number() }).optional(),
  properties: z.array(z.string()),
})
export type Weapon = z.infer<typeof weaponSchema>

export const armorSchema = z.object({
  ...equipmentBase,
  category: z.literal('armor'),
  armorCategory: z.enum(['Light', 'Medium', 'Heavy', 'Shield']),
  /** Kalkanda base AC eklenen değerdir (+2); zırhta taban AC'dir. */
  armorClass: z.object({
    base: z.number().int(),
    dexBonus: z.boolean(),
    maxDexBonus: z.number().int().nullable(),
  }),
  strMinimum: z.number().int(),
  stealthDisadvantage: z.boolean(),
})
export type Armor = z.infer<typeof armorSchema>

export const gearSchema = z.object({
  ...equipmentBase,
  category: z.enum(['gear', 'tool', 'vehicle']),
  gearCategory: z.string().optional(),
  quantity: z.number().int().optional(),
})
export type Gear = z.infer<typeof gearSchema>

export const equipmentSchema = z.discriminatedUnion('category', [
  weaponSchema,
  armorSchema,
  gearSchema,
])
export type Equipment = z.infer<typeof equipmentSchema>

/**
 * Başlangıç ekipmanı seçenekleri özyinelemelidir: "(a) zincir zırh veya
 * (b) deri zırh, uzun yay ve 20 ok" gibi paketler ve "bir martial silah seç"
 * gibi iç içe seçimler içerir.
 */
export interface EquipmentOption {
  kind: 'item' | 'bundle' | 'choice'
  itemId?: string
  count?: number
  items?: EquipmentOption[]
  choose?: number
  fromCategory?: string
  fromOptions?: EquipmentOption[]
  /** Çözümlenemeyen serbest metin seçenekleri (ör. "bir müzik aleti"). */
  label?: string
}

export const equipmentOptionSchema: z.ZodType<EquipmentOption> = z.lazy(() =>
  z.object({
    kind: z.enum(['item', 'bundle', 'choice']),
    itemId: z.string().optional(),
    count: z.number().int().optional(),
    items: z.array(equipmentOptionSchema).optional(),
    choose: z.number().int().optional(),
    fromCategory: z.string().optional(),
    fromOptions: z.array(equipmentOptionSchema).optional(),
    label: z.string().optional(),
  }),
)

export const equipmentChoiceSchema = z.object({
  desc: z.string(),
  choose: z.number().int().positive(),
  options: z.array(equipmentOptionSchema),
})
export type EquipmentChoice = z.infer<typeof equipmentChoiceSchema>

// ---------------------------------------------------------------------------
// Sınıf, alt sınıf, sınıf özellikleri, seviye tabloları
// ---------------------------------------------------------------------------

export const featureSchema = z.object({
  ...recordBase,
  classId: z.string(),
  subclassId: z.string().optional(),
  level: z.number().int().min(1).max(20),
  desc: z.array(z.string()),
})
export type Feature = z.infer<typeof featureSchema>

export const characterClassSchema = z.object({
  ...recordBase,
  hitDie: z.number().int().positive(),
  savingThrows: z.array(abilityIdSchema),
  proficiencies: z.array(z.string()),
  skillChoice: choiceSchema.optional(),
  /** Alet/enstrüman gibi ek yeterlilik seçimleri (Bard, Monk, Rogue…). */
  proficiencyChoices: z.array(choiceSchema),
  subclasses: z.array(z.string()),
  /** Alt sınıfın seçildiği seviye (sınıfa göre 1, 2 veya 3). */
  subclassLevel: z.number().int().min(1).max(20),
  spellcasting: z
    .object({
      /** Büyü yapmanın başladığı sınıf seviyesi (Paladin/Ranger için 2). */
      startLevel: z.number().int().min(1),
      ability: abilityIdSchema,
      /** Warlock'un Pact Magic'i normal slot tablosundan ayrıdır. */
      pactMagic: z.boolean(),
      info: z.array(z.object({ name: z.string(), desc: z.array(z.string()) })),
    })
    .optional(),
  startingEquipment: z.array(z.object({ itemId: z.string(), count: z.number().int() })),
  startingEquipmentChoices: z.array(equipmentChoiceSchema),
})
export type CharacterClass = z.infer<typeof characterClassSchema>

export const subclassSchema = z.object({
  ...recordBase,
  classId: z.string(),
  flavor: z.string(),
  desc: z.array(z.string()),
})
export type Subclass = z.infer<typeof subclassSchema>

/**
 * Seviye tablosunun tek satırı. Büyü slotları `spellSlots[0]` = 1. seviye
 * slotu olacak şekilde 9 elemanlı dizidir.
 */
export const classLevelSchema = z.object({
  classId: z.string(),
  level: z.number().int().min(1).max(20),
  profBonus: z.number().int().positive(),
  /** Bu seviyede kazanılan ASI/feat hakkı sayısı (genelde 0 veya 1). */
  abilityScoreBonuses: z.number().int().min(0),
  features: z.array(z.string()),
  spellcasting: z
    .object({
      cantripsKnown: z.number().int().min(0).optional(),
      spellsKnown: z.number().int().min(0).optional(),
      spellSlots: z.array(z.number().int().min(0)).length(9),
    })
    .optional(),
  /** Sneak Attack, Rage, Ki gibi sınıfa özel ölçekleyen değerler. */
  classSpecific: z.record(z.string(), z.unknown()),
  source: sourceSchema,
})
export type ClassLevel = z.infer<typeof classLevelSchema>

// ---------------------------------------------------------------------------
// Geçmiş (background) ve feat
// ---------------------------------------------------------------------------

export const backgroundSchema = z.object({
  ...recordBase,
  feature: z.object({ name: z.string(), desc: z.array(z.string()) }),
  proficiencies: z.array(z.string()),
  languageChoice: choiceSchema.optional(),
  /** SRD Acolyte'ta dil seçimi "herhangi iki dil" şeklindedir. */
  languageChoiceCount: z.number().int().min(0),
  startingEquipment: z.array(z.object({ itemId: z.string(), count: z.number().int() })),
  startingEquipmentChoices: z.array(equipmentChoiceSchema),
  startingGold: z.number().int().min(0),
  personalityTraits: z.array(z.string()),
  ideals: z.array(z.object({ desc: z.string(), alignments: z.array(z.string()) })),
  bonds: z.array(z.string()),
  flaws: z.array(z.string()),
})
export type Background = z.infer<typeof backgroundSchema>

export const featSchema = z.object({
  ...recordBase,
  desc: z.array(z.string()),
  prerequisites: z.array(
    z.object({ ability: abilityIdSchema, minimumScore: z.number().int() }),
  ),
})
export type Feat = z.infer<typeof featSchema>

// ---------------------------------------------------------------------------
// Büyü
// ---------------------------------------------------------------------------

export const spellSchema = z.object({
  ...recordBase,
  /** 0 = cantrip. */
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.array(z.enum(['V', 'S', 'M'])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  attackType: z.enum(['melee', 'ranged']).optional(),
  damage: z
    .object({
      type: z.string().optional(),
      atSlotLevel: z.record(z.string(), z.string()).optional(),
      atCharacterLevel: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  healAtSlotLevel: z.record(z.string(), z.string()).optional(),
  dc: z.object({ ability: abilityIdSchema, successType: z.string() }).optional(),
  areaOfEffect: z.object({ type: z.string(), size: z.number() }).optional(),
  /** Bu büyüyü kullanabilen sınıflar. */
  classes: z.array(z.string()),
  subclasses: z.array(z.string()),
  desc: z.array(z.string()),
  higherLevel: z.array(z.string()),
})
export type Spell = z.infer<typeof spellSchema>

export const magicSchoolSchema = z.object({
  ...recordBase,
  desc: z.string(),
})
export type MagicSchool = z.infer<typeof magicSchoolSchema>
