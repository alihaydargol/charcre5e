import { backgrounds, classes, equipmentCategories } from '../data/registry.ts'
import type { Equipment, EquipmentChoice, EquipmentOption } from '../data/schema.ts'
import type { Character } from './character.ts'
import { abilityScores } from './abilities.ts'
import { pickMany, type Rng } from './dice.ts'

/**
 * Başlangıç ekipmanı ve para.
 *
 * Sınıf ve geçmişin verdiği ekipman seçenekleri özyinelemeli bir yapıdadır:
 * "(a) zincir zırh veya (b) deri zırh, uzun yay ve 20 ok". Bu dosya o yapıyı
 * sihirbazın gösterebileceği düz bir seçenek listesine çevirir.
 */

/** Bir seçeneğin kullanıcıya gösterilecek çözümlenmiş hâli. */
export interface ResolvedOption {
  /** "Chain Mail" ya da "Leather Armor, Longbow, 20× Arrow" gibi. */
  label: string
  /** Seçilirse envantere eklenecek eşyalar. */
  items: { itemId: string; quantity: number }[]
  /**
   * Bu seçenek hâlâ bir alt seçim gerektiriyorsa (ör. "bir martial silah seç"),
   * seçilebilecek eşya id'leri burada durur.
   */
  pendingChoice?: { choose: number; from: string[]; label: string }
}

/**
 * Bir kategoriden seçilebilecek eşyalar. `martial-weapons` gibi kategoriler
 * eşyanın kendi alanlarından türetilebilirdi ama `holy-symbols` türetilemez —
 * bu yüzden hepsi tek bir yerden, kategori tablosundan okunur.
 */
export function itemsInCategory(categoryId: string): string[] {
  return equipmentCategories.get(categoryId)?.items ?? []
}

/** Özyinelemeli seçeneği tek bir düz seçeneğe indirger. */
function resolveOption(option: EquipmentOption, equipment: Map<string, Equipment>): ResolvedOption {
  const nameOf = (id: string) => equipment.get(id)?.name ?? id

  switch (option.kind) {
    case 'item': {
      if (!option.itemId) {
        return { label: option.label ?? 'Belirsiz eşya', items: [] }
      }
      const quantity = option.count ?? 1
      return {
        label: quantity > 1 ? `${quantity}× ${nameOf(option.itemId)}` : nameOf(option.itemId),
        items: [{ itemId: option.itemId, quantity }],
      }
    }

    case 'bundle': {
      const parts = (option.items ?? []).map((item) => resolveOption(item, equipment))
      return {
        label: parts.map((p) => p.label).join(', '),
        items: parts.flatMap((p) => p.items),
        // Paket içindeki ilk çözümlenmemiş seçim yukarı taşınır.
        pendingChoice: parts.find((p) => p.pendingChoice)?.pendingChoice,
      }
    }

    case 'choice': {
      const from = option.fromCategory
        ? itemsInCategory(option.fromCategory)
        : (option.fromOptions ?? [])
            .map((o) => o.itemId)
            .filter((id): id is string => id !== undefined)
      return {
        label: option.label ?? 'Seçim',
        items: [],
        pendingChoice: {
          choose: option.choose ?? 1,
          from,
          label: option.label ?? 'Seçim',
        },
      }
    }
  }
}

/** Bir seçim grubunu (ör. "(a) … veya (b) …") gösterilebilir hâle getirir. */
export function resolveChoice(
  choice: EquipmentChoice,
  equipment: Map<string, Equipment>,
): { desc: string; choose: number; options: ResolvedOption[] } {
  return {
    desc: choice.desc,
    choose: choice.choose,
    options: choice.options.map((option) => resolveOption(option, equipment)),
  }
}

/** Karakterin sınıf ve geçmişinden gelen tüm başlangıç ekipmanı seçimleri. */
export function startingEquipmentChoices(
  character: Character,
  equipment: Map<string, Equipment>,
): { source: string; desc: string; choose: number; options: ResolvedOption[] }[] {
  const groups: { source: string; desc: string; choose: number; options: ResolvedOption[] }[] = []

  const primary = character.classes[0]
  if (primary) {
    const cls = classes.get(primary.classId)
    for (const choice of cls?.startingEquipmentChoices ?? []) {
      groups.push({ source: cls!.name, ...resolveChoice(choice, equipment) })
    }
  }

  if (character.background?.kind === 'srd') {
    const background = backgrounds.get(character.background.id)
    for (const choice of background?.startingEquipmentChoices ?? []) {
      groups.push({ source: background!.name, ...resolveChoice(choice, equipment) })
    }
  }

  return groups
}

/** Seçim gerektirmeden doğrudan verilen eşyalar. */
export function fixedStartingEquipment(
  character: Character,
): { itemId: string; quantity: number }[] {
  const items: { itemId: string; quantity: number }[] = []

  const primary = character.classes[0]
  if (primary) {
    for (const entry of classes.get(primary.classId)?.startingEquipment ?? []) {
      items.push({ itemId: entry.itemId, quantity: entry.count })
    }
  }
  if (character.background?.kind === 'srd') {
    for (const entry of backgrounds.get(character.background.id)?.startingEquipment ?? []) {
      items.push({ itemId: entry.itemId, quantity: entry.count })
    }
  }

  return items
}

