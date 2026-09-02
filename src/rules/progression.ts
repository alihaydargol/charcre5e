import { classes } from '../data/registry.ts'
import { getClassLevel, getClassLevelsUpTo } from '../data/classLevels.ts'
import { subclassOf, totalLevel, type Character, type LevelChoice } from './character.ts'

/**
 * Seviye ilerlemesi: proficiency bonus, ASI hakları, seviyede kazanılan
 * özellikler ve alt sınıf seçim noktası.
 */

/**
 * Proficiency bonus KARAKTER seviyesine bağlıdır, sınıf seviyesine değil.
 * Multiclass'ta bu ayrım önemlidir; formül tek yerde durmalı.
 */
export function proficiencyBonus(characterLevel: number): number {
  if (characterLevel < 1 || characterLevel > 20) {
    throw new Error(`Karakter seviyesi 1-20 arasında olmalı, verilen: ${characterLevel}`)
  }
  return 2 + Math.floor((characterLevel - 1) / 4)
}

export function characterProficiencyBonus(character: Character): number {
  return proficiencyBonus(Math.max(1, totalLevel(character)))
}

/** Bir sınıfın ASI/feat hakkı kazandırdığı seviyeler. */
export function asiLevels(classId: string): number[] {
  return getClassLevelsUpTo(classId, 20)
    .filter((row) => row.abilityScoreBonuses > 0)
    .map((row) => row.level)
}

/** Verilen sınıf seviyesinde ASI/feat hakkı var mı? */
export function grantsAbilityScoreImprovement(classId: string, level: number): boolean {
  return (getClassLevel(classId, level)?.abilityScoreBonuses ?? 0) > 0
}

/** Alt sınıfın seçildiği seviye (Cleric 1, Wizard 2, çoğu sınıf 3). */
export function subclassLevel(classId: string): number {
  return classes.require(classId).subclassLevel
}

/** Karakter bu sınıfta alt sınıf seçebilecek seviyeye geldi mi? */
export function canChooseSubclass(character: Character, classId: string): boolean {
  if (!hasSubclasses(classId)) return false
  const level = character.classes.find((c) => c.classId === classId)?.level ?? 0
  return level >= subclassLevel(classId) && subclassOf(character, classId) === undefined
}

/**
 * Sınıfın seçilebilecek bir alt sınıfı var mı?
 *
 * SRD sınıflarının hepsinde en az bir tane var, ama homebrew bir sınıf alt
 * sınıfsız tanımlanabilir. O durumda alt sınıf sorusu hiç sorulmamalı: sorulsa
 * seçeneksiz ve yanıtlanamaz bir karar noktası doğar ve karakter hiçbir zaman
 * tamamlanamaz.
 */
function hasSubclasses(classId: string): boolean {
  return (classes.get(classId)?.subclasses.length ?? 0) > 0
}

/**
 * Karakterin sahip olduğu tüm sınıf özelliklerinin id'leri.
 *
 * Alt sınıf özellikleri yalnızca o alt sınıf seçilmişse dahil edilir; seviye
 * tablosu alt sınıf satırlarını içermediği için alt sınıf özellikleri ayrıca
 * `features` koleksiyonundan süzülmelidir (Aşama 6'da karakter sayfasında
 * kullanılacak).
 */
export function classFeatureIds(character: Character): string[] {
  const ids: string[] = []
  for (const cls of character.classes) {
    for (const row of getClassLevelsUpTo(cls.classId, cls.level)) {
      ids.push(...row.features)
    }
  }
  return ids
}

/** Bir seviyede yeni kazanılan özelliklerin id'leri. */
export function featuresGainedAt(classId: string, level: number): string[] {
  return getClassLevel(classId, level)?.features ?? []
}

/**
 * Bu seviyede karakterin yapması gereken seçimler.
 *
 * Sihirbaz bunu "seviye atla" ekranında sırayla sormak için, rastgele
 * oluşturucu ise aralarından seçim yapmak için kullanır (bkz. CLAUDE.md).
 */
export type PendingDecision =
  | { kind: 'subclass'; classId: string; level: number }
  | { kind: 'asiOrFeat'; classId: string; level: number }
  | { kind: 'fightingStyle'; classId: string; level: number }
  | { kind: 'expertise'; classId: string; level: number }

export function decisionsAtLevel(classId: string, level: number): PendingDecision[] {
  const decisions: PendingDecision[] = []

  if (subclassLevel(classId) === level && hasSubclasses(classId)) {
    decisions.push({ kind: 'subclass', classId, level })
  }
  if (grantsAbilityScoreImprovement(classId, level)) {
    decisions.push({ kind: 'asiOrFeat', classId, level })
  }
  // Fighting Style ve Expertise, sınıf tablosunda birer özellik olarak görünür.
  const features = featuresGainedAt(classId, level)
  if (features.some((id) => /fighting-style$/.test(id))) {
    decisions.push({ kind: 'fightingStyle', classId, level })
  }
  if (features.some((id) => /expertise(-\d+)?$/.test(id))) {
    decisions.push({ kind: 'expertise', classId, level })
  }

  return decisions
}

/** Karakterin henüz yanıtlamadığı seçimler — sihirbazın "eksik" listesi. */
export function pendingDecisions(character: Character): PendingDecision[] {
  const answered = new Set(
    character.levelChoices.map((c: LevelChoice) => `${c.kind}:${c.classId}:${c.level}`),
  )

  const pending: PendingDecision[] = []
  for (const cls of character.classes) {
    for (let level = 1; level <= cls.level; level += 1) {
      for (const decision of decisionsAtLevel(cls.classId, level)) {
        // ASI ve feat aynı karar noktasının iki cevabıdır.
        const keys =
          decision.kind === 'asiOrFeat'
            ? [`asi:${cls.classId}:${level}`, `feat:${cls.classId}:${level}`]
            : [`${decision.kind}:${cls.classId}:${level}`]
        if (!keys.some((key) => answered.has(key))) pending.push(decision)
      }
    }
  }
  return pending
}
