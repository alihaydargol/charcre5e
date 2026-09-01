import { z } from 'zod'
import { abilityIdSchema, type AbilityId } from '../data/schema.ts'

/**
 * Karakter veri modeli.
 *
 * Temel ilke: **türetilebilen hiçbir şey saklanmaz.** AC, HP, kurtarma atışı,
 * büyü slotu gibi değerler her zaman bu kayıttan hesaplanır. Saklanan tek şey
 * kullanıcının *seçimleridir*. Bu sayede 8. seviyedeki bir seçim değiştiğinde
 * 20. seviyedeki tüm değerler kendiliğinden doğru olur.
 *
 * `abilities` alanı ırk bonusu **hariç** ham puanları tutar; ırk bonusu
 * hesaplama anında eklenir. Böylece ırk değiştirildiğinde puanlar bozulmaz.
 */

export const SCHEMA_VERSION = 1

/** Her seviyede yapılan seçim. Seviye atlamanın ve yeniden hesaplamanın kalbi. */
export const levelChoiceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('asi'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    /** Toplam +2 dağıtılır: tek yeteneğe +2 ya da iki yeteneğe +1. */
    increases: z.array(z.object({ ability: abilityIdSchema, amount: z.number().int().min(1).max(2) })),
  }),
  z.object({
    kind: z.literal('feat'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    featId: z.string(),
  }),
  z.object({
    kind: z.literal('subclass'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    subclassId: z.string(),
  }),
  z.object({
    kind: z.literal('fightingStyle'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    styleId: z.string(),
  }),
  z.object({
    kind: z.literal('expertise'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    /** Beceri id'si ya da 'thieves-tools'. */
    proficiencyIds: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('spellsLearned'),
    classId: z.string(),
    level: z.number().int().min(1).max(20),
    spellIds: z.array(z.string()),
  }),
])
export type LevelChoice = z.infer<typeof levelChoiceSchema>

/**
 * SRD tek background (Acolyte) ve tek feat (Grappler) içerir. Kullanıcının
 * kendi geçmişini tanımlayabilmesi bir telafi değil, tasarımın parçası
 * (bkz. CLAUDE.md).
 */
export const customBackgroundSchema = z.object({
  name: z.string().min(1),
  featureName: z.string(),
  featureDesc: z.string(),
  skillIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  languageCount: z.number().int().min(0),
})
export type CustomBackground = z.infer<typeof customBackgroundSchema>

export const abilityMethodSchema = z.enum(['pointbuy', 'standard', 'roll', 'manual'])
export type AbilityMethod = z.infer<typeof abilityMethodSchema>

export const hpMethodSchema = z.enum(['average', 'roll', 'manual'])
export type HpMethod = z.infer<typeof hpMethodSchema>

export const characterSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  raceId: z.string().optional(),
  subraceId: z.string().optional(),
  /** Irkın seçmeli yetenek bonusu (Half-Elf: CHA dışı iki yetenekten +1). */
  raceAbilityChoice: z.array(abilityIdSchema).default([]),

  /** Dizi olarak tutulur; multiclass ilk sürümde kapalı ama model hazır. */
  classes: z
    .array(
      z.object({
        classId: z.string(),
        level: z.number().int().min(1).max(20),
      }),
    )
    .default([]),

  background: z
    .union([
      z.object({ kind: z.literal('srd'), id: z.string() }),
      z.object({ kind: z.literal('custom'), value: customBackgroundSchema }),
    ])
    .optional(),

  /** Irk bonusu HARİÇ ham yetenek puanları. */
  abilities: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  abilityMethod: abilityMethodSchema,

  levelChoices: z.array(levelChoiceSchema).default([]),

  hp: z
    .object({
      method: hpMethodSchema,
      /** 2. seviyeden itibaren atılan hit die sonuçları (index 0 = 2. seviye). */
      rolls: z.array(z.number().int()).default([]),
      /** method === 'manual' ise kullanıcının girdiği toplam. */
      manualTotal: z.number().int().optional(),
    })
    .default({ method: 'average', rolls: [] }),

  proficiencies: z
    .object({
      /** Sınıftan seçilen beceriler. Irk ve geçmişten gelenler türetilir. */
      skills: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
      languages: z.array(z.string()).default([]),
    })
    .default({ skills: [], tools: [], languages: [] }),

  spells: z
    .object({
      cantrips: z.array(z.string()).default([]),
      known: z.array(z.string()).default([]),
      prepared: z.array(z.string()).default([]),
    })
    .default({ cantrips: [], known: [], prepared: [] }),

  equipment: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().int().min(1).default(1),
        equipped: z.boolean().default(false),
      }),
    )
    .default([]),

  notes: z
    .object({
      appearance: z.string().default(''),
      backstory: z.string().default(''),
      personality: z.string().default(''),
      alignment: z.string().default(''),
    })
    .default({ appearance: '', backstory: '', personality: '', alignment: '' }),

  /** Rastgele üretildiyse hangi tohumla üretildiği (yeniden üretilebilirlik). */
  seed: z.number().int().optional(),
})
export type Character = z.infer<typeof characterSchema>

export const ABILITY_IDS: readonly AbilityId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** Boş bir karakter taslağı. Sihirbaz buradan başlar. */
export function createEmptyCharacter(id: string, now = new Date().toISOString()): Character {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: '',
    createdAt: now,
    updatedAt: now,
    raceAbilityChoice: [],
    classes: [],
    // Varsayılan yöntem point-buy; o da 8'den başlar (27 puanın tamamı elde).
    // 10'dan başlamak 12 puanı peşinen harcanmış gösterirdi.
    abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    abilityMethod: 'pointbuy',
    levelChoices: [],
    hp: { method: 'average', rolls: [] },
    proficiencies: { skills: [], tools: [], languages: [] },
    spells: { cantrips: [], known: [], prepared: [] },
    equipment: [],
    notes: { appearance: '', backstory: '', personality: '', alignment: '' },
  }
}

/** Dışa aktarılan JSON'u doğrular. İçe aktarmada kullanılır. */
export function parseCharacter(input: unknown): Character {
  return characterSchema.parse(input)
}

/** Karakterin toplam seviyesi (multiclass'ta sınıf seviyelerinin toplamı). */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0)
}

/** Birincil sınıf: karakterin ilk aldığı sınıf. Kurtarma atışlarını o belirler. */
export function primaryClass(character: Character): { classId: string; level: number } | undefined {
  return character.classes[0]
}

/** Belirli bir sınıftaki seviye; karakter o sınıfa sahip değilse 0. */
export function levelIn(character: Character, classId: string): number {
  return character.classes.find((c) => c.classId === classId)?.level ?? 0
}

/** Karakterin seçtiği alt sınıf (varsa). */
export function subclassOf(character: Character, classId: string): string | undefined {
  for (const choice of character.levelChoices) {
    if (choice.kind === 'subclass' && choice.classId === classId) return choice.subclassId
  }
  return undefined
}
