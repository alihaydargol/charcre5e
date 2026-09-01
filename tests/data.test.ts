import { describe, expect, it } from 'vitest'
import {
  abilities,
  backgrounds,
  classes,
  conditions,
  damageTypes,
  feats,
  getClassLevel,
  getClassLevelsUpTo,
  languages,
  loadEquipment,
  loadFeatures,
  loadSpells,
  magicSchools,
  proficiencies,
  races,
  skills,
  subclasses,
  subraces,
  traits,
  weaponProperties,
} from '../src/data/registry.ts'

/**
 * Bu testler iki işi yapar:
 *
 * 1. Şema doğrulaması — koleksiyonlar geliştirme modunda zod ile doğrulanarak
 *    yüklendiği için, bozuk bir kayıt bu dosyadaki herhangi bir testi
 *    yükleme anında düşürür.
 * 2. Referans bütünlüğü — bir kaydın işaret ettiği id'lerin gerçekten var
 *    olduğunu kontrol eder. Kopuk referanslar (ör. olmayan bir trait id'si)
 *    sessizce boş ekrana yol açar; burada yakalanır.
 */

describe('SRD veri kapsamı', () => {
  it('SRD 5.1 beklenen kayıt sayılarını içerir', () => {
    expect(abilities.size).toBe(6)
    expect(skills.size).toBe(18)
    expect(languages.size).toBe(16)
    expect(conditions.size).toBe(15)
    expect(damageTypes.size).toBe(13)
    expect(weaponProperties.size).toBe(11)
    expect(magicSchools.size).toBe(8)
    expect(races.size).toBe(9)
    expect(subraces.size).toBe(4)
    expect(classes.size).toBe(12)
    expect(subclasses.size).toBe(12)
  })

  it('SRD kapsamının dar olduğu yerleri belgeler', () => {
    // SRD 5.1 yalnızca tek background ve tek feat içerir. Bu bir eksik değil,
    // lisansın sınırıdır; kalanı homebrew ile karşılanacak (bkz. CLAUDE.md).
    expect(backgrounds.size).toBe(1)
    expect(backgrounds.require('acolyte').name).toBe('Acolyte')
    expect(feats.size).toBe(1)
    expect(feats.require('grappler').name).toBe('Grappler')

    // Her sınıfın tam olarak bir alt sınıfı vardır.
    for (const cls of classes.all()) {
      expect(cls.subclasses).toHaveLength(1)
    }
  })

  it('her kayıt srd kaynaklıdır', () => {
    for (const collection of [races, classes, skills, languages, backgrounds, feats]) {
      expect(collection.bySource('homebrew')).toHaveLength(0)
      expect(collection.bySource('srd')).toHaveLength(collection.size)
    }
  })
})

describe('referans bütünlüğü', () => {
  it('ırklar geçerli dil, özellik ve alt ırk id’lerine işaret eder', () => {
    for (const race of races.all()) {
      for (const id of race.languages) expect(languages.has(id), `dil: ${id}`).toBe(true)
      for (const id of race.traits) expect(traits.has(id), `özellik: ${id}`).toBe(true)
      for (const id of race.subraces) expect(subraces.has(id), `alt ırk: ${id}`).toBe(true)
      for (const id of race.languageChoice?.from ?? []) {
        expect(languages.has(id), `dil seçeneği: ${id}`).toBe(true)
      }
    }
  })

  it('alt ırklar geçerli ırk ve özellik id’lerine işaret eder', () => {
    for (const subrace of subraces.all()) {
      expect(races.has(subrace.raceId), `ırk: ${subrace.raceId}`).toBe(true)
      for (const id of subrace.traits) expect(traits.has(id), `özellik: ${id}`).toBe(true)
    }
  })

  it('sınıflar geçerli beceri, yeterlilik ve alt sınıf id’lerine işaret eder', () => {
    for (const cls of classes.all()) {
      for (const id of cls.skillChoice?.from ?? []) {
        expect(skills.has(id), `${cls.id} beceri seçeneği: ${id}`).toBe(true)
      }
      for (const id of cls.proficiencies) {
        expect(proficiencies.has(id), `${cls.id} yeterlilik: ${id}`).toBe(true)
      }
      for (const id of cls.subclasses) {
        expect(subclasses.has(id), `${cls.id} alt sınıf: ${id}`).toBe(true)
      }
    }
  })

  it('alt sınıflar geçerli sınıf id’lerine işaret eder', () => {
    for (const subclass of subclasses.all()) {
      expect(classes.has(subclass.classId), `sınıf: ${subclass.classId}`).toBe(true)
    }
  })

  it('beceriler geçerli yetenek id’lerine işaret eder', () => {
    for (const skill of skills.all()) {
      expect(abilities.has(skill.ability), `yetenek: ${skill.ability}`).toBe(true)
    }
  })
})

