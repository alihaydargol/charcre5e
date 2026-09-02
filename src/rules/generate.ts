import {
  backgrounds,
  classes,
  languages,
  races,
  skills,
  traits,
  type Collection,
} from '../data/registry.ts'
import type { AbilityId, Equipment, Spell } from '../data/schema.ts'
import { STANDARD_ARRAY } from './abilities.ts'
import {
  createEmptyCharacter,
  totalLevel,
  type Character,
  type LevelChoice,
} from './character.ts'
import { chooseRandomly, getValidChoices } from './choices.ts'
import { createRng, pick, pickMany, randomSeed, type Rng } from './dice.ts'
import { randomStartingEquipment } from './equipment.ts'
import { decisionsAtLevel } from './progression.ts'
import {
  maxSpellLevelFor,
  spellListClassId,
  spellcasting,
  usesSpellbook,
  wizardSpellbookSize,
} from './spellcasting.ts'

/**
 * Rastgele karakter oluşturma.
 *
 * Amaç (bkz. CLAUDE.md): D&D hiç oynamamış biri tek tuşla **oynanabilir** ve
 * kurallara uygun bir karakter alabilmeli.
 *
 * Bu dosya hiçbir kural mantığı içermez; her karar `getValidChoices` /
 * `chooseRandomly` üzerinden verilir. Bu yüzden üretilen karakter tanım gereği
 * geçerlidir ve kural değişiklikleri buraya yansımak zorunda değildir.
 *
 * Tek istisna: yetenek puanlarının hangi sıraya dağıtılacağı. Bu bir kural
 * değil, **oynanabilirlik tavsiyesidir** — rastgele dağıtılırsa kurallara
 * uygun ama işe yaramaz bir karakter çıkar (INT 15'lik bir Barbarian gibi).
 */

/**
 * Sınıfların yetenek önceliği. Kural değil, masadaki yaygın tavsiye:
 * ilk sıradaki yetenek sınıfın "ana" yeteneğidir.
 */
const ABILITY_PRIORITY: Record<string, AbilityId[]> = {
  barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  cleric: ['wis', 'con', 'str', 'cha', 'int', 'dex'],
  druid: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  fighter: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  paladin: ['str', 'cha', 'con', 'wis', 'int', 'dex'],
  ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  rogue: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
  sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
}

const FALLBACK_PRIORITY: AbilityId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * Homebrew bir sınıfın yetenek önceliği.
 *
 * SRD sınıfları için elle yazılmış tablo var; homebrew sınıflar için sınıfın
 * kendi tanımından türetilir: önce büyü yeteneği, sonra kurtarma atışı
 * yeterlilikleri, sonra CON. Sabit bir sıraya düşmek STR 19'luk bir WIS kasteri
 * üretirdi — kurallara uygun ama oynanamaz.
 */
function derivedPriority(classId: string): AbilityId[] {
  const definition = classes.get(classId)
  if (!definition) return FALLBACK_PRIORITY

  const order: AbilityId[] = []
  const push = (ability: AbilityId) => {
    if (!order.includes(ability)) order.push(ability)
  }

  if (definition.spellcasting) push(definition.spellcasting.ability)
  for (const ability of definition.savingThrows) push(ability)
  push('con')
  for (const ability of FALLBACK_PRIORITY) push(ability)
  return order
}

const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
]

/**
 * İsim üretimi. SRD isim tablosu içermez ve başka kaynaktan kopyalanamaz
 * (telif), bu yüzden heceleri birleştiren nötr bir üretici kullanıyoruz.
 * Kullanıcı beğenmezse değiştirir — isim zaten en kişisel alan.
 */
const NAME_START = ['Bal', 'Dor', 'El', 'Fen', 'Gar', 'Hal', 'Kor', 'Mar', 'Sel', 'Tor', 'Vel', 'Zar']
const NAME_MID = ['a', 'e', 'i', 'o', 'ua', 'ye']
const NAME_END = ['dan', 'rin', 'mir', 'thas', 'wyn', 'gor', 'lith', 'nar', 'ves', 'dros']

export function randomName(rng: Rng): string {
  return `${pick(NAME_START, rng)}${pick(NAME_MID, rng)}${pick(NAME_END, rng)}`
}

