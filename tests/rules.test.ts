import { describe, expect, it } from 'vitest'
import { loadEquipment } from '../src/data/registry.ts'
import type { Equipment } from '../src/data/schema.ts'
import {
  createEmptyCharacter,
  parseCharacter,
  totalLevel,
  type Character,
} from '../src/rules/character.ts'
import {
  abilityScores,
  evaluatePointBuy,
  formatModifier,
  modifier,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyIncreaseCost,
  rollAbilityScores,
  STANDARD_ARRAY,
} from '../src/rules/abilities.ts'
import {
  asiLevels,
  decisionsAtLevel,
  pendingDecisions,
  proficiencyBonus,
  subclassLevel,
} from '../src/rules/progression.ts'
import { averageHitDie, hpPerLevelBonus, maxHitPoints } from '../src/rules/hitpoints.ts'
import {
  highestSlotLevel,
  preparedSpellCount,
  spellAttackBonus,
  spellcasting,
  spellSaveDC,
} from '../src/rules/spellcasting.ts'
import {
  armorClass,
  carryingCapacity,
  initiative,
  passivePerception,
  savingThrows,
  skillModifiers,
  walkingSpeed,
} from '../src/rules/derived.ts'
import { chooseRandomly, getValidChoices } from '../src/rules/choices.ts'
import { createRng, pickMany, roll4d6DropLowest, seedFromString } from '../src/rules/dice.ts'

/** Test karakterleri kurmak için kısa yol. */
function character(overrides: Partial<Character> = {}): Character {
  return { ...createEmptyCharacter('test', '2026-01-01T00:00:00.000Z'), ...overrides }
}

describe('yetenek puanları', () => {
  it('modifier 5e formülüne uyar', () => {
    expect(modifier(1)).toBe(-5)
    expect(modifier(8)).toBe(-1)
    expect(modifier(10)).toBe(0)
    expect(modifier(11)).toBe(0)
    expect(modifier(12)).toBe(1)
    expect(modifier(20)).toBe(5)
    expect(modifier(30)).toBe(10)
  })

  it('modifier işaretli gösterilir', () => {
    expect(formatModifier(3)).toBe('+3')
    expect(formatModifier(0)).toBe('+0')
    expect(formatModifier(-2)).toBe('-2')
  })

  it('standart dizi 5e değerlerini içerir', () => {
    expect([...STANDARD_ARRAY]).toEqual([15, 14, 13, 12, 10, 8])
  })

  it('point-buy maliyet tablosu doğrudur — 14 ve 15 ekstra pahalı', () => {
    expect(pointBuyCost(8)).toBe(0)
    expect(pointBuyCost(13)).toBe(5)
    expect(pointBuyCost(14)).toBe(7) // 13'ten 14'e 2 puan
    expect(pointBuyCost(15)).toBe(9) // 14'ten 15'e 2 puan
    expect(pointBuyIncreaseCost(13)).toBe(2)
    expect(pointBuyIncreaseCost(12)).toBe(1)
    expect(pointBuyIncreaseCost(15)).toBeNull()
  })

  it('27 puanlık bütçe aşılamaz', () => {
    // Klasik 15/15/15/8/8/8 dağılımı: 9+9+9+0+0+0 = 27, tam bütçe.
    const exact = evaluatePointBuy({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })
    expect(exact.spent).toBe(POINT_BUY_BUDGET)
    expect(exact.remaining).toBe(0)
    expect(exact.valid).toBe(true)

    const over = evaluatePointBuy({ str: 15, dex: 15, con: 15, int: 12, wis: 8, cha: 8 })
    expect(over.valid).toBe(false)
    expect(over.errors[0]).toMatch(/bütçe/)
  })

  it('point-buy 8-15 aralığını zorunlu kılar', () => {
    const tooHigh = evaluatePointBuy({ str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
    expect(tooHigh.valid).toBe(false)
    expect(tooHigh.errors[0]).toMatch(/STR/)

    const tooLow = evaluatePointBuy({ str: 7, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
    expect(tooLow.valid).toBe(false)
  })

  it('ırk ve alt ırk bonusları toplanır', () => {
    // Hill Dwarf: ırktan CON +2, alt ırktan WIS +1.
    const dwarf = character({
      raceId: 'dwarf',
      subraceId: 'hill-dwarf',
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 12, cha: 10 },
    })
    const scores = abilityScores(dwarf)
    expect(scores.con.racial).toBe(2)
    expect(scores.con.total).toBe(16)
    expect(scores.con.modifier).toBe(3)
    expect(scores.wis.racial).toBe(1)
    expect(scores.wis.total).toBe(13)
  })

  it('Half-Elf’in seçmeli bonusu uygulanır', () => {
    const halfElf = character({
      raceId: 'half-elf',
      raceAbilityChoice: ['dex', 'con'],
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 14 },
    })
    const scores = abilityScores(halfElf)
    expect(scores.cha.racial).toBe(2) // Half-Elf sabit CHA +2
    expect(scores.dex.racial).toBe(1)
    expect(scores.con.racial).toBe(1)
    expect(scores.str.racial).toBe(0)
  })

  it('ASI eklenir ve 20 üst sınırı aşılmaz', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 8 }],
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      raceId: 'half-orc', // STR +2
      levelChoices: [
        { kind: 'asi', classId: 'fighter', level: 4, increases: [{ ability: 'str', amount: 2 }] },
        { kind: 'asi', classId: 'fighter', level: 6, increases: [{ ability: 'str', amount: 2 }] },
        { kind: 'asi', classId: 'fighter', level: 8, increases: [{ ability: 'str', amount: 2 }] },
      ],
    })
    const scores = abilityScores(fighter)
    // 15 ham + 2 ırk + 6 ASI = 23 ama üst sınır 20.
    expect(scores.str.total).toBe(20)
    expect(scores.str.modifier).toBe(5)
  })
})

