import { classes, races, traits } from '../../data/registry.ts'
import { evaluatePointBuy } from '../../rules/abilities.ts'
import type { Character } from '../../rules/character.ts'
import { getValidChoices } from '../../rules/choices.ts'
import { spellcasting, usesSpellbook, wizardSpellbookSize } from '../../rules/spellcasting.ts'

/**
 * Sihirbaz adımları ve her adımın doğrulaması.
 *
 * Doğrulama saf fonksiyonlardır — React'ten bağımsız, test edilebilir. Arayüz
 * yalnızca sonucu gösterir. Bir adım geçersizse **nedeni Türkçe ve somut**
 * yazılır ("2 beceri seçmelisin, 1 seçtin"); "geçersiz" demek yetmez.
 */

export type StepId =
  | 'race'
  | 'class'
  | 'abilities'
  | 'background'
  | 'proficiencies'
  | 'equipment'
  | 'spells'
  | 'details'
  | 'summary'

export interface StepDefinition {
  id: StepId
  label: string
  /** Bu adım bu karakter için geçerli mi (ör. büyü adımı yalnızca kasterlerde). */
  applies: (character: Character) => boolean
}

export const STEPS: StepDefinition[] = [
  { id: 'race', label: 'Irk', applies: () => true },
  { id: 'class', label: 'Sınıf', applies: () => true },
  { id: 'abilities', label: 'Yetenekler', applies: () => true },
  { id: 'background', label: 'Geçmiş', applies: () => true },
  { id: 'proficiencies', label: 'Beceri ve Dil', applies: () => true },
  { id: 'equipment', label: 'Ekipman', applies: () => true },
  { id: 'spells', label: 'Büyüler', applies: (c) => spellcasting(c).length > 0 },
  { id: 'details', label: 'Detaylar', applies: () => true },
  { id: 'summary', label: 'Özet', applies: () => true },
]

/** Bu karakter için geçerli adımlar. Büyü yapmayan sınıflarda büyü adımı düşer. */
export function applicableSteps(character: Character): StepDefinition[] {
  return STEPS.filter((step) => step.applies(character))
}

export interface StepStatus {
  complete: boolean
  /** İlerlemeyi ENGELLEYEN eksikler. */
  issues: string[]
  /**
   * Engellemeyen ama kullanıcının bilmesi gereken durumlar — ör. point-buy'da
   * puan artması. Kullanılmamış puan geçersiz bir karakter yaratmaz, sadece
   * dezavantajlıdır; bu yüzden ilerlemeyi kilitlemek yanlış olur.
   */
  warnings: string[]
}

/**
 * Irk adımında ırkın kendisi dışında seçilmesi gereken şeyler de olabilir:
 * alt ırk, seçmeli yetenek bonusu, ek dil, trait yeterliliği.
 */
function validateRace(character: Character): StepStatus {
  const issues: string[] = []

  if (!character.raceId) {
    return { complete: false, issues: ['Bir ırk seç.'], warnings: [] }
  }
  const race = races.require(character.raceId)

  if (race.subraces.length > 0 && !character.subraceId) {
    issues.push(`${race.name} için bir alt ırk seç.`)
  }

  if (race.abilityBonusChoice) {
    const need = race.abilityBonusChoice.choose
    const have = character.raceAbilityChoice.length
    if (have !== need) {
      issues.push(`${need} yeteneğe +${race.abilityBonusChoice.bonus} dağıtmalısın, ${have} seçtin.`)
    }
    if (new Set(character.raceAbilityChoice).size !== have) {
      issues.push('Aynı yeteneği iki kez seçemezsin.')
    }
  }

  if (race.languageChoice) {
    const chosen = character.proficiencies.raceLanguages.filter((id) =>
      race.languageChoice!.from.includes(id),
    )
    if (chosen.length !== race.languageChoice.choose) {
      issues.push(
        `${race.languageChoice.choose} ek dil seçmelisin, ${chosen.length} seçtin.`,
      )
    }
  }

  // Irk özelliklerinin yeterlilik seçimleri (ör. Dwarf'ın Tool Proficiency'si).
  for (const traitId of race.traits) {
    const trait = traits.get(traitId)
    if (!trait?.proficiencyChoice) continue
    const pool = trait.proficiencyChoice.from
    // Beceri seçimleri raceSkills'te, alet seçimleri tools'ta durur; sınıf
    // seçimleriyle karışmasınlar diye ayrı sayılırlar.
    const chosen = [
      ...character.proficiencies.tools,
      ...character.proficiencies.raceSkills,
    ].filter((id) => pool.includes(id))
    if (chosen.length !== trait.proficiencyChoice.choose) {
      issues.push(
        `${trait.name}: ${trait.proficiencyChoice.choose} seçim yapmalısın, ${chosen.length} yaptın.`,
      )
    }
  }

  return { complete: issues.length === 0, issues, warnings: [] }
}

function validateClass(character: Character): StepStatus {
  if (character.classes.length === 0) {
    return { complete: false, issues: ['Bir sınıf seç.'], warnings: [] }
  }
  return { complete: true, issues: [], warnings: [] }
}

function validateAbilities(character: Character): StepStatus {
  const issues: string[] = []
  const warnings: string[] = []

  if (character.abilityMethod === 'pointbuy') {
    const state = evaluatePointBuy(character.abilities)
    // Bütçe aşımı ve aralık dışı puanlar geçersizdir; artan puan değildir.
    issues.push(...state.errors)
    if (state.remaining > 0) {
      warnings.push(`${state.remaining} puanın kullanılmadı. Harcamadan da devam edebilirsin.`)
    }
  }

  if (character.abilityMethod === 'manual' || character.abilityMethod === 'roll') {
    for (const [ability, score] of Object.entries(character.abilities)) {
      if (score < 1 || score > 20) {
        issues.push(`${ability.toUpperCase()} 1-20 arasında olmalı (şu an ${score}).`)
      }
    }
  }

  return { complete: issues.length === 0, issues, warnings }
}

