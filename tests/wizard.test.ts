import { describe, expect, it } from 'vitest'
import { createEmptyCharacter, type Character } from '../src/rules/character.ts'
import {
  applicableSteps,
  isCharacterComplete,
  validateStep,
} from '../src/features/wizard/steps.ts'

function character(overrides: Partial<Character> = {}): Character {
  return { ...createEmptyCharacter('test', '2026-01-01T00:00:00.000Z'), ...overrides }
}

/** Adımları geçebilecek eksiksiz bir Hill Dwarf Barbarian. */
function completeBarbarian(): Character {
  return character({
    name: 'Thorgrim',
    raceId: 'dwarf',
    subraceId: 'hill-dwarf',
    classes: [{ classId: 'barbarian', level: 1 }],
    abilities: { str: 15, dex: 13, con: 13, int: 8, wis: 8, cha: 8 },
    background: { kind: 'srd', id: 'acolyte' },
    proficiencies: {
      skills: ['athletics', 'survival'],
      tools: ['smiths-tools'],
      languages: [],
    },
  })
}

describe('adım listesi', () => {
  it('büyü yapmayan sınıfta büyü adımı listede olmaz', () => {
    const barbarian = character({ classes: [{ classId: 'barbarian', level: 1 }] })
    expect(applicableSteps(barbarian).map((s) => s.id)).not.toContain('spells')
  })

  it('büyü yapan sınıfta büyü adımı belirir', () => {
    const wizard = character({ classes: [{ classId: 'wizard', level: 1 }] })
    expect(applicableSteps(wizard).map((s) => s.id)).toContain('spells')
  })

  it('Paladin 1. seviyede büyü adımı yok, 2. seviyede var', () => {
    const abilities = { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 }
    expect(
      applicableSteps(character({ classes: [{ classId: 'paladin', level: 1 }], abilities })).map(
        (s) => s.id,
      ),
    ).not.toContain('spells')
    expect(
      applicableSteps(character({ classes: [{ classId: 'paladin', level: 2 }], abilities })).map(
        (s) => s.id,
      ),
    ).toContain('spells')
  })
})

describe('ırk adımı', () => {
  it('ırk seçilmeden tamamlanmaz', () => {
    const status = validateStep(character(), 'race')
    expect(status.complete).toBe(false)
    expect(status.issues[0]).toBe('Bir ırk seç.')
  })

  it('alt ırkı olan ırkta alt ırk zorunludur', () => {
    const status = validateStep(character({ raceId: 'dwarf' }), 'race')
    expect(status.complete).toBe(false)
    expect(status.issues.join(' ')).toMatch(/alt ırk seç/)
  })

  it('alt ırkı olmayan ırkta alt ırk istenmez', () => {
    // Human'ın SRD'de alt ırkı yok — ama ek dil seçimi var, o ayrı bir eksik.
    const status = validateStep(character({ raceId: 'human' }), 'race')
    expect(status.issues.join(' ')).not.toMatch(/alt ırk/)
    expect(status.issues.join(' ')).toMatch(/1 ek dil seçmelisin/)

    const withLanguage = validateStep(
      character({
        raceId: 'human',
        proficiencies: { skills: [], tools: [], languages: ['dwarvish'] },
      }),
      'race',
    )
    expect(withLanguage.complete).toBe(true)
  })

  it('trait yeterlilik seçimi eksikse somut sayıyla bildirilir', () => {
    const status = validateStep(character({ raceId: 'dwarf', subraceId: 'hill-dwarf' }), 'race')
    expect(status.complete).toBe(false)
    expect(status.issues.join(' ')).toMatch(/Tool Proficiency: 1 seçim yapmalısın, 0 yaptın/)
  })

  it('trait seçimi yapılınca tamamlanır', () => {
    const status = validateStep(
      character({
        raceId: 'dwarf',
        subraceId: 'hill-dwarf',
        proficiencies: { skills: [], tools: ['smiths-tools'], languages: [] },
      }),
      'race',
    )
    expect(status.complete).toBe(true)
  })

  it('Half-Elf’in yetenek bonusu ve dil seçimi zorunludur', () => {
    const partial = validateStep(character({ raceId: 'half-elf' }), 'race')
    expect(partial.complete).toBe(false)
    expect(partial.issues.join(' ')).toMatch(/2 yeteneğe \+1 dağıtmalısın, 0 seçtin/)
    expect(partial.issues.join(' ')).toMatch(/1 ek dil seçmelisin, 0 seçtin/)

    const done = validateStep(
      character({
        raceId: 'half-elf',
        raceAbilityChoice: ['dex', 'con'],
        proficiencies: { skills: ['stealth', 'perception'], tools: [], languages: ['dwarvish'] },
      }),
      'race',
    )
    expect(done.complete).toBe(true)
  })

  it('aynı yeteneğe iki kez bonus verilemez', () => {
    const status = validateStep(
      character({
        raceId: 'half-elf',
        raceAbilityChoice: ['dex', 'dex'],
        proficiencies: { skills: ['stealth', 'perception'], tools: [], languages: ['dwarvish'] },
      }),
      'race',
    )
    expect(status.issues.join(' ')).toMatch(/iki kez seçemezsin/)
  })
})

