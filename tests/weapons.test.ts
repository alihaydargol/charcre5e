import { beforeAll, describe, expect, it } from 'vitest'
import {
  classes,
  equipmentCategories,
  loadEquipment,
  loadMagicItems,
} from '../src/data/registry.ts'
import type { Armor, Equipment, Weapon } from '../src/data/schema.ts'
import { createEmptyCharacter, type Character } from '../src/rules/character.ts'
import {
  armorPenalties,
  attackAbility,
  characterAttacks,
  isProficientWithArmor,
  isProficientWithWeapon,
  isVersatile,
  martialArtsDie,
  rageDamageBonus,
  requiresTwoHands,
  sneakAttackDice,
  weaponAttack,
} from '../src/rules/weapons.ts'
import {
  carriedWeight,
  fromCopper,
  randomStartingEquipment,
  startingEquipmentChoices,
  startingGold,
  toCopper,
} from '../src/rules/equipment.ts'
import { createRng } from '../src/rules/dice.ts'

let items: Map<string, Equipment>
const weapon = (id: string): Weapon => {
  const item = items.get(id)
  if (item?.category !== 'weapon') throw new Error(`${id} bir silah değil`)
  return item
}
const armor = (id: string): Armor => {
  const item = items.get(id)
  if (item?.category !== 'armor') throw new Error(`${id} bir zırh değil`)
  return item
}

beforeAll(async () => {
  const collection = await loadEquipment()
  items = new Map(collection.all().map((item) => [item.id, item]))
})

function character(overrides: Partial<Character> = {}): Character {
  return { ...createEmptyCharacter('test', '2026-01-01T00:00:00.000Z'), ...overrides }
}

describe('ekipman kategorileri', () => {
  it('39 kategori yüklenir', () => {
    expect(equipmentCategories.size).toBe(39)
  })

  it('başlangıç ekipmanının atıf yaptığı kategoriler çözümlenebilir', () => {
    // Bu kategoriler olmadan sihirbazın ekipman adımı çalışamaz.
    const referenced = [
      'martial-weapons',
      'martial-melee-weapons',
      'simple-weapons',
      'simple-melee-weapons',
      'holy-symbols',
      'arcane-foci',
      'druidic-foci',
      'musical-instruments',
    ]
    for (const id of referenced) {
      const category = equipmentCategories.get(id)
      expect(category, id).toBeDefined()
      expect(category!.items.length, id).toBeGreaterThan(0)
    }
  })

  it('kategori içerikleri gerçek eşyalara işaret eder', () => {
    // Acolyte "bir kutsal sembol" seçer; seçenekler bunlar olmalı.
    expect(equipmentCategories.require('holy-symbols').items).toEqual([
      'amulet',
      'emblem',
      'reliquary',
    ])
    expect(equipmentCategories.require('martial-weapons').items).toHaveLength(23)
  })

  it('kategorilerdeki tüm eşya id’leri ekipman koleksiyonunda vardır', async () => {
    const equipment = await loadEquipment()
    // Sihirli eşya kategorileri de bu tabloda; onları ayıklıyoruz.
    const magic = await loadMagicItems()
    for (const category of equipmentCategories.all()) {
      for (const id of category.items) {
        const exists = equipment.has(id) || magic.has(id) || equipmentCategories.has(id)
        expect(exists, `${category.id} → ${id}`).toBe(true)
      }
    }
  })
})

describe('sihirli eşyalar', () => {
  it('362 SRD sihirli eşyası yüklenir', async () => {
    const magic = await loadMagicItems()
    expect(magic.size).toBe(362)

    const flameTongue = magic.require('flame-tongue')
    expect(flameTongue.rarity).toBe('Rare')
    expect(flameTongue.category).toBe('weapon')
    expect(flameTongue.desc.length).toBeGreaterThan(0)
  })
})