describe('ilerleme', () => {
  it('proficiency bonus formülü', () => {
    expect(proficiencyBonus(1)).toBe(2)
    expect(proficiencyBonus(4)).toBe(2)
    expect(proficiencyBonus(5)).toBe(3)
    expect(proficiencyBonus(9)).toBe(4)
    expect(proficiencyBonus(13)).toBe(5)
    expect(proficiencyBonus(17)).toBe(6)
    expect(proficiencyBonus(20)).toBe(6)
    expect(() => proficiencyBonus(21)).toThrow()
    expect(() => proficiencyBonus(0)).toThrow()
  })

  it('ASI seviyeleri sınıfa göre doğrudur', () => {
    expect(asiLevels('fighter')).toEqual([4, 6, 8, 12, 14, 16, 19])
    expect(asiLevels('rogue')).toEqual([4, 8, 10, 12, 16, 19])
    expect(asiLevels('wizard')).toEqual([4, 8, 12, 16, 19])
  })

  it('alt sınıf seviyeleri', () => {
    expect(subclassLevel('cleric')).toBe(1)
    expect(subclassLevel('wizard')).toBe(2)
    expect(subclassLevel('fighter')).toBe(3)
  })

  it('bir seviyedeki karar noktaları listelenir', () => {
    // Fighter 1: Fighting Style seçer, alt sınıf ve ASI yok.
    expect(decisionsAtLevel('fighter', 1).map((d) => d.kind)).toEqual(['fightingStyle'])
    // Fighter 3: alt sınıf.
    expect(decisionsAtLevel('fighter', 3).map((d) => d.kind)).toEqual(['subclass'])
    // Fighter 4: ASI.
    expect(decisionsAtLevel('fighter', 4).map((d) => d.kind)).toEqual(['asiOrFeat'])
    // Cleric 1: alt sınıf hemen seçilir.
    expect(decisionsAtLevel('cleric', 1).map((d) => d.kind)).toEqual(['subclass'])
  })

  it('yanıtlanmamış kararlar bekleyen listede çıkar, yanıtlananlar çıkmaz', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 4 }] })
    const pending = pendingDecisions(fighter)
    expect(pending.map((d) => `${d.kind}@${d.level}`)).toEqual([
      'fightingStyle@1',
      'subclass@3',
      'asiOrFeat@4',
    ])

    const answered = character({
      classes: [{ classId: 'fighter', level: 4 }],
      levelChoices: [
        { kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'defense' },
        { kind: 'subclass', classId: 'fighter', level: 3, subclassId: 'champion' },
        { kind: 'feat', classId: 'fighter', level: 4, featId: 'grappler' },
      ],
    })
    expect(pendingDecisions(answered)).toHaveLength(0)
  })
})