describe('yetenek adımı', () => {
  it('point-buy bütçesi aşılırsa engellenir', () => {
    const status = validateStep(
      character({ abilities: { str: 15, dex: 15, con: 15, int: 12, wis: 8, cha: 8 } }),
      'abilities',
    )
    expect(status.complete).toBe(false)
    expect(status.issues.join(' ')).toMatch(/bütçe/)
  })

  it('artan puan ENGELLEMEZ, yalnızca uyarır', () => {
    // Kullanılmamış puan geçersiz bir karakter yaratmaz, sadece dezavantajlıdır.
    const status = validateStep(
      character({ abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } }),
      'abilities',
    )
    expect(status.complete).toBe(true)
    expect(status.issues).toHaveLength(0)
    expect(status.warnings.join(' ')).toMatch(/27 puanın kullanılmadı/)
  })

  it('point-buy aralığı dışındaki puan engellenir', () => {
    const status = validateStep(
      character({ abilities: { str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } }),
      'abilities',
    )
    expect(status.complete).toBe(false)
    expect(status.issues.join(' ')).toMatch(/STR/)
  })

  it('elle girme yönteminde 1-20 aralığı zorunludur', () => {
    const tooHigh = validateStep(
      character({
        abilityMethod: 'manual',
        abilities: { str: 25, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      }),
      'abilities',
    )
    expect(tooHigh.complete).toBe(false)

    const fine = validateStep(
      character({
        abilityMethod: 'manual',
        abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      }),
      'abilities',
    )
    expect(fine.complete).toBe(true)
  })
})

describe('geçmiş adımı', () => {
  it('geçmiş seçilmeden tamamlanmaz', () => {
    expect(validateStep(character(), 'background').complete).toBe(false)
  })

  it('SRD geçmişi yeterlidir', () => {
    expect(
      validateStep(character({ background: { kind: 'srd', id: 'acolyte' } }), 'background')
        .complete,
    ).toBe(true)
  })

  it('özel geçmiş isim ve en az bir beceri ister', () => {
    const empty = validateStep(
      character({
        background: {
          kind: 'custom',
          value: {
            name: '',
            featureName: '',
            featureDesc: '',
            skillIds: [],
            toolIds: [],
            languageCount: 0,
          },
        },
      }),
      'background',
    )
    expect(empty.complete).toBe(false)
    expect(empty.issues).toHaveLength(2)

    const filled = validateStep(
      character({
        background: {
          kind: 'custom',
          value: {
            name: 'Şehir Muhafızı',
            featureName: 'Kapı Ağzı',
            featureDesc: 'Nöbetçilerle konuşabilirsin.',
            skillIds: ['athletics'],
            toolIds: [],
            languageCount: 1,
          },
        },
      }),
      'background',
    )
    expect(filled.complete).toBe(true)
  })
})