describe('saldırıda kullanılan yetenek', () => {
  const mods = { str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 0 }

  it('yakın dövüş silahı STR kullanır', () => {
    expect(attackAbility(weapon('longsword'), mods).ability).toBe('str')
  })

  it('menzilli silah DEX kullanır', () => {
    expect(attackAbility(weapon('longbow'), mods).ability).toBe('dex')
  })

  it('finesse silah yüksek olanı seçer ve diğerini alternatif sunar', () => {
    // STR +3 > DEX +1 → STR seçilir.
    const strong = attackAbility(weapon('rapier'), mods)
    expect(strong.ability).toBe('str')
    expect(strong.alternatives).toEqual(['dex'])

    // DEX +4 > STR +0 → DEX seçilir.
    const nimble = attackAbility(weapon('rapier'), { ...mods, str: 0, dex: 4 })
    expect(nimble.ability).toBe('dex')
    expect(nimble.alternatives).toEqual(['str'])
  })
})

describe('versatile ve iki elli silahlar', () => {
  it('longsword versatile, greatsword iki elli zorunlu', () => {
    expect(isVersatile(weapon('longsword'))).toBe(true)
    expect(requiresTwoHands(weapon('longsword'))).toBe(false)
    expect(requiresTwoHands(weapon('greatsword'))).toBe(true)
    expect(isVersatile(weapon('greatsword'))).toBe(false)
  })

  it('longsword tek elle 1d8, iki elle 1d10 atar', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })

    const oneHand = weaponAttack(fighter, weapon('longsword'))
    expect(oneHand.damageDice).toBe('1d8')
    expect(oneHand.damageBonus).toBe(3)
    expect(oneHand.damage).toBe('1d8+3')
    expect(oneHand.attackBonus).toBe(3 + 2) // STR +3, PB +2

    const twoHands = weaponAttack(fighter, weapon('longsword'), { twoHanded: true })
    expect(twoHands.damageDice).toBe('1d10')
    expect(twoHands.damage).toBe('1d10+3')
  })

  it('kalkan takılıyken iki elli silah uyarı verir', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const attack = weaponAttack(fighter, weapon('greatsword'), { shieldEquipped: true })
    expect(attack.warnings.join(' ')).toMatch(/kalkanla birlikte kullanılamaz/)
  })

  it('kalkan takılıyken versatile silahın büyük zarı geçersizdir', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const attack = weaponAttack(fighter, weapon('longsword'), {
      twoHanded: true,
      shieldEquipped: true,
    })
    expect(attack.warnings.join(' ')).toMatch(/tek elle tutulur/)
  })

  it('versatile olmayan silahta iki elle tutmak hasarı değiştirmez', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const attack = weaponAttack(fighter, weapon('shortsword'), { twoHanded: true })
    expect(attack.damageDice).toBe('1d6')
    expect(attack.notes.join(' ')).toMatch(/versatile değil/)
  })
})

describe('silah yeterliliği', () => {
  it('Fighter tüm martial silahlarda yeterlidir', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 1 }] })
    expect(isProficientWithWeapon(fighter, weapon('greatsword'))).toBe(true)
    expect(isProficientWithWeapon(fighter, weapon('club'))).toBe(true)
  })

  it('Wizard yalnızca sayılı silahlarda yeterlidir', () => {
    const wizard = character({ classes: [{ classId: 'wizard', level: 1 }] })
    expect(isProficientWithWeapon(wizard, weapon('dagger'))).toBe(true)
    expect(isProficientWithWeapon(wizard, weapon('quarterstaff'))).toBe(true)
    expect(isProficientWithWeapon(wizard, weapon('greatsword'))).toBe(false)
    expect(isProficientWithWeapon(wizard, weapon('longsword'))).toBe(false)
  })

  it('yeterlilik yoksa saldırıya PB eklenmez ve uyarı verilir', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 5 }],
      abilities: { str: 14, dex: 12, con: 14, int: 16, wis: 10, cha: 10 }, // STR +2
    })
    const attack = weaponAttack(wizard, weapon('greatsword'))
    expect(attack.proficient).toBe(false)
    expect(attack.attackBonus).toBe(2) // PB +3 eklenmedi
    expect(attack.warnings.join(' ')).toMatch(/yeterliliğin yok/)
  })
})