function validateBackground(character: Character): StepStatus {
  if (!character.background) {
    return {
      complete: false,
      issues: ['Bir geçmiş seç ya da kendi geçmişini tanımla.'],
      warnings: [],
    }
  }
  if (character.background.kind === 'custom') {
    const custom = character.background.value
    const issues: string[] = []
    if (!custom.name.trim()) issues.push('Özel geçmişine bir isim ver.')
    if (custom.skillIds.length === 0) issues.push('Özel geçmişin en az bir beceri vermeli.')
    return { complete: issues.length === 0, issues, warnings: [] }
  }
  return { complete: true, issues: [], warnings: [] }
}

function validateProficiencies(character: Character): StepStatus {
  const choices = getValidChoices(character, { kind: 'classSkills' })
  if (!choices.applicable) return { complete: true, issues: [], warnings: [] }

  const selectable = new Set(
    choices.options.filter((o) => !o.disabledReason).map((o) => o.id),
  )
  const chosen = character.proficiencies.skills.filter((id) => selectable.has(id))

  const issues: string[] = []
  if (chosen.length !== choices.choose) {
    issues.push(`${choices.choose} beceri seçmelisin, ${chosen.length} seçtin.`)
  }

  // Geçmişin verdiği beceriyi sınıftan tekrar seçmek puan kaybıdır.
  const blocked = character.proficiencies.skills.filter((id) =>
    choices.options.some((o) => o.id === id && o.disabledReason),
  )
  if (blocked.length > 0) {
    issues.push('Zaten sahip olduğun bir beceriyi tekrar seçtin; başka bir beceri seç.')
  }

  return { complete: issues.length === 0, issues, warnings: [] }
}

/**
 * Ekipman adımı isteğe bağlıdır: karakter ekipmansız da geçerlidir (bazı
 * masalar ekipmanı sonra dağıtır). Bu yüzden hiçbir zaman engellemez.
 */
function validateEquipment(): StepStatus {
  return { complete: true, issues: [], warnings: [] }
}

function validateSpells(character: Character): StepStatus {
  const casting = spellcasting(character)
  if (casting.length === 0) return { complete: true, issues: [], warnings: [] }

  const issues: string[] = []
  for (const info of casting) {
    const cls = classes.require(info.classId)

    if (info.cantripsKnown !== undefined && character.spells.cantrips.length !== info.cantripsKnown) {
      issues.push(
        `${cls.name}: ${info.cantripsKnown} cantrip seçmelisin, ${character.spells.cantrips.length} seçtin.`,
      )
    }

    // Hazırlayan sınıflar (Cleric, Druid, Paladin) tüm sınıf listesine erişir;
    // bilenler (Bard, Ranger, Sorcerer, Warlock) sabit sayıda büyü seçer.
    if (info.spellsKnown !== undefined && character.spells.known.length !== info.spellsKnown) {
      issues.push(
        `${cls.name}: ${info.spellsKnown} büyü seçmelisin, ${character.spells.known.length} seçtin.`,
      )
    }

    // Wizard'ın defteri seviyeyle büyür: 1. seviyede 6, sonra seviye başına 2.
    if (usesSpellbook(info.classId)) {
      const expected = wizardSpellbookSize(
        character.classes.find((c) => c.classId === info.classId)?.level ?? 1,
      )
      if (character.spells.known.length !== expected) {
        issues.push(
          `${cls.name}: büyü defterine ${expected} büyü yazmalısın, ${character.spells.known.length} yazdın.`,
        )
      }
    }
  }

  return { complete: issues.length === 0, issues, warnings: [] }
}

function validateDetails(character: Character): StepStatus {
  if (!character.name.trim()) {
    return { complete: false, issues: ['Karakterine bir isim ver.'], warnings: [] }
  }
  return { complete: true, issues: [], warnings: [] }
}

const VALIDATORS: Record<StepId, (character: Character) => StepStatus> = {
  race: validateRace,
  class: validateClass,
  abilities: validateAbilities,
  background: validateBackground,
  proficiencies: validateProficiencies,
  equipment: validateEquipment,
  spells: validateSpells,
  details: validateDetails,
  // Özet adımı kendi başına bir şey istemez; öncekilerin durumunu gösterir.
  summary: () => ({ complete: true, issues: [], warnings: [] }),
}

export function validateStep(character: Character, step: StepId): StepStatus {
  return VALIDATORS[step](character)
}

/** Tüm adımların durumu — stepper'da tik/uyarı göstermek için. */
export function validateAll(character: Character): Record<StepId, StepStatus> {
  const result = {} as Record<StepId, StepStatus>
  for (const step of STEPS) {
    result[step.id] = validateStep(character, step.id)
  }
  return result
}

/** Karakter kaydedilmeye hazır mı? Özet adımı bunu gösterir. */
export function isCharacterComplete(character: Character): { ready: boolean; issues: string[] } {
  const issues: string[] = []
  for (const step of applicableSteps(character)) {
    if (step.id === 'summary') continue
    const status = validateStep(character, step.id)
    if (!status.complete) {
      issues.push(...status.issues.map((issue) => `${step.label}: ${issue}`))
    }
  }
  return { ready: issues.length === 0, issues }
}
