import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  applyHomebrew,
  backgrounds,
  classes,
  clearAllHomebrew,
  feats,
  loadSpells,
  races,
  subclasses,
  type Collection,
} from '../src/data/registry.ts'
import { getClassLevel } from '../src/data/classLevels.ts'
import { setHomebrewClassLevels } from '../src/data/pendingLevels.ts'
import type { Feature, Spell } from '../src/data/schema.ts'
import { buildClassLevels, buildSpellcasting } from '../src/rules/classTable.ts'
import {
  emptyPack,
  homebrewPackSchema,
  installPack,
  mergePacks,
  packSize,
  parseHomebrewImport,
} from '../src/state/homebrew.ts'
import { abilityScores } from '../src/rules/abilities.ts'
import { createEmptyCharacter } from '../src/rules/character.ts'
import { getValidChoices } from '../src/rules/choices.ts'
import { spellListClassId, spellcasting } from '../src/rules/spellcasting.ts'
import { maxHitPoints } from '../src/rules/hitpoints.ts'
import { generateCharacter } from '../src/rules/generate.ts'
import { pendingDecisions } from '../src/rules/progression.ts'

const race = {
  id: 'hb-aetherborn',
  name: 'Aetherborn',
  source: 'homebrew' as const,
  speed: 30,
  size: 'Medium' as const,
  sizeDesc: '',
  ageDesc: '',
  alignmentDesc: '',
  abilityBonuses: [{ ability: 'cha' as const, bonus: 2 }],
  languages: ['common'],
  languageDesc: '',
  traits: [],
  subraces: [],
}

/** Wizard gibi büyü yapan, d8'lik bir homebrew sınıf. */
function witchHunter() {
  const features: Feature[] = [
    {
      id: 'hb-witch-hunter--av-isareti-0',
      name: 'Av İşareti',
      source: 'homebrew',
      classId: 'hb-witch-hunter',
      level: 1,
      desc: ['Bir yaratığı işaretlersin.'],
    },
  ]

  const cls = {
    id: 'hb-witch-hunter',
    name: 'Witch Hunter',
    source: 'homebrew' as const,
    hitDie: 8,
    savingThrows: ['dex' as const, 'wis' as const],
    proficiencies: ['light-armor', 'simple-weapons'],
    skillChoice: { choose: 2, from: ['perception', 'stealth', 'survival', 'arcana'] },
    proficiencyChoices: [],
    subclasses: [],
    subclassLevel: 3,
    spellcasting: buildSpellcasting('wizard', 'wis'),
    startingEquipment: [],
    startingEquipmentChoices: [],
  }

  const levels = buildClassLevels({
    classId: cls.id,
    spellcastingModelId: 'wizard',
    features,
  })

  return { cls, features, levels }
}

let spells: Collection<Spell>

beforeAll(async () => {
  spells = await loadSpells()
})

afterEach(() => {
  clearAllHomebrew()
  setHomebrewClassLevels([])
})

describe('registry homebrew kurulumu', () => {
  it('homebrew ırk SRD ırklarının yanında görünür', () => {
    const before = races.size
    applyHomebrew('races', [race])
    expect(races.size).toBe(before + 1)
    expect(races.get('hb-aetherborn')?.name).toBe('Aetherborn')
    expect(races.bySource('homebrew')).toHaveLength(1)
    expect(races.bySource('srd').length).toBe(before)
  })

  it('kurulum "sil ve yeniden yaz"dır: listeden çıkan kayıt kalmaz', () => {
    applyHomebrew('races', [race])
    applyHomebrew('races', [])
    expect(races.get('hb-aetherborn')).toBeUndefined()
    expect(races.bySource('srd').length).toBe(races.size)
  })

  it('SRD kaydı homebrew ile ezilemez, silinemez', () => {
    expect(() =>
      applyHomebrew('races', [{ ...race, id: 'elf', source: 'srd' }]),
    ).toThrow()
    expect(races.get('elf')?.source).toBe('srd')
    expect(races.unregister('elf')).toBe(false)
  })

  it('şemaya uymayan kayıt kurulmaz ve öncekiler bozulmaz', () => {
    applyHomebrew('races', [race])
    expect(() => applyHomebrew('races', [{ ...race, id: 'hb-bozuk', speed: -5 }])).toThrow()
    // Hata sonrası eski içerik yerinde durmalı.
    expect(races.get('hb-aetherborn')).toBeDefined()
    expect(races.get('hb-bozuk')).toBeUndefined()
  })

  it('lazy koleksiyon yüklendikten sonra da homebrew alır', () => {
    const spell = {
      id: 'hb-thorn-whip',
      name: 'Thorn Whip',
      source: 'homebrew' as const,
      level: 0,
      school: 'transmutation',
      castingTime: '1 action',
      range: '30 feet',
      components: ['V' as const, 'S' as const, 'M' as const],
      material: 'the stem of a plant with thorns',
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      classes: ['druid'],
      subclasses: [],
      desc: ['Dikenli bir kırbaç yaratırsın.'],
      higherLevel: [],
    }
    applyHomebrew('spells', [spell])
    expect(spells.get('hb-thorn-whip')?.name).toBe('Thorn Whip')
  })
})

