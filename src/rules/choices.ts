import {
  backgrounds,
  classes,
  feats,
  languages,
  proficiencies,
  races,
  skills,
  subclasses,
  subraces,
  traits,
} from '../data/registry.ts'
import type { AbilityId, Source } from '../data/schema.ts'
import { ABILITY_IDS, levelIn, type Character } from './character.ts'
import { abilityScores } from './abilities.ts'
import { skillProficiencies } from './derived.ts'
import { grantsAbilityScoreImprovement, subclassLevel } from './progression.ts'
import { pickMany, type Rng } from './dice.ts'

/**
 * "Şu an hangi seçenekler geçerli?" katmanı.
 *
 * Bu, projenin en önemli mimari kararı (bkz. CLAUDE.md). Sihirbaz bu katmanı
 * kullanıcıya seçenekleri göstermek için, rastgele oluşturucu ise aralarından
 * seçim yapmak için kullanır. Böylece kural mantığı iki yerde tekrarlanmaz ve
 * rastgele üretilen karakter **tanım gereği** geçerli olur.
 */

export type DecisionPoint =
  | { kind: 'race' }
  | { kind: 'subrace' }
  | { kind: 'class' }
  | { kind: 'subclass'; classId: string }
  | { kind: 'background' }
  | { kind: 'classSkills' }
  | { kind: 'raceLanguages' }
  | { kind: 'raceAbilityBonus' }
  | { kind: 'traitProficiency'; traitId: string }
  | { kind: 'asiOrFeat'; classId: string; level: number }
  | { kind: 'asiAbilities'; classId: string; level: number }
  | { kind: 'feat'; classId: string; level: number }
  | { kind: 'fightingStyle'; classId: string; level: number }
  | { kind: 'expertise'; classId: string; level: number }

export interface ChoiceOption {
  id: string
  name: string
  /**
   * Kaydın kaynağı. Kural motoru bunu umursamaz (bkz. CLAUDE.md §3); yalnızca
   * arayüz homebrew içeriği rozetle ayırt edebilsin diye taşınır.
   */
  source?: Source
  /** Kullanıcıya gösterilen kısa açıklama. */
  description?: string
  /** Doluysa seçenek seçilemez ve neden burada yazar. */
  disabledReason?: string
}

export interface ValidChoices {
  /** Kaç tane seçilmeli. */
  choose: number
  options: ChoiceOption[]
  /** Bu karar noktası bu karakter için geçerli mi? */
  applicable: boolean
  /** Geçerli değilse nedeni (ör. "Bu ırkın alt ırkı yok"). */
  reason?: string
}

const NOT_APPLICABLE = (reason: string): ValidChoices => ({
  choose: 0,
  options: [],
  applicable: false,
  reason,
})

const first = (character: Character) => character.classes[0]

/**
 * Bir karar noktasında geçerli seçenekleri döner.
 *
 * Seçilemeyecek seçenekler listeden **çıkarılmaz**, `disabledReason` ile
 * işaretlenir — kullanıcının neden seçemediğini görmesi, seçeneğin yok olmasından
 * iyidir. Rastgele oluşturucu yalnızca `disabledReason` olmayanları kullanır.
 */