describe('seviye tabloları', () => {
  it('her sınıf için 1-20 arası eksiksiz satır vardır', () => {
    for (const cls of classes.all()) {
      const rows = getClassLevelsUpTo(cls.id, 20)
      expect(rows, cls.id).toHaveLength(20)
      expect(rows.map((r) => r.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    }
  })

  it('proficiency bonus 5e formülüne uyar: 2 + floor((seviye-1)/4)', () => {
    for (const cls of classes.all()) {
      for (const row of getClassLevelsUpTo(cls.id, 20)) {
        expect(row.profBonus, `${cls.id} sv${row.level}`).toBe(2 + Math.floor((row.level - 1) / 4))
      }
    }
  })

  it('ASI seviyeleri doğrudur — Fighter 7, Rogue 6, diğerleri 5 hak', () => {
    const asiLevels = (classId: string) =>
      getClassLevelsUpTo(classId, 20)
        .filter((r) => r.abilityScoreBonuses > 0)
        .map((r) => r.level)

    expect(asiLevels('fighter')).toEqual([4, 6, 8, 12, 14, 16, 19])
    expect(asiLevels('rogue')).toEqual([4, 8, 10, 12, 16, 19])
    for (const cls of classes.all()) {
      if (cls.id === 'fighter' || cls.id === 'rogue') continue
      expect(asiLevels(cls.id), cls.id).toEqual([4, 8, 12, 16, 19])
    }
  })

  it('tam kaster büyü slotları doğrudur', () => {
    // Wizard 5: 4/3/2
    expect(getClassLevel('wizard', 5)?.spellcasting?.spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0])
    // Cleric 20: 4/3/3/3/3/2/2/1/1
    expect(getClassLevel('cleric', 20)?.spellcasting?.spellSlots).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })

  it('yarı kaster büyü slotları doğrudur ve 2. seviyede başlar', () => {
    expect(getClassLevel('paladin', 1)?.spellcasting?.spellSlots).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(getClassLevel('paladin', 2)?.spellcasting?.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
    // Ranger 11: 4/3/3
    expect(getClassLevel('ranger', 11)?.spellcasting?.spellSlots).toEqual([4, 3, 3, 0, 0, 0, 0, 0, 0])
  })

  it('Warlock Pact Magic tam kaster tablosundan farklıdır', () => {
    const warlock5 = getClassLevel('warlock', 5)?.spellcasting?.spellSlots
    const wizard5 = getClassLevel('wizard', 5)?.spellcasting?.spellSlots

    // 5. seviye Warlock: yalnızca 2 adet 3. seviye slot.
    expect(warlock5).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0])
    expect(warlock5).not.toEqual(wizard5)
    expect(classes.require('warlock').spellcasting?.pactMagic).toBe(true)
    expect(classes.require('wizard').spellcasting?.pactMagic).toBe(false)
  })

  it('büyü yapmayan sınıflarda spellcasting alanı yoktur', () => {
    expect(getClassLevel('barbarian', 20)?.spellcasting).toBeUndefined()
    expect(getClassLevel('fighter', 20)?.spellcasting).toBeUndefined()
  })

  it('ölçekleyen sınıf değerleri taşınır', () => {
    // Rogue 5: 3d6 Sneak Attack
    expect(getClassLevel('rogue', 5)?.classSpecific).toMatchObject({
      sneak_attack: { dice_count: 3, dice_value: 6 },
    })
  })

  it('alt sınıf seçim seviyeleri sınıfa göre doğrudur', () => {
    const level = (id: string) => classes.require(id).subclassLevel
    expect(level('cleric')).toBe(1)
    expect(level('sorcerer')).toBe(1)
    expect(level('warlock')).toBe(1)
    expect(level('druid')).toBe(2)
    expect(level('wizard')).toBe(2)
    expect(level('fighter')).toBe(3)
    expect(level('rogue')).toBe(3)
  })
})

