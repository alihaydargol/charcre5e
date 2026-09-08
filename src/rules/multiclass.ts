import { classes, skills } from '../data/registry.ts'
import type { AbilityId } from '../data/schema.ts'
import { abilityScores } from './abilities.ts'
import { levelIn, type Character } from './character.ts'

/**
 * Multiclass kuralları.
 *
 * SRD 5.1'in "Multiclassing" bölümü tablo hâlinde iki şey söyler: bir sınıfa
 * girmek için gereken yetenek eşikleri ve girerken kazanılan **kısıtlı**
 * yeterlilikler. Bu tablolar kaynak veri kümesinde yapılı biçimde yok (metin
 * olarak var), bu yüzden burada açıkça kodlanıyorlar — `hitpoints.ts`'teki
 * Dwarven Toughness eşleştirmesiyle aynı gerekçe.
 *
 * Homebrew sınıflar bu tablolarda yer almaz: eşik istemezler ve yeterlilik
 * vermezler. Tanımlayan kişi dengeyi kendi kurar.
 */

/** Bir sınıfa multiclass ile girmek için gereken yetenek eşikleri. */
interface Prerequisite {
  /** Hepsi sağlanmalı. */
  all?: AbilityId[]
  /** En az biri sağlanmalı. */
  any?: AbilityId[]
}

/** SRD 5.1 Multiclassing tablosu. Eşik her zaman 13'tür. */
export const MULTICLASS_MINIMUM = 13

const PREREQUISITES: Record<string, Prerequisite> = {
  barbarian: { all: ['str'] },
  bard: { all: ['cha'] },
  cleric: { all: ['wis'] },
  druid: { all: ['wis'] },
  fighter: { any: ['str', 'dex'] },
  monk: { all: ['dex', 'wis'] },
  paladin: { all: ['str', 'cha'] },
  ranger: { all: ['dex', 'wis'] },
  rogue: { all: ['dex'] },
  sorcerer: { all: ['cha'] },
  warlock: { all: ['cha'] },
  wizard: { all: ['int'] },
}

/**
 * Multiclass ile bir sınıfa girerken kazanılan yeterlilikler.
 *
 * Sınıfın tam listesi DEĞİL — 5e bilerek kısıtlar. Örneğin Fighter'a sonradan
 * girmek zırh ve silah yeterliliği verir ama beceri seçimi vermez.
 *
 * Listedeki beceri seçimleri (Bard, Ranger, Rogue) ayrıca ele alınır; burada
 * yalnızca doğrudan kazanılan yeterlilikler var.
 */
const GAINED_PROFICIENCIES: Record<string, string[]> = {
  barbarian: ['shields', 'simple-weapons', 'martial-weapons'],
  bard: ['light-armor'],
  cleric: ['light-armor', 'medium-armor', 'shields'],
  druid: ['light-armor', 'medium-armor', 'shields'],
  fighter: ['light-armor', 'medium-armor', 'shields', 'simple-weapons', 'martial-weapons'],
  monk: ['simple-weapons', 'shortswords'],
  paladin: ['light-armor', 'medium-armor', 'shields', 'simple-weapons', 'martial-weapons'],
  ranger: ['light-armor', 'medium-armor', 'shields', 'simple-weapons', 'martial-weapons'],
  rogue: ['light-armor', 'thieves-tools'],
  sorcerer: [],
  warlock: ['light-armor', 'simple-weapons'],
  wizard: [],
}

export interface PrerequisiteResult {
  met: boolean
  /** Karşılanmadıysa Türkçe açıklama. */
  reason?: string
}

/**
 * Karakter bu sınıfa multiclass ile girebilir mi?
 *
 * İki yönlü bir kuraldır: hem YENİ sınıfın eşiği hem MEVCUT sınıfların eşiği
 * sağlanmalı. Bunu tek yönlü uygulamak, Wizard'a INT 13 olmadan girilmesini
 * engellerken INT 8 bir Wizard'ın Fighter'a geçmesine izin verirdi.
 */
export function meetsMulticlassPrerequisite(
  character: Character,
  classId: string,
): PrerequisiteResult {
  const scores = abilityScores(character)
  const check = (id: string): string | undefined => {
    const rule = PREREQUISITES[id]
    // Homebrew sınıflar tabloda yok; eşik aranmaz.
    if (!rule) return undefined
    const name = classes.get(id)?.name ?? id

    if (rule.all) {
      const missing = rule.all.filter((a) => scores[a].total < MULTICLASS_MINIMUM)
      if (missing.length > 0) {
        return `${name} için ${missing
          .map((a) => a.toUpperCase())
          .join(' ve ')} en az ${MULTICLASS_MINIMUM} olmalı.`
      }
    }
    if (rule.any && !rule.any.some((a) => scores[a].total >= MULTICLASS_MINIMUM)) {
      return `${name} için ${rule.any
        .map((a) => a.toUpperCase())
        .join(' ya da ')} en az ${MULTICLASS_MINIMUM} olmalı.`
    }
    return undefined
  }

  const reason =
    check(classId) ?? character.classes.map((c) => check(c.classId)).find(Boolean)
  return reason ? { met: false, reason } : { met: true }
}

/** Multiclass ile bu sınıfa girince kazanılacak yeterlilikler. */
export function multiclassProficiencies(classId: string): string[] {
  return GAINED_PROFICIENCIES[classId] ?? []
}

