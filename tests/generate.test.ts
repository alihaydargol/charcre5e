import { beforeAll, describe, expect, it } from 'vitest'
import { classes, loadEquipment, loadSpells, type Collection } from '../src/data/registry.ts'
import type { Equipment, Spell } from '../src/data/schema.ts'
import { abilityScores } from '../src/rules/abilities.ts'
import { parseCharacter, totalLevel } from '../src/rules/character.ts'
import { armorClass } from '../src/rules/derived.ts'
import { generateCharacter, randomName } from '../src/rules/generate.ts'
import { maxHitPoints } from '../src/rules/hitpoints.ts'
import { pendingDecisions } from '../src/rules/progression.ts'
import { spellcasting } from '../src/rules/spellcasting.ts'
import { createRng } from '../src/rules/dice.ts'
import { isCharacterComplete } from '../src/features/wizard/steps.ts'

let spells: Collection<Spell>
let equipment: Map<string, Equipment>

beforeAll(async () => {
  spells = await loadSpells()
  const collection = await loadEquipment()
  equipment = new Map(collection.all().map((i) => [i.id, i]))
})

describe('tohumlanabilirlik', () => {
  it('aynı tohum birebir aynı karakteri üretir', () => {
    const a = generateCharacter({ seed: 12345, level: 5, spells, equipment })
    const b = generateCharacter({ seed: 12345, level: 5, spells, equipment })

    // createdAt/updatedAt zaman damgası olduğu için karşılaştırma dışı.
    const strip = (c: ReturnType<typeof generateCharacter>) => ({
      ...c,
      createdAt: '',
      updatedAt: '',
    })
    expect(strip(a)).toEqual(strip(b))
  })

  it('farklı tohum farklı karakter üretir', () => {
    const a = generateCharacter({ seed: 1, level: 5 })
    const b = generateCharacter({ seed: 2, level: 5 })
    const same =
      a.raceId === b.raceId &&
      a.classes[0].classId === b.classes[0].classId &&
      a.name === b.name
    expect(same).toBe(false)
  })

  it('tohum karaktere yazılır, yeniden üretilebilir', () => {
    const original = generateCharacter({ seed: 999, level: 3, spells, equipment })
    expect(original.seed).toBe(999)

    const reproduced = generateCharacter({ seed: original.seed, level: 3, spells, equipment })
    expect(reproduced.name).toBe(original.name)
    expect(reproduced.classes).toEqual(original.classes)
  })

  it('isim üretimi tohumla belirlenimcidir', () => {
    expect(randomName(createRng(7))).toBe(randomName(createRng(7)))
    expect(randomName(createRng(7))).not.toBe(randomName(createRng(8)))
  })
})

describe('üretilen karakter tanım gereği geçerlidir', () => {
  it('50 farklı tohumda hiç bekleyen karar kalmaz', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const character = generateCharacter({ seed, level: 12, spells, equipment })
      expect(pendingDecisions(character), `tohum ${seed}`).toEqual([])
    }
  })

  it('50 farklı tohumda sihirbaz doğrulamasını geçer', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const character = generateCharacter({ seed, level: 1, spells, equipment })
      const { ready, issues } = isCharacterComplete(character)
      expect(issues, `tohum ${seed}`).toEqual([])
      expect(ready).toBe(true)
    }
  })

  it('her seviyede şema doğrulamasını geçer', () => {
    for (const level of [1, 2, 5, 11, 17, 20]) {
      const character = generateCharacter({ seed: level * 31, level, spells, equipment })
      expect(() => parseCharacter(JSON.parse(JSON.stringify(character)))).not.toThrow()
      expect(totalLevel(character)).toBe(level)
    }
  })

  it('her sınıf 1. ve 20. seviyede geçerli üretilir', () => {
    for (const cls of classes.all()) {
      for (const level of [1, 20]) {
        const character = generateCharacter({
          seed: 42,
          level,
          classId: cls.id,
          spells,
          equipment,
        })
        expect(character.classes[0].classId).toBe(cls.id)
        expect(pendingDecisions(character), `${cls.id} sv${level}`).toEqual([])
        expect(maxHitPoints(character).total).toBeGreaterThan(0)
      }
    }
  })

  it('yetenek puanları 20 üst sınırını aşmaz', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const character = generateCharacter({ seed, level: 20, spells, equipment })
      const scores = abilityScores(character)
      for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
        expect(scores[ability].total, `tohum ${seed} ${ability}`).toBeLessThanOrEqual(20)
      }
    }
  })
})