describe('Fighting Style etkileri', () => {
  const abilities = { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 }

  it('Archery menzilli saldırıya +2 verir, yakın dövüşe vermez', () => {
    const archer = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities,
      levelChoices: [{ kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'archery' }],
    })
    // DEX +3, PB +2, Archery +2
    expect(weaponAttack(archer, weapon('longbow')).attackBonus).toBe(3 + 2 + 2)
    // Yakın dövüşte Archery yok: STR +3, PB +2
    expect(weaponAttack(archer, weapon('longsword')).attackBonus).toBe(3 + 2)
  })

  it('Dueling tek elli yakın dövüş silahına +2 hasar verir', () => {
    const duelist = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities,
      levelChoices: [{ kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'dueling' }],
    })
    const oneHand = weaponAttack(duelist, weapon('longsword'))
    expect(oneHand.damageBonus).toBe(3 + 2)
    expect(oneHand.damage).toBe('1d8+5')

    // İki elle tutulunca Dueling geçersiz.
    const twoHands = weaponAttack(duelist, weapon('longsword'), { twoHanded: true })
    expect(twoHands.damageBonus).toBe(3)

    // İki elli zorunlu silahta da geçersiz.
    expect(weaponAttack(duelist, weapon('greatsword')).damageBonus).toBe(3)
  })

  it('Great Weapon Fighting iki elli silahta not olarak görünür', () => {
    const brute = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities,
      levelChoices: [
        { kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'great-weapon-fighting' },
      ],
    })
    expect(weaponAttack(brute, weapon('greatsword')).notes.join(' ')).toMatch(/yeniden atılır/)
    expect(weaponAttack(brute, weapon('shortsword')).notes.join(' ')).not.toMatch(/yeniden atılır/)
  })

  it('ikinci el saldırısında modifier hasara eklenmez; TWF stiliyle eklenir', () => {
    const plain = character({ classes: [{ classId: 'fighter', level: 1 }], abilities })
    expect(weaponAttack(plain, weapon('shortsword'), { offHand: true }).damageBonus).toBe(0)

    const twf = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities,
      levelChoices: [
        { kind: 'fightingStyle', classId: 'fighter', level: 1, styleId: 'two-weapon-fighting' },
      ],
    })
    expect(weaponAttack(twf, weapon('shortsword'), { offHand: true }).damageBonus).toBe(3)
  })
})

describe('zırh cezaları', () => {
  it('STR gereksinimi karşılanmazsa hız 10 ft düşer', () => {
    // Chain Mail STR 13 ister.
    const weak = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const penalties = armorPenalties(weak, armor('chain-mail'))
    expect(penalties.speedPenalty).toBe(10)
    expect(penalties.warnings.join(' ')).toMatch(/STR 13 gerekir/)

    const strong = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    expect(armorPenalties(strong, armor('chain-mail')).speedPenalty).toBe(0)
  })

  it('ırk bonusu STR gereksinimini karşılayabilir', () => {
    // Ham STR 11 + Half-Orc +2 = 13, tam yeterli.
    const halfOrc = character({
      raceId: 'half-orc',
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 11, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    expect(armorPenalties(halfOrc, armor('chain-mail')).speedPenalty).toBe(0)
  })

  it('stealth dezavantajı bildirilir', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    expect(armorPenalties(fighter, armor('chain-mail')).stealthDisadvantage).toBe(true)
    expect(armorPenalties(fighter, armor('leather-armor')).stealthDisadvantage).toBe(false)
  })

  it('zırh yeterliliği yoksa uyarı verilir', () => {
    const wizard = character({
      classes: [{ classId: 'wizard', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 16, wis: 10, cha: 10 },
    })
    const penalties = armorPenalties(wizard, armor('chain-mail'))
    expect(penalties.notProficient).toBe(true)
    expect(penalties.warnings.join(' ')).toMatch(/büyü yapamazsın/)

    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    expect(armorPenalties(fighter, armor('chain-mail')).notProficient).toBe(false)
  })

  it('zırh yeterlilikleri sınıfa göre doğrudur', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 1 }] })
    const rogue = character({ classes: [{ classId: 'rogue', level: 1 }] })

    expect(isProficientWithArmor(fighter, armor('chain-mail'))).toBe(true)
    expect(isProficientWithArmor(fighter, armor('shield'))).toBe(true)
    // Rogue yalnızca hafif zırh kullanır.
    expect(isProficientWithArmor(rogue, armor('leather-armor'))).toBe(true)
    expect(isProficientWithArmor(rogue, armor('chain-mail'))).toBe(false)
    expect(isProficientWithArmor(rogue, armor('shield'))).toBe(false)
  })
})