export function getValidChoices(character: Character, point: DecisionPoint): ValidChoices {
  switch (point.kind) {
    case 'race':
      return {
        choose: 1,
        applicable: true,
        options: races.all().map((race) => ({
          id: race.id,
          name: race.name,
          source: race.source,
          description: race.abilityBonuses
            .map((b) => `${b.ability.toUpperCase()} +${b.bonus}`)
            .join(', '),
        })),
      }

    case 'subrace': {
      const race = character.raceId ? races.get(character.raceId) : undefined
      if (!race) return NOT_APPLICABLE('Önce ırk seçilmeli.')
      if (race.subraces.length === 0) {
        return NOT_APPLICABLE(`${race.name} ırkının SRD'de alt ırkı yok.`)
      }
      return {
        choose: 1,
        applicable: true,
        options: race.subraces.map((id) => {
          const subrace = subraces.require(id)
          return {
            id: subrace.id,
            name: subrace.name,
            source: subrace.source,
            description: subrace.abilityBonuses
              .map((b) => `${b.ability.toUpperCase()} +${b.bonus}`)
              .join(', '),
          }
        }),
      }
    }

    case 'class':
      return {
        choose: 1,
        applicable: true,
        options: classes.all().map((cls) => ({
          id: cls.id,
          name: cls.name,
          source: cls.source,
          description: `d${cls.hitDie} · ${cls.savingThrows.map((s) => s.toUpperCase()).join('/')}`,
        })),
      }

    case 'subclass': {
      const cls = classes.get(point.classId)
      if (!cls) return NOT_APPLICABLE('Sınıf bulunamadı.')
      const level = levelIn(character, point.classId)
      const required = subclassLevel(point.classId)
      if (level < required) {
        return NOT_APPLICABLE(`${cls.name} alt sınıfı ${required}. seviyede seçilir.`)
      }
      return {
        choose: 1,
        applicable: true,
        options: cls.subclasses.map((id) => {
          const subclass = subclasses.require(id)
          return {
            id: subclass.id,
            name: subclass.name,
            source: subclass.source,
            description: subclass.flavor,
          }
        }),
      }
    }

    case 'background':
      return {
        choose: 1,
        applicable: true,
        options: backgrounds.all().map((background) => ({
          id: background.id,
          name: background.name,
          source: background.source,
          description: background.feature.name,
        })),
      }

    case 'classSkills': {
      const cls = first(character) ? classes.get(first(character).classId) : undefined
      if (!cls) return NOT_APPLICABLE('Önce sınıf seçilmeli.')
      if (!cls.skillChoice) return NOT_APPLICABLE(`${cls.name} beceri seçimi sunmuyor.`)

      // Geçmişten ya da ırktan zaten gelen beceriler tekrar seçilemez.
      const alreadyHave = skillProficiencies({ ...character, proficiencies: { ...character.proficiencies, skills: [] } })

      return {
        choose: cls.skillChoice.choose,
        applicable: true,
        options: cls.skillChoice.from.map((id) => {
          const skill = skills.require(id)
          return {
            id: skill.id,
            name: skill.name,
            description: skill.ability.toUpperCase(),
            disabledReason: alreadyHave.has(id) ? 'Bu beceri zaten başka bir kaynaktan geliyor.' : undefined,
          }
        }),
      }
    }

    case 'raceLanguages': {
      const race = character.raceId ? races.get(character.raceId) : undefined
      if (!race?.languageChoice) return NOT_APPLICABLE('Bu ırk ek dil seçimi sunmuyor.')
      const known = new Set(race.languages)
      return {
        choose: race.languageChoice.choose,
        applicable: true,
        options: race.languageChoice.from.map((id) => {
          const language = languages.require(id)
          return {
            id: language.id,
            name: language.name,
            disabledReason: known.has(id) ? 'Bu dili zaten biliyorsun.' : undefined,
          }
        }),
      }
    }

    case 'raceAbilityBonus': {
      const race = character.raceId ? races.get(character.raceId) : undefined
      if (!race?.abilityBonusChoice) {
        return NOT_APPLICABLE('Bu ırk seçmeli yetenek bonusu sunmuyor.')
      }
      return {
        choose: race.abilityBonusChoice.choose,
        applicable: true,
        options: race.abilityBonusChoice.from.map((ability) => ({
          id: ability,
          name: ability.toUpperCase(),
          description: `+${race.abilityBonusChoice!.bonus}`,
        })),
      }
    }

    case 'traitProficiency': {
      const trait = traits.get(point.traitId)
      if (!trait?.proficiencyChoice) {
        return NOT_APPLICABLE('Bu özellik yeterlilik seçimi sunmuyor.')
      }
      return {
        choose: trait.proficiencyChoice.choose,
        applicable: true,
        // İsim önce beceri, sonra yeterlilik kaydından alınır; ikisi de yoksa
        // id okunabilir hâle getirilir. Aksi hâlde "smiths tools" gibi görünür.
        options: trait.proficiencyChoice.from.map((id) => ({
          id,
          name: skills.get(id)?.name ?? proficiencies.get(id)?.name ?? id.replaceAll('-', ' '),
        })),
      }
    }

    case 'asiOrFeat': {
      if (!grantsAbilityScoreImprovement(point.classId, point.level)) {
        return NOT_APPLICABLE(`${point.level}. seviyede ASI/feat hakkı yok.`)
      }
      return {
        choose: 1,
        applicable: true,
        options: [
          {
            id: 'asi',
            name: 'Yetenek puanı artışı',
            description: 'Bir yeteneğe +2 ya da iki yeteneğe +1 (en fazla 20).',
          },
          {
            id: 'feat',
            name: 'Feat',
            description:
              feats.size === 1
                ? "SRD yalnızca bir feat içerir (Grappler); kendi feat'ini de tanımlayabilirsin."
                : `${feats.size} feat arasından seç.`,
          },
        ],
      }
    }

    case 'asiAbilities': {
      const scores = abilityScores(character)
      return {
        // İki ayrı +1 ya da tek +2; arayüz toplam 2 puan dağıttırır.
        choose: 2,
        applicable: true,
        options: ABILITY_IDS.map((ability) => ({
          id: ability,
          name: ability.toUpperCase(),
          description: `${scores[ability].total}`,
          disabledReason:
            scores[ability].total >= 20 ? 'Yetenek puanı 20 üst sınırına ulaştı.' : undefined,
        })),
      }
    }

    case 'feat': {
      const scores = abilityScores(character)
      const taken = new Set(
        character.levelChoices.filter((c) => c.kind === 'feat').map((c) => c.featId),
      )
      return {
        choose: 1,
        applicable: true,
        options: feats.all().map((feat) => {
          const unmet = feat.prerequisites.find((p) => scores[p.ability].total < p.minimumScore)
          return {
            id: feat.id,
            name: feat.name,
            source: feat.source,
            description: feat.desc[0],
            disabledReason: taken.has(feat.id)
              ? 'Bu feat zaten alındı.'
              : unmet
                ? `${unmet.ability.toUpperCase()} en az ${unmet.minimumScore} olmalı.`
                : undefined,
          }
        }),
      }
    }

    case 'expertise': {
      // Uzmanlık yalnızca ZATEN yeterliliğin olduğu becerilerde alınabilir.
      const proficient = [...skillProficiencies(character)]
      const taken = new Set(
        character.levelChoices
          .filter((c) => c.kind === 'expertise')
          .flatMap((c) => c.proficiencyIds),
      )

      const options: ChoiceOption[] = proficient.map((id) => ({
        id,
        name: skills.get(id)?.name ?? id,
        description: skills.get(id)?.ability.toUpperCase(),
        disabledReason: taken.has(id) ? 'Bu beceride zaten uzmanlığın var.' : undefined,
      }))

      // Rogue uzmanlığı thieves' tools'a da verebilir.
      if (point.classId === 'rogue') {
        options.push({
          id: 'thieves-tools',
          name: "Thieves' Tools",
          description: 'Alet yeterliliği',
          disabledReason: taken.has('thieves-tools')
            ? 'Bu alette zaten uzmanlığın var.'
            : undefined,
        })
      }

      if (options.length === 0 || options.every((o) => o.disabledReason)) {
        return NOT_APPLICABLE(
          'Uzmanlık için önce beceri yeterliliği kazanmalısın; uygun beceri kalmadı.',
        )
      }

      return { choose: 2, applicable: true, options }
    }

    case 'fightingStyle': {
      const options = fightingStyleOptions(point.classId)
      if (options.length === 0) {
        return NOT_APPLICABLE('Bu sınıf Fighting Style seçmiyor.')
      }
      const taken = new Set(
        character.levelChoices.filter((c) => c.kind === 'fightingStyle').map((c) => c.styleId),
      )
      return {
        choose: 1,
        applicable: true,
        options: options.map((option) => ({
          ...option,
          disabledReason: taken.has(option.id) ? 'Bu stil zaten seçildi.' : undefined,
        })),
      }
    }
  }
}

