import { z } from 'zod'
import {
  abilitySchema,
  backgroundSchema,
  characterClassSchema,
  conditionSchema,
  damageTypeSchema,
  equipmentCategorySchema,
  equipmentSchema,
  featSchema,
  featureSchema,
  languageSchema,
  magicItemSchema,
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
  type Condition,
  type DamageType,
  type Equipment,
  type EquipmentCategory,
  type Feat,
  type Feature,
  type Language,
  type MagicItem,
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
import classesJson from './srd/classes.json'
import conditionsJson from './srd/conditions.json'
import damageTypesJson from './srd/damage-types.json'
import equipmentCategoriesJson from './srd/equipment-categories.json'
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
    // Önce hepsi doğrulanır, sonra yazılır: listenin ortasında hata çıkarsa
    // koleksiyon yarı kurulmuş hâlde kalmasın.
    const parsed = records.map((record) => {
      const value = this.#parse(record)
      if (value.source !== 'homebrew') {
        throw new Error(`Yalnızca homebrew kayıt eklenebilir (id: ${value.id})`)
      }
      return value
    })
    for (const record of parsed) this.#records.set(record.id, record)
  }

  /** Homebrew kaydı kaldırır. SRD kayıtları silinemez. */
  unregister(id: string): boolean {
    const record = this.#records.get(id)
    if (!record || record.source === 'srd') return false
    return this.#records.delete(id)
  }

  /**
   * Tüm homebrew kayıtlarını kaldırır; SRD kayıtları kalır.
   *
   * Homebrew kurulumu "sil ve yeniden yaz" biçiminde yapılır: kullanıcı bir
   * kaydı silince kalıntı kalmasın diye. Kısmi güncelleme yapmak, silinen
   * kayıtları koleksiyonda unutmaya açık olurdu.
   */
  clearHomebrew(): void {
    for (const [id, record] of this.#records) {
      if (record.source === 'homebrew') this.#records.delete(id)
    }
  }
}

// ---------------------------------------------------------------------------
// Homebrew kurulumu
// ---------------------------------------------------------------------------

/**
 * Homebrew kaydı kabul eden koleksiyonlar.
 *
 * Not: `classLevels` burada yok — seviye tabloları ayrı bir modülde duruyor
 * (bkz. `classLevels.ts`) ve oradaki `applyHomebrewClassLevels` ile kurulur.
 */
export const HOMEBREW_KINDS = [
  'races',
  'subraces',
  'traits',
  'classes',
  'subclasses',
  'backgrounds',
  'feats',
  'spells',
  'equipment',
  'magicItems',
  'features',
] as const

export type HomebrewKind = (typeof HOMEBREW_KINDS)[number]

/**
 * Kurulu homebrew kayıtları, tür başına.
 *
 * Lazy koleksiyonlar (büyü, ekipman…) uygulama açıldıktan sonra yüklenir;
 * o ana kadar kurulan homebrew kayıtlarını kaybetmemek için burada tutulur ve
 * koleksiyon yüklendiğinde uygulanır.
 */
const installedHomebrew = new Map<HomebrewKind, unknown[]>()
const lazyKinds = new Set<HomebrewKind>()
const loadedLazy = new Map<HomebrewKind, Collection<Identified>>()

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

/**
 * Ekipman kategorileri eager yüklenir: küçüktür (39 kayıt, yalnızca id
 * listeleri) ve sihirbazın ekipman adımında "bir martial silah seç" gibi
 * seçenekleri çözmek için gerekir.
 */
export const equipmentCategories = new Collection<EquipmentCategory>(
  'Ekipman kategorisi',
  equipmentCategorySchema,
  equipmentCategoriesJson,
)

// ---------------------------------------------------------------------------
// Lazy koleksiyonlar — büyük dosyalar, yalnızca gerektiğinde indirilir
// ---------------------------------------------------------------------------

