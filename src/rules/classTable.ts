import { classes } from '../data/registry.ts'
import { getClassLevel } from '../data/classLevels.ts'
import type { AbilityId, CharacterClass, ClassLevel, Feature } from '../data/schema.ts'
import { proficiencyBonus } from './progression.ts'

/**
 * Homebrew bir sınıfın 1–20 seviye tablosunu üretir.
 *
 * Bir sınıfı elle 20 satır doldurarak tanımlatmak hem yorucu hem hataya açık
 * olurdu; oysa tablonun neredeyse tamamı türetilebilir:
 *
 *  - Proficiency bonus seviyeden gelen bir formüldür.
 *  - ASI seviyeleri 4/8/12/16/19'dur; Fighter ve Rogue gibi fazladan hak veren
 *    sınıflar için ek seviyeler işaretlenir.
 *  - Büyü ilerlemesi ise türetilmez, **kopyalanır**: kullanıcı "hangi sınıf
 *    gibi büyü yapsın" diye seçer ve o sınıfın slot/cantrip/bilinen-büyü
 *    satırları aynen alınır. Tam kaster, yarı kaster ve Pact Magic tabloları
 *    birbirinin türevi değildir; kopyalamak, elle tablo yazmaktan hem daha
 *    kısa hem tanımı gereği doğrudur.
 */

/** SRD'de standart olan ASI seviyeleri. */
export const STANDARD_ASI_LEVELS = [4, 8, 12, 16, 19]

export interface ClassTableInput {
  classId: string
  /** Büyü ilerlemesinin kopyalanacağı SRD sınıfı; büyü yapmıyorsa boş. */
  spellcastingModelId?: string
  /** 4/8/12/16/19 dışındaki ek ASI seviyeleri (Fighter 6 ve 14, Rogue 10). */
  extraAsiLevels?: number[]
  /** Seviyelere bağlanacak özellikler. */
  features: Feature[]
}

/** Bir sınıfın 20 satırlık tablosu. */
export function buildClassLevels({
  classId,
  spellcastingModelId,
  extraAsiLevels = [],
  features,
}: ClassTableInput): ClassLevel[] {
  const asi = new Set([...STANDARD_ASI_LEVELS, ...extraAsiLevels])
  const rows: ClassLevel[] = []

  for (let level = 1; level <= 20; level += 1) {
    const model = spellcastingModelId ? getClassLevel(spellcastingModelId, level) : undefined
    rows.push({
      classId,
      level,
      profBonus: proficiencyBonus(level),
      abilityScoreBonuses: asi.has(level) ? 1 : 0,
      features: features.filter((f) => f.level === level).map((f) => f.id),
      spellcasting: model?.spellcasting,
      classSpecific: {},
      source: 'homebrew',
    })
  }

  return rows
}

/**
 * Model sınıfın büyücülük ayarları, kullanıcının seçtiği yetenekle.
 *
 * Model sınıf aynı zamanda büyü *listesi* olarak da kaydedilir: hiçbir SRD
 * büyüsü homebrew bir sınıfı listelemez, o yüzden "Wizard gibi büyü yapar"
 * demek Wizard'ın listesinden seçmek demektir.
 *
 * Model sınıf büyü yapmıyorsa `undefined` döner.
 */
export function buildSpellcasting(
  modelClassId: string,
  ability: AbilityId,
): CharacterClass['spellcasting'] {
  const model = classes.get(modelClassId)?.spellcasting
  if (!model) return undefined
  return {
    startLevel: model.startLevel,
    ability,
    pactMagic: model.pactMagic,
    spellList: modelClassId,
    info: [],
  }
}

/** Büyü ilerlemesi için model olarak seçilebilecek SRD sınıfları. */
export function spellcastingModels(): CharacterClass[] {
  return classes.bySource('srd').filter((c) => c.spellcasting)
}