/**
 * Multiclass ile girince kazanılan beceri seçimi.
 *
 * SRD Multiclassing tablosunda yalnızca üç sınıf verir: Bard (herhangi bir
 * beceri), Ranger ve Rogue (kendi sınıf listelerinden bir tane). Diğerleri
 * beceri vermez — 5e bunu bilerek kısıtlar.
 */
export function multiclassSkillChoice(
  classId: string,
): { choose: number; from: string[] } | undefined {
  if (classId === 'bard') {
    return { choose: 1, from: skills.all().map((skill) => skill.id) }
  }
  if (classId === 'ranger' || classId === 'rogue') {
    const pool = classes.get(classId)?.skillChoice?.from
    return pool ? { choose: 1, from: pool } : undefined
  }
  return undefined
}

/**
 * Karakterin sınıflarından gelen tüm yeterlilikler.
 *
 * Birinci sınıf tam listesini verir; sonradan girilen sınıflar yalnızca
 * multiclass tablosundaki kısıtlı seti. Hepsinin tam listesini toplamak,
 * Wizard 1 / Fighter 1 bir karaktere ağır zırh yeterliliği verirdi — 5e bunu
 * bilerek engeller.
 */
export function classProficiencies(character: Character): Set<string> {
  const owned = new Set<string>()
  character.classes.forEach((cls, index) => {
    const ids =
      index === 0
        ? (classes.get(cls.classId)?.proficiencies ?? [])
        : multiclassProficiencies(cls.classId)
    for (const id of ids) owned.add(id)
  })
  return owned
}

// ---------------------------------------------------------------------------
// Büyücülük ilerlemesi
// ---------------------------------------------------------------------------

export type CasterProgression = 'none' | 'full' | 'half' | 'pact'

/**
 * Sınıfın kaster tipi.
 *
 * Sınıf kaydından türetilir: Pact Magic bayrağı varsa pact, büyü 1. seviyede
 * başlıyorsa tam kaster, 2. seviyede başlıyorsa yarı kaster.
 *
 * SRD'de üçte-bir kaster **sınıf** yoktur (Eldritch Knight ve Arcane Trickster
 * alt sınıftır ve slotları sınıf tablosunda durmaz), o yüzden bu ayrım burada
 * temsil edilmiyor.
 */
export function casterProgression(classId: string): CasterProgression {
  const casting = classes.get(classId)?.spellcasting
  if (!casting) return 'none'
  if (casting.pactMagic) return 'pact'
  return casting.startLevel <= 1 ? 'full' : 'half'
}

/**
 * Multiclass birleşik kaster seviyesi.
 *
 * 5e'de birden çok büyü yapan sınıfı olan karakter ayrı ayrı slot tabloları
 * kullanmaz; tek bir havuzu olur. Havuzun seviyesi:
 *   tam kasterlerin seviyeleri + yarı kasterlerin YARISI (aşağı yuvarlanır)
 * ve sonuç tam kaster tablosundan okunur.
 *
 * Yarı kasterin yuvarlaması sınıf başına yapılır, toplamdan sonra değil:
 * Paladin 1 / Ranger 1 birleşik 0 kaster seviyesi verir, 1 değil.
 *
 * Warlock buraya girmez — Pact Magic ayrı bir kaynaktır.
 */
export function combinedCasterLevel(character: Character): number {
  let level = 0
  for (const cls of character.classes) {
    const progression = casterProgression(cls.classId)
    if (progression === 'full') level += cls.level
    else if (progression === 'half') level += Math.floor(cls.level / 2)
  }
  return level
}

/** Karakterin birden fazla büyü yapan sınıfı var mı? Pact Magic sayılmaz. */
export function hasMultipleSpellcastingClasses(character: Character): boolean {
  return (
    character.classes.filter((c) => {
      const progression = casterProgression(c.classId)
      return progression === 'full' || progression === 'half'
    }).length > 1
  )
}

/** Karakter multiclass mı? */
export function isMulticlass(character: Character): boolean {
  return character.classes.length > 1
}

/** "Fighter 3 / Wizard 2" biçiminde sınıf özeti. */
export function classSummary(character: Character): string {
  return character.classes
    .map((c) => `${classes.get(c.classId)?.name ?? c.classId} ${c.level}`)
    .join(' / ')
}

/** Karakterin bu sınıftaki seviyesi — dışarıya kolaylık olsun diye. */
export function levelInClass(character: Character, classId: string): number {
  return levelIn(character, classId)
}

export interface LevelEntry {
  /** 1'den başlayan karakter seviyesi. */
  characterLevel: number
  classId: string
  /** O sınıftaki kaçıncı seviye olduğu. */
  classLevel: number
}

/**
 * Karakter seviyelerinin sınıflara dağılımı — seviye geçmişinin omurgası.
 *
 * Seviyelerin hangi SIRAYLA alındığı karakterde saklanmıyor; `classes`
 * dizisinin sırası kanonik kabul ediliyor: önce ilk sınıfın tüm seviyeleri,
 * sonra ikincininki. Sırayı ayrıca saklamak veri modelini büyütürdü ve
 * türetilen hiçbir değeri değiştirmezdi — HP toplamı, slotlar ve özellikler
 * sıradan bağımsız.
 *
 * Tek yan etkisi görsel: "6. seviyede ne kazandım" sorusunun cevabı bu sıraya
 * göre veriliyor.
 */
export function levelTrack(character: Character): LevelEntry[] {
  const track: LevelEntry[] = []
  for (const cls of character.classes) {
    for (let classLevel = 1; classLevel <= cls.level; classLevel += 1) {
      track.push({ characterLevel: track.length + 1, classId: cls.classId, classLevel })
    }
  }
  return track
}
