import { describe, expect, it } from 'vitest'
import { abilityScores } from '../src/rules/abilities.ts'
import { createEmptyCharacter, type Character, type LevelChoice } from '../src/rules/character.ts'
import { getValidChoices } from '../src/rules/choices.ts'
import { savingThrows, skillModifiers } from '../src/rules/derived.ts'
import { maxHitPoints } from '../src/rules/hitpoints.ts'
import {
  characterProficiencyBonus,
  decisionsAtLevel,
  pendingDecisions,
} from '../src/rules/progression.ts'
import { spellcasting } from '../src/rules/spellcasting.ts'

function character(overrides: Partial<Character> = {}): Character {
  return { ...createEmptyCharacter('test', '2026-01-01T00:00:00.000Z'), ...overrides }
}

/** Store'un setLevel davranışının saf karşılığı — testte aynı kuralı uygularız. */
function setLevel(source: Character, level: number): Character {
  const next = structuredClone(source)
  next.classes[0].level = level
  next.levelChoices = next.levelChoices.filter((c) => c.level <= level)
  next.hp.rolls = next.hp.rolls.slice(0, Math.max(0, level - 1))
  return next
}

/** Store'un setLevelChoice davranışının saf karşılığı. */
function setChoice(source: Character, choice: LevelChoice): Character {
  const next = structuredClone(source)
  const conflicting: LevelChoice['kind'][] =
    choice.kind === 'asi' || choice.kind === 'feat' ? ['asi', 'feat'] : [choice.kind]
  next.levelChoices = next.levelChoices.filter(
    (c) => !(conflicting.includes(c.kind) && c.classId === choice.classId && c.level === choice.level),
  )
  next.levelChoices.push(choice)
  next.levelChoices.sort((a, b) => a.level - b.level)
  return next
}

describe('seviye kararları', () => {
  it('Rogue 1. seviyede Expertise seçer', () => {
    expect(decisionsAtLevel('rogue', 1).map((d) => d.kind)).toEqual(['expertise'])
    expect(decisionsAtLevel('rogue', 6).map((d) => d.kind)).toEqual(['expertise'])
  })

  it('Bard 3. seviyede hem alt sınıf hem Expertise seçer', () => {
    expect(decisionsAtLevel('bard', 3).map((d) => d.kind).sort()).toEqual([
      'expertise',
      'subclass',
    ])
    expect(decisionsAtLevel('bard', 10).map((d) => d.kind)).toEqual(['expertise'])
  })

  it('Ranger 2. seviyede Fighting Style seçer', () => {
    expect(decisionsAtLevel('ranger', 2).map((d) => d.kind)).toEqual(['fightingStyle'])
  })

  it('20. seviyeye kadar tüm bekleyen kararlar listelenir', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 20 }] })
    const pending = pendingDecisions(fighter)
    // Fighting Style (sv1), alt sınıf (sv3), 7 ASI.
    expect(pending.filter((d) => d.kind === 'fightingStyle')).toHaveLength(1)
    expect(pending.filter((d) => d.kind === 'subclass')).toHaveLength(1)
    expect(pending.filter((d) => d.kind === 'asiOrFeat')).toHaveLength(7)
  })
})

describe('seviye düşürme geçersiz seçimleri temizler', () => {
  it('üst seviyedeki seçimler silinir, alttakiler kalır', () => {
    let fighter = character({
      classes: [{ classId: 'fighter', level: 12 }],
      abilities: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      levelChoices: [
        { kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'defense' },
        { kind: 'subclass', classId: 'fighter', level: 3, subclassId: 'champion' },
        { kind: 'asi', classId: 'fighter', level: 4, increases: [{ ability: 'str', amount: 2 }] },
        { kind: 'asi', classId: 'fighter', level: 8, increases: [{ ability: 'con', amount: 2 }] },
        { kind: 'asi', classId: 'fighter', level: 12, increases: [{ ability: 'dex', amount: 2 }] },
      ],
      hp: { method: 'roll', rolls: [6, 5, 7, 4, 8, 6, 5, 9, 3, 7, 6] },
    })

    fighter = setLevel(fighter, 5)

    expect(fighter.levelChoices.map((c) => c.level)).toEqual([1, 3, 4])
    expect(fighter.hp.rolls).toHaveLength(4) // 2-5. seviye
    // 8 ve 12'deki ASI gittiği için CON ve DEX artışları da gitmeli.
    const scores = abilityScores(fighter)
    expect(scores.str.total).toBe(17) // 15 + 4. seviye ASI
    expect(scores.con.total).toBe(14)
    expect(scores.dex.total).toBe(14)
  })
})