describe('hit point', () => {
  it('hit die ortalaması doğrudur', () => {
    expect(averageHitDie(6)).toBe(4)
    expect(averageHitDie(8)).toBe(5)
    expect(averageHitDie(10)).toBe(6)
    expect(averageHitDie(12)).toBe(7)
  })

  it('1. seviye = hit die max + CON', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    })
    // d10 max (10) + CON +2 = 12
    expect(maxHitPoints(fighter).total).toBe(12)
  })

  it('Hill Dwarf Barbarian 10. seviye — Dwarven Toughness dahil', () => {
    const barbarian = character({
      raceId: 'dwarf',
      subraceId: 'hill-dwarf',
      classes: [{ classId: 'barbarian', level: 10 }],
      // ham CON 14 + ırk +2 = 16 → modifier +3
      abilities: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
    })
    const hp = maxHitPoints(barbarian)

    expect(hpPerLevelBonus(barbarian)).toBe(1)
    expect(hp.hitDie).toBe(12)
    expect(hp.firstLevel).toBe(12) // d12 max
    expect(hp.laterLevels).toBe(9 * 7) // 9 seviye × ortalama 7
    expect(hp.constitution).toBe(3 * 10) // CON +3 × 10 seviye
    expect(hp.traits).toBe(10) // Dwarven Toughness: seviye başına +1
    expect(hp.total).toBe(12 + 63 + 30 + 10)
    expect(hp.total).toBe(115)
  })

  it('zar yöntemi atılan değerleri kullanır, eksikse ortalamaya düşer', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 4 }],
      abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      hp: { method: 'roll', rolls: [6, 2] }, // 2. ve 3. seviye; 4. seviye eksik
    })
    const hp = maxHitPoints(wizard)
    // d6 max 6 + (6 + 2 + ortalama 4) + CON +1 × 4 = 6 + 12 + 4
    expect(hp.laterLevels).toBe(12)
    expect(hp.total).toBe(22)
  })

  it('manuel yöntem kullanıcının değerini aynen alır', () => {
    const custom = character({
      classes: [{ classId: 'fighter', level: 5 }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: { method: 'manual', rolls: [], manualTotal: 99 },
    })
    expect(maxHitPoints(custom).total).toBe(99)
  })

  it('negatif CON’da bile seviye başına en az 1 HP kalır', () => {
    const frail = character({
      classes: [{ classId: 'wizard', level: 3 }],
      abilities: { str: 10, dex: 10, con: 3, int: 16, wis: 10, cha: 10 }, // CON -4
    })
    // 6 + 4 + 4 - 12 = 2, ama alt sınır seviye sayısı kadar (3).
    expect(maxHitPoints(frail).total).toBe(3)
  })

  it('sınıfsız karakterin HP’si sıfırdır', () => {
    expect(maxHitPoints(character()).total).toBe(0)
  })
})