/**
 * Fighting Style seçenekleri. SRD verisinde bunlar ayrı "özellik" kayıtlarıdır
 * ve isimleri sınıfa göre farklı biçimlendirilmiştir; bu yüzden burada açıkça
 * tanımlıyoruz. Sınıflar farklı alt kümelere erişir — Ranger'da Great Weapon
 * Fighting, Paladin'de Archery yoktur.
 */
const FIGHTING_STYLES: Record<string, { id: string; name: string; description: string }> = {
  archery: { id: 'archery', name: 'Archery', description: 'Menzilli silahlarla saldırıya +2.' },
  defense: { id: 'defense', name: 'Defense', description: 'Zırh giyerken AC +1.' },
  dueling: {
    id: 'dueling',
    name: 'Dueling',
    description: 'Tek elli silahla ve başka silah yokken hasara +2.',
  },
  'great-weapon-fighting': {
    id: 'great-weapon-fighting',
    name: 'Great Weapon Fighting',
    description: 'İki elli silahta 1 ve 2 gelen hasar zarları yeniden atılır.',
  },
  protection: {
    id: 'protection',
    name: 'Protection',
    description: 'Kalkanla, yakınındaki bir dosta yapılan saldırıya dezavantaj verirsin.',
  },
  'two-weapon-fighting': {
    id: 'two-weapon-fighting',
    name: 'Two-Weapon Fighting',
    description: 'İkinci silahla saldırıda yetenek modifier’ını hasara eklersin.',
  },
}