export interface GenerateOptions {
  /** Karakterin seviyesi (1-20). */
  level?: number
  /** Belirli bir sınıf istenirse. */
  classId?: string
  /** Belirli bir ırk istenirse. */
  raceId?: string
  /** Verilmezse rastgele bir tohum üretilir ve karaktere yazılır. */
  seed?: number
  /** Verilmezse isim üretilir. */
  name?: string
  /** Büyü seçimi için; yoksa büyüler boş kalır. */
  spells?: Collection<Spell>
  /** Ekipman seçimi için; yoksa envanter boş kalır. */
  equipment?: Map<string, Equipment>
}

/**
 * Tam bir karakter üretir.
 *
 * Aynı tohum aynı karakteri verir; bu hem testi belirlenimci kılar hem de
 * karakterin bağlantı olarak paylaşılmasını mümkün kılar.
 */
export function generateCharacter(options: GenerateOptions = {}): Character {
  const seed = options.seed ?? randomSeed()
  const rng = createRng(seed)
  const level = Math.min(20, Math.max(1, options.level ?? 1))

  const character = createEmptyCharacter(`char_${seed.toString(36)}`)
  character.seed = seed
  character.abilityMethod = 'standard'

  // --- Irk -----------------------------------------------------------------
  character.raceId = options.raceId ?? chooseRandomly(character, { kind: 'race' }, rng)[0]

  const [subraceId] = chooseRandomly(character, { kind: 'subrace' }, rng)
  if (subraceId) character.subraceId = subraceId

  // --- Sınıf ---------------------------------------------------------------
  const classId = options.classId ?? chooseRandomly(character, { kind: 'class' }, rng)[0]
  character.classes = [{ classId, level }]

  // --- Yetenek puanları ----------------------------------------------------
  // Irkın seçmeli bonusu sınıfın önceliğine göre verilir ki bonus boşa gitmesin.
  const priority = ABILITY_PRIORITY[classId] ?? derivedPriority(classId)
  character.abilities = assignStandardArray(priority)

  const bonusChoices = getValidChoices(character, { kind: 'raceAbilityBonus' })
  if (bonusChoices.applicable) {
    const available = bonusChoices.options
      .filter((o) => !o.disabledReason)
      .map((o) => o.id as AbilityId)
    character.raceAbilityChoice = priority
      .filter((a) => available.includes(a))
      .slice(0, bonusChoices.choose)
  }

  // --- Irkın gerektirdiği diğer seçimler -----------------------------------
  const languageChoices = getValidChoices(character, { kind: 'raceLanguages' })
  if (languageChoices.applicable) {
    character.proficiencies.raceLanguages = chooseRandomly(
      character,
      { kind: 'raceLanguages' },
      rng,
    )
  }

  for (const traitId of races.get(character.raceId!)?.traits ?? []) {
    if (!traits.get(traitId)?.proficiencyChoice) continue
    const options = getValidChoices(character, { kind: 'traitProficiency', traitId }).options
    // Havuz becerilerden mi (Half-Elf) aletlerden mi (Dwarf) oluşuyor?
    const isSkillChoice = options.every((o) => skills.has(o.id))
    const target = isSkillChoice
      ? character.proficiencies.raceSkills
      : character.proficiencies.tools

    for (const id of chooseRandomly(character, { kind: 'traitProficiency', traitId }, rng)) {
      if (!target.includes(id)) target.push(id)
    }
  }

  // --- Geçmiş --------------------------------------------------------------
  const [backgroundId] = chooseRandomly(character, { kind: 'background' }, rng)
  if (backgroundId) character.background = { kind: 'srd', id: backgroundId }

  // Geçmişin verdiği ek diller (Acolyte: iki dil).
  const backgroundLanguages = backgrounds.get(backgroundId ?? '')?.languageChoiceCount ?? 0
  if (backgroundLanguages > 0) {
    const known = new Set(character.proficiencies.raceLanguages)
    for (const id of races.get(character.raceId!)?.languages ?? []) known.add(id)
    // Diller registry'den okunur; elle liste tutmak veriyle ayrışırdı.
    const pool = languages.all().map((l) => l.id).filter((id) => !known.has(id))
    for (const id of pickMany(pool, Math.min(backgroundLanguages, pool.length), rng)) {
      character.proficiencies.languages.push(id)
    }
  }

  // --- Sınıf becerileri ----------------------------------------------------
  // Geçmiş seçildikten SONRA seçilmeli; çakışan beceriler engellenmiş olur.
  const skillChoices = getValidChoices(character, { kind: 'classSkills' })
  if (skillChoices.applicable) {
    const fromClass = chooseRandomly(character, { kind: 'classSkills' }, rng)
    for (const id of fromClass) {
      if (!character.proficiencies.skills.includes(id)) character.proficiencies.skills.push(id)
    }
  }

  // --- Seviye kararları ----------------------------------------------------
  for (let l = 1; l <= level; l += 1) {
    for (const decision of decisionsAtLevel(classId, l)) {
      const choice = answerDecision(character, decision, rng, priority)
      if (choice) character.levelChoices.push(choice)
    }
  }
  character.levelChoices.sort((a, b) => a.level - b.level)

  // --- Büyüler -------------------------------------------------------------
  if (options.spells) fillSpells(character, options.spells, rng)

  // --- Ekipman -------------------------------------------------------------
  if (options.equipment) {
    character.equipment = randomStartingEquipment(character, options.equipment, rng).map(
      (entry) => ({ ...entry, equipped: false }),
    )
    equipBest(character, options.equipment)
  }

  // --- Kimlik --------------------------------------------------------------
  character.name = options.name ?? randomName(rng)
  character.notes.alignment = pick(ALIGNMENTS, rng)

  // HP: zar atmak yeni oyuncuyu şaşırtır; ortalama öngörülebilir ve adil.
  character.hp = { method: 'average', rolls: [] }

  return character
}