describe('sınıfa özel hasar değerleri veriden okunur', () => {
  it('Sneak Attack seviyeyle ölçeklenir', () => {
    const at = (level: number) =>
      sneakAttackDice(character({ classes: [{ classId: 'rogue', level }] }))
    expect(at(1)).toBe('1d6')
    expect(at(5)).toBe('3d6')
    expect(at(20)).toBe('10d6')
    expect(sneakAttackDice(character({ classes: [{ classId: 'fighter', level: 5 }] }))).toBeUndefined()
  })

  it('Rage hasar bonusu seviyeyle artar', () => {
    const at = (level: number) =>
      rageDamageBonus(character({ classes: [{ classId: 'barbarian', level }] }))
    expect(at(1)).toBe(2)
    expect(at(9)).toBe(3)
    expect(at(16)).toBe(4)
  })

  it('Martial Arts zarı seviyeyle büyür', () => {
    const at = (level: number) =>
      martialArtsDie(character({ classes: [{ classId: 'monk', level }] }))
    expect(at(1)).toBe('1d4')
    expect(at(5)).toBe('1d6')
    expect(at(11)).toBe('1d8')
    expect(at(17)).toBe('1d10')
  })
})

describe('karakterin saldırı listesi', () => {
  it('kuşanılmış silahlardan saldırı üretir ve kalkanı hesaba katar', () => {
    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      equipment: [
        { itemId: 'greatsword', quantity: 1, equipped: true },
        { itemId: 'shield', quantity: 1, equipped: true },
        { itemId: 'backpack', quantity: 1, equipped: false },
      ],
    })
    const attacks = characterAttacks(fighter, items)
    expect(attacks).toHaveLength(1) // sırt çantası silah değil
    expect(attacks[0].name).toBe('Greatsword')
    expect(attacks[0].warnings.join(' ')).toMatch(/kalkanla birlikte kullanılamaz/)
  })
})

describe('SRD kapsam kontrolü', () => {
  it('Fighting Style tanımlı sınıflar SRD ile uyumludur', () => {
    // Fighting Style yalnızca bu üç sınıfta vardır.
    for (const id of ['fighter', 'paladin', 'ranger']) {
      expect(classes.has(id)).toBe(true)
    }
  })
})

