import { z } from 'zod'
import { setHomebrewClassLevels } from '../data/pendingLevels.ts'
import { applyHomebrew, HOMEBREW_KINDS, type HomebrewKind } from '../data/registry.ts'
import {
  backgroundSchema,
  characterClassSchema,
  classLevelSchema,
  equipmentSchema,
  featSchema,
  featureSchema,
  magicItemSchema,
  raceSchema,
  spellSchema,
  subclassSchema,
  subraceSchema,
  traitSchema,
} from '../data/schema.ts'

/**
 * Homebrew içeriğin saklanması, kurulması ve paylaşılması.
 *
 * Kural motoru homebrew'i tanımaz (bkz. CLAUDE.md): bir kaydın SRD'den mi
 * kullanıcıdan mı geldiği yalnızca `source` alanında yazar ve kayıtlar aynı
 * şemayı kullanır. Bu yüzden bu dosya bir *depolama ve kurulum* katmanıdır,
 * kural katmanı değil.
 */

const HOMEBREW_KEY = 'charcre5e:homebrew'

/** Paketin biçim sürümü; şema değişince artırılır. */
export const HOMEBREW_VERSION = 1

/**
 * Bir homebrew paketi.
 *
 * Her alan isteğe bağlıdır; yalnızca kullanıcının tanımladığı türler dolar.
 * `classLevels` kullanıcı tarafından elle doldurulmaz, sınıf kaydedilirken
 * `buildClassLevels` ile üretilir (bkz. `rules/classTable.ts`).
 */
export const homebrewPackSchema = z.object({
  format: z.literal('charcre5e-homebrew'),
  version: z.number().int().positive(),
  name: z.string().default('Homebrew'),
  races: z.array(raceSchema).default([]),
  subraces: z.array(subraceSchema).default([]),
  traits: z.array(traitSchema).default([]),
  classes: z.array(characterClassSchema).default([]),
  subclasses: z.array(subclassSchema).default([]),
  classLevels: z.array(classLevelSchema).default([]),
  features: z.array(featureSchema).default([]),
  backgrounds: z.array(backgroundSchema).default([]),
  feats: z.array(featSchema).default([]),
  spells: z.array(spellSchema).default([]),
  equipment: z.array(equipmentSchema).default([]),
  magicItems: z.array(magicItemSchema).default([]),
})

export type HomebrewPack = z.infer<typeof homebrewPackSchema>

export function emptyPack(): HomebrewPack {
  return homebrewPackSchema.parse({
    format: 'charcre5e-homebrew',
    version: HOMEBREW_VERSION,
    name: 'Homebrew',
  })
}

/** Paketteki toplam kayıt sayısı (seviye tabloları hariç — onlar türetilmiştir). */
export function packSize(pack: HomebrewPack): number {
  return HOMEBREW_KINDS.reduce((total, kind) => total + pack[kind].length, 0)
}

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------

/**
 * Paketi registry'ye kurar.
 *
 * Sıra önemli değil: koleksiyonlar birbirine referansları çözmez, kural motoru
 * çözer.
 *
 * Seviye tabloları doğrudan yazılmaz, `pendingLevels` üzerinden geçer — sınıf
 * tablosu modülü ayrı bir chunk'ta ve buradan import edilmesi onu ilk bundle'a
 * çekerdi.
 */
export function installPack(pack: HomebrewPack): void {
  for (const kind of HOMEBREW_KINDS) {
    applyHomebrew(kind, pack[kind])
  }
  setHomebrewClassLevels(pack.classLevels)
}

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export interface HomebrewLoadResult {
  pack: HomebrewPack
  /** Yükleme başarısızsa nedeni; kullanıcıya gösterilir, sessizce yutulmaz. */
  error?: string
}

export function loadHomebrew(): HomebrewLoadResult {
  const raw = safeRead(HOMEBREW_KEY)
  if (!raw) return { pack: emptyPack() }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { pack: emptyPack(), error: 'Homebrew kaydı okunamadı (bozuk JSON).' }
  }

  const result = homebrewPackSchema.safeParse(parsed)
  if (!result.success) {
    return {
      pack: emptyPack(),
      error: 'Homebrew kaydı güncel şemaya uymuyor ve yüklenemedi.',
    }
  }
  return { pack: result.data }
}

/** Paketi yazar. Kota dolduysa false döner. */
export function saveHomebrew(pack: HomebrewPack): boolean {
  try {
    localStorage.setItem(HOMEBREW_KEY, JSON.stringify(pack))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Dışa / içe aktarma
// ---------------------------------------------------------------------------

/**
 * İçe aktarılan paketi ayrıştırır.
 *
 * Bozuk kayıt sessizce yutulmaz: paket bütünüyle geçerli değilse hata döner ve
 * hiçbir şey kurulmaz. Kısmi kurulum, kırık referanslara (var olmayan bir
 * trait'e bakan ırk gibi) yol açardı.
 */
export function parseHomebrewImport(text: string): { pack?: HomebrewPack; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Dosya geçerli bir JSON değil.' }
  }

  const result = homebrewPackSchema.safeParse(parsed)
  if (!result.success) {
    return { error: `Paket okunamadı: ${z.prettifyError(result.error)}` }
  }
  if (result.data.version > HOMEBREW_VERSION) {
    return { error: 'Bu paket uygulamanın desteklediğinden yeni bir sürümle yazılmış.' }
  }
  return { pack: result.data }
}

/**
 * İki paketi birleştirir; aynı id'li kayıtlarda gelen paket kazanır.
 * İçe aktarma, var olan homebrew içeriğin üzerine yazmak yerine ekler.
 */
export function mergePacks(base: HomebrewPack, incoming: HomebrewPack): HomebrewPack {
  const merged = { ...base, name: base.name }

  const mergeById = (a: { id: string }[], b: { id: string }[]) => {
    const byId = new Map(a.map((r) => [r.id, r]))
    for (const record of b) byId.set(record.id, record)
    return [...byId.values()]
  }

  // Birleştirme mantığı her türde aynı ama alanların tipleri farklı; tür
  // güvenliği paketin şemasıyla zaten sağlandığı için burada gevşetiliyor.
  const target = merged as unknown as Record<HomebrewKind, { id: string }[]>
  const from = base as unknown as Record<HomebrewKind, { id: string }[]>
  const to = incoming as unknown as Record<HomebrewKind, { id: string }[]>
  for (const kind of HOMEBREW_KINDS) {
    target[kind] = mergeById(from[kind], to[kind])
  }

  const levelKey = (row: { classId: string; level: number }) => `${row.classId}:${row.level}`
  const levels = new Map(base.classLevels.map((r) => [levelKey(r), r]))
  for (const row of incoming.classLevels) levels.set(levelKey(row), row)
  merged.classLevels = [...levels.values()]

  return merged
}
