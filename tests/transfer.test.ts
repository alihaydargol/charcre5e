import { describe, expect, it } from 'vitest'
import { createEmptyCharacter, type Character } from '../src/rules/character.ts'
import { buildExport, parseImport, safeFileName } from '../src/state/transfer.ts'

function sample(overrides: Partial<Character> = {}): Character {
  return {
    ...createEmptyCharacter('c1', '2026-01-01T00:00:00.000Z'),
    name: 'Thorgrim',
    raceId: 'dwarf',
    subraceId: 'hill-dwarf',
    classes: [{ classId: 'barbarian', level: 5 }],
    abilities: { str: 16, dex: 13, con: 15, int: 8, wis: 10, cha: 8 },
    background: { kind: 'srd', id: 'acolyte' },
    ...overrides,
  }
}

describe('dosya adı', () => {
  it('dosya sisteminde sorun çıkaran karakterleri temizler', () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).toBe('abcdefghi')
    expect(safeFileName('   ')).toBe('karakter')
    expect(safeFileName('')).toBe('karakter')
  })

  it('Türkçe harfleri ASCII’ye çevirir', () => {
    // Tarayıcılar download özniteliğinde ASCII dışı görünce dosya adını yok
    // sayıp uzantısız "download" indiriyor.
    expect(safeFileName('Thorgrim Taşyumruk')).toBe('Thorgrim-Tasyumruk')
    expect(safeFileName('Vesper Kılıçgölge')).toBe('Vesper-Kilicgolge')
    expect(safeFileName('ÇĞİÖŞÜ ıçğöşü')).toBe('CGIOSU-icgosu')
  })

  it('geriye ASCII kalmayan isimde varsayılana düşer', () => {
    expect(safeFileName('日本語')).toBe('karakter')
    expect(safeFileName('...')).toBe('karakter')
  })
})

describe('dışa aktarma', () => {
  it('sarmalayıcı biçim ve sürüm bilgisi içerir', () => {
    const file = buildExport([sample()])
    expect(file.format).toBe('charcre5e')
    expect(file.schemaVersion).toBe(1)
    expect(file.characters).toHaveLength(1)
    expect(typeof file.exportedAt).toBe('string')
  })
})

describe('içe aktarma', () => {
  it('dışa aktarılan dosya birebir geri okunur', () => {
    const original = sample()
    const raw = JSON.stringify(buildExport([original]))
    const { characters, errors } = parseImport(raw)

    expect(errors).toEqual([])
    expect(characters).toHaveLength(1)
    expect(characters[0]).toEqual(original)
  })

  it('çoklu karakter dosyası okunur', () => {
    const raw = JSON.stringify(
      buildExport([sample(), sample({ id: 'c2', name: 'Vesper' })]),
    )
    const { characters } = parseImport(raw)
    expect(characters.map((c) => c.name)).toEqual(['Thorgrim', 'Vesper'])
  })

  it('sarmalayıcısız tek karakter de kabul edilir', () => {
    // Kullanıcı hangi biçimi indirdiğini hatırlamak zorunda kalmasın.
    const { characters, errors } = parseImport(JSON.stringify(sample()))
    expect(errors).toEqual([])
    expect(characters[0].name).toBe('Thorgrim')
  })

  it('düz dizi de kabul edilir', () => {
    const { characters } = parseImport(JSON.stringify([sample(), sample({ id: 'c2' })]))
    expect(characters).toHaveLength(2)
  })

  it('bozuk JSON açıklayıcı hata verir', () => {
    const { characters, errors } = parseImport('{ bu json değil')
    expect(characters).toEqual([])
    expect(errors[0]).toMatch(/geçerli bir JSON değil/)
  })

  it('şemaya uymayan kayıt reddedilir ve nedeni yazılır', () => {
    const broken = { ...sample(), classes: [{ classId: 'barbarian', level: 99 }] }
    const { characters, errors } = parseImport(JSON.stringify(broken))
    expect(characters).toEqual([])
    expect(errors[0]).toMatch(/"Thorgrim" okunamadı/)
  })

  it('geçerli ve bozuk kayıtlar birlikteyken geçerliler alınır', () => {
    const raw = JSON.stringify({
      format: 'charcre5e',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      characters: [sample(), { name: 'Bozuk', schemaVersion: 1 }],
    })
    const { characters, errors } = parseImport(raw)

    // Bir kaydın bozuk olması diğerini de kaybettirmemeli.
    expect(characters).toHaveLength(1)
    expect(characters[0].name).toBe('Thorgrim')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/"Bozuk" okunamadı/)
  })

  it('boş dosya sessizce geçmez', () => {
    const { characters, errors } = parseImport(JSON.stringify({ format: 'charcre5e', schemaVersion: 1, exportedAt: '', characters: [] }))
    expect(characters).toEqual([])
    expect(errors[0]).toMatch(/karakter bulunamadı/)
  })
})
