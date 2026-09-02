/**
 * Homebrew seviye satırları için bekleme odası.
 *
 * `classLevels.ts` sınıf tablosu JSON'unu (~112 kB) taşıdığı için ayrı bir
 * chunk'ta durur ve yalnızca kural motoru gerektirdiğinde iner. Homebrew
 * kurulumu ise uygulama açılışında yapılır; kurulum kodunun o modülü doğrudan
 * import etmesi tabloyu ilk bundle'a geri çekerdi.
 *
 * Bu yüzden satırlar burada bekletilir: `classLevels.ts` yüklendiği anda
 * kendini bağlar ve bekleyenleri alır. Böylece ne yükleme sırası bir yarışa
 * dönüşür ne de ilk açılış ağırlaşır.
 */

let pending: unknown[] = []
let apply: ((rows: unknown[]) => void) | undefined

/** Kurulum tarafı: bu türün tüm homebrew satırları. */
export function setHomebrewClassLevels(rows: unknown[]): void {
  pending = rows
  apply?.(rows)
}

/** `classLevels.ts` yüklenince kendini bağlar; bekleyen satırlar hemen uygulanır. */
export function connectClassLevels(sink: (rows: unknown[]) => void): void {
  apply = sink
  if (pending.length > 0) sink(pending)
}