/** Standart diziyi sınıfın öncelik sırasına dağıtır. */
function assignStandardArray(priority: AbilityId[]): Record<AbilityId, number> {
  const scores = {} as Record<AbilityId, number>
  priority.forEach((ability, index) => {
    scores[ability] = STANDARD_ARRAY[index] ?? 8
  })
  return scores
}

/** Bir seviye kararını rastgele ama işe yarar biçimde cevaplar. */
function answerDecision(
  character: Character,
  decision: ReturnType<typeof decisionsAtLevel>[number],
  rng: Rng,
  priority: AbilityId[],
): LevelChoice | undefined {
  switch (decision.kind) {
    case 'subclass': {
      const [subclassId] = chooseRandomly(
        character,
        { kind: 'subclass', classId: decision.classId },
        rng,
      )
      return subclassId
        ? { kind: 'subclass', classId: decision.classId, level: decision.level, subclassId }
        : undefined
    }

    case 'fightingStyle': {
      const [styleId] = chooseRandomly(
        character,
        { kind: 'fightingStyle', classId: decision.classId, level: decision.level },
        rng,
      )
      return styleId
        ? { kind: 'fightingStyle', classId: decision.classId, level: decision.level, styleId }
        : undefined
    }

    case 'expertise': {
      const proficiencyIds = chooseRandomly(
        character,
        { kind: 'expertise', classId: decision.classId, level: decision.level },
        rng,
      )
      return proficiencyIds.length > 0
        ? { kind: 'expertise', classId: decision.classId, level: decision.level, proficiencyIds }
        : undefined
    }

    case 'asiOrFeat': {
      // Yeni oyuncu için ASI feat'ten daha anlaşılırdır ve SRD'de zaten tek
      // feat var. Puanlar sınıfın ana yeteneğine gider.
      const increases = improveAbilities(character, priority)
      return increases.length > 0
        ? { kind: 'asi', classId: decision.classId, level: decision.level, increases }
        : undefined
    }
  }
}

/**
 * ASI puanlarını dağıtır: önce sınıfın ana yeteneğini 20'ye çıkarmaya çalışır,
 * dolduysa sıradakine geçer. Bu, rastgele dağıtmaktan çok daha oynanabilir bir
 * karakter üretir.
 */