describe('büyücülük', () => {
  it('save DC ve saldırı bonusu formülleri', () => {
    expect(spellSaveDC(3, 4)).toBe(15)
    expect(spellAttackBonus(3, 4)).toBe(7)
  })

  it('5. seviye Wizard: PB +3, 4/3/2 slot, DC = 8+3+INT', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 5 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }, // INT +3
    })
    const [casting] = spellcasting(wizard)
    expect(casting.spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0])
    expect(casting.ability).toBe('int')
    expect(casting.saveDC).toBe(8 + 3 + 3)
    expect(casting.spellAttackBonus).toBe(3 + 3)
    expect(casting.pactMagic).toBe(false)
    // Wizard hazırlar: INT mod + sınıf seviyesi
    expect(casting.preparedCount).toBe(3 + 5)
  })

  it('5. seviye Warlock: 2 adet 3. seviye pact slotu', () => {
    const warlock = character({
      classes: [{ classId: 'warlock', level: 5 }],
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
    })
    const [casting] = spellcasting(warlock)
    expect(casting.pactMagic).toBe(true)
    expect(casting.spellSlots).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0])
    expect(casting.pactSlotLevel).toBe(3)
    expect(casting.preparedCount).toBeUndefined() // Warlock hazırlamaz, bilir
  })

  it('11. seviye Ranger (yarı kaster): 4/3/3', () => {
    const ranger = character({
      classes: [{ classId: 'ranger', level: 11 }],
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 10 },
    })
    const [casting] = spellcasting(ranger)
    expect(casting.spellSlots).toEqual([4, 3, 3, 0, 0, 0, 0, 0, 0])
  })

  it('Paladin 1. seviyede henüz büyü yapamaz, 2. seviyede yapar', () => {
    const abilities = { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 }
    expect(spellcasting(character({ classes: [{ classId: 'paladin', level: 1 }], abilities }))).toHaveLength(0)

    const level2 = spellcasting(character({ classes: [{ classId: 'paladin', level: 2 }], abilities }))
    expect(level2).toHaveLength(1)
    expect(level2[0].spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
    // Yarı kaster hazırlama: CHA +2 + floor(2/2) = 3
    expect(level2[0].preparedCount).toBe(3)
  })

  it('büyü yapmayan sınıflarda boş döner', () => {
    const barbarian = character({
      classes: [{ classId: 'barbarian', level: 20 }],
      abilities: { str: 20, dex: 14, con: 20, int: 8, wis: 10, cha: 8 },
    })
    expect(spellcasting(barbarian)).toHaveLength(0)
  })

  it('en yüksek slot seviyesi doğru bulunur', () => {
    expect(highestSlotLevel([4, 3, 2, 0, 0, 0, 0, 0, 0])).toBe(3)
    expect(highestSlotLevel([0, 0, 2, 0, 0, 0, 0, 0, 0])).toBe(3)
    expect(highestSlotLevel([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0)
  })

  it('hazırlanabilir büyü sayısı en az 1’dir', () => {
    expect(preparedSpellCount('cleric', 1, -1)).toBe(1)
    expect(preparedSpellCount('cleric', 5, 3)).toBe(8)
    expect(preparedSpellCount('paladin', 5, 3)).toBe(5) // 3 + floor(5/2)
  })
})

describe('türetilmiş değerler', () => {
  it('kurtarma atışları yalnızca birincil sınıftan gelir', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 5 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    })
    const saves = savingThrows(wizard)
    expect(saves.int.proficient).toBe(true)
    expect(saves.int.value).toBe(3 + 3) // INT +3, PB +3
    expect(saves.wis.proficient).toBe(true)
    expect(saves.dex.proficient).toBe(false)
    expect(saves.dex.value).toBe(2)
  })

  it('beceri yeterliliği ve uzmanlık bonusu', () => {
    const rogue = character({
      classes: [{ classId: 'rogue', level: 5 }],
      abilities: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: ['stealth', 'acrobatics'], tools: [], languages: [] },
      levelChoices: [
        { kind: 'expertise', classId: 'rogue', level: 1, proficiencyIds: ['stealth'] },
      ],
    })
    const mods = skillModifiers(rogue)
    // DEX +3, PB +3. Uzmanlık PB'yi ikiye katlar.
    expect(mods.stealth.value).toBe(3 + 6)
    expect(mods.stealth.expertise).toBe(true)
    expect(mods.acrobatics.value).toBe(3 + 3)
    expect(mods.acrobatics.expertise).toBe(false)
    // Yeterliliği olmayan beceri sadece yetenek modifier'ı.
    expect(mods.athletics.value).toBe(0)
    expect(mods.athletics.proficient).toBe(false)
  })

  it('geçmişin verdiği beceriler de sayılır', () => {
    const acolyte = character({
      classes: [{ classId: 'fighter', level: 1 }],
      background: { kind: 'srd', id: 'acolyte' },
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
    })
    const mods = skillModifiers(acolyte)
    // Acolyte: Insight ve Religion.
    expect(mods.insight.proficient).toBe(true)
    expect(mods.religion.proficient).toBe(true)
  })

  it('özel geçmişin becerileri de sayılır', () => {
    const custom = character({
      classes: [{ classId: 'fighter', level: 1 }],
      background: {
        kind: 'custom',
        value: {
          name: 'Şehir Muhafızı',
          featureName: 'Kapı Ağzı',
          featureDesc: 'Nöbetçilerle konuşabilirsin.',
          skillIds: ['athletics', 'intimidation'],
          toolIds: [],
          languageCount: 1,
        },
      },
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
    })
    const mods = skillModifiers(custom)
    expect(mods.athletics.proficient).toBe(true)
    expect(mods.intimidation.proficient).toBe(true)
  })

  it('initiative, pasif Perception, hız ve taşıma kapasitesi', () => {
    const halfling = character({
      raceId: 'halfling', // hız 25
      classes: [{ classId: 'rogue', level: 1 }],
      abilities: { str: 8, dex: 15, con: 12, int: 10, wis: 14, cha: 12 },
      proficiencies: { skills: ['perception'], tools: [], languages: [] },
    })
    // Halfling DEX +2 → 17 → +3
    expect(initiative(halfling)).toBe(3)
    expect(walkingSpeed(halfling)).toBe(25)
    // WIS +2, PB +2 → Perception +4 → pasif 14
    expect(passivePerception(halfling)).toBe(14)
    expect(carryingCapacity(halfling).capacity).toBe(8 * 15)
  })
})