describe('homebrew sınıf', () => {
  it('20 satırlık tablo üretilir; PB ve ASI doğru', () => {
    const { levels } = witchHunter()
    expect(levels).toHaveLength(20)
    expect(levels[0].profBonus).toBe(2)
    expect(levels[19].profBonus).toBe(6)

    const asi = levels.filter((l) => l.abilityScoreBonuses > 0).map((l) => l.level)
    expect(asi).toEqual([4, 8, 12, 16, 19])
  })

  it('ek ASI seviyeleri Fighter/Rogue gibi sınıflara eklenebilir', () => {
    const levels = buildClassLevels({ classId: 'x', extraAsiLevels: [6, 14], features: [] })
    expect(levels.filter((l) => l.abilityScoreBonuses > 0).map((l) => l.level)).toEqual([
      4, 6, 8, 12, 14, 16, 19,
    ])
  })

  it('büyü ilerlemesi model sınıftan birebir kopyalanır', () => {
    const { cls, features, levels } = witchHunter()
    applyHomebrew('classes', [cls])
    applyHomebrew('features', features)
    setHomebrewClassLevels(levels)

    for (const level of [1, 5, 11, 20]) {
      expect(getClassLevel('hb-witch-hunter', level)?.spellcasting?.spellSlots).toEqual(
        getClassLevel('wizard', level)?.spellcasting?.spellSlots,
      )
    }
  })

  it('kural motoru homebrew sınıfı SRD sınıfından ayırt etmez', () => {
    const { cls, features, levels } = witchHunter()
    applyHomebrew('classes', [cls])
    applyHomebrew('features', features)
    setHomebrewClassLevels(levels)

    const character = {
      ...createEmptyCharacter('test'),
      classes: [{ classId: 'hb-witch-hunter', level: 5 }],
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 8 },
    }

    // Save DC = 8 + PB(3) + WIS(+3)
    const [info] = spellcasting(character)
    expect(info.saveDC).toBe(14)
    expect(info.spellSlots).toEqual(getClassLevel('wizard', 5)!.spellcasting!.spellSlots)

    // HP: 8 + CON(+2) ilk seviye, sonra 4 × (5 + 2)
    expect(maxHitPoints(character).total).toBe(10 + 4 * 7)
  })

  it('sihirbaz seçenekleri arasında görünür ve kaynağı işaretlenir', () => {
    applyHomebrew('races', [race])
    const { options } = getValidChoices(createEmptyCharacter('test'), { kind: 'race' })
    const option = options.find((o) => o.id === 'hb-aetherborn')
    expect(option?.source).toBe('homebrew')
    expect(options.find((o) => o.id === 'elf')?.source).toBe('srd')
  })

  it('yetenek önceliği sınıf tanımından türetilir', () => {
    const { cls, features, levels } = witchHunter()
    applyHomebrew('classes', [cls])
    applyHomebrew('features', features)
    setHomebrewClassLevels(levels)

    // Büyü yeteneği WIS; sabit bir sıraya düşerse STR 15 çıkardı.
    const character = generateCharacter({
      seed: 3,
      level: 1,
      classId: 'hb-witch-hunter',
      spells,
    })
    expect(abilityScores(character).wis.base).toBe(15)
  })

  it('homebrew kaster model sınıfın büyü listesinden seçer', () => {
    const { cls, features, levels } = witchHunter()
    applyHomebrew('classes', [cls])
    applyHomebrew('features', features)
    setHomebrewClassLevels(levels)

    expect(spellListClassId('hb-witch-hunter')).toBe('wizard')

    const character = generateCharacter({
      seed: 3,
      level: 5,
      classId: 'hb-witch-hunter',
      spells,
    })
    expect(character.spells.cantrips.length).toBeGreaterThan(0)
    expect(character.spells.known.length).toBeGreaterThan(0)
    for (const id of [...character.spells.cantrips, ...character.spells.known]) {
      expect(spells.require(id).classes).toContain('wizard')
    }
  })

  it('SRD sınıfının büyü listesi kendi id’sidir', () => {
    expect(spellListClassId('wizard')).toBe('wizard')
    expect(spellListClassId('bard')).toBe('bard')
  })

  it('rastgele oluşturucu homebrew sınıfla geçerli karakter üretir', () => {
    const { cls, features, levels } = witchHunter()
    applyHomebrew('classes', [cls])
    applyHomebrew('features', features)
    setHomebrewClassLevels(levels)

    const character = generateCharacter({
      seed: 7,
      level: 8,
      classId: 'hb-witch-hunter',
      spells,
    })
    expect(character.classes[0].classId).toBe('hb-witch-hunter')
    expect(pendingDecisions(character)).toEqual([])
    expect(character.proficiencies.skills).toHaveLength(2)
  })
})