describe('başlangıç ekipmanı çözümleme', () => {
  it('Fighter’ın "(a) zincir zırh veya (b) deri zırh, uzun yay, 20 ok" seçeneği çözülür', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 1 }] })
    const groups = startingEquipmentChoices(fighter, items)

    const armorGroup = groups.find((g) => g.desc.includes('chain mail'))
    expect(armorGroup).toBeDefined()
    expect(armorGroup!.options[0].label).toBe('Chain Mail')
    expect(armorGroup!.options[1].label).toBe('Leather Armor, Longbow, 20× Arrow')
    expect(armorGroup!.options[1].items).toEqual([
      { itemId: 'leather-armor', quantity: 1 },
      { itemId: 'longbow', quantity: 1 },
      { itemId: 'arrow', quantity: 20 },
    ])
  })

  it('"bir martial silah seç" kategori üzerinden çözülür', () => {
    const fighter = character({ classes: [{ classId: 'fighter', level: 1 }] })
    const groups = startingEquipmentChoices(fighter, items)

    const weaponGroup = groups.find((g) => g.desc.includes('martial weapon'))
    expect(weaponGroup).toBeDefined()
    const pending = weaponGroup!.options.find((o) => o.pendingChoice)?.pendingChoice
    expect(pending).toBeDefined()
    expect(pending!.from.length).toBeGreaterThan(20)
    expect(pending!.from).toContain('greatsword')
  })

  it('Acolyte’ın kutsal sembol seçimi çözülür — Aşama 4’ü bloke eden boşluktu', () => {
    const acolyte = character({
      classes: [{ classId: 'cleric', level: 1 }],
      background: { kind: 'srd', id: 'acolyte' },
    })
    const groups = startingEquipmentChoices(acolyte, items)

    const symbolGroup = groups.find((g) => g.source === 'Acolyte')
    expect(symbolGroup).toBeDefined()
    const pending = symbolGroup!.options[0].pendingChoice
    expect(pending!.from).toEqual(['amulet', 'emblem', 'reliquary'])
  })

  it('rastgele seçim geçerli eşyalar üretir ve miktarları birleştirir', () => {

    const fighter = character({
      classes: [{ classId: 'fighter', level: 1 }],
      background: { kind: 'srd', id: 'acolyte' },
    })
    const rng = createRng(2026)
    for (let i = 0; i < 20; i += 1) {
      const chosen = randomStartingEquipment(fighter, items, rng)
      expect(chosen.length).toBeGreaterThan(0)
      // Aynı eşya iki satırda görünmemeli.
      expect(new Set(chosen.map((c) => c.itemId)).size).toBe(chosen.length)
      for (const entry of chosen) {
        expect(items.has(entry.itemId), entry.itemId).toBe(true)
        expect(entry.quantity).toBeGreaterThan(0)
      }
    }
  })
})

describe('para ve yük', () => {
  it('para birimi dönüşümü', () => {
    expect(toCopper(1, 'gp')).toBe(100)
    expect(toCopper(1, 'pp')).toBe(1000)
    expect(fromCopper(1234)).toEqual({ pp: 1, gp: 2, ep: 0, sp: 3, cp: 4 })
    expect(fromCopper(0)).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
  })

  it('Acolyte 15 gp ile başlar', () => {
    const acolyte = character({ background: { kind: 'srd', id: 'acolyte' } })
    expect(startingGold(acolyte)).toBe(15)
  })

  it('taşınan ağırlık ve yük seviyeleri', () => {
    // STR 10 → kapasite 150, yüklü eşiği 50, ağır yüklü 100.
    const base = {
      classes: [{ classId: 'fighter', level: 1 }],
      abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    }

    const light = character({
      ...base,
      equipment: [{ itemId: 'dagger', quantity: 1, equipped: true }], // 1 lb
    })
    expect(carriedWeight(light, items).level).toBe('none')

    // Chain Mail 55 lb → yüklü.
    const medium = character({
      ...base,
      equipment: [{ itemId: 'chain-mail', quantity: 1, equipped: true }],
    })
    expect(carriedWeight(medium, items).total).toBe(55)
    expect(carriedWeight(medium, items).level).toBe('encumbered')

    // 3× Chain Mail = 165 lb → kapasite aşıldı.
    const overloaded = character({
      ...base,
      equipment: [{ itemId: 'chain-mail', quantity: 3, equipped: false }],
    })
    expect(carriedWeight(overloaded, items).level).toBe('overloaded')
    expect(carriedWeight(overloaded, items).effect).toMatch(/hareket edemezsin/)
  })
})