describe('zırh sınıfı', () => {
  it('zırhsız temel AC = 10 + DEX', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 1 }],
      abilities: { str: 8, dex: 16, con: 12, int: 16, wis: 10, cha: 10 },
    })
    expect(armorClass(wizard).value).toBe(13)
  })

  it('Barbarian Unarmored Defense: 10 + DEX + CON, kalkanla birlikte', async () => {
    const equipment = await equipmentMap()
    const barbarian = character({
      classes: [{ classId: 'barbarian', level: 1 }],
      abilities: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 },
      equipment: [{ itemId: 'shield', quantity: 1, equipped: true }],
    })
    const ac = armorClass(barbarian, equipment)
    // 10 + DEX +2 + CON +3 = 15, kalkan +2 = 17
    expect(ac.options.find((o) => o.label.includes('Barbarian'))?.value).toBe(15)
    expect(ac.shieldBonus).toBe(2)
    expect(ac.value).toBe(17)
  })

  it('Monk Unarmored Defense: 10 + DEX + WIS, kalkan geçersiz', async () => {
    const equipment = await equipmentMap()
    const monk = character({
      classes: [{ classId: 'monk', level: 1 }],
      abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 16, cha: 10 },
      equipment: [{ itemId: 'shield', quantity: 1, equipped: true }],
    })
    const ac = armorClass(monk, equipment)
    const monkOption = ac.options.find((o) => o.label.includes('Monk'))
    // 10 + DEX +3 + WIS +3 = 16
    expect(monkOption?.value).toBe(16)
    expect(monkOption?.allowsShield).toBe(false)
    // Kalkanla zırhsız (10+3+2=15) Monk'unkinden (16) düşük; en iyi 16 kalır.
    expect(ac.value).toBe(16)
  })

  it('Barbarian ile Monk’un formülleri karışmaz', () => {
    const abilities = { str: 12, dex: 14, con: 18, int: 10, wis: 8, cha: 10 }
    const barbarian = character({ classes: [{ classId: 'barbarian', level: 1 }], abilities })
    const monk = character({ classes: [{ classId: 'monk', level: 1 }], abilities })
    // CON +4 → 16 ; WIS -1 → 11 (zırhsız 12'den düşük olduğu için 12 kalır)
    expect(armorClass(barbarian).value).toBe(16)
    expect(armorClass(monk).value).toBe(12)
  })

  it('ağır zırh DEX bonusu almaz', async () => {
    const equipment = await equipmentMap()
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
      equipment: [{ itemId: 'chain-mail', quantity: 1, equipped: true }],
    })
    // Chain Mail AC 16, DEX eklenmez.
    expect(armorClass(fighter, equipment).value).toBe(16)
  })

  it('orta zırh DEX bonusunu en fazla +2 alır', async () => {
    const equipment = await equipmentMap()
    const ranger = character({
      classes: [{ classId: 'ranger', level: 1 }],
      abilities: { str: 12, dex: 18, con: 14, int: 10, wis: 14, cha: 10 }, // DEX +4
      equipment: [{ itemId: 'half-plate-armor', quantity: 1, equipped: true }],
    })
    // Half Plate AC 15 + min(4, 2) = 17
    expect(armorClass(ranger, equipment).value).toBe(17)
  })

  it('hafif zırh DEX bonusunun tamamını alır', async () => {
    const equipment = await equipmentMap()
    const rogue = character({
      classes: [{ classId: 'rogue', level: 1 }],
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 12, cha: 14 },
      equipment: [{ itemId: 'leather-armor', quantity: 1, equipped: true }],
    })
    // Leather AC 11 + DEX +4 = 15
    expect(armorClass(rogue, equipment).value).toBe(15)
  })

  it('Draconic Bloodline Sorcerer zırhsızken 13 + DEX kullanır', () => {
    const sorcerer = character({
      classes: [{ classId: 'sorcerer', level: 1 }],
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      levelChoices: [
        { kind: 'subclass', classId: 'sorcerer', level: 1, subclassId: 'draconic' },
      ],
    })
    expect(armorClass(sorcerer).value).toBe(15) // 13 + DEX +2
  })
})