function lazyCollection<T extends Identified>(
  kind: HomebrewKind,
  label: string,
  schema: z.ZodType<T>,
  importJson: () => Promise<{ default: unknown }>,
) {
  let promise: Promise<Collection<T>> | undefined

  const loader = () => {
    promise ??= importJson().then((m) => {
      const collection = new Collection<T>(label, schema, m.default)
      // Koleksiyon uygulama açıldıktan çok sonra yüklenebilir; o ana kadar
      // kurulmuş homebrew kayıtları burada uygulanır.
      collection.register(installedHomebrew.get(kind) ?? [])
      loadedLazy.set(kind, collection as Collection<Identified>)
      return collection
    })
    return promise
  }

  lazyKinds.add(kind)
  return loader
}

/** 319 büyü (~450 KB). İlk açılışta indirilmez. */
export const loadSpells = lazyCollection<Spell>('spells', 'Büyü', spellSchema, () =>
  import('./srd/spells.json'),
)

/** 237 ekipman kaydı. */
export const loadEquipment = lazyCollection<Equipment>('equipment', 'Ekipman', equipmentSchema, () =>
  import('./srd/equipment.json'),
)

/** 362 sihirli eşya. Karakter oluşturmada 1. seviyede gerekmez. */
export const loadMagicItems = lazyCollection<MagicItem>('magicItems', 'Sihirli eşya', magicItemSchema, () =>
  import('./srd/magic-items.json'),
)

/** 407 sınıf/alt sınıf özelliği (~200 KB). Karakter sayfasında gerekir. */
export const loadFeatures = lazyCollection<Feature>('features', 'Sınıf özelliği', featureSchema, () =>
  import('./srd/features.json'),
)

// ---------------------------------------------------------------------------
// Homebrew kurulum arayüzü
// ---------------------------------------------------------------------------

const eagerCollections: Partial<Record<HomebrewKind, Collection<Identified>>> = {
  races: races as Collection<Identified>,
  subraces: subraces as Collection<Identified>,
  traits: traits as Collection<Identified>,
  classes: classes as Collection<Identified>,
  subclasses: subclasses as Collection<Identified>,
  backgrounds: backgrounds as Collection<Identified>,
  feats: feats as Collection<Identified>,
}

/**
 * Bir türün homebrew kayıtlarını kurar.
 *
 * "Sil ve yeniden yaz" biçiminde çalışır: verilen liste o türün tam
 * homebrew içeriğidir, listede olmayan eski kayıtlar kaldırılır. Böylece
 * kaydetme ve silme tek bir yoldan geçer.
 *
 * Doğrulama `Collection.register` içinde her zaman yapılır; şemaya uymayan
 * bir kayıt hata fırlatır ve hiçbiri kurulmaz.
 */
export function applyHomebrew(kind: HomebrewKind, records: unknown[]): void {
  const collection = eagerCollections[kind] ?? loadedLazy.get(kind)
  if (!collection && !lazyKinds.has(kind)) {
    throw new Error(`Bilinmeyen homebrew türü: ${kind}`)
  }

  if (collection) {
    // register atomiktir: liste bütünüyle doğrulanmadan hiçbiri yazılmaz.
    // Bu yüzden temizlik güvenle önce yapılabilir... ama yapılmaz: hata
    // durumunda eski homebrew içeriği duruyor olmalı.
    const previous = installedHomebrew.get(kind) ?? []
    collection.clearHomebrew()
    try {
      collection.register(records)
    } catch (error) {
      collection.clearHomebrew()
      collection.register(previous)
      throw error
    }
  }
  installedHomebrew.set(kind, records)
}

/** Kurulu homebrew kayıtlarının tamamını kaldırır. */
export function clearAllHomebrew(): void {
  for (const kind of HOMEBREW_KINDS) {
    eagerCollections[kind]?.clearHomebrew()
    loadedLazy.get(kind)?.clearHomebrew()
    installedHomebrew.delete(kind)
  }
}
