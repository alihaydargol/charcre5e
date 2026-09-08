import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { classes, races, subraces } from '../data/registry.ts'
import { totalLevel, type Character } from '../rules/character.ts'
import { useCharacterStore } from '../state/characterStore.ts'
import { storageUsage } from '../state/storage.ts'
import { buildExport, downloadJson, parseImport } from '../state/transfer.ts'
import CharacterCard from '../features/roster/CharacterCard.tsx'
import { btnPrimary, btnSecondary, card, sectionLabel } from '../components/ui.ts'

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

/**
 * Kayıtlı karakteri olmayan kullanıcıya üç yol.
 *
 * D&D bilmeyen biri "Yeni karakter oluştur" düğmesine basmaya çekinebilir;
 * rastgele oluşturma tam da onun için var ve burada eşit ağırlıkta duruyor.
 */
const STARTING_POINTS = [
  {
    to: '/olustur',
    title: 'Sihirbazla oluştur',
    desc: 'Adım adım ilerle; her adımda ne seçtiğin ve neden önemli olduğu yazar.',
    action: 'Sihirbazı aç',
  },
  {
    to: '/rastgele',
    title: 'Benim için seç',
    desc: 'D&D oynamadıysan buradan başla. Tek tuşla oynanabilir bir karakter çıkar.',
    action: 'Karakter at',
  },
  {
    to: '/icerik',
    title: 'Önce içeriğe bak',
    desc: 'Irklar, sınıflar, 319 büyü ve ekipman tablolarını karakter yapmadan incele.',
    action: 'İçeriğe göz at',
  },
]

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

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        {/* Hiç karakteri olmayana "Karakterlerim" demek boş bir vaat. */}
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {saved.length > 0 ? 'Karakterlerim' : 'D&D 5e karakter oluşturucu'}
        </h1>
        <p className="max-w-2xl text-muted">
          SRD 5.1 kurallarına göre seviye 1&ndash;20 karakter oluştur. Tamamen tarayıcıda
          çalışır: hesap gerekmez, karakterlerin kendi cihazında kalır.
        </p>
        <div className="flex flex-wrap gap-2">
          {/*
            Kayıtlı karakter varken eylemler burada; yokken aşağıdaki kartlar
            aynı işi daha açıklayıcı yapıyor, ikisini birden göstermek tekrardı.
          */}
          {(saved.length > 0 || hasDraft) && (
            <Link to="/olustur" className={btnPrimary}>
              {hasDraft ? 'Yarım kalan karaktere devam et' : 'Yeni karakter oluştur'}
            </Link>
          )}
          {saved.length > 0 && (
            <Link
              to="/rastgele"
              className={`${btnSecondary} border-accent text-accent hover:bg-accent-soft`}
            >
              Rastgele oluştur
            </Link>
          )}
          {saved.length > 0 && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={btnSecondary}
            >
              JSON&apos;dan içe aktar
            </button>
          )}
          {saved.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  `charcre5e-karakterler-${new Date().toISOString().slice(0, 10)}.json`,
                  buildExport(saved),
                )
              }
              className={btnSecondary}
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
          <p role="status" className="rounded-md bg-surface-muted px-3 py-2 text-sm text-good">
            {importMessage}
          </p>
        )}
        {importErrors.length > 0 && (
          <div className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
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
        <div className="rounded-lg border border-warn bg-warn-soft p-4">
          <p className="font-medium text-warn-ink">Bazı kayıtlar yüklenemedi:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-warn-ink">
            {loadErrors.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {persistenceFailed && (
        <div className="rounded-lg border border-warn bg-warn-soft p-4 text-sm text-warn-ink">
          <p className="font-medium">Kayıt yazılamadı.</p>
          <p className="mt-1">
            Tarayıcının depolama alanı dolmuş olabilir. Karakterlerini kaybetmemek için
            &ldquo;Tümünü dışa aktar&rdquo; ile yedek al, sonra kullanmadıklarını sil.
          </p>
        </div>
      )}

      {saved.length === 0 && (
        <section aria-labelledby="baslangic" className="space-y-3">
          <h2 id="baslangic" className={sectionLabel}>
            Nereden başlamalı
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {STARTING_POINTS.map((point) => (
              <li key={point.to}>
                {/*
                  Kartın tamamı bağlantı: küçük bir başlığa nişan almak yerine
                  kartın herhangi bir yerine basmak yetiyor.
                */}
                <Link
                  to={point.to}
                  className={`${card} flex h-full flex-col gap-2 p-5 transition-colors hover:border-accent hover:bg-accent-soft/40`}
                >
                  <span className="font-display text-lg font-semibold text-ink">
                    {point.title}
                  </span>
                  <span className="text-sm text-muted">{point.desc}</span>
                  <span aria-hidden="true" className="mt-auto pt-2 text-sm font-medium text-accent">
                    {point.action} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Daha önce dışa aktardığın bir dosya varsa{' '}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-medium text-accent underline underline-offset-2 hover:no-underline"
            >
              JSON&apos;dan içe aktarabilirsin
            </button>
            .
          </p>
        </section>
      )}

      {saved.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={sectionLabel}>Kayıtlı karakterler ({saved.length})</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              {saved.length > 3 && (
                <label>
                  <span className="sr-only">Karakter ara</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="İsim, ırk veya sınıf ara"
                    className="min-h-8 rounded-md border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-faint"

                  />
                </label>
              )}
              {saved.length > 1 && (
                <label>
                  <span className="sr-only">Sıralama</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink"
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
            <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">
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
            <p className="text-xs text-muted">
              Tarayıcı depolamasının yaklaşık %{Math.round(usage.ratio * 100)}&apos;i kullanılıyor (
              {Math.round(usage.bytes / 1024)} KB). Yedek almak için &ldquo;Tümünü dışa
              aktar&rdquo;ı kullanabilirsin.
            </p>
          )}
        </section>
      )}

    </div>
  )
}
