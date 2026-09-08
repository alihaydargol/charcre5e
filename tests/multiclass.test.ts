import { describe, expect, it } from 'vitest'
import { createEmptyCharacter, totalLevel, type Character } from '../src/rules/character.ts'
import { abilityScores } from '../src/rules/abilities.ts'
import { hitDicePool, hitDiceByLevel, maxHitPoints } from '../src/rules/hitpoints.ts'
import {
  casterProgression,
  classSummary,
  combinedCasterLevel,
  levelTrack,
  meetsMulticlassPrerequisite,
  multiclassProficiencies,
  multiclassSkillChoice,
} from '../src/rules/multiclass.ts'
import { characterProficiencyBonus, pendingDecisions } from '../src/rules/progression.ts'
import { savingThrows, skillProficiencies } from '../src/rules/derived.ts'
import { isProficientWithArmor } from '../src/rules/weapons.ts'
import { spellcasting } from '../src/rules/spellcasting.ts'

/** Verilen sınıf/seviye çiftleriyle bir karakter kurar. */
function build(
  classes: [string, number][],
  abilities: Partial<Character['abilities']> = {},
): Character {
  // Irk verilmiyor: ön koşullar nihai puana bakıyor ve her SRD ırkı bonus
  // veriyor. Irksız kurunca testteki ham puan doğrudan nihai puan oluyor.
  return {
    ...createEmptyCharacter('t'),
    classes: classes.map(([classId, level]) => ({ classId, level })),
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...abilities },
  }
}

describe('ön koşullar', () => {
  it('tek yetenek isteyen sınıf', () => {
    // Fighter'ın kendi eşiği de sağlanmalı (STR ya da DEX 13) — kural iki yönlü.
    const ok = build([['fighter', 1]], { str: 13, int: 13 })
    expect(meetsMulticlassPrerequisite(ok, 'wizard').met).toBe(true)

    const low = meetsMulticlassPrerequisite(build([['fighter', 1]], { str: 13, int: 12 }), 'wizard')
    expect(low.met).toBe(false)
    expect(low.reason).toContain('INT')
  })

  it('iki yetenek birden isteyen sınıf (Paladin: STR ve CHA)', () => {
    expect(
      meetsMulticlassPrerequisite(build([['fighter', 1]], { str: 13, cha: 12 }), 'paladin').met,
    ).toBe(false)
    expect(
      meetsMulticlassPrerequisite(build([['fighter', 1]], { str: 13, cha: 13 }), 'paladin').met,
    ).toBe(true)
  })

  it('yalnızca yeni sınıfın eşiği yetmez', () => {
    // DEX 13 Fighter için yeter ama mevcut Wizard'ın INT'i 10.
    const result = meetsMulticlassPrerequisite(build([['wizard', 1]], { dex: 13 }), 'fighter')
    expect(result.met).toBe(false)
    expect(result.reason).toContain('Wizard')
  })

  it('iki yetenekten biri yeten sınıf (Fighter: STR ya da DEX)', () => {
    // Wizard'ın INT eşiği her seferinde sağlanıyor; değişken olan STR/DEX.
    const wizard = (extra: Partial<Character['abilities']>) =>
      meetsMulticlassPrerequisite(build([['wizard', 1]], { int: 13, ...extra }), 'fighter').met

    expect(wizard({ dex: 13 })).toBe(true)
    expect(wizard({ str: 13 })).toBe(true)
    expect(wizard({ str: 12, dex: 12 })).toBe(false)
  })

  it('kural iki yönlü: mevcut sınıfın eşiği de aranır', () => {
    // INT 8 bir Wizard, DEX 13 olsa bile Fighter'a geçemez: kendi sınıfının
    // eşiğini karşılamıyor.
    const result = meetsMulticlassPrerequisite(build([['wizard', 3]], { int: 8, dex: 13 }), 'fighter')
    expect(result.met).toBe(false)
    expect(result.reason).toContain('Wizard')
  })

  it('ırk bonusu eşiğe sayılır', () => {
    // Human tüm yeteneklere +1 verir; ham 12 → 13. Eşik nihai puana bakar.
    const character = { ...build([['fighter', 1]], { int: 12, str: 13 }), raceId: 'human' }
    expect(abilityScores(character).int.total).toBe(13)
    expect(meetsMulticlassPrerequisite(character, 'wizard').met).toBe(true)

    // Aynı karakter ırksız olsa INT 12'de kalır ve geçemez.
    expect(meetsMulticlassPrerequisite(build([['fighter', 1]], { int: 12, str: 13 }), 'wizard').met).toBe(
      false,
    )
  })
})

