import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { classes, races, subraces } from '../data/registry.ts'
import { totalLevel, type Character } from '../rules/character.ts'
import { useCharacterStore } from '../state/characterStore.ts'
import { storageUsage } from '../state/storage.ts'
import { buildExport, downloadJson, parseImport } from '../state/transfer.ts'
import CharacterCard from '../features/roster/CharacterCard.tsx'

const roadmap = [
  { label: 'İskelet ve yayın hattı', done: true },
  { label: 'SRD 5.1 veri katmanı', done: true },
  { label: 'Kural motoru (HP, AC, büyü slotları)', done: true },
  { label: 'Silah/zırh mekanikleri ve ekipman kategorileri', done: true },
  { label: 'Karakter oluşturma sihirbazı', done: true },
  { label: 'Seviye atlama (1-20)', done: true },
  { label: 'Karakter sayfası, yazdırma, JSON aktarımı', done: true },
  { label: 'Karakter listesi ve depolama yönetimi', done: true },
  { label: 'Mobil uyum, erişilebilirlik, tema', done: false },
  { label: 'Rastgele karakter oluşturma', done: true },
  { label: 'Homebrew içerik desteği', done: true },
  { label: 'Görsel tasarım ve arayüz yenilemesi', done: false },
]

type SortKey = 'updated' | 'name' | 'level'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'updated', label: 'Son düzenlenen' },
  { id: 'name', label: 'İsme göre' },
  { id: 'level', label: 'Seviyeye göre' },
]

/** Karakterin aranabilir metni: isim, ırk ve sınıf. */
function searchText(character: Character): string {
  const race = character.raceId ? races.get(character.raceId)?.name : ''
  const subrace = character.subraceId ? subraces.get(character.subraceId)?.name : ''
  const cls = character.classes[0] ? classes.get(character.classes[0].classId)?.name : ''
  return [character.name, race, subrace, cls].filter(Boolean).join(' ').toLocaleLowerCase('tr')
}

export default function HomePage() {
  const saved = useCharacterStore((s) => s.saved)
  const draft = useCharacterStore((s) => s.draft)
  const loadErrors = useCharacterStore((s) => s.loadErrors)
  const persistenceFailed = useCharacterStore((s) => s.persistenceFailed)
  const importCharacter = useCharacterStore((s) => s.importCharacter)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const fileInput = useRef<HTMLInputElement>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importMessage, setImportMessage] = useState<string>()

  const hasDraft = Boolean(draft.raceId || draft.classes.length > 0 || draft.name)
  const usage = storageUsage()

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const filtered = q ? saved.filter((c) => searchText(c).includes(q)) : saved
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'tr')
      if (sort === 'level') return totalLevel(b) - totalLevel(a)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [saved, query, sort])

  const handleImport = async (file: File) => {
    const { characters, errors } = parseImport(await file.text())
    for (const character of characters) importCharacter(character)
    setImportErrors(errors)
    setImportMessage(
      characters.length > 0 ? `${characters.length} karakter içe aktarıldı.` : undefined,
    )
  }

  const buttonClass =
    'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Karakterlerim</h1>
        <p className="max-w-2xl text-slate-600">
          SRD 5.1 kurallarına göre D&amp;D 5e karakteri oluştur. Tamamen tarayıcıda çalışır:
          hesap gerekmez, karakterlerin kendi cihazında kalır.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/olustur"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {hasDraft ? 'Yarım kalan karaktere devam et' : 'Yeni karakter oluştur'}
          </Link>
          <Link
            to="/rastgele"
            className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            Benim için rastgele oluştur
          </Link>
          <Link to="/icerik" className={buttonClass}>
            SRD içeriğine göz at
          </Link>
          <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
            JSON&apos;dan içe aktar
          </button>
          {saved.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  `charcre5e-karakterler-${new Date().toISOString().slice(0, 10)}.json`,
                  buildExport(saved),
                )
              }
              className={buttonClass}
            >
              Tümünü dışa aktar
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              // Aynı dosyayı ikinci kez seçebilmek için input sıfırlanmalı.
              e.target.value = ''
            }}
          />
        </div>

        {importMessage && (
          <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {importMessage}
          </p>
        )}
        {importErrors.length > 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">İçe aktarılamayan kayıtlar:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {importErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {loadErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Bazı kayıtlar yüklenemedi:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {loadErrors.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {persistenceFailed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Kayıt yazılamadı.</p>
          <p className="mt-1">
            Tarayıcının depolama alanı dolmuş olabilir. Karakterlerini kaybetmemek için
            &ldquo;Tümünü dışa aktar&rdquo; ile yedek al, sonra kullanmadıklarını sil.
          </p>
        </div>
      )}

      {saved.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Kayıtlı karakterler ({saved.length})
            </h2>
            <div className="ml-auto flex flex-wrap gap-2">
              {saved.length > 3 && (
                <label>
                  <span className="sr-only">Karakter ara</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="İsim, ırk veya sınıf ara"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </label>
              )}
              {saved.length > 1 && (
                <label>
                  <span className="sr-only">Sıralama</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              &ldquo;{query}&rdquo; aramasına uyan karakter yok.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </ul>
          )}

          {/* Kota dolmadan önce uyar; sonrasında karakter kaybı olur. */}
          {usage.ratio > 0.6 && (
            <p className="text-xs text-slate-500">
              Tarayıcı depolamasının yaklaşık %{Math.round(usage.ratio * 100)}&apos;i kullanılıyor (
              {Math.round(usage.bytes / 1024)} KB). Yedek almak için &ldquo;Tümünü dışa
              aktar&rdquo;ı kullanabilirsin.
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Yol haritası
        </h2>
        <ul className="mt-4 space-y-2">
          {roadmap.map((step) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={[
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step.done ? 'bg-accent text-white' : 'border border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {step.done ? '✓' : ''}
              </span>
              <span className={step.done ? 'text-slate-900' : 'text-slate-500'}>{step.label}</span>
              <span className="sr-only">{step.done ? '(tamamlandı)' : '(bekliyor)'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
