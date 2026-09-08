/**
 * Homebrew düzenleyicilerinin metin yardımcıları.
 *
 * Bileşen dosyalarından ayrı duruyorlar: bir modül hem bileşen hem yardımcı
 * fonksiyon dışa aktarınca Vite'ın fast refresh'i çalışmıyor.
 *
 * Kimlik üretimi burada değil `data/ids.ts` içinde: dış biçim çeviricileri de
 * aynı kuralı kullanmak zorunda.
 */

/** Çok satırlı metni paragraf dizisine çevirir; boş satır paragrafları ayırır. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Bir ırkın özelliklerinin id ön eki.
 *
 * Irk özellikleri ayrı kayıtlardır ama ırkla birlikte yaşarlar: ırk
 * güncellenince eski özellikleri bu önekle bulunup silinir.
 */
export function traitIdPrefix(raceId: string): string {
  return `${raceId}--`
}
