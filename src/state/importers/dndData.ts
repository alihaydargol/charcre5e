import { classes, damageTypes, magicSchools } from '../../data/registry.ts'
import { slugify } from '../../data/ids.ts'
import type {
  AbilityId,
  Background,
  CharacterClass,
  Equipment,
  Race,
  Spell,
} from '../../data/schema.ts'
import { buildClassLevels, buildSpellcasting } from '../../rules/classTable.ts'
import { emptyPack, type HomebrewPack } from '../homebrew.ts'

/**
 * `nick-aschenbach/dnd-data` biçimini homebrew paketine çevirir.
 *
 * ## Bu veri neden depoda değil
 *
 * Kaynak deponun içeriği PHB 2024, DMG, Xanathar's, Tasha's ve 190'dan fazla
 * kitabın birebir metni; yalnızca Wizards of the Coast değil, onlarca üçüncü
 * taraf yayıncı da var. Deponun MIT lisansı bu metinleri dağıtma hakkı vermez
 * ve CLAUDE.md §2 depoya SRD 5.1 dışında içerik konmasını yasaklar.
 *
 * Bu yüzden burada yalnızca **çevirici** var. Kullanıcı dosyaları kendi
 * makinesinde edinir, kendi tarayıcısına yükler; hiçbir şey depoya ya da bir
 * sunucuya gitmez — zaten sunucu da yok.
 *
 * ## Çevirinin sınırı
 *
 * Kaynak kayıtların çoğu düzyazıdır: `description` alanı kitabın metni,
 * `properties` ise dağınık ve veri kümesine göre değişen bir sözlük. Yapılı
 * olan alanlar aktarılır, olmayanlar için makul varsayılan konur ve hangi
 * alanların varsayıldığı raporda **açıkça söylenir**. Sessizce doldurmak,
 * kullanıcıya yanlış bir kayıt hakkında doğru olduğunu düşündürürdü.
 */

/** Kaynak biçimdeki tek kayıt. */
interface SourceRecord {
  name?: unknown
  description?: unknown
  properties?: Record<string, unknown>
  publisher?: unknown
  book?: unknown
}

export type Dataset = 'species' | 'classes' | 'spells' | 'backgrounds' | 'items'

export interface ImportReport {
  dataset?: Dataset
  /** Pakete giren kayıt sayısı. */
  imported: number
  /** Çevrilemeyen kayıtlar ve nedenleri. */
  skipped: { name: string; reason: string }[]
  /**
   * Kaynakta yapılı karşılığı olmayan, varsayılanla dolan alanlar.
   * Kullanıcı içe aktardıktan sonra bunları elle düzeltmeli.
   */
  defaulted: string[]
  /**
   * Aynı ada sahip olduğu için birleşen kayıt sayısı.
   *
   * Kaynak derlemede aynı tür/büyü birden çok kitapta geçebiliyor; kimlik
   * addan türetildiği için bunlar tek kayda düşüyor. Sayılmasa "40 kayıt
   * alındı" deyip listede 29 göstermek olurdu.
   */
  merged: number
}

export interface ImportResult {
  pack: HomebrewPack
  report: ImportReport
  error?: string
}

