/**
 * Kimlik üretimi.
 *
 * Hem homebrew düzenleyicileri hem dış biçim çeviricileri aynı kuralı
 * kullanmalı: aynı isimden aynı id çıksın, yoksa bir kayıt iki farklı yoldan
 * girildiğinde iki kopya oluşurdu.
 */

const TURKISH_TO_ASCII: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

/**
 * Ad alanından türetilen kimlik: "Kaos Büyücüsü" → "hb-kaos-buyucusu".
 *
 * `hb-` öneki homebrew kayıtlarını SRD kayıtlarından ayırır: aynı ada sahip
 * bir homebrew büyü SRD'dekini ezmesin diye.
 */
export function slugify(name: string): string {
  const ascii = [...name].map((ch) => TURKISH_TO_ASCII[ch] ?? ch).join('')
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `hb-${slug || 'kayit'}`
}

/** Alt kayıt id'si: "hb-witch-hunter--gizli-vurus-0". */
export function childId(parentId: string, name: string, index: number): string {
  return `${parentId}--${slugify(name).replace(/^hb-/, '')}-${index}`
}
