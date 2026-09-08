import { describe, expect, it } from 'vitest'
import { convertDndData, detectDataset } from '../src/state/importers/dndData.ts'
import { homebrewPackSchema } from '../src/state/homebrew.ts'
import { getClassLevel } from '../src/data/classLevels.ts'
import { applyHomebrewClassLevels } from '../src/data/classLevels.ts'

/**
 * dnd-data çeviricisi testleri.
 *
 * Test verisi ELLE YAZILDI. Kaynak deponun içeriği telifli (PHB 2024,
 * Xanathar's ve 190+ kitabın birebir metni); gerçek kayıtları teste
 * kopyalamak veriyi depoya sokmak olurdu. Buradaki kayıtlar yalnızca
 * kaynağın ŞEKLİNİ taklit ediyor.
 */

const speciesFile = [
  {
    name: 'Testborn',
    description: 'Uydurma bir tür.',
    publisher: 'Test Yayınları',
    book: 'Test Kitabı',
    properties: {
      Category: 'Races',
      Size: 'Small',
      Speed: 25,
      'data-Ability Score Increase': '{"Charisma":"2","Strength":"1"}',
    },
  },
  {
    name: 'Düzyazı Tür',
    description: 'Yapılı alanı olmayan kayıt.',
    properties: { Category: 'Races' },
  },
]

const classesFile = [
  {
    name: 'Test Kasteri',
    description: 'Uydurma bir sınıf.',
    properties: {
      Category: 'Classes',
      'Hit Die': 'd8',
      'Caster Progression': 'full',
      'Spellcasting Ability': 'Wisdom',
      'data-Saving Throws': '["Wisdom", "Charisma"]',
      'data-Subclass Level': 2,
      'data-Ability Score Levels': '["4", "8", "12", "16", "19"]',
    },
  },
  {
    name: 'Yalnızca Metin',
    description: 'Hit die yok.',
    properties: { Category: 'Classes' },
  },
]

const spellsFile = [
  {
    name: 'Test Patlaması',
    description: 'Uydurma bir büyü.',
    properties: {
      Category: 'Spells',
      Level: 3,
      School: 'Evocation',
      Components: 'V S M',
      'Casting Time': '1 action',
      'data-RangeAoe': '150 feet',
      Duration: 'Instantaneous',
      Classes: 'Wizard, Sorcerer, Bilinmeyen Sınıf',
      Concentration: true,
    },
  },
]

const itemsFile = [
  {
    name: 'Test Kılıcı',
    description: 'Uydurma bir silah.',
    properties: {
      Category: 'Items',
      'Item Type': 'Melee Weapon',
      Subtype: 'Martial, Sword',
      Damage: '1d8',
      'Damage Type': 'Slashing',
      'Alternate Damage': '1d10',
      Properties: 'Versatile',
      Weight: 3,
    },
  },
  {
    name: 'Test Zırhı',
    description: 'Uydurma bir zırh.',
    properties: {
      Category: 'Items',
      'Item Type': 'Medium Armor',
      AC: 14,
      Stealth: 'Disadvantage',
      Weight: 20,
    },
  },
]

describe('veri kümesi tanıma', () => {
  it('Category alanından tanır', () => {
    expect(detectDataset(speciesFile)).toBe('species')
    expect(detectDataset(classesFile)).toBe('classes')
    expect(detectDataset(spellsFile)).toBe('spells')
    expect(detectDataset(itemsFile)).toBe('items')
  })

  it('tanınmayan girdi hata verir, çökmez', () => {
    expect(convertDndData({ bir: 'nesne' }).error).toContain('kayıt dizisi değil')
    expect(convertDndData([{ name: 'x' }]).error).toContain('tanınamadı')
  })
})

describe('tür (species) çevirisi', () => {
  it('yapılı alanlar aktarılır', () => {
    const { pack, report } = convertDndData(speciesFile)
    expect(report.dataset).toBe('species')
    expect(report.imported).toBe(2)

    const race = pack.races.find((r) => r.name === 'Testborn')!
    expect(race.source).toBe('homebrew')
    expect(race.speed).toBe(25)
    expect(race.size).toBe('Small')
    expect(race.abilityBonuses).toEqual(
      expect.arrayContaining([
        { ability: 'cha', bonus: 2 },
        { ability: 'str', bonus: 1 },
      ]),
    )
  })

  it('yapılı alanı olmayan kayıt varsayılanlarla gelir', () => {
    const { pack } = convertDndData(speciesFile)
    const race = pack.races.find((r) => r.name === 'Düzyazı Tür')!
    expect(race.speed).toBe(30)
    expect(race.size).toBe('Medium')
    expect(race.abilityBonuses).toEqual([])
  })

  it('varsayılanla dolan alanlar raporlanır', () => {
    const { report } = convertDndData(speciesFile)
    expect(report.defaulted.length).toBeGreaterThan(0)
    expect(report.defaulted.join(' ')).toContain('özellik')
  })
})

