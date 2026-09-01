import { z } from 'zod'
import {
  abilitySchema,
  backgroundSchema,
  characterClassSchema,
  classLevelSchema,
  conditionSchema,
  damageTypeSchema,
  equipmentSchema,
  featSchema,
  featureSchema,
  languageSchema,
  magicSchoolSchema,
  proficiencySchema,
  raceSchema,
  skillSchema,
  spellSchema,
  subclassSchema,
  subraceSchema,
  traitSchema,
  weaponPropertySchema,
  type Ability,
  type Background,
  type CharacterClass,
  type ClassLevel,
  type Condition,
  type DamageType,
  type Equipment,
  type Feat,
  type Feature,
  type Language,
  type MagicSchool,
  type Proficiency,
  type Race,
  type Skill,
  type Source,
  type Spell,
  type Subclass,
  type Subrace,
  type Trait,
  type WeaponProperty,
} from './schema.ts'

import abilitiesJson from './srd/abilities.json'
import backgroundsJson from './srd/backgrounds.json'
import classLevelsJson from './srd/class-levels.json'
import classesJson from './srd/classes.json'
import conditionsJson from './srd/conditions.json'
import damageTypesJson from './srd/damage-types.json'
import featsJson from './srd/feats.json'
import languagesJson from './srd/languages.json'
import magicSchoolsJson from './srd/magic-schools.json'
import proficienciesJson from './srd/proficiencies.json'
import racesJson from './srd/races.json'
import skillsJson from './srd/skills.json'
import subclassesJson from './srd/subclasses.json'
import subracesJson from './srd/subraces.json'
import traitsJson from './srd/traits.json'
import weaponPropertiesJson from './srd/weapon-properties.json'

/**
 * İçerik registry'si.
 *
 * Kural (bkz. CLAUDE.md): kodun hiçbir yerinde doğrudan JSON importu olmamalı —
 * her erişim buradan geçer. Registry, SRD verisi ile kullanıcının homebrew
 * içeriğini tek bir görünümde birleştirir; kural motoru bir kaydın nereden
 * geldiğini umursamaz.
 *
 * Bu dosya JSON'ları import eden **tek** yerdir.
 */

/** Registry'nin sakladığı her kaydın taşıması gereken en az alan kümesi. */
interface Identified {
  id: string
  name: string
  source: Source
}

export class Collection<T extends Identified> {
  readonly #records = new Map<string, T>()
  readonly #schema: z.ZodType<T>
  readonly #label: string

  constructor(label: string, schema: z.ZodType<T>, srdRecords: unknown) {
    this.#label = label
    this.#schema = schema
    this.#load(srdRecords, { validate: import.meta.env.DEV })
  }