describe('zar ve tohumlanabilirlik', () => {
  it('aynı tohum aynı sonucu üretir', () => {
    const a = rollAbilityScores(createRng(12345)).map((r) => r.total)
    const b = rollAbilityScores(createRng(12345)).map((r) => r.total)
    expect(a).toEqual(b)

    const different = rollAbilityScores(createRng(54321)).map((r) => r.total)
    expect(different).not.toEqual(a)
  })

  it('metin tohumu belirlenimcidir', () => {
    expect(seedFromString('gandalf')).toBe(seedFromString('gandalf'))
    expect(seedFromString('gandalf')).not.toBe(seedFromString('saruman'))
  })

  it('4d6 en düşüğü çıkarır ve 3-18 aralığında kalır', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i += 1) {
      const roll = roll4d6DropLowest(rng)
      expect(roll.dice).toHaveLength(4)
      expect(roll.dropped).toBe(Math.min(...roll.dice))
      expect(roll.total).toBe(roll.dice.reduce((s, d) => s + d, 0) - roll.dropped)
      expect(roll.total).toBeGreaterThanOrEqual(3)
      expect(roll.total).toBeLessThanOrEqual(18)
    }
  })

  it('pickMany tekrarsız seçer ve kapasiteyi aşmaz', () => {
    const rng = createRng(99)
    const chosen = pickMany(['a', 'b', 'c', 'd', 'e'], 3, rng)
    expect(chosen).toHaveLength(3)
    expect(new Set(chosen).size).toBe(3)
    expect(() => pickMany(['a', 'b'], 3, rng)).toThrow(/seçilemez/)
  })
})

