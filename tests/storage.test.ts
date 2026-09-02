import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyCharacter, SCHEMA_VERSION, type Character } from '../src/rules/character.ts'

/**
 * Depolama katmanı testleri.
 *
 * `storage.ts` localStorage'a doğrudan eriştiği için testte sahte bir
 * localStorage kuruyoruz. Amaç kalıcılığın kendisini değil, **hatalara
 * dayanıklılığını** doğrulamak: kota dolduğunda, veri bozulduğunda ya da
 * localStorage hiç erişilebilir olmadığında uygulama çökmemeli ve durumu
 * kullanıcıya bildirmeli.
 */

class FakeStorage {
  private data = new Map<string, string>()
  /** Kota dolmuş gibi davranmak için. */
  failWrites = false
  /** Erişimin tamamen engellendiği tarayıcıları taklit etmek için. */
  failAll = false

  getItem(key: string): string | null {
    if (this.failAll) throw new Error('erişim engellendi')
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failAll || this.failWrites) throw new Error('kota doldu')
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    if (this.failAll) throw new Error('erişim engellendi')
    this.data.delete(key)
  }

  seed(key: string, value: string): void {
    this.data.set(key, value)
  }

  raw(key: string): string | undefined {
    return this.data.get(key)
  }
}

let fake: FakeStorage

function sample(overrides: Partial<Character> = {}): Character {
  return {
    ...createEmptyCharacter('c1', '2026-01-01T00:00:00.000Z'),
    name: 'Thorgrim',
    raceId: 'dwarf',
    classes: [{ classId: 'barbarian', level: 3 }],
    ...overrides,
  }
}

/** Modül localStorage'ı yükleme anında okuduğu için her testte yeniden alınır. */
async function freshStorage() {
  vi.resetModules()
  return import('../src/state/storage.ts')
}

beforeEach(() => {
  fake = new FakeStorage()
  vi.stubGlobal('localStorage', fake)
})

describe('karakter kaydetme ve okuma', () => {
  it('kaydedilen karakter geri okunur', async () => {
    const { saveCharacters, loadCharacters } = await freshStorage()
    expect(saveCharacters([sample()])).toBe(true)

    const result = loadCharacters()
    expect(result.errors).toEqual([])
    expect(result.characters).toHaveLength(1)
    expect(result.characters[0].name).toBe('Thorgrim')
  })

  it('hiç kayıt yoksa boş liste döner', async () => {
    const { loadCharacters } = await freshStorage()
    expect(loadCharacters()).toEqual({ characters: [], errors: [] })
  })

  it('bozuk JSON açıklayıcı hata verir, çökmez', async () => {
    fake.seed('charcre5e:characters', '{ bozuk')
    const { loadCharacters } = await freshStorage()
    const result = loadCharacters()
    expect(result.characters).toEqual([])
    expect(result.errors[0].message).toMatch(/okunamadı/)
  })

  it('beklenmedik biçim (dizi değil) bildirilir', async () => {
    fake.seed('charcre5e:characters', '{"a":1}')
    const { loadCharacters } = await freshStorage()
    const result = loadCharacters()
    expect(result.characters).toEqual([])
    expect(result.errors[0].message).toMatch(/biçimi beklenmedik/)
  })

  it('bozuk kayıt diğerlerini kaybettirmez ve sessizce yutulmaz', async () => {
    fake.seed(
      'charcre5e:characters',
      JSON.stringify([sample(), { id: 'x', name: 'Bozuk', schemaVersion: 1 }]),
    )
    const { loadCharacters } = await freshStorage()
    const result = loadCharacters()

    expect(result.characters).toHaveLength(1)
    expect(result.characters[0].name).toBe('Thorgrim')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toMatch(/"Bozuk"/)
  })
})

describe('kota ve erişim hataları', () => {
  it('yazma başarısız olursa false döner, hata fırlatmaz', async () => {
    const { saveCharacters, saveDraft } = await freshStorage()
    fake.failWrites = true

    expect(saveCharacters([sample()])).toBe(false)
    expect(saveDraft(sample())).toBe(false)
  })

  it('localStorage hiç erişilemezse okuma çökmez', async () => {
    fake.failAll = true
    const { loadCharacters, loadDraft, storageAvailable } = await freshStorage()

    expect(loadCharacters()).toEqual({ characters: [], errors: [] })
    expect(loadDraft()).toBeUndefined()
    expect(storageAvailable()).toBe(false)
  })

  it('erişim varken storageAvailable true döner ve iz bırakmaz', async () => {
    const { storageAvailable } = await freshStorage()
    expect(storageAvailable()).toBe(true)
    expect(fake.raw('__charcre5e_probe__')).toBeUndefined()
  })
})

describe('taslak', () => {
  it('kaydedilir, okunur ve temizlenir', async () => {
    const { saveDraft, loadDraft, clearDraft } = await freshStorage()
    saveDraft(sample({ name: 'Yarım' }))
    expect(loadDraft()?.name).toBe('Yarım')

    clearDraft()
    expect(loadDraft()).toBeUndefined()
  })

  it('bozuk taslak sessizce yok sayılır', async () => {
    // Taslak yedeklenmemiş bir çalışma kopyası; bozuksa uyarmak yerine
    // temiz başlamak daha az can sıkıcı.
    fake.seed('charcre5e:draft', '{"schemaVersion":1,"id":"x"}')
    const { loadDraft } = await freshStorage()
    expect(loadDraft()).toBeUndefined()
  })
})

describe('şema göçü', () => {
  it('güncel sürümdeki kayıt olduğu gibi geçer', async () => {
    const { migrate } = await freshStorage()
    const record = sample()
    expect(migrate(record)).toEqual(record)
  })

  it('nesne olmayan girdi bozulmadan döner', async () => {
    const { migrate } = await freshStorage()
    expect(migrate(null)).toBeNull()
    expect(migrate('metin')).toBe('metin')
  })

  it('sürüm alanı olmayan kayıt için sonsuz döngüye girmez', async () => {
    // Henüz dönüştürücü yok; eksik sürümlü kayıt olduğu gibi dönmeli.
    const { migrate } = await freshStorage()
    const result = migrate({ name: 'Eski' }) as Record<string, unknown>
    expect(result.name).toBe('Eski')
  })
})

describe('depolama kullanımı', () => {
  it('kayıt yokken sıfır, kayıt varken artar', async () => {
    const { storageUsage, saveCharacters } = await freshStorage()
    expect(storageUsage().bytes).toBe(0)

    saveCharacters([sample(), sample({ id: 'c2' })])
    const usage = storageUsage()
    expect(usage.bytes).toBeGreaterThan(0)
    expect(usage.ratio).toBeGreaterThan(0)
    expect(usage.ratio).toBeLessThan(1)
  })

  it('localStorage erişilemezse sıfır döner', async () => {
    const { storageUsage } = await freshStorage()
    fake.failAll = true
    expect(storageUsage().bytes).toBe(0)
  })
})

describe('şema sürümü', () => {
  it('kayıtlar güncel sürümle yazılır', async () => {
    const { saveCharacters } = await freshStorage()
    saveCharacters([sample()])
    const written = JSON.parse(fake.raw('charcre5e:characters')!)
    expect(written[0].schemaVersion).toBe(SCHEMA_VERSION)
  })
})
