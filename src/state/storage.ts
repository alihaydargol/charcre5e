import { characterSchema, SCHEMA_VERSION, type Character } from '../rules/character.ts'

/**
 * localStorage kalıcılığı.
 *
 * Veri modeli ileride kaçınılmaz olarak değişecek (homebrew, multiclass…).
 * Kullanıcının kayıtlı karakterleri o zaman bozulmasın diye şema versiyonu ve
 * sürümden sürüme dönüştürme mekanizması baştan kuruluyor — sonradan eklemek
 * geriye dönük veri kaybı riski taşır.
 */

const CHARACTERS_KEY = 'charcre5e:characters'
const DRAFT_KEY = 'charcre5e:draft'

/**
 * localStorage her ortamda çalışmaz: gizli sekmede, site verisi engellendiğinde
 * ya da kotada erişim hata fırlatabilir. Uygulamanın çökmemesi için her erişim
 * korumalı.
 */
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Yoksayılır; silinememesi kullanıcıyı engellemez.
  }
}

/**
 * Sürüm dönüştürücüleri. Her giriş, `n` sürümündeki kaydı `n+1`'e çevirir.
 * Şu an tek sürüm var; ilk şema değişikliğinde buraya eklenecek.
 */
const MIGRATIONS: Record<number, (record: Record<string, unknown>) => Record<string, unknown>> = {}

/** Eski sürümdeki bir kaydı güncel şemaya taşır. */
export function migrate(record: unknown): unknown {
  if (typeof record !== 'object' || record === null) return record
  let current = record as Record<string, unknown>
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    current = step(current)
    version += 1
    current.schemaVersion = version
  }
  return current
}

export interface LoadResult {
  characters: Character[]
  /** Ayrıştırılamayan kayıtlar; kullanıcıya bildirilir, sessizce yutulmaz. */
  errors: { id: string; message: string }[]
}

/** Kayıtlı tüm karakterler. Bozuk kayıtlar listeden düşer ama raporlanır. */
export function loadCharacters(): LoadResult {
  const raw = safeRead(CHARACTERS_KEY)
  if (!raw) return { characters: [], errors: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { characters: [], errors: [{ id: '-', message: 'Kayıt dosyası okunamadı (bozuk JSON).' }] }
  }
  if (!Array.isArray(parsed)) {
    return { characters: [], errors: [{ id: '-', message: 'Kayıt dosyasının biçimi beklenmedik.' }] }
  }

  const characters: Character[] = []
  const errors: LoadResult['errors'] = []

  for (const entry of parsed) {
    const result = characterSchema.safeParse(migrate(entry))
    if (result.success) {
      characters.push(result.data)
    } else {
      const id = (entry as { id?: string })?.id ?? '?'
      const name = (entry as { name?: string })?.name
      errors.push({
        id,
        message: `"${name || id}" kaydı güncel şemaya uymuyor ve yüklenemedi.`,
      })
    }
  }

  return { characters, errors }
}

/** Tüm karakterleri yazar. Kota dolduysa false döner. */
export function saveCharacters(characters: Character[]): boolean {
  return safeWrite(CHARACTERS_KEY, JSON.stringify(characters))
}

/** Yarım kalan sihirbaz taslağı. Sekme kapansa bile kaybolmaz. */
export function loadDraft(): Character | undefined {
  const raw = safeRead(DRAFT_KEY)
  if (!raw) return undefined
  try {
    const result = characterSchema.safeParse(migrate(JSON.parse(raw)))
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

export function saveDraft(character: Character): boolean {
  return safeWrite(DRAFT_KEY, JSON.stringify(character))
}

export function clearDraft(): void {
  safeRemove(DRAFT_KEY)
}

/** localStorage bu tarayıcıda kullanılabilir mi? */
export function storageAvailable(): boolean {
  try {
    const probe = '__charcre5e_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