/** `properties.Category` alanından veri kümesini tanır. */
export function detectDataset(records: unknown): Dataset | undefined {
  if (!Array.isArray(records)) return undefined
  for (const record of records.slice(0, 50)) {
    const category = (record as SourceRecord)?.properties?.Category
    if (typeof category !== 'string') continue
    switch (category.toLowerCase()) {
      case 'races':
      case 'species':
        return 'species'
      case 'classes':
        return 'classes'
      case 'spells':
        return 'spells'
      case 'backgrounds':
        return 'backgrounds'
      case 'items':
        return 'items'
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Küçük yardımcılar
// ---------------------------------------------------------------------------

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const num = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

/** Kaynakta bazı diziler JSON dizesi olarak gömülü geliyor. */
function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function jsonObject(value: unknown): Record<string, string> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** Uzun düzyazıyı paragraflara böler; kaynakta satır sonu yok, cümle var. */
function paragraphs(value: unknown): string[] {
  const raw = text(value)
  if (!raw) return []
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

const ABILITY_BY_NAME: Record<string, AbilityId> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

function ability(value: string): AbilityId | undefined {
  return ABILITY_BY_NAME[value.trim().toLowerCase()]
}

/** Kaynak ve kitap bilgisi açıklamanın sonuna not olarak eklenir. */
function attribution(record: SourceRecord): string[] {
  const publisher = text(record.publisher)
  const book = text(record.book)
  if (!publisher && !book) return []
  return [`Kaynak: ${[book, publisher].filter(Boolean).join(' — ')}`]
}

// ---------------------------------------------------------------------------
// Veri kümesi çevirileri
// ---------------------------------------------------------------------------

function toRace(record: SourceRecord): Race | undefined {
  const name = text(record.name)
  if (!name) return undefined
  const props = record.properties ?? {}

  const bonuses = Object.entries(jsonObject(props['data-Ability Score Increase']))
    .map(([key, value]) => {
      const id = ability(key)
      const bonus = num(value)
      return id && bonus ? { ability: id, bonus } : undefined
    })
    .filter((b) => b !== undefined)

  const size = text(props.Size)
  return {
    id: slugify(name),
    name,
    source: 'homebrew',
    speed: num(props.Speed) ?? 30,
    size: (['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const).includes(
      size as never,
    )
      ? (size as Race['size'])
      : 'Medium',
    sizeDesc: '',
    ageDesc: '',
    alignmentDesc: '',
    abilityBonuses: bonuses,
    languages: ['common'],
    languageDesc: '',
    traits: [],
    subraces: [],
  }
}

/** Kaster ilerlemesi → model alınacak SRD sınıfı. */
const CASTER_MODEL: Record<string, string> = {
  full: 'wizard',
  half: 'paladin',
  pact: 'warlock',
}

function toClass(record: SourceRecord): { cls: CharacterClass; levels: HomebrewPack['classLevels'] } | undefined {
  const name = text(record.name)
  const props = record.properties ?? {}
  const hitDie = num(text(props['Hit Die']).replace(/^d/i, ''))
  // Hit die olmayan kayıtlar yalnızca düzyazı; sınıf olarak kurulamaz.
  if (!name || !hitDie) return undefined

  const id = slugify(name)
  const saves = jsonArray(props['data-Saving Throws'])
    .map(ability)
    .filter((a) => a !== undefined)

  const progression = text(props['Caster Progression']).toLowerCase()
  const modelId = CASTER_MODEL[progression]
  const castingAbility = ability(text(props['Spellcasting Ability'])) ?? 'int'

  const asiLevels = jsonArray(props['data-Ability Score Levels'])
    .map((l) => num(l))
    .filter((l) => l !== undefined)

  const cls: CharacterClass = {
    id,
    name,
    source: 'homebrew',
    hitDie,
    savingThrows: saves,
    proficiencies: [],
    skillChoice: undefined,
    proficiencyChoices: [],
    subclasses: [],
    subclassLevel: num(props['data-Subclass Level']) ?? 3,
    spellcasting: modelId ? buildSpellcasting(modelId, castingAbility) : undefined,
    startingEquipment: [],
    startingEquipmentChoices: [],
  }

  const levels = buildClassLevels({
    classId: id,
    spellcastingModelId: modelId,
    extraAsiLevels: asiLevels,
    features: [],
  })

  return { cls, levels }
}

function toSpell(record: SourceRecord): Spell | undefined {
  const name = text(record.name)
  const props = record.properties ?? {}
  const level = num(props.Level)
  if (!name || level === undefined || level < 0 || level > 9) return undefined

  const school = text(props.School).toLowerCase()
  const components = text(props.Components)
    .toUpperCase()
    .split(/[^VSM]+/)
    .filter((c): c is 'V' | 'S' | 'M' => c === 'V' || c === 'S' || c === 'M')

  // Sınıf listesi virgülle ayrılmış adlar; SRD'de karşılığı olmayanlar düşer.
  const spellClasses = text(props.Classes)
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => classes.has(c))

  return {
    id: slugify(name),
    name,
    source: 'homebrew',
    level,
    school: magicSchools.has(school) ? school : 'evocation',
    castingTime: text(props['Casting Time']) || '1 action',
    range: text(props.Range) || text(props['data-RangeAoe']) || '—',
    components: components.length > 0 ? components : ['V'],
    material: text(props.Material) || undefined,
    duration: text(props.Duration) || 'Instantaneous',
    concentration: Boolean(props.Concentration),
    ritual: Boolean(props.Ritual),
    classes: spellClasses,
    subclasses: [],
    desc: [...paragraphs(record.description), ...attribution(record)],
    higherLevel: [],
  }
}

function toBackground(record: SourceRecord): Background | undefined {
  const name = text(record.name)
  if (!name) return undefined
  const props = record.properties ?? {}

  return {
    id: slugify(name),
    name,
    source: 'homebrew',
    feature: { name, desc: [...paragraphs(record.description), ...attribution(record)] },
    proficiencies: [],
    languageChoiceCount: 0,
    startingEquipment: [],
    startingEquipmentChoices: [],
    startingGold: num(props['data-Starting Gold']) ?? 0,
    personalityTraits: jsonArray(props['data-Personality Traits']),
    ideals: jsonArray(props['data-Ideals']).map((desc) => ({ desc, alignments: [] })),
    bonds: jsonArray(props['data-Bonds']),
    flaws: jsonArray(props['data-Flaws']),
  }
}

const ARMOR_KINDS: Record<string, 'Light' | 'Medium' | 'Heavy' | 'Shield'> = {
  'light armor': 'Light',
  'medium armor': 'Medium',
  'heavy armor': 'Heavy',
  shield: 'Shield',
}

function toEquipment(record: SourceRecord): Equipment | undefined {
  const name = text(record.name)
  if (!name) return undefined

  const props = record.properties ?? {}
  const id = slugify(name)
  const itemType = text(props['Item Type']).toLowerCase()
  const desc = [...paragraphs(record.description), ...attribution(record)]
  const base = { id, name, source: 'homebrew' as const, weight: num(props.Weight), desc }

  const armorKind = ARMOR_KINDS[itemType]
  if (armorKind) {
    const ac = num(props.AC) ?? (armorKind === 'Shield' ? 2 : 11)
    return {
      ...base,
      category: 'armor',
      armorCategory: armorKind,
      armorClass: {
        base: ac,
        dexBonus: armorKind !== 'Shield' && armorKind !== 'Heavy',
        maxDexBonus: armorKind === 'Medium' ? 2 : null,
      },
      strMinimum: 0,
      stealthDisadvantage: text(props.Stealth).toLowerCase().includes('disadvantage'),
    }
  }

  if (itemType.includes('weapon')) {
    const dice = text(props.Damage)
    const damageType = text(props['Damage Type']).toLowerCase()
    const alternate = text(props['Alternate Damage'])
    const properties = text(props.Properties)
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)

    return {
      ...base,
      category: 'weapon',
      weaponCategory: text(props.Subtype).toLowerCase().includes('martial') ? 'Martial' : 'Simple',
      weaponRange: itemType.includes('ranged') ? 'Ranged' : 'Melee',
      damage: dice
        ? { dice, type: damageTypes.has(damageType) ? damageType : 'bludgeoning' }
        : undefined,
      twoHandedDamage: alternate
        ? { dice: alternate, type: damageTypes.has(damageType) ? damageType : 'bludgeoning' }
        : undefined,
      properties,
    }
  }

  return { ...base, category: 'gear' }
}

// ---------------------------------------------------------------------------
// Giriş noktası
// ---------------------------------------------------------------------------

/** Hangi alanların varsayılanla dolduğu — kullanıcıya söylenir. */
const DEFAULTED: Record<Dataset, string[]> = {
  species: [
    'Irk özellikleri (traits) kaynakta yapılı değil; açıklama metni kalır, özellikleri elle eklemelisin.',
    'Diller "Common" varsayılır.',
    'Boyut ve hız yalnızca birkaç kayıtta yapılı; kalanı Medium / 30 ft varsayılır.',
  ],
  classes: [
    'Zırh ve silah yeterlilikleri kaynakta yapılı değil; boş gelir.',
    'Beceri seçimi ve başlangıç ekipmanı boş gelir.',
    'Seviye özellikleri boş gelir; tablo (PB, ASI, slotlar) üretilir.',
  ],
  spells: ['Hasar tabloları ve "daha yüksek seviyede" notu açıklama metninde kalır.'],
  backgrounds: [
    'Beceri ve dil yeterlilikleri kaynakta yapılı değil; boş gelir.',
    'Başlangıç ekipmanı boş gelir.',
  ],
  items: ['Fiyat kaynakta yok; boş gelir.'],
}

/**
 * Ayrıştırılmış bir dnd-data dosyasını homebrew paketine çevirir.
 *
 * Bozuk tek bir kayıt tüm dosyayı düşürmez: çevrilemeyen kayıt nedeniyle
 * birlikte raporlanır ve gerisi alınır. Paket içe aktarmadan farkı bu —
 * orada dosya kullanıcının kendi dışa aktarımı olduğu için bütünlük beklenir,
 * burada kaynak dış bir derleme ve kısmi başarı normaldir.
 */
export function convertDndData(raw: unknown, limit = 500): ImportResult {
  const empty = {
    pack: emptyPack(),
    report: { imported: 0, merged: 0, skipped: [], defaulted: [] },
  }

  if (!Array.isArray(raw)) {
    return { ...empty, error: 'Dosya bir kayıt dizisi değil. dnd-data JSON dosyalarını bekliyoruz.' }
  }

  const dataset = detectDataset(raw)
  if (!dataset) {
    return {
      ...empty,
      error:
        'Veri kümesi tanınamadı. Kayıtlarda properties.Category alanı bekleniyor ' +
        '(Species, Classes, Spells, Backgrounds ya da Items).',
    }
  }

  const pack = emptyPack()
  const skipped: ImportReport['skipped'] = []
  const seenIds = new Set<string>()
  let imported = 0
  let merged = 0

  for (const entry of raw) {
    if (imported >= limit) {
      skipped.push({
        name: `+${Math.max(0, raw.length - imported - skipped.length)} kayıt daha`,
        reason: `Tek seferde en fazla ${limit} kayıt alınıyor (tarayıcı depolaması sınırlı).`,
      })
      break
    }

    const record = entry as SourceRecord
    const name = text(record.name) || '(isimsiz)'

    // Her dal ya kayıt ekler ya atlama nedeni döner; sayaç tek yerde artar.
    const reason = ((): string | undefined => {
      switch (dataset) {
        case 'species': {
          const race = toRace(record)
          if (!race) return 'Adı okunamadı.'
          pack.races.push(race)
          return undefined
        }
        case 'classes': {
          const converted = toClass(record)
          if (!converted) return 'Hit die bilgisi yok; yalnızca düzyazı kayıt.'
          pack.classes.push(converted.cls)
          pack.classLevels.push(...converted.levels)
          return undefined
        }
        case 'spells': {
          const spell = toSpell(record)
          if (!spell) return 'Seviye bilgisi yok ya da geçersiz.'
          pack.spells.push(spell)
          return undefined
        }
        case 'backgrounds': {
          const background = toBackground(record)
          if (!background) return 'Adı okunamadı.'
          pack.backgrounds.push(background)
          return undefined
        }
        case 'items': {
          const item = toEquipment(record)
          if (!item) return 'Adı okunamadı.'
          pack.equipment.push(item)
          return undefined
        }
      }
    })()

    if (reason) {
      skipped.push({ name, reason })
      continue
    }

    // Kimlik addan türetiliyor; aynı ad ikinci kez gelirse öncekinin üzerine
    // yazılır. Kullanıcıya kaç kaydın böyle birleştiğini söylüyoruz.
    const id = slugify(name)
    if (seenIds.has(id)) merged += 1
    seenIds.add(id)
    imported += 1
  }

  return {
    pack,
    report: { dataset, imported, merged, skipped, defaulted: DEFAULTED[dataset] },
  }
}