describe('beceri adımı', () => {
  it('eksik beceri sayısı somut olarak bildirilir', () => {
    const status = validateStep(
      character({
        classes: [{ classId: 'barbarian', level: 1 }],
        proficiencies: { skills: ['athletics'], tools: [], languages: [] },
      }),
      'proficiencies',
    )
    expect(status.complete).toBe(false)
    expect(status.issues[0]).toBe('2 beceri seçmelisin, 1 seçtin.')
  })

  it('geçmişten gelen beceriyi sınıftan tekrar seçmek engellenir', () => {
    // Acolyte Insight verir; Cleric listesinde de Insight var.
    const status = validateStep(
      character({
        classes: [{ classId: 'cleric', level: 1 }],
        background: { kind: 'srd', id: 'acolyte' },
        proficiencies: { skills: ['insight', 'medicine'], tools: [], languages: [] },
      }),
      'proficiencies',
    )
    expect(status.complete).toBe(false)
    expect(status.issues.join(' ')).toMatch(/zaten sahip olduğun/i)
  })
})

describe('büyü adımı', () => {
  it('Wizard 3 cantrip ve 6 defter büyüsü ister', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 1 }],
      abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    })
    const empty = validateStep(wizard, 'spells')
    expect(empty.complete).toBe(false)
    expect(empty.issues.join(' ')).toMatch(/3 cantrip seçmelisin, 0 seçtin/)
    expect(empty.issues.join(' ')).toMatch(/6 büyü yazmalısın, 0 yazdın/)

    const filled = validateStep(
      {
        ...wizard,
        spells: {
          cantrips: ['fire-bolt', 'mage-hand', 'prestidigitation'],
          known: [
            'magic-missile',
            'shield',
            'burning-hands',
            'detect-magic',
            'mage-armor',
            'sleep',
          ],
          prepared: [],
        },
      },
      'spells',
    )
    expect(filled.complete).toBe(true)
  })

  it('hazırlayan sınıf (Cleric) büyü seçmek zorunda değildir', () => {
    const cleric = character({
      classes: [{ classId: 'cleric', level: 1 }],
      abilities: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      spells: { cantrips: ['guidance', 'light', 'sacred-flame'], known: [], prepared: [] },
    })
    expect(validateStep(cleric, 'spells').complete).toBe(true)
  })

  it('büyü yapmayan sınıfta adım her zaman geçerlidir', () => {
    const barbarian = character({ classes: [{ classId: 'barbarian', level: 1 }] })
    expect(validateStep(barbarian, 'spells').complete).toBe(true)
  })
})

describe('ekipman ve detaylar', () => {
  it('ekipman adımı hiçbir zaman engellemez', () => {
    expect(validateStep(character(), 'equipment').complete).toBe(true)
  })

  it('isim zorunludur', () => {
    expect(validateStep(character(), 'details').complete).toBe(false)
    expect(validateStep(character({ name: 'Thorgrim' }), 'details').complete).toBe(true)
    // Sadece boşluk isim sayılmaz.
    expect(validateStep(character({ name: '   ' }), 'details').complete).toBe(false)
  })
})

describe('karakter bütünlüğü', () => {
  it('eksiksiz karakter kaydedilmeye hazırdır', () => {
    const { ready, issues } = isCharacterComplete(completeBarbarian())
    expect(issues).toEqual([])
    expect(ready).toBe(true)
  })

  it('eksikler adım adıyla birlikte raporlanır', () => {
    const { ready, issues } = isCharacterComplete(character())
    expect(ready).toBe(false)
    expect(issues.some((i) => i.startsWith('Irk:'))).toBe(true)
    expect(issues.some((i) => i.startsWith('Sınıf:'))).toBe(true)
    expect(issues.some((i) => i.startsWith('Detaylar:'))).toBe(true)
  })

  it('büyü yapmayan karakterde büyü eksiği raporlanmaz', () => {
    const { issues } = isCharacterComplete(character({ classes: [{ classId: 'barbarian', level: 1 }] }))
    expect(issues.some((i) => i.startsWith('Büyüler:'))).toBe(false)
  })

  it('artan point-buy puanı kaydetmeyi engellemez', () => {
    const frugal = { ...completeBarbarian() }
    frugal.abilities = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
    expect(isCharacterComplete(frugal).ready).toBe(true)
  })
})
