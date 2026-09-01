import { Link, useNavigate } from 'react-router-dom'
import { classes, races, subraces } from '../data/registry.ts'
import { totalLevel, type Character } from '../rules/character.ts'
import { useCharacterStore } from '../state/characterStore.ts'

const roadmap = [
  { label: 'İskelet ve yayın hattı', done: true },
  { label: 'SRD 5.1 veri katmanı', done: true },
  { label: 'Kural motoru (HP, AC, büyü slotları)', done: true },
  { label: 'Silah/zırh mekanikleri ve ekipman kategorileri', done: true },
  { label: 'Karakter oluşturma sihirbazı', done: true },
  { label: 'Seviye atlama (1-20)', done: false },
  { label: 'Karakter sayfası, yazdırma, JSON aktarımı', done: false },
  { label: 'Rastgele karakter oluşturma', done: false },
  { label: 'Homebrew içerik desteği', done: false },
  { label: 'Görsel tasarım ve arayüz yenilemesi', done: false },
]

export default function HomePage() {
  const saved = useCharacterStore((s) => s.saved)
  const draft = useCharacterStore((s) => s.draft)
  const loadErrors = useCharacterStore((s) => s.loadErrors)
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter)
  const loadForEditing = useCharacterStore((s) => s.loadForEditing)
  const navigate = useNavigate()

  // Taslakta bir şey seçilmişse "yarım kalan iş" olarak gösterilir.
  const hasDraft = Boolean(draft.raceId || draft.classes.length > 0 || draft.name)

  const edit = (id: string) => {
    loadForEditing(id)
    navigate('/olustur')
  }

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
            to="/icerik"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            SRD içeriğine göz at
          </Link>
        </div>
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

      {saved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Kayıtlı karakterler ({saved.length})
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {saved.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onEdit={() => edit(character.id)}
                onDelete={() => {
                  if (confirm(`"${character.name}" silinecek. Emin misin?`)) {
                    deleteCharacter(character.id)
                  }
                }}
              />
            ))}
          </ul>
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

function CharacterCard({
  character,
  onEdit,
  onDelete,
}: {
  character: Character
  onEdit: () => void
  onDelete: () => void
}) {
  const race = character.raceId ? races.get(character.raceId) : undefined
  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{character.name || 'İsimsiz'}</h3>
      <p className="mt-0.5 text-sm text-slate-500">
        {[subrace?.name ?? race?.name, cls?.name].filter(Boolean).join(' ') || 'Tamamlanmamış'}
        {cls && ` · ${totalLevel(character)}. seviye`}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Son düzenleme: {new Date(character.updatedAt).toLocaleDateString('tr-TR')}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Düzenle
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-accent"
        >
          Sil
        </button>
      </div>
    </li>
  )
}