function improveAbilities(
  character: Character,
  priority: AbilityId[],
): { ability: AbilityId; amount: 1 | 2 }[] {
  // Şu anki toplamları, bu karara kadar verilen ASI'lar dahil hesapla.
  const current = new Map<AbilityId, number>()
  for (const ability of priority) current.set(ability, character.abilities[ability])
  for (const choice of character.levelChoices) {
    if (choice.kind !== 'asi') continue
    for (const inc of choice.increases) {
      current.set(inc.ability, (current.get(inc.ability) ?? 0) + inc.amount)
    }
  }
  // Irk bonusları da sayılmalı; abilityScores yerine kaba bir yaklaşım yeterli
  // çünkü tam değer zaten kural motorunda 20 ile sınırlanıyor.
  const race = character.raceId ? races.get(character.raceId) : undefined
  for (const bonus of race?.abilityBonuses ?? []) {
    current.set(bonus.ability, (current.get(bonus.ability) ?? 0) + bonus.bonus)
  }
  for (const ability of character.raceAbilityChoice) {
    current.set(ability, (current.get(ability) ?? 0) + (race?.abilityBonusChoice?.bonus ?? 0))
  }

  const room = (ability: AbilityId) => 20 - (current.get(ability) ?? 0)

  // Ana yeteneği önce 20'ye tamamla: bir Wizard için INT 20, saldırı bonusunu
  // ve save DC'yi doğrudan etkiler. Tam 1 puan kaldıysa +2'yi başka yeteneğe
  // kaydırmak yerine +1/+1 böleriz.
  const [main] = priority
  if (room(main) >= 2) return [{ ability: main, amount: 2 }]
  if (room(main) === 1) {
    const second = priority.slice(1).find((a) => room(a) >= 1)
    return second
      ? [
          { ability: main, amount: 1 as const },
          { ability: second, amount: 1 as const },
        ]
      : [{ ability: main, amount: 1 as const }]
  }

  // Ana yetenek dolduysa sıradaki en yüksek öncelikli yeteneğe geç.
  const next = priority.find((a) => room(a) >= 2)
  if (next) return [{ ability: next, amount: 2 }]

  const singles = priority.filter((a) => room(a) >= 1).slice(0, 2)
  return singles.map((ability) => ({ ability, amount: 1 as const }))
}

/** Büyü bilen sınıflar için cantrip ve büyü seçer. */
function fillSpells(character: Character, spells: Collection<Spell>, rng: Rng): void {
  const [info] = spellcasting(character)
  if (!info) return

  const classLevel = character.classes[0].level
  const forClass = spells.all().filter((s) => s.classes.includes(spellListClassId(info.classId)))
  const maxLevel = maxSpellLevelFor(info.classId, classLevel)

  const cantripCount = info.cantripsKnown ?? 0
  const cantrips = forClass.filter((s) => s.level === 0)
  character.spells.cantrips = pickMany(
    cantrips,
    Math.min(cantripCount, cantrips.length),
    rng,
  ).map((s) => s.id)

  // Wizard'ın defteri seviyeyle büyür; bilen sınıflarda sayı tablodan gelir.
  const knownCount = usesSpellbook(info.classId)
    ? wizardSpellbookSize(classLevel)
    : (info.spellsKnown ?? 0)
  if (knownCount > 0) {
    const leveled = forClass.filter((s) => s.level > 0 && s.level <= maxLevel)
    character.spells.known = pickMany(
      leveled,
      Math.min(knownCount, leveled.length),
      rng,
    ).map((s) => s.id)
  }
}

/**
 * Envanterdeki en iyi zırhı ve silahları kuşandırır.
 *
 * Kuşanmamış bir karakter sayfası yeni oyuncuya "AC 10" gösterir ve neden
 * zırhının işe yaramadığını anlamaz.
 */
function equipBest(character: Character, equipment: Map<string, Equipment>): void {
  let bestArmor: { itemId: string; ac: number } | undefined

  for (const entry of character.equipment) {
    const item = equipment.get(entry.itemId)
    if (!item) continue

    if (item.category === 'weapon') {
      entry.equipped = true
      continue
    }
    if (item.category !== 'armor') continue

    if (item.armorCategory === 'Shield') {
      entry.equipped = true
      continue
    }
    // Kaba bir karşılaştırma: taban AC + DEX izni. Kesin hesap kural
    // motorunda yapılıyor; burada yalnızca hangisini giyeceğimizi seçiyoruz.
    const score = item.armorClass.base + (item.armorClass.dexBonus ? 2 : 0)
    if (!bestArmor || score > bestArmor.ac) bestArmor = { itemId: item.id, ac: score }
  }

  if (bestArmor) {
    const entry = character.equipment.find((e) => e.itemId === bestArmor.itemId)
    if (entry) entry.equipped = true
  }
}

/** Karakterin özeti — arayüzde "ne ürettin?" sorusuna kısa cevap. */
export function describeCharacter(character: Character): string {
  const race = character.raceId ? races.get(character.raceId)?.name : '?'
  const cls = character.classes[0] ? classes.get(character.classes[0].classId)?.name : '?'
  return `${race} ${cls} · ${totalLevel(character)}. seviye`
}