describe('geçerli seçenekler katmanı', () => {
  it('ırk listesi dokuz SRD ırkını verir', () => {
    const choices = getValidChoices(character(), { kind: 'race' })
    expect(choices.applicable).toBe(true)
    expect(choices.choose).toBe(1)
    expect(choices.options).toHaveLength(9)
  })

  it('alt ırk yalnızca ırk seçilince ve varsa uygulanabilir', () => {
    expect(getValidChoices(character(), { kind: 'subrace' }).applicable).toBe(false)

    const dwarf = getValidChoices(character({ raceId: 'dwarf' }), { kind: 'subrace' })
    expect(dwarf.applicable).toBe(true)
    expect(dwarf.options.map((o) => o.id)).toEqual(['hill-dwarf'])

    // Human'ın SRD'de alt ırkı yok.
    const human = getValidChoices(character({ raceId: 'human' }), { kind: 'subrace' })
    expect(human.applicable).toBe(false)
    expect(human.reason).toMatch(/alt ırkı yok/)
  })

  it('alt sınıf seçim seviyesine gelmeden uygulanamaz', () => {
    const level2 = character({ classes: [{ classId: 'fighter', level: 2 }] })
    const early = getValidChoices(level2, { kind: 'subclass', classId: 'fighter' })
    expect(early.applicable).toBe(false)
    expect(early.reason).toMatch(/3\. seviyede/)

    const level3 = character({ classes: [{ classId: 'fighter', level: 3 }] })
    const ready = getValidChoices(level3, { kind: 'subclass', classId: 'fighter' })
    expect(ready.applicable).toBe(true)
    expect(ready.options.map((o) => o.id)).toEqual(['champion'])
  })

  it('sınıf beceri seçimi doğru sayı ve listeyi verir', () => {
    const wizard = character({ classes: [{ classId: 'wizard', level: 1 }] })
    const choices = getValidChoices(wizard, { kind: 'classSkills' })
    expect(choices.choose).toBe(2)
    expect(choices.options.map((o) => o.id).sort()).toEqual([
      'arcana',
      'history',
      'insight',
      'investigation',
      'medicine',
      'religion',
    ])
  })

  it('geçmişten gelen beceri sınıf listesinde kilitlenir', () => {
    const cleric = character({
      classes: [{ classId: 'cleric', level: 1 }],
      background: { kind: 'srd', id: 'acolyte' }, // Insight ve Religion verir
    })
    const choices = getValidChoices(cleric, { kind: 'classSkills' })
    const insight = choices.options.find((o) => o.id === 'insight')
    expect(insight?.disabledReason).toMatch(/zaten/)
  })

  it('20 puana ulaşmış yetenek ASI’de seçilemez', () => {
    const maxed = character({
      classes: [{ classId: 'fighter', level: 8 }],
      abilities: { str: 20, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const choices = getValidChoices(maxed, { kind: 'asiAbilities', classId: 'fighter', level: 8 })
    expect(choices.options.find((o) => o.id === 'str')?.disabledReason).toMatch(/20/)
    expect(choices.options.find((o) => o.id === 'dex')?.disabledReason).toBeUndefined()
  })

  it('Fighting Style seçenekleri sınıfa göre farklıdır', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 1 }] })
    const paladin = character({ classes: [{ classId: 'paladin', level: 2 }] })
    const wizard = character({ classes: [{ classId: 'wizard', level: 2 }] })

    const fighterStyles = getValidChoices(fighter, {
      kind: 'fightingStyle',
      classId: 'fighter',
      level: 1,
    })
    expect(fighterStyles.options).toHaveLength(6)
    expect(fighterStyles.options.map((o) => o.id)).toContain('archery')

    const paladinStyles = getValidChoices(paladin, {
      kind: 'fightingStyle',
      classId: 'paladin',
      level: 2,
    })
    // Paladin'de Archery ve Two-Weapon Fighting yoktur.
    expect(paladinStyles.options.map((o) => o.id)).not.toContain('archery')
    expect(paladinStyles.options).toHaveLength(4)

    expect(
      getValidChoices(wizard, { kind: 'fightingStyle', classId: 'wizard', level: 2 }).applicable,
    ).toBe(false)
  })

  it('alınmış feat tekrar seçilemez', () => {
    const taken = character({
      classes: [{ classId: 'fighter', level: 8 }],
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      levelChoices: [{ kind: 'feat', classId: 'fighter', level: 4, featId: 'grappler' }],
    })
    const choices = getValidChoices(taken, { kind: 'feat', classId: 'fighter', level: 8 })
    expect(choices.options.find((o) => o.id === 'grappler')?.disabledReason).toMatch(/zaten/)
  })

  it('feat ön koşulu karşılanmazsa engellenir', () => {
    // Grappler STR 13 ister.
    const weak = character({
      classes: [{ classId: 'wizard', level: 4 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    })
    const choices = getValidChoices(weak, { kind: 'feat', classId: 'wizard', level: 4 })
    expect(choices.options.find((o) => o.id === 'grappler')?.disabledReason).toMatch(/STR en az 13/)
  })
})