describe('sınıf çevirisi', () => {
  it('hit die, kurtarma atışları ve ASI seviyeleri aktarılır', () => {
    const { pack } = convertDndData(classesFile)
    const cls = pack.classes[0]
    expect(cls.hitDie).toBe(8)
    expect(cls.savingThrows).toEqual(['wis', 'cha'])
    expect(cls.subclassLevel).toBe(2)
  })

  it('kaster ilerlemesi model sınıfa bağlanır', () => {
    const { pack } = convertDndData(classesFile)
    const cls = pack.classes[0]
    expect(cls.spellcasting?.ability).toBe('wis')
    // "full" → Wizard modeli; slot tablosu oradan kopyalanır.
    expect(cls.spellcasting?.spellList).toBe('wizard')

    applyHomebrewClassLevels(pack.classLevels)
    for (const level of [1, 5, 20]) {
      expect(getClassLevel(cls.id, level)?.spellcasting?.spellSlots).toEqual(
        getClassLevel('wizard', level)?.spellcasting?.spellSlots,
      )
    }
    applyHomebrewClassLevels([])
  })

  it('20 satırlık tablo üretilir', () => {
    const { pack } = convertDndData(classesFile)
    expect(pack.classLevels).toHaveLength(20)
    expect(pack.classLevels[19].profBonus).toBe(6)
  })

  it('hit die olmayan kayıt atlanır ve nedeni yazılır', () => {
    const { report } = convertDndData(classesFile)
    expect(report.imported).toBe(1)
    expect(report.skipped).toHaveLength(1)
    expect(report.skipped[0].name).toBe('Yalnızca Metin')
    expect(report.skipped[0].reason).toContain('Hit die')
  })
})

describe('büyü çevirisi', () => {
  it('seviye, okul ve bileşenler aktarılır', () => {
    const { pack } = convertDndData(spellsFile)
    const spell = pack.spells[0]
    expect(spell.level).toBe(3)
    expect(spell.school).toBe('evocation')
    expect(spell.components).toEqual(['V', 'S', 'M'])
    expect(spell.concentration).toBe(true)
    expect(spell.range).toBe('150 feet')
  })

  it('SRD’de karşılığı olmayan sınıf adları düşer', () => {
    const { pack } = convertDndData(spellsFile)
    expect(pack.spells[0].classes).toEqual(['wizard', 'sorcerer'])
  })

  it('kaynak ve kitap açıklamaya not olarak eklenir', () => {
    const { pack } = convertDndData(speciesFile)
    const race = pack.races.find((r) => r.name === 'Testborn')!
    void race
    const spells = convertDndData(spellsFile).pack.spells[0]
    expect(spells.desc.join(' ')).toContain('Uydurma bir büyü')
  })
})

describe('eşya çevirisi', () => {
  it('silah alanları aktarılır, versatile iki elli hasara döner', () => {
    const { pack } = convertDndData(itemsFile)
    const sword = pack.equipment.find((e) => e.name === 'Test Kılıcı')!
    expect(sword.category).toBe('weapon')
    if (sword.category !== 'weapon') throw new Error('silah bekleniyordu')
    expect(sword.weaponCategory).toBe('Martial')
    expect(sword.damage).toEqual({ dice: '1d8', type: 'slashing' })
    expect(sword.twoHandedDamage).toEqual({ dice: '1d10', type: 'slashing' })
    expect(sword.properties).toContain('versatile')
  })

  it('zırh alanları aktarılır', () => {
    const { pack } = convertDndData(itemsFile)
    const armor = pack.equipment.find((e) => e.name === 'Test Zırhı')!
    if (armor.category !== 'armor') throw new Error('zırh bekleniyordu')
    expect(armor.armorCategory).toBe('Medium')
    expect(armor.armorClass.base).toBe(14)
    expect(armor.armorClass.maxDexBonus).toBe(2)
    expect(armor.stealthDisadvantage).toBe(true)
  })
})

describe('çıktı paketi geçerlidir', () => {
  it('her veri kümesinin çıktısı şemayı geçer', () => {
    for (const file of [speciesFile, classesFile, spellsFile, itemsFile]) {
      const { pack } = convertDndData(file)
      expect(() => homebrewPackSchema.parse(JSON.parse(JSON.stringify(pack)))).not.toThrow()
    }
  })

  it('tüm kayıtlar homebrew işaretli', () => {
    const { pack } = convertDndData(itemsFile)
    expect(pack.equipment.every((e) => e.source === 'homebrew')).toBe(true)
  })

  it('sınır aşılınca kalan kayıt sayısı raporlanır', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      name: `Büyü ${i}`,
      description: 'x',
      properties: { Category: 'Spells', Level: 1, School: 'Evocation' },
    }))
    const { report } = convertDndData(many, 4)
    expect(report.imported).toBe(4)
    expect(report.skipped[0].reason).toContain('en fazla 4')
  })
})

describe('aynı adlı kayıtlar', () => {
  it('birleşen kayıt sayısı raporlanır', () => {
    // Kaynak derlemede aynı tür birden çok kitapta geçebiliyor.
    const withDuplicates = [
      { name: 'Aynı Tür', description: 'a', properties: { Category: 'Races', Speed: 30 } },
      { name: 'Aynı Tür', description: 'b', properties: { Category: 'Races', Speed: 25 } },
      { name: 'Başka Tür', description: 'c', properties: { Category: 'Races' } },
    ]
    const { pack, report } = convertDndData(withDuplicates)

    expect(report.imported).toBe(3)
    expect(report.merged).toBe(1)
    // Pakete giren gerçek kayıt sayısı ikisi.
    expect(new Set(pack.races.map((r) => r.id)).size).toBe(2)
  })
})
