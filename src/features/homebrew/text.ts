/**
 * Homebrew düzenleyicilerinin metin yardımcıları.
 *
 * Bileşen dosyalarından ayrı duruyorlar: bir modül hem bileşen hem yardımcı
 * fonksiyon dışa aktarınca Vite'ın fast refresh'i çalışmıyor.
 */

/** Çok satırlı metni paragraf dizisine çevirir; boş satır paragrafları ayırır. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Ad alanından türetilen kimlik: "Kaos Büyücüsü" → "hb-kaos-buyucusu".
 *
 * Türkçe harfler ASCII karşılıklarına çevrilir; id'ler dosya adı ve URL
 * parçası olarak da kullanılabilsin diye.
 */
export function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  }
  const ascii = [...name].map((ch) => map[ch] ?? ch).join('')
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `hb-${slug || 'kayit'}`
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

/** Alt kayıt id'si: "hb-witch-hunter--gizli-vurus-0". */
export function childId(parentId: string, name: string, index: number): string {
  return `${parentId}--${slugify(name).replace(/^hb-/, '')}-${index}`
}