describe('paket', () => {
  it('boş paket geçerlidir ve sıfır kayıt içerir', () => {
    const pack = emptyPack()
    expect(packSize(pack)).toBe(0)
    expect(() => homebrewPackSchema.parse(pack)).not.toThrow()
  })

  it('kurulum, paketin tamamını registry’ye yazar', () => {
    const { cls, features, levels } = witchHunter()
    installPack({
      ...emptyPack(),
      races: [race],
      classes: [cls],
      features,
      classLevels: levels,
    })

    expect(races.get('hb-aetherborn')).toBeDefined()
    expect(classes.get('hb-witch-hunter')).toBeDefined()
    expect(getClassLevel('hb-witch-hunter', 20)).toBeDefined()
  })

  it('bozuk paket içe aktarılmaz; hata Türkçe döner', () => {
    expect(parseHomebrewImport('{ bozuk').error).toContain('JSON')
    expect(parseHomebrewImport('{"format":"baska"}').error).toBeDefined()
  })

  it('geçerli paket içe aktarılır', () => {
    const pack = { ...emptyPack(), races: [race] }
    const result = parseHomebrewImport(JSON.stringify(pack))
    expect(result.error).toBeUndefined()
    expect(result.pack?.races).toHaveLength(1)
  })

  it('daha yeni sürümlü paket reddedilir', () => {
    const pack = { ...emptyPack(), version: 99 }
    expect(parseHomebrewImport(JSON.stringify(pack)).error).toContain('sürüm')
  })

  it('birleştirmede aynı id gelen pakette kalır, diğerleri korunur', () => {
    const base = { ...emptyPack(), races: [race], feats: [] }
    const incoming = {
      ...emptyPack(),
      races: [{ ...race, name: 'Aetherborn (v2)' }, { ...race, id: 'hb-baska', name: 'Başka' }],
    }
    const merged = mergePacks(base, incoming)
    expect(merged.races).toHaveLength(2)
    expect(merged.races.find((r) => r.id === 'hb-aetherborn')?.name).toBe('Aetherborn (v2)')
  })
})

describe('kayıt silme', () => {
  it('SRD içeriği homebrew temizliğinden etkilenmez', () => {
    const srdCounts = {
      races: races.bySource('srd').length,
      classes: classes.bySource('srd').length,
      backgrounds: backgrounds.bySource('srd').length,
      feats: feats.bySource('srd').length,
      subclasses: subclasses.bySource('srd').length,
    }

    const { cls, features, levels } = witchHunter()
    installPack({ ...emptyPack(), races: [race], classes: [cls], features, classLevels: levels })
    clearAllHomebrew()

    expect(races.bySource('srd').length).toBe(srdCounts.races)
    expect(classes.bySource('srd').length).toBe(srdCounts.classes)
    expect(backgrounds.bySource('srd').length).toBe(srdCounts.backgrounds)
    expect(feats.bySource('srd').length).toBe(srdCounts.feats)
    expect(subclasses.bySource('srd').length).toBe(srdCounts.subclasses)
    expect(races.bySource('homebrew')).toEqual([])
  })

  it('homebrew seviye satırı silinince SRD tablosu yerinde kalır', () => {
    const { levels } = witchHunter()
    setHomebrewClassLevels(levels)
    setHomebrewClassLevels([])
    expect(getClassLevel('hb-witch-hunter', 1)).toBeUndefined()
    expect(getClassLevel('wizard', 20)?.spellcasting?.spellSlots).toBeDefined()
  })
})
