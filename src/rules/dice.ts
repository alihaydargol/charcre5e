/**
 * Tohumlanabilir rastgelelik ve zar atma.
 *
 * Rastgeleliğin tohumlanabilir olması bir tercih değil, gereklilik (bkz.
 * CLAUDE.md): aynı tohum aynı karakteri üretmeli. Bu hem testleri
 * belirlenimci kılar hem de üretilen bir karakterin bağlantı olarak
 * paylaşılmasına imkân verir.
 */

/** Sözde rastgele sayı üreteci: [0, 1) aralığında değer döner. */
export type Rng = () => number

/**
 * mulberry32 — 32 bitlik tohumdan üreyen küçük ve hızlı bir PRNG.
 * Kriptografik değildir; oyun zarı için fazlasıyla yeterlidir.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Metin tohumu 32 bitlik sayıya çevirir (FNV-1a). Paylaşılabilir tohumlar için. */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Tohum verilmezse zamana dayalı bir tohum üretir. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

/** 1..sides arası tek zar. */
export function rollDie(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1
}

/** `count` adet `sides` yüzlü zar atar, tek tek sonuçları döner. */
export function rollDice(count: number, sides: number, rng: Rng): number[] {
  return Array.from({ length: count }, () => rollDie(sides, rng))
}

/**
 * 4d6 at, en düşüğü çıkar. D&D'nin klasik yetenek puanı atma yöntemi.
 * Ayrıntıyı da döner ki arayüz "6, 4, 3, ~2~ → 13" gösterebilsin.
 */
export function roll4d6DropLowest(rng: Rng): { total: number; dice: number[]; dropped: number } {
  const dice = rollDice(4, 6, rng)
  const dropped = Math.min(...dice)
  const total = dice.reduce((sum, d) => sum + d, 0) - dropped
  return { total, dice, dropped }
}

/** Listeden rastgele bir eleman. Boş listede hata verir. */
export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('Boş listeden seçim yapılamaz')
  return items[Math.floor(rng() * items.length)]
}

/** Listeden tekrarsız `count` eleman. İstenen sayı listeden büyükse hata verir. */
export function pickMany<T>(items: readonly T[], count: number, rng: Rng): T[] {
  if (count > items.length) {
    throw new Error(`${items.length} seçenekten ${count} tane seçilemez`)
  }
  // Fisher-Yates; yalnızca gereken kadar karıştırırız.
  const pool = [...items]
  const chosen: T[] = []
  for (let i = 0; i < count; i += 1) {
    const index = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[index]] = [pool[index], pool[i]]
    chosen.push(pool[i])
  }
  return chosen
}

/**
 * "2d6", "1d8", "3d6+2" gibi zar ifadesini çözer.
 * Hasar tablolarındaki değerleri hesaplamak için kullanılır.
 */
export function parseDiceNotation(notation: string): { count: number; sides: number; modifier: number } {
  const match = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(notation.trim())
  if (!match) throw new Error(`Anlaşılmayan zar ifadesi: ${notation}`)
  const [, count, sides, sign, modifier] = match
  return {
    count: Number(count),
    sides: Number(sides),
    modifier: modifier ? Number(modifier) * (sign === '-' ? -1 : 1) : 0,
  }
}

/** Zar ifadesinin ortalama değeri (yukarı yuvarlanmaz; ham ortalama). */
export function averageOf(notation: string): number {
  const { count, sides, modifier } = parseDiceNotation(notation)
  return count * ((sides + 1) / 2) + modifier
}