describe('multiclass yeterlilikleri kısıtlıdır', () => {
  it('Fighter zırh ve silah verir, beceri vermez', () => {
    const gained = multiclassProficiencies('fighter')
    expect(gained).toContain('light-armor')
    expect(gained).toContain('martial-weapons')
    expect(gained).toContain('shields')
    expect(gained.some((id) => id.startsWith('skill-'))).toBe(false)
  })

  it('Wizard ve Sorcerer hiçbir yeterlilik vermez', () => {
    expect(multiclassProficiencies('wizard')).toEqual([])
    expect(multiclassProficiencies('sorcerer')).toEqual([])
  })

  it('Rogue hafif zırh ve hırsız aletleri verir', () => {
    expect(multiclassProficiencies('rogue')).toEqual(['light-armor', 'thieves-tools'])
  })
})

describe('yeterlilikler kural motoruna bağlı', () => {
  it('sonradan girilen sınıf ağır zırh yeterliliği vermez', () => {
    const heavy = {
      id: 'plate',
      name: 'Plate',
      source: 'srd' as const,
      category: 'armor' as const,
      armorCategory: 'Heavy' as const,
      armorClass: { base: 18, dexBonus: false, maxDexBonus: null },
      strMinimum: 15,
      stealthDisadvantage: true,
      desc: [],
    }

    // Tek başına Fighter: all-armor → ağır zırh kullanabilir.
    expect(isProficientWithArmor(build([['fighter', 1]]), heavy)).toBe(true)

    // Wizard olarak başlayıp Fighter'a geçen karakter yalnızca multiclass
    // tablosundakileri alır: light, medium, shields — ağır zırh yok.
    expect(isProficientWithArmor(build([['wizard', 1], ['fighter', 1]]), heavy)).toBe(false)
  })

  it('sonradan girilen sınıf orta zırh ve kalkan verir', () => {
    const medium = {
      id: 'scale-mail',
      name: 'Scale Mail',
      source: 'srd' as const,
      category: 'armor' as const,
      armorCategory: 'Medium' as const,
      armorClass: { base: 14, dexBonus: true, maxDexBonus: 2 },
      strMinimum: 0,
      stealthDisadvantage: true,
      desc: [],
    }
    expect(isProficientWithArmor(build([['wizard', 1], ['fighter', 1]]), medium)).toBe(true)
  })

  it('birinci sınıf tam listesini verir', () => {
    const heavy = {
      id: 'plate',
      name: 'Plate',
      source: 'srd' as const,
      category: 'armor' as const,
      armorCategory: 'Heavy' as const,
      armorClass: { base: 18, dexBonus: false, maxDexBonus: null },
      strMinimum: 15,
      stealthDisadvantage: true,
      desc: [],
    }
    // Fighter önce geldiyse ağır zırh kalır.
    expect(isProficientWithArmor(build([['fighter', 1], ['wizard', 1]]), heavy)).toBe(true)
  })
})

describe('multiclass beceri seçimi', () => {
  it('yalnızca Bard, Ranger ve Rogue verir', () => {
    expect(multiclassSkillChoice('bard')?.choose).toBe(1)
    expect(multiclassSkillChoice('ranger')?.choose).toBe(1)
    expect(multiclassSkillChoice('rogue')?.choose).toBe(1)
    expect(multiclassSkillChoice('fighter')).toBeUndefined()
    expect(multiclassSkillChoice('wizard')).toBeUndefined()
  })

  it('Bard herhangi bir beceriyi, Rogue kendi listesinden verir', () => {
    expect(multiclassSkillChoice('bard')!.from.length).toBe(18)
    const rogue = multiclassSkillChoice('rogue')!.from
    expect(rogue.length).toBeLessThan(18)
    expect(rogue).toContain('stealth')
  })

  it('birinci sınıfta sorulmaz, sonradan girilende sorulur', () => {
    // Rogue ile başlayan karakter: beceriler sihirbazın normal adımında.
    const first = pendingDecisions(build([['rogue', 1]]))
    expect(first.some((d) => d.kind === 'multiclassSkill')).toBe(false)

    // Fighter'la başlayıp Rogue'a geçen: multiclass becerisi sorulur.
    const second = pendingDecisions(build([['fighter', 1], ['rogue', 1]]))
    expect(second.some((d) => d.kind === 'multiclassSkill' && d.classId === 'rogue')).toBe(true)
  })

  it('beceri vermeyen sınıfa geçince sorulmaz', () => {
    const pending = pendingDecisions(build([['fighter', 1], ['wizard', 1]]))
    expect(pending.some((d) => d.kind === 'multiclassSkill')).toBe(false)
  })

  it('seçilen beceri yeterliliklere sayılır', () => {
    const character: Character = {
      ...build([['fighter', 1], ['rogue', 1]]),
      levelChoices: [
        { kind: 'multiclassSkill', classId: 'rogue', level: 1, skillIds: ['stealth'] },
      ],
    }
    expect(skillProficiencies(character).has('stealth')).toBe(true)
    expect(pendingDecisions(character).some((d) => d.kind === 'multiclassSkill')).toBe(false)
  })
})