const FIGHTING_STYLES_BY_CLASS: Record<string, string[]> = {
  fighter: [
    'archery',
    'defense',
    'dueling',
    'great-weapon-fighting',
    'protection',
    'two-weapon-fighting',
  ],
  paladin: ['defense', 'dueling', 'great-weapon-fighting', 'protection'],
  ranger: ['archery', 'defense', 'dueling', 'two-weapon-fighting'],
}

export function fightingStyleOptions(classId: string): ChoiceOption[] {
  return (FIGHTING_STYLES_BY_CLASS[classId] ?? []).map((id) => FIGHTING_STYLES[id])
}

// ---------------------------------------------------------------------------
// Rastgele seçim
// ---------------------------------------------------------------------------

/**
 * Bir karar noktasında geçerli seçenekler arasından rastgele seçer.
 *
 * Rastgele oluşturucu (Aşama 9) bunu kullanır. Kural mantığını tekrar
 * etmediği, `getValidChoices` sonucundan seçtiği için ürettiği sonuç
 * tanım gereği geçerlidir.
 */
export function chooseRandomly(
  character: Character,
  point: DecisionPoint,
  rng: Rng,
): string[] {
  const choices = getValidChoices(character, point)
  if (!choices.applicable) return []

  const available = choices.options.filter((o) => !o.disabledReason)
  const count = Math.min(choices.choose, available.length)
  if (count === 0) return []

  return pickMany(available, count, rng).map((o) => o.id)
}

/**
 * ASI'de +2'yi dağıtır: rastgele oluşturucu için tek yeteneğe +2 vermek,
 * iki yeteneğe +1 vermekten genelde daha işlevsel bir karakter üretir.
 */
export function randomAbilityIncreases(
  character: Character,
  rng: Rng,
): { ability: AbilityId; amount: number }[] {
  const scores = abilityScores(character)
  const available = ABILITY_IDS.filter((a) => scores[a].total < 20)
  if (available.length === 0) return []

  const canTakeTwo = available.filter((a) => scores[a].total <= 18)
  if (canTakeTwo.length > 0) {
    return [{ ability: pickMany(canTakeTwo, 1, rng)[0], amount: 2 }]
  }
  return pickMany(available, Math.min(2, available.length), rng).map((ability) => ({
    ability,
    amount: 1 as const,
  }))
}