describe('geçmiş seviyedeki değişiklik her şeyi yeniden hesaplar', () => {
  it('8. seviyedeki ASI değiştirilince 20. seviye değerleri düzelir', () => {
    // Türetilmiş hiçbir değer saklanmadığı için yeniden hesaplama adımı yok.
    let wizard = character({
      classes: [{ classId: 'wizard', level: 20 }],
      abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
      levelChoices: [
        { kind: 'subclass', classId: 'wizard', level: 2, subclassId: 'evocation' },
        { kind: 'asi', classId: 'wizard', level: 4, increases: [{ ability: 'int', amount: 2 }] },
        { kind: 'asi', classId: 'wizard', level: 8, increases: [{ ability: 'con', amount: 2 }] },
      ],
    })

    const before = spellcasting(wizard)[0]
    expect(abilityScores(wizard).int.total).toBe(17) // 15 + 2
    expect(before.saveDC).toBe(8 + 6 + 3) // PB +6, INT +3
    const hpBefore = maxHitPoints(wizard).total

    // 8. seviyedeki CON artışını INT'e çevir.
    wizard = setChoice(wizard, {
      kind: 'asi',
      classId: 'wizard',
      level: 8,
      increases: [{ ability: 'int', amount: 2 }],
    })

    const after = spellcasting(wizard)[0]
    expect(abilityScores(wizard).int.total).toBe(19) // 15 + 2 + 2
    expect(after.saveDC).toBe(8 + 6 + 4) // INT +4
    // CON artışı gittiği için HP 20 puan düşmeli (20 seviye × CON -1).
    expect(maxHitPoints(wizard).total).toBe(hpBefore - 20)
  })

  it('ASI yerine feat seçilince yetenek artışı geri alınır', () => {
    let fighter = character({
      classes: [{ classId: 'fighter', level: 4 }],
      abilities: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      levelChoices: [
        { kind: 'asi', classId: 'fighter', level: 4, increases: [{ ability: 'str', amount: 2 }] },
      ],
    })
    expect(abilityScores(fighter).str.total).toBe(17)

    fighter = setChoice(fighter, {
      kind: 'feat',
      classId: 'fighter',
      level: 4,
      featId: 'grappler',
    })

    // ASI ve feat aynı karar noktasının iki cevabı; biri diğerini siler.
    expect(fighter.levelChoices.filter((c) => c.kind === 'asi')).toHaveLength(0)
    expect(abilityScores(fighter).str.total).toBe(15)
    // ASI karar noktası artık cevaplanmış sayılır (feat de geçerli bir cevap).
    expect(pendingDecisions(fighter).some((d) => d.kind === 'asiOrFeat')).toBe(false)
    // Fighting Style ve alt sınıf hâlâ cevaplanmamış olduğu için beklemede.
    expect(pendingDecisions(fighter).map((d) => d.kind)).toEqual(['fightingStyle', 'subclass'])
  })
})

describe('seviye atlama türetilmiş değerleri doğru büyütür', () => {
  it('proficiency bonus ve kurtarma atışları seviyeyle artar', () => {
    const base = character({
      classes: [{ classId: 'wizard', level: 1 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    })

    expect(characterProficiencyBonus(base)).toBe(2)
    expect(savingThrows(base).int.value).toBe(3 + 2)

    const level17 = setLevel(base, 17)
    expect(characterProficiencyBonus(level17)).toBe(6)
    expect(savingThrows(level17).int.value).toBe(3 + 6)
  })

  it('HP her seviyede ortalama kadar artar', () => {
    const base = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    // d10: 1. seviye 10 + CON 2 = 12
    expect(maxHitPoints(base).total).toBe(12)
    // 2. seviye: + ortalama 6 + CON 2 = 20
    expect(maxHitPoints(setLevel(base, 2)).total).toBe(20)
    // 20. seviye: 10 + 19×6 + 20×2 = 164
    expect(maxHitPoints(setLevel(base, 20)).total).toBe(10 + 19 * 6 + 20 * 2)
  })

  it('büyü slotları seviyeyle açılır', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 1 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    })
    expect(spellcasting(wizard)[0].spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(spellcasting(setLevel(wizard, 9))[0].spellSlots).toEqual([4, 3, 3, 3, 1, 0, 0, 0, 0])
    expect(spellcasting(setLevel(wizard, 20))[0].spellSlots).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })
})