describe('seviye şeridi', () => {
  it('seviyeler sınıflara kanonik sırayla dağılır', () => {
    expect(levelTrack(build([['fighter', 2], ['wizard', 2]]))).toEqual([
      { characterLevel: 1, classId: 'fighter', classLevel: 1 },
      { characterLevel: 2, classId: 'fighter', classLevel: 2 },
      { characterLevel: 3, classId: 'wizard', classLevel: 1 },
      { characterLevel: 4, classId: 'wizard', classLevel: 2 },
    ])
  })
})

describe('hit points', () => {
  it('1. seviye ilk sınıfın zarının maksimumu, sonrası kendi sınıfının', () => {
    // Fighter 3 / Wizard 2, CON +2
    const character = build([['fighter', 3], ['wizard', 2]], { con: 14 })
    expect(hitDiceByLevel(character)).toEqual([10, 10, 10, 6, 6])

    // 10 (d10 maks) + 2×6 (Fighter ortalaması) + 2×4 (Wizard ortalaması)
    // + 5 seviye × CON +2
    const hp = maxHitPoints(character)
    expect(hp.firstLevel).toBe(10)
    expect(hp.laterLevels).toBe(6 + 6 + 4 + 4)
    expect(hp.constitution).toBe(2 * 5)
    expect(hp.total).toBe(10 + 20 + 10)
  })

  it('hangi sınıfla başlandığı toplamı değiştirir', () => {
    const a = maxHitPoints(build([['fighter', 3], ['wizard', 2]], { con: 14 }))
    const b = maxHitPoints(build([['wizard', 2], ['fighter', 3]], { con: 14 }))

    // Aynı zarlardan aynı sayıda atılıyor; değişen tek şey hangi zarın 1.
    // seviyede MAKSİMUM sayıldığı. Fark = (10 - ort10) - (6 - ort6) = 4 - 2.
    expect(a.total - b.total).toBe(10 - 6 - (6 - 4))
    expect(a.total - b.total).toBe(2)
  })

  it('hit dice havuzu zar boyutuna göre ayrılır', () => {
    expect(hitDicePool(build([['fighter', 3], ['wizard', 2]]))).toEqual([
      { die: 10, count: 3 },
      { die: 6, count: 2 },
    ])
  })

  it('tek sınıfta davranış değişmedi', () => {
    // Aşama 3'ten beri doğrulanan değer: Hill Dwarf Barbarian sv10 = 115 HP.
    const barbarian = {
      ...createEmptyCharacter('t'),
      raceId: 'dwarf',
      subraceId: 'hill-dwarf',
      classes: [{ classId: 'barbarian', level: 10 }],
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
    }
    // CON 14 + Dwarf +2 = 16 → +3. 12 + 9×7 + 3×10 + 10 (Toughness) = 115.
    expect(maxHitPoints(barbarian).total).toBe(115)
  })
})

describe('proficiency bonus ve kurtarma atışları', () => {
  it('PB toplam karakter seviyesinden gelir, sınıf seviyesinden değil', () => {
    // Fighter 3 / Wizard 2 = 5. seviye karakter → PB +3
    const character = build([['fighter', 3], ['wizard', 2]])
    expect(totalLevel(character)).toBe(5)
    expect(characterProficiencyBonus(character)).toBe(3)
  })

  it('kurtarma atışı yeterliliği yalnızca ilk sınıftan gelir', () => {
    const character = build([['fighter', 3], ['wizard', 2]])
    const saves = savingThrows(character)
    // Fighter: STR ve CON
    expect(saves.str.proficient).toBe(true)
    expect(saves.con.proficient).toBe(true)
    // Wizard'ın INT ve WIS'i sonradan gelmez.
    expect(saves.int.proficient).toBe(false)
    expect(saves.wis.proficient).toBe(false)
  })
})

