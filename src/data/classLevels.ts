import { z } from 'zod'
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

export function registerClassLevels(records: unknown[]): void {
  for (const record of z.array(classLevelSchema).parse(records)) {
    if (record.source !== 'homebrew') {
      throw new Error(`Yalnızca homebrew seviye satırı eklenebilir (${record.classId}:${record.level})`)
    }
    classLevelIndex.set(`${record.classId}:${record.level}`, record)
  }
}
