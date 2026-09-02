import { z } from 'zod'
import { connectClassLevels } from './pendingLevels.ts'
import { classLevelSchema, type ClassLevel } from './schema.ts'
import classLevelsJson from './srd/class-levels.json'

/**
 * Sınıf seviye tabloları (12 sınıf × 20 seviye = 240 satır).
 *
 * Bu veri `registry.ts`'ten AYRI bir modülde duruyor çünkü tek başına eager
 * verinin en büyük parçası (~112 kB). Karakter listesi gibi yalnızca sınıf
 * *adına* ihtiyaç duyan ekranlar bunu indirmek zorunda kalmasın diye ayrıldı;
 * seviye tabloları yalnızca kural motoru ve sihirbaz tarafından kullanılır ve
 * onlar zaten ayrı chunk'ta.
 *
 * Registry kuralı burada da geçerli: JSON'a doğrudan erişen tek yer burasıdır.
 */

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

/**
 * Homebrew seviye satırlarını kurar.
 *
 * `registry.ts`'teki `applyHomebrew` ile aynı mantık: verilen liste tüm
 * homebrew içeriğidir, eskiler kaldırılır. Doğrulama önce yapılır, yazma
 * sonra — hatalı bir liste tabloyu yarım bırakmaz.
 */
export function applyHomebrewClassLevels(records: unknown[]): void {
  const parsed = z.array(classLevelSchema).parse(records)
  for (const record of parsed) {
    if (record.source !== 'homebrew') {
      throw new Error(
        `Yalnızca homebrew seviye satırı eklenebilir (${record.classId}:${record.level})`,
      )
    }
  }

  for (const [key, row] of classLevelIndex) {
    if (row.source === 'homebrew') classLevelIndex.delete(key)
  }
  for (const record of parsed) {
    classLevelIndex.set(`${record.classId}:${record.level}`, record)
  }
}

// Bu modül yüklendiği anda, açılışta kurulmuş homebrew satırlarını devralır.
connectClassLevels(applyHomebrewClassLevels)