describe('birleşik büyü slotları', () => {
  it('kaster tipleri sınıf kaydından türetilir', () => {
    expect(casterProgression('wizard')).toBe('full')
    expect(casterProgression('cleric')).toBe('full')
    expect(casterProgression('paladin')).toBe('half')
    expect(casterProgression('ranger')).toBe('half')
    expect(casterProgression('warlock')).toBe('pact')
    expect(casterProgression('fighter')).toBe('none')
  })

  it('yarı kasterin yuvarlaması sınıf başına yapılır', () => {
    // Paladin 1 / Ranger 1 → floor(1/2) + floor(1/2) = 0, 1 değil.
    expect(combinedCasterLevel(build([['paladin', 1], ['ranger', 1]]))).toBe(0)
    // Paladin 2 / Ranger 2 → 1 + 1 = 2
    expect(combinedCasterLevel(build([['paladin', 2], ['ranger', 2]]))).toBe(2)
  })

  it('tam + yarı kaster birleşik seviye', () => {
    // Wizard 4 / Paladin 4 → 4 + 2 = 6
    expect(combinedCasterLevel(build([['wizard', 4], ['paladin', 4]]))).toBe(6)
  })

  it('Wizard 4 / Cleric 1 slotları 5. seviye tam kaster tablosundan gelir', () => {
    const character = build([['wizard', 4], ['cleric', 1]], { int: 16, wis: 14 })
    const info = spellcasting(character)
    expect(info).toHaveLength(2)
    // İkisi de AYNI birleşik havuzu görür.
    const wizardSlots = info.find((i) => i.classId === 'wizard')!.spellSlots
    const clericSlots = info.find((i) => i.classId === 'cleric')!.spellSlots
    expect(wizardSlots).toEqual(clericSlots)
    // 5. seviye tam kaster: 4/3/2
    expect(wizardSlots.slice(0, 3)).toEqual([4, 3, 2])
  })

  it('Warlock’un Pact Magic’i birleşik havuza karışmaz', () => {
    // Warlock 3 / Wizard 3 → Wizard birleşik seviye 3 (Warlock sayılmaz)
    const character = build([['warlock', 3], ['wizard', 3]], { cha: 16, int: 16 })
    expect(combinedCasterLevel(character)).toBe(3)

    const info = spellcasting(character)
    const warlock = info.find((i) => i.classId === 'warlock')!
    const wizard = info.find((i) => i.classId === 'wizard')!

    // Warlock 3: 2 adet 2. seviye pact slotu
    expect(warlock.pactMagic).toBe(true)
    expect(warlock.spellSlots[1]).toBe(2)
    expect(warlock.pactSlotLevel).toBe(2)

    // Wizard tarafı 3. seviye tam kaster tablosu: 4/2
    expect(wizard.spellSlots.slice(0, 2)).toEqual([4, 2])
  })

  it('tek büyü yapan sınıfta slotlar sınıfın kendi tablosundan gelir', () => {
    // Fighter 3 / Wizard 2: tek kaster → Wizard 2'nin kendi satırı (3 slot)
    const character = build([['fighter', 3], ['wizard', 2]], { int: 16 })
    const [info] = spellcasting(character)
    expect(info.classId).toBe('wizard')
    expect(info.spellSlots[0]).toBe(3)
  })

  it('save DC her sınıf için kendi yeteneğinden hesaplanır', () => {
    const character = build([['wizard', 4], ['cleric', 1]], { int: 16, wis: 12 })
    const info = spellcasting(character)
    const pb = characterProficiencyBonus(character)
    const scores = abilityScores(character)
    const mod = (score: number) => Math.floor((score - 10) / 2)

    expect(info.find((i) => i.classId === 'wizard')!.saveDC).toBe(
      8 + pb + mod(scores.int.total),
    )
    expect(info.find((i) => i.classId === 'cleric')!.saveDC).toBe(
      8 + pb + mod(scores.wis.total),
    )
  })
})

describe('gösterim', () => {
  it('sınıf özeti "Fighter 3 / Wizard 2" biçiminde', () => {
    expect(classSummary(build([['fighter', 3], ['wizard', 2]]))).toBe('Fighter 3 / Wizard 2')
  })
})
