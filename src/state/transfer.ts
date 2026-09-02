import { z } from 'zod'
import { characterSchema, SCHEMA_VERSION, type Character } from '../rules/character.ts'
import { migrate } from './storage.ts'

/**
 * Karakterlerin JSON olarak dışa/içe aktarılması.
 *
 * Dışa aktarılan dosya, uygulamanın kendi şemasıdır — başka bir araca değil,
 * bu araca geri yüklenmek için. Kullanıcının verisini kilit altında tutmamak
 * için gereklidir: tarayıcı verisi silinse bile karakter elde kalır.
 */

/** Dosyanın içeriğini tanımlayan sarmalayıcı. */
const exportFileSchema = z.object({
  format: z.literal('charcre5e'),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  characters: z.array(z.unknown()),
})

export interface ExportFile {
  format: 'charcre5e'
  schemaVersion: number
  exportedAt: string
  characters: Character[]
}

export function buildExport(characters: Character[]): ExportFile {
  return {
    format: 'charcre5e',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    characters,
  }
}

/** Türkçe harflerin ASCII karşılıkları. */
const TURKISH_TO_ASCII: Record<string, string> = {
  ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G',
  ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C',
}

/**
 * Dosya adını güvenli hâle getirir.
 *
 * Türkçe harfler ASCII'ye çevrilir: tarayıcılar `download` özniteliğinde
 * ASCII olmayan karakter görünce adı tamamen yok sayıp dosyayı uzantısız
 * "download" olarak indiriyor. Karakterin ekrandaki adı elbette Türkçe kalır;
 * yalnızca dosya adı sadeleşir.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (ch) => TURKISH_TO_ASCII[ch] ?? ch)
    // Kalan ASCII dışı karakterler (emoji, aksan) ve dosya sistemi sakıncalıları.
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
  return cleaned || 'karakter'
}

export interface ImportResult {
  characters: Character[]
  /** Ayrıştırılamayan kayıtlar; sessizce yutulmaz. */
  errors: string[]
}

/**
 * İçe aktarma. Hem tek karakter hem de çoklu dışa aktarma dosyasını kabul eder;
 * kullanıcı hangisini indirdiğini hatırlamak zorunda kalmasın.
 */
export function parseImport(raw: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { characters: [], errors: ['Dosya geçerli bir JSON değil.'] }
  }

  const wrapped = exportFileSchema.safeParse(data)
  const candidates: unknown[] = wrapped.success
    ? wrapped.data.characters
    : Array.isArray(data)
      ? data
      : [data]

  const characters: Character[] = []
  const errors: string[] = []

  for (const [index, candidate] of candidates.entries()) {
    const result = characterSchema.safeParse(migrate(candidate))
    if (result.success) {
      characters.push(result.data)
      continue
    }
    const name = (candidate as { name?: string })?.name
    errors.push(
      `${name ? `"${name}"` : `${index + 1}. kayıt`} okunamadı: ${z.prettifyError(result.error)}`,
    )
  }

  if (characters.length === 0 && errors.length === 0) {
    errors.push('Dosyada karakter bulunamadı.')
  }

  return { characters, errors }
}

/**
 * Tarayıcıda dosya indirir.
 *
 * Object URL bellekte kalmasın diye serbest bırakılır, ama bunu SENKRON
 * yapmak indirmeyi bozar: tarayıcı tıklamayı işlemeden URL geçersizleşir ve
 * dosya adı kaybolur. Bu yüzden bir sonraki tick'e bırakılıyor.
 */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()

  setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 0)
}