describe('rastgele seçim geçerli sonuç üretir', () => {
  it('aynı tohum aynı seçimi verir', () => {
    const blank = character()
    const a = chooseRandomly(blank, { kind: 'race' }, createRng(42))
    const b = chooseRandomly(blank, { kind: 'race' }, createRng(42))
    expect(a).toEqual(b)
  })

  it('seçilen ırk gerçekten geçerli seçenekler arasındadır', () => {
    const rng = createRng(2026)
    for (let i = 0; i < 50; i += 1) {
      const [raceId] = chooseRandomly(character(), { kind: 'race' }, rng)
      const valid = getValidChoices(character(), { kind: 'race' }).options.map((o) => o.id)
      expect(valid).toContain(raceId)
    }
  })

  it('engellenmiş seçenekler asla seçilmez', () => {
    const cleric = character({
      classes: [{ classId: 'cleric', level: 1 }],
      background: { kind: 'srd', id: 'acolyte' },
    })
    const rng = createRng(5)
    for (let i = 0; i < 50; i += 1) {
      const picked = chooseRandomly(cleric, { kind: 'classSkills' }, rng)
      expect(picked).not.toContain('insight')
      expect(picked).not.toContain('religion')
      expect(new Set(picked).size).toBe(picked.length)
    }
  })

  it('uygulanamaz karar noktasında boş döner', () => {
    expect(chooseRandomly(character(), { kind: 'subrace' }, createRng(1))).toEqual([])
  })
})

describe('karakter kaydı', () => {
  it('boş karakter şemayı geçer ve yeniden ayrıştırılabilir', () => {
    const blank = createEmptyCharacter('abc')
    const roundTrip = parseCharacter(JSON.parse(JSON.stringify(blank)))
    expect(roundTrip).toEqual(blank)
  })

  it('toplam seviye sınıf seviyelerinin toplamıdır', () => {
    expect(totalLevel(character({ classes: [{ classId: 'fighter', level: 5 }] }))).toBe(5)
    expect(
      totalLevel(
        character({
          classes: [
            { classId: 'fighter', level: 3 },
            { classId: 'rogue', level: 2 },
          ],
        }),
      ),
    ).toBe(5)
  })

  it('bozuk karakter kaydı reddedilir', () => {
    expect(() => parseCharacter({ schemaVersion: 1, id: 'x' })).toThrow()
    expect(() =>
      parseCharacter({ ...createEmptyCharacter('x'), classes: [{ classId: 'fighter', level: 25 }] }),
    ).toThrow()
  })
})

/** Ekipman lazy yüklendiği için AC testlerinde id → kayıt haritası kurulur. */
async function equipmentMap(): Promise<Map<string, Equipment>> {
  const collection = await loadEquipment()
  return new Map(collection.all().map((item) => [item.id, item]))
}