/**
 * Başlangıç ekipmanını rastgele seçer (Aşama 9 için).
 * Alt seçim gerektiren seçenekler de çözülür.
 */
export function randomStartingEquipment(
  character: Character,
  equipment: Map<string, Equipment>,
  rng: Rng,
): { itemId: string; quantity: number }[] {
  const chosen = [...fixedStartingEquipment(character)]

  for (const group of startingEquipmentChoices(character, equipment)) {
    const available = group.options.filter((o) => o.items.length > 0 || o.pendingChoice)
    if (available.length === 0) continue

    for (const option of pickMany(available, Math.min(group.choose, available.length), rng)) {
      chosen.push(...option.items)
      if (option.pendingChoice && option.pendingChoice.from.length > 0) {
        const count = Math.min(option.pendingChoice.choose, option.pendingChoice.from.length)
        for (const itemId of pickMany(option.pendingChoice.from, count, rng)) {
          chosen.push({ itemId, quantity: 1 })
        }
      }
    }
  }

  return mergeQuantities(chosen)
}

/** Aynı eşyanın birden çok girişini tek satırda toplar. */
export function mergeQuantities(
  items: { itemId: string; quantity: number }[],
): { itemId: string; quantity: number }[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity)
  }
  return [...totals].map(([itemId, quantity]) => ({ itemId, quantity }))
}

// ---------------------------------------------------------------------------
// Para
// ---------------------------------------------------------------------------

/** Para birimlerinin bakır (cp) cinsinden karşılıkları. */
export const COIN_IN_COPPER = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 } as const
export type Coin = keyof typeof COIN_IN_COPPER

export function toCopper(amount: number, unit: Coin): number {
  return amount * COIN_IN_COPPER[unit]
}

/** Bakır cinsinden tutarı en büyük birimlerden başlayarak böler. */
export function fromCopper(copper: number): Record<Coin, number> {
  let remaining = Math.max(0, Math.floor(copper))
  const result: Record<Coin, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }
  // ep (electrum) nadiren kullanılır; bozuk para verirken atlıyoruz.
  for (const unit of ['pp', 'gp', 'sp', 'cp'] as const) {
    const value = COIN_IN_COPPER[unit]
    result[unit] = Math.floor(remaining / value)
    remaining -= result[unit] * value
  }
  return result
}

/**
 * Geçmişin verdiği başlangıç altını.
 *
 * NOT: SRD 5.1 sınıflara göre "Starting Wealth" tablosunu **içermez** — o tablo
 * Player's Handbook'tadır ve telif nedeniyle buraya kopyalanamaz (bkz.
 * CLAUDE.md). Bu yüzden "altın at, ekipmanı kendin satın al" seçeneği
 * sunulmaz; sınıfın ekipman paketi kullanılır ve kullanıcı isterse altını elle
 * girer.
 */
export function startingGold(character: Character): number {
  if (character.background?.kind === 'srd') {
    return backgrounds.get(character.background.id)?.startingGold ?? 0
  }
  return 0
}

// ---------------------------------------------------------------------------
// Ağırlık ve yük
// ---------------------------------------------------------------------------

export type EncumbranceLevel = 'none' | 'encumbered' | 'heavily-encumbered' | 'overloaded'

export interface CarriedWeight {
  total: number
  capacity: number
  level: EncumbranceLevel
  /** Yük durumunun etkisi; 'none' ise boş. */
  effect: string
}

/**
 * Taşınan toplam ağırlık ve yük durumu.
 *
 * Encumbrance 5e'de isteğe bağlı bir kuraldır; hesabı gösterip kararı masaya
 * bırakıyoruz. Kapasitenin tamamen aşılması ise isteğe bağlı değildir.
 */
export function carriedWeight(
  character: Character,
  equipment: Map<string, Equipment>,
): CarriedWeight {
  const total = character.equipment.reduce((sum, entry) => {
    const weight = equipment.get(entry.itemId)?.weight ?? 0
    return sum + weight * entry.quantity
  }, 0)

  const strength = abilityScores(character).str.total
  const capacity = strength * 15

  let level: EncumbranceLevel = 'none'
  let effect = ''
  if (total > capacity) {
    level = 'overloaded'
    effect = 'Taşıma kapasiteni aştın; hareket edemezsin.'
  } else if (total > strength * 10) {
    level = 'heavily-encumbered'
    effect = 'Ağır yüklü (isteğe bağlı kural): hız 20 ft düşer, atışlarda dezavantaj.'
  } else if (total > strength * 5) {
    level = 'encumbered'
    effect = 'Yüklü (isteğe bağlı kural): hız 10 ft düşer.'
  }

  return { total, capacity, level, effect }
}