  #load(records: unknown, { validate }: { validate: boolean }) {
    const list = records as T[]
    for (const record of list) {
      const parsed = validate ? this.#parse(record) : record
      this.#records.set(parsed.id, parsed)
    }
  }

  #parse(record: unknown): T {
    const result = this.#schema.safeParse(record)
    if (!result.success) {
      const id = (record as { id?: string })?.id ?? '<id yok>'
      throw new Error(
        `${this.#label} kaydı şemaya uymuyor (id: ${id}): ${z.prettifyError(result.error)}`,
      )
    }
    return result.data
  }

  /** Tüm kayıtlar, isme göre sıralı. */
  all(): T[] {
    return [...this.#records.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }

  get(id: string): T | undefined {
    return this.#records.get(id)
  }

  /** Kaydın var olduğundan emin olunan yerlerde kullanılır; yoksa hata verir. */
  require(id: string): T {
    const record = this.#records.get(id)
    if (!record) throw new Error(`${this.#label} bulunamadı: ${id}`)
    return record
  }

  has(id: string): boolean {
    return this.#records.has(id)
  }

  bySource(source: Source): T[] {
    return this.all().filter((r) => r.source === source)
  }

  get size(): number {
    return this.#records.size
  }

  /**
   * Homebrew kayıt ekler. Kullanıcı girdisi olduğu için doğrulama her zaman
   * yapılır — geliştirme/üretim ayrımı gözetilmez.
   */
  register(records: unknown[]): void {
    for (const record of records) {
      const parsed = this.#parse(record)
      if (parsed.source !== 'homebrew') {
        throw new Error(`Yalnızca homebrew kayıt eklenebilir (id: ${parsed.id})`)
      }
      this.#records.set(parsed.id, parsed)
    }
  }

  /** Homebrew kaydı kaldırır. SRD kayıtları silinemez. */
  unregister(id: string): boolean {
    const record = this.#records.get(id)
    if (!record || record.source === 'srd') return false
    return this.#records.delete(id)
  }
}

// ---------------------------------------------------------------------------
// Eager koleksiyonlar — küçük ve sihirbazın ilk adımlarında gerekli
// ---------------------------------------------------------------------------

export const abilities = new Collection<Ability>('Yetenek', abilitySchema, abilitiesJson)
export const skills = new Collection<Skill>('Beceri', skillSchema, skillsJson)
export const languages = new Collection<Language>('Dil', languageSchema, languagesJson)
export const conditions = new Collection<Condition>('Koşul', conditionSchema, conditionsJson)
export const damageTypes = new Collection<DamageType>('Hasar tipi', damageTypeSchema, damageTypesJson)
export const weaponProperties = new Collection<WeaponProperty>(
  'Silah özelliği',
  weaponPropertySchema,
  weaponPropertiesJson,
)
export const magicSchools = new Collection<MagicSchool>('Büyü okulu', magicSchoolSchema, magicSchoolsJson)
export const proficiencies = new Collection<Proficiency>('Yeterlilik', proficiencySchema, proficienciesJson)
export const races = new Collection<Race>('Irk', raceSchema, racesJson)
export const subraces = new Collection<Subrace>('Alt ırk', subraceSchema, subracesJson)
export const traits = new Collection<Trait>('Özellik', traitSchema, traitsJson)
export const classes = new Collection<CharacterClass>('Sınıf', characterClassSchema, classesJson)
export const subclasses = new Collection<Subclass>('Alt sınıf', subclassSchema, subclassesJson)
export const backgrounds = new Collection<Background>('Geçmiş', backgroundSchema, backgroundsJson)
export const feats = new Collection<Feat>('Feat', featSchema, featsJson)

// ---------------------------------------------------------------------------
// Seviye tablosu — id ile değil (sınıf, seviye) çiftiyle adreslenir
// ---------------------------------------------------------------------------

const classLevels: ClassLevel[] = import.meta.env.DEV
  ? z.array(classLevelSchema).parse(classLevelsJson)
  : (classLevelsJson as ClassLevel[])

const classLevelIndex = new Map<string, ClassLevel>(
  classLevels.map((l) => [`${l.classId}:${l.level}`, l]),
)

/** Bir sınıfın belirli seviyedeki tablo satırı. */
export function getClassLevel(classId: string, level: number): ClassLevel | undefined {
  return classLevelIndex.get(`${classId}:${level}`)
}

/** Bir sınıfın 1. seviyeden verilen seviyeye kadarki tüm satırları. */
export function getClassLevelsUpTo(classId: string, level: number): ClassLevel[] {
  const rows: ClassLevel[] = []
  for (let l = 1; l <= level; l += 1) {
    const row = classLevelIndex.get(`${classId}:${l}`)
    if (row) rows.push(row)
  }
  return rows
}

export function registerClassLevels(records: unknown[]): void {
  for (const record of z.array(classLevelSchema).parse(records)) {
    if (record.source !== 'homebrew') {
      throw new Error(`Yalnızca homebrew seviye satırı eklenebilir (${record.classId}:${record.level})`)
    }
    classLevelIndex.set(`${record.classId}:${record.level}`, record)
  }
}

// ---------------------------------------------------------------------------
// Lazy koleksiyonlar — büyük dosyalar, yalnızca gerektiğinde indirilir
// ---------------------------------------------------------------------------

function lazyCollection<T extends Identified>(
  label: string,
  schema: z.ZodType<T>,
  importJson: () => Promise<{ default: unknown }>,
) {
  let promise: Promise<Collection<T>> | undefined
  return () => {
    promise ??= importJson().then((m) => new Collection<T>(label, schema, m.default))
    return promise
  }
}

/** 319 büyü (~450 KB). İlk açılışta indirilmez. */
export const loadSpells = lazyCollection<Spell>('Büyü', spellSchema, () => import('./srd/spells.json'))

/** 237 ekipman kaydı. */
export const loadEquipment = lazyCollection<Equipment>('Ekipman', equipmentSchema, () =>
  import('./srd/equipment.json'),
)

/** 407 sınıf/alt sınıf özelliği (~200 KB). Karakter sayfasında gerekir. */
export const loadFeatures = lazyCollection<Feature>('Sınıf özelliği', featureSchema, () =>
  import('./srd/features.json'),
)