describe('lazy koleksiyonlar', () => {
  it('319 SRD büyüsü yüklenir ve şemayı geçer', async () => {
    const spells = await loadSpells()
    expect(spells.size).toBe(319)

    const fireball = spells.require('fireball')
    expect(fireball.level).toBe(3)
    expect(fireball.school).toBe('evocation')
    expect(fireball.classes).toContain('wizard')
    expect(fireball.damage?.atSlotLevel?.['3']).toBe('8d6')

    // Cantrip'ler 0. seviyedir.
    expect(spells.require('fire-bolt').level).toBe(0)
  })

  it('büyüler geçerli sınıf ve okul id’lerine işaret eder', async () => {
    const spells = await loadSpells()
    for (const spell of spells.all()) {
      expect(magicSchools.has(spell.school), `${spell.id} okulu: ${spell.school}`).toBe(true)
      for (const id of spell.classes) {
        expect(classes.has(id), `${spell.id} sınıfı: ${id}`).toBe(true)
      }
    }
  })

  it('ekipman yüklenir; zırh ve silah alanları doğrudur', async () => {
    const equipment = await loadEquipment()
    expect(equipment.size).toBe(237)

    const chainMail = equipment.require('chain-mail')
    expect(chainMail.category).toBe('armor')
    if (chainMail.category !== 'armor') throw new Error('zırh bekleniyordu')
    expect(chainMail.armorClass.base).toBe(16)
    expect(chainMail.armorClass.dexBonus).toBe(false)
    expect(chainMail.strMinimum).toBe(13)
    expect(chainMail.stealthDisadvantage).toBe(true)

    const leather = equipment.require('leather-armor')
    if (leather.category !== 'armor') throw new Error('zırh bekleniyordu')
    expect(leather.armorClass.base).toBe(11)
    expect(leather.armorClass.dexBonus).toBe(true)
    expect(leather.armorClass.maxDexBonus).toBeNull()

    const halfPlate = equipment.require('half-plate-armor')
    if (halfPlate.category !== 'armor') throw new Error('zırh bekleniyordu')
    expect(halfPlate.armorClass.maxDexBonus).toBe(2)

    // Versatile silahlar iki elle tutulunca daha büyük zar atar.
    const longsword = equipment.require('longsword')
    if (longsword.category !== 'weapon') throw new Error('silah bekleniyordu')
    expect(longsword.damage?.dice).toBe('1d8')
    expect(longsword.twoHandedDamage?.dice).toBe('1d10')
    expect(longsword.properties).toContain('versatile')

    const longbow = equipment.require('longbow')
    if (longbow.category !== 'weapon') throw new Error('silah bekleniyordu')
    expect(longbow.weaponCategory).toBe('Martial')
    expect(longbow.weaponRange).toBe('Ranged')
    expect(longbow.damage?.dice).toBe('1d8')
    expect(longbow.properties).toContain('two-handed')
  })

  it('versatile özellikli her silahın iki elle hasarı vardır', async () => {
    const equipment = await loadEquipment()
    const versatile = equipment
      .all()
      .filter((i) => i.category === 'weapon' && i.properties.includes('versatile'))

    // SRD'de altı versatile silah vardır; hiçbiri iki elle hasarsız kalmamalı.
    expect(versatile).toHaveLength(6)
    for (const weapon of versatile) {
      if (weapon.category !== 'weapon') continue
      expect(weapon.twoHandedDamage, weapon.name).toBeDefined()
    }
  })

  it('sınıf özellikleri yüklenir ve geçerli sınıflara işaret eder', async () => {
    const features = await loadFeatures()
    expect(features.size).toBe(407)
    for (const feature of features.all()) {
      expect(classes.has(feature.classId), `${feature.id} sınıfı`).toBe(true)
      if (feature.subclassId) {
        expect(subclasses.has(feature.subclassId), `${feature.id} alt sınıfı`).toBe(true)
      }
    }
  })

  it('seviye tablosundaki özellik id’leri gerçekten vardır', async () => {
    const features = await loadFeatures()
    for (const cls of classes.all()) {
      for (const row of getClassLevelsUpTo(cls.id, 20)) {
        for (const id of row.features) {
          expect(features.has(id), `${cls.id} sv${row.level} özelliği: ${id}`).toBe(true)
        }
      }
    }
  })
})

describe('homebrew kaydı', () => {
  it('homebrew ırk eklenip kaldırılabilir', () => {
    const before = races.size
    races.register([
      {
        id: 'test-irk',
        name: 'Test Irkı',
        source: 'homebrew',
        speed: 30,
        size: 'Medium',
        sizeDesc: 'Orta boy.',
        ageDesc: 'Uzun yaşar.',
        alignmentDesc: 'Genelde tarafsız.',
        abilityBonuses: [{ ability: 'str', bonus: 2 }],
        languages: ['common'],
        languageDesc: 'Common konuşur.',
        traits: [],
        subraces: [],
      },
    ])

    expect(races.size).toBe(before + 1)
    expect(races.require('test-irk').source).toBe('homebrew')
    expect(races.bySource('homebrew')).toHaveLength(1)

    expect(races.unregister('test-irk')).toBe(true)
    expect(races.size).toBe(before)
  })

  it('geçersiz homebrew kaydı reddedilir', () => {
    expect(() =>
      races.register([{ id: 'bozuk', name: 'Bozuk', source: 'homebrew', speed: -5 }]),
    ).toThrow(/şemaya uymuyor/)
    expect(races.has('bozuk')).toBe(false)
  })

  it('srd kaydı olarak eklemeye çalışmak reddedilir', () => {
    expect(() =>
      races.register([
        {
          id: 'sahte-srd',
          name: 'Sahte',
          source: 'srd',
          speed: 30,
          size: 'Medium',
          sizeDesc: '',
          ageDesc: '',
          alignmentDesc: '',
          abilityBonuses: [],
          languages: [],
          languageDesc: '',
          traits: [],
          subraces: [],
        },
      ]),
    ).toThrow(/Yalnızca homebrew/)
  })

  it('srd kayıtları silinemez', () => {
    expect(races.unregister('dwarf')).toBe(false)
    expect(races.has('dwarf')).toBe(true)
  })
})

describe('registry erişimi', () => {
  it('require olmayan id için açıklayıcı hata verir', () => {
    expect(() => classes.require('paladin-of-nothing')).toThrow(/Sınıf bulunamadı/)
  })

  it('all() isme göre sıralı döner', () => {
    const names = classes.all().map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'tr')))
  })
})