describe('oynanabilirlik', () => {
  it('ana yetenek en yüksek puanı alır', () => {
    // Rastgele dağıtılsa kurallara uygun ama işe yaramaz karakter çıkardı.
    const wizard = generateCharacter({ seed: 1, level: 1, classId: 'wizard' })
    const scores = abilityScores(wizard)
    expect(scores.int.base).toBe(15)

    const barbarian = generateCharacter({ seed: 1, level: 1, classId: 'barbarian' })
    expect(abilityScores(barbarian).str.base).toBe(15)

    const rogue = generateCharacter({ seed: 1, level: 1, classId: 'rogue' })
    expect(abilityScores(rogue).dex.base).toBe(15)
  })

  it('ASI puanları ana yeteneğe gider ve 20’de durur', () => {
    const wizard = generateCharacter({ seed: 3, level: 20, classId: 'wizard', spells, equipment })
    const scores = abilityScores(wizard)
    // 15 ham + ırk bonusu + 5 ASI (20'de sınırlı)
    expect(scores.int.total).toBe(20)
  })

  it('ırkın seçmeli bonusu sınıfın önceliğine göre verilir', () => {
    // Half-Elf CHA +2 sabit, ayrıca iki yetenekten +1 seçer.
    const wizard = generateCharacter({ seed: 5, level: 1, classId: 'wizard', raceId: 'half-elf' })
    // Wizard önceliği: int, con, dex... CHA seçenekler arasında yok.
    expect(wizard.raceAbilityChoice).toEqual(['int', 'con'])
  })

  it('zırh ve silah kuşandırılır; AC 10’da kalmaz', () => {
    for (const classId of ['fighter', 'cleric', 'ranger']) {
      const character = generateCharacter({ seed: 11, level: 1, classId, spells, equipment })
      const equipped = character.equipment.filter((e) => e.equipped)
      expect(equipped.length, classId).toBeGreaterThan(0)
      expect(armorClass(character, equipment).value, classId).toBeGreaterThan(10)
    }
  })

  it('HP ortalama yöntemiyle hesaplanır — yeni oyuncu için öngörülebilir', () => {
    const character = generateCharacter({ seed: 8, level: 5, spells, equipment })
    expect(character.hp.method).toBe('average')
    expect(character.hp.rolls).toEqual([])
  })

  it('isim ve alignment doldurulur', () => {
    const character = generateCharacter({ seed: 4, level: 1 })
    expect(character.name.length).toBeGreaterThan(3)
    expect(character.notes.alignment).not.toBe('')
  })

  it('istenen isim korunur', () => {
    const character = generateCharacter({ seed: 4, level: 1, name: 'Kendi İsmim' })
    expect(character.name).toBe('Kendi İsmim')
  })
})

describe('büyü seçimi', () => {
  it('Wizard büyü defteri seviyeyle büyür: sv1 = 6, sv12 = 28', () => {
    const at = (level: number) =>
      generateCharacter({ seed: 2, level, classId: 'wizard', spells, equipment }).spells.known
        .length
    expect(at(1)).toBe(6)
    expect(at(2)).toBe(8)
    expect(at(12)).toBe(6 + 11 * 2)
  })

  it('Wizard 1. seviyede 3 cantrip ve 6 defter büyüsü alır', () => {
    const wizard = generateCharacter({ seed: 2, level: 1, classId: 'wizard', spells, equipment })
    expect(wizard.spells.cantrips).toHaveLength(3)
    expect(wizard.spells.known).toHaveLength(6)
    // Hepsi Wizard listesinden ve seviyesi uygun olmalı.
    for (const id of wizard.spells.known) {
      const spell = spells.require(id)
      expect(spell.classes).toContain('wizard')
      expect(spell.level).toBeGreaterThan(0)
      expect(spell.level).toBeLessThanOrEqual(1)
    }
    for (const id of wizard.spells.cantrips) {
      expect(spells.require(id).level).toBe(0)
    }
  })

  it('Bard 5. seviyede tablo kadar büyü bilir', () => {
    const bard = generateCharacter({ seed: 6, level: 5, classId: 'bard', spells, equipment })
    const [info] = spellcasting(bard)
    expect(bard.spells.known).toHaveLength(info.spellsKnown!)
    expect(bard.spells.cantrips).toHaveLength(info.cantripsKnown!)
  })

  it('büyü yapmayan sınıfta büyü listesi boş kalır', () => {
    const barbarian = generateCharacter({
      seed: 9,
      level: 10,
      classId: 'barbarian',
      spells,
      equipment,
    })
    expect(barbarian.spells.cantrips).toEqual([])
    expect(barbarian.spells.known).toEqual([])
  })

  it('büyü koleksiyonu verilmezse büyüler boş kalır ama karakter üretilir', () => {
    const wizard = generateCharacter({ seed: 2, level: 1, classId: 'wizard' })
    expect(wizard.spells.known).toEqual([])
    expect(wizard.classes[0].classId).toBe('wizard')
  })
})

describe('seçim çakışmaları', () => {
  it('geçmişin verdiği beceri sınıftan tekrar seçilmez', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const character = generateCharacter({ seed, level: 1, spells, equipment })
      const unique = new Set(character.proficiencies.skills)
      expect(unique.size, `tohum ${seed}`).toBe(character.proficiencies.skills.length)
    }
  })

  it('diller tekrarlanmaz', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const character = generateCharacter({ seed, level: 1, spells, equipment })
      const unique = new Set(character.proficiencies.languages)
      expect(unique.size, `tohum ${seed}`).toBe(character.proficiencies.languages.length)
    }
  })

  it('aynı yeteneğe iki kez ırk bonusu verilmez', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const character = generateCharacter({ seed, level: 1 })
      const unique = new Set(character.raceAbilityChoice)
      expect(unique.size).toBe(character.raceAbilityChoice.length)
    }
  })

  it('aynı beceride iki kez uzmanlık alınmaz', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const rogue = generateCharacter({
        seed,
        level: 10,
        classId: 'rogue',
        spells,
        equipment,
      })
      const expertise = rogue.levelChoices
        .filter((c) => c.kind === 'expertise')
        .flatMap((c) => c.proficiencyIds)
      expect(new Set(expertise).size, `tohum ${seed}`).toBe(expertise.length)
    }
  })
})