describe('Expertise', () => {
  it('yalnızca yeterliliğin olduğu becerilerde alınabilir', () => {
    const rogue = character({
      classes: [{ classId: 'rogue', level: 1 }],
      abilities: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: ['stealth', 'acrobatics'], tools: [], languages: [] },
    })
    const choices = getValidChoices(rogue, { kind: 'expertise', classId: 'rogue', level: 1 })

    expect(choices.applicable).toBe(true)
    expect(choices.choose).toBe(2)
    const ids = choices.options.map((o) => o.id)
    expect(ids).toContain('stealth')
    expect(ids).toContain('acrobatics')
    // Yeterliliği olmayan beceri seçenek olarak sunulmaz.
    expect(ids).not.toContain('athletics')
    // Rogue thieves' tools'u da seçebilir.
    expect(ids).toContain('thieves-tools')
  })

  it('aynı beceride iki kez uzmanlık alınamaz', () => {
    const rogue = character({
      classes: [{ classId: 'rogue', level: 6 }],
      abilities: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: ['stealth', 'acrobatics', 'perception', 'deception'], tools: [], languages: [] },
      levelChoices: [
        { kind: 'expertise', classId: 'rogue', level: 1, proficiencyIds: ['stealth', 'perception'] },
      ],
    })
    const choices = getValidChoices(rogue, { kind: 'expertise', classId: 'rogue', level: 6 })
    expect(choices.options.find((o) => o.id === 'stealth')?.disabledReason).toMatch(/zaten/)
    expect(choices.options.find((o) => o.id === 'acrobatics')?.disabledReason).toBeUndefined()
  })

  it('uzmanlık proficiency bonusu ikiye katlar ve seviyeyle ölçeklenir', () => {
    const rogue = character({
      classes: [{ classId: 'rogue', level: 1 }],
      abilities: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: ['stealth', 'acrobatics'], tools: [], languages: [] },
      levelChoices: [
        { kind: 'expertise', classId: 'rogue', level: 1, proficiencyIds: ['stealth'] },
      ],
    })
    // DEX +3, PB +2 → uzmanlıkla 3 + 4 = 7
    expect(skillModifiers(rogue).stealth.value).toBe(7)
    expect(skillModifiers(rogue).acrobatics.value).toBe(5)

    // 17. seviyede PB +6 → uzmanlıkla 3 + 12 = 15
    const high = setLevel(rogue, 17)
    expect(skillModifiers(high).stealth.value).toBe(15)
    expect(skillModifiers(high).acrobatics.value).toBe(9)
  })
})

describe('alt sınıf seçimi', () => {
  it('seçim seviyesine gelmeden bekleyen karar listesinde çıkmaz', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 2 }] })
    expect(pendingDecisions(fighter).some((d) => d.kind === 'subclass')).toBe(false)

    const level3 = setLevel(fighter, 3)
    expect(pendingDecisions(level3).some((d) => d.kind === 'subclass')).toBe(true)
  })

  it('Draconic Bloodline seçimi AC hesabını etkiler', async () => {
    const { armorClass } = await import('../src/rules/derived.ts')
    let sorcerer = character({
      classes: [{ classId: 'sorcerer', level: 1 }],
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
    })
    expect(armorClass(sorcerer).value).toBe(12) // 10 + DEX +2

    sorcerer = setChoice(sorcerer, {
      kind: 'subclass',
      classId: 'sorcerer',
      level: 1,
      subclassId: 'draconic',
    })
    expect(armorClass(sorcerer).value).toBe(15) // 13 + DEX +2
  })
})
