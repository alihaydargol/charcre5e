import { useEffect, useRef, useState } from 'react'
import { loadEquipment, loadSpells } from '../../data/registry.ts'
import type {
  Background,
  CharacterClass,
  Equipment,
  Feat,
  Race,
  Spell,
  Subclass,
} from '../../data/schema.ts'
import { downloadJson, safeFileName } from '../../state/transfer.ts'
import { parseHomebrewImport, packSize, type HomebrewPack } from '../../state/homebrew.ts'
import { useHomebrewStore } from '../../state/homebrewStore.ts'
import BackgroundEditor from './BackgroundEditor.tsx'
import ClassEditor from './ClassEditor.tsx'
import EquipmentEditor from './EquipmentEditor.tsx'
import FeatEditor from './FeatEditor.tsx'
import RaceEditor from './RaceEditor.tsx'
import SpellEditor from './SpellEditor.tsx'
import SubclassEditor from './SubclassEditor.tsx'
import { traitIdPrefix } from './text.ts'

/**
 * Homebrew içerik yönetimi.
 *
 * Bu sayfa kural motoruna hiç dokunmaz — kayıtlar SRD kayıtlarıyla aynı şemayı
 * kullanır ve registry üzerinden kurulur (bkz. CLAUDE.md §3). Sihirbaz,
 * rastgele oluşturucu ve karakter sayfası burada tanımlanan içeriği
 * kendiliğinden görür; hiçbiri "homebrew" diye ayrı bir yol izlemez.
 */

type Tab = 'races' | 'classes' | 'subclasses' | 'backgrounds' | 'feats' | 'spells' | 'equipment'

const TABS: { id: Tab; label: string; singular: string }[] = [
  { id: 'races', label: 'Irklar', singular: 'ırk' },
  { id: 'classes', label: 'Sınıflar', singular: 'sınıf' },
  { id: 'subclasses', label: 'Alt sınıflar', singular: 'alt sınıf' },
  { id: 'backgrounds', label: 'Geçmişler', singular: 'geçmiş' },
  { id: 'feats', label: "Feat'ler", singular: 'feat' },
  { id: 'spells', label: 'Büyüler', singular: 'büyü' },
  { id: 'equipment', label: 'Eşyalar', singular: 'eşya' },
]

export default function HomebrewPage() {
  const pack = useHomebrewStore((s) => s.pack)
  const error = useHomebrewStore((s) => s.error)
  const persistenceFailed = useHomebrewStore((s) => s.persistenceFailed)
  const commit = useHomebrewStore((s) => s.commit)
  const upsert = useHomebrewStore((s) => s.upsert)
  const remove = useHomebrewStore((s) => s.remove)
  const merge = useHomebrewStore((s) => s.merge)

  const [tab, setTab] = useState<Tab>('races')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)

  // Büyü ve eşya düzenleyicileri lazy koleksiyonlara yazar; kurulumun
  // görünür olması için koleksiyonların yüklenmiş olması gerekir.
  useEffect(() => {
    void Promise.all([loadSpells(), loadEquipment()])
  }, [])

  const closeEditor = () => {
    setEditingId(null)
    setCreating(false)
  }

  const records = pack[tab] as { id: string; name: string }[]
  const editing = editingId ? records.find((r) => r.id === editingId) : undefined
  const showEditor = creating || Boolean(editing)

  const importPack = async (file: File) => {
    const { pack: incoming, error: parseError } = parseHomebrewImport(await file.text())
    if (parseError || !incoming) {
      setImportError(parseError ?? 'Paket okunamadı.')
      return
    }
    setImportError(undefined)
    merge(incoming)
  }

  const buttonClass =
    'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Homebrew içerik</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Kendi ırk, sınıf, alt sınıf, geçmiş, feat, büyü ve eşyanı tanımla. Burada
          tanımladıkların sihirbazda, seviye atlamada ve rastgele oluşturmada SRD içeriğiyle
          birlikte görünür. Her şey senin tarayıcında durur; paylaşmak için dışa aktar.
        </p>
        <p className="max-w-3xl text-xs text-slate-400">
          Bu araç SRD 5.1 dışındaki resmî içeriği (PHB, Xanathar&apos;s, Tasha&apos;s)
          barındırmaz. Kendi masanda ne kullandığın senin tercihin; depoya konulan içerik
          SRD ile sınırlıdır.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-accent bg-accent-soft p-3 text-sm text-accent">
          {error}
        </p>
      )}
      {persistenceFailed && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Homebrew içerik tarayıcıya kaydedilemedi (depolama dolu ya da erişim engelli).
          Kaybetmemek için dışa aktar.
        </p>
      )}

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() =>
            downloadJson(`${safeFileName(pack.name || 'homebrew')}.json`, pack as unknown)
          }
          disabled={packSize(pack) === 0}
          className={buttonClass + ' disabled:opacity-40'}
        >
          Paketi dışa aktar ({packSize(pack)} kayıt)
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
          Paket içe aktar
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importPack(file)
            e.target.value = ''
          }}
        />
        {importError && (
          <span role="alert" className="text-sm text-accent">
            {importError}
          </span>
        )}
      </section>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((entry) => {
          const count = (pack[entry.id] as unknown[]).length
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setTab(entry.id)
                closeEditor()
              }}
              className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                tab === entry.id
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {entry.label}
              {count > 0 && <span className="ml-1.5 text-xs text-slate-400">{count}</span>}
            </button>
          )
        })}
      </nav>

      {showEditor ? (
        <Editor
          tab={tab}
          pack={pack}
          editingId={editingId}
          onClose={closeEditor}
          onSaveRace={(race, traits) => {
            commit((current) => ({
              ...current,
              races: [...current.races.filter((r) => r.id !== race.id), race],
              traits: [
                ...current.traits.filter((t) => !t.id.startsWith(traitIdPrefix(race.id))),
                ...traits,
              ],
            }))
            closeEditor()
          }}
          onSaveClass={(cls, features, levels) => {
            commit((current) => ({
              ...current,
              classes: [...current.classes.filter((c) => c.id !== cls.id), cls],
              // Sınıfın kendi özellikleri değişti; alt sınıf özellikleri kalır.
              features: [
                ...current.features.filter((f) => f.classId !== cls.id || f.subclassId),
                ...features,
              ],
              classLevels: [
                ...current.classLevels.filter((row) => row.classId !== cls.id),
                ...levels,
              ],
            }))
            closeEditor()
          }}
          onSaveSubclass={(subclass, features) => {
            commit((current) => ({
              ...current,
              subclasses: [
                ...current.subclasses.filter((s) => s.id !== subclass.id),
                subclass,
              ],
              features: [
                ...current.features.filter((f) => f.subclassId !== subclass.id),
                ...features,
              ],
              // Üst sınıf homebrew ise alt sınıfı listesine eklenmeli; SRD
              // sınıflarına homebrew alt sınıf eklemek registry'de SRD kaydını
              // değiştirmek olurdu, o yüzden bağ yalnızca alt sınıfta durur.
              classes: current.classes.map((c) =>
                c.id === subclass.classId && !c.subclasses.includes(subclass.id)
                  ? { ...c, subclasses: [...c.subclasses, subclass.id] }
                  : c,
              ),
            }))
            closeEditor()
          }}
          onSaveSimple={(kind, record) => {
            upsert(kind, record)
            closeEditor()
          }}
        />
      ) : (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Yeni {TABS.find((t) => t.id === tab)?.singular} ekle
          </button>

          {records.length === 0 ? (
            <p className="text-sm text-slate-500">
              Henüz {TABS.find((t) => t.id === tab)?.singular} tanımlamadın.
            </p>
          ) : (
            <ul className="space-y-2">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{record.name}</p>
                    <p className="text-xs text-slate-400">{record.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(record.id)}
                      className={buttonClass}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${record.name}" silinecek. Emin misin?`)) {
                          remove(tab, record.id)
                        }
                      }}
                      className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-accent"
                    >
                      Sil
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

/** Sekmeye göre doğru düzenleyiciyi açar. */
function Editor({
  tab,
  pack,
  editingId,
  onClose,
  onSaveRace,
  onSaveClass,
  onSaveSubclass,
  onSaveSimple,
}: {
  tab: Tab
  pack: HomebrewPack
  editingId: string | null
  onClose: () => void
  onSaveRace: (race: Race, traits: HomebrewPack['traits']) => void
  onSaveClass: (
    cls: CharacterClass,
    features: HomebrewPack['features'],
    levels: HomebrewPack['classLevels'],
  ) => void
  onSaveSubclass: (subclass: Subclass, features: HomebrewPack['features']) => void
  onSaveSimple: (
    kind: 'backgrounds' | 'feats' | 'spells' | 'equipment',
    record: Background | Feat | Spell | Equipment,
  ) => void
}) {
  const find = <T extends { id: string }>(list: T[]) =>
    editingId ? list.find((r) => r.id === editingId) : undefined

  switch (tab) {
    case 'races':
      return (
        <RaceEditor
          record={find(pack.races)}
          existingTraits={
            editingId ? pack.traits.filter((t) => t.id.startsWith(traitIdPrefix(editingId))) : []
          }
          onSave={onSaveRace}
          onCancel={onClose}
        />
      )
    case 'classes':
      return (
        <ClassEditor
          record={find(pack.classes)}
          existingFeatures={
            editingId ? pack.features.filter((f) => f.classId === editingId && !f.subclassId) : []
          }
          existingLevels={
            editingId ? pack.classLevels.filter((row) => row.classId === editingId) : []
          }
          onSave={onSaveClass}
          onCancel={onClose}
        />
      )
    case 'subclasses':
      return (
        <SubclassEditor
          record={find(pack.subclasses)}
          existingFeatures={
            editingId ? pack.features.filter((f) => f.subclassId === editingId) : []
          }
          onSave={onSaveSubclass}
          onCancel={onClose}
        />
      )
    case 'backgrounds':
      return (
        <BackgroundEditor
          record={find(pack.backgrounds)}
          onSave={(record) => onSaveSimple('backgrounds', record)}
          onCancel={onClose}
        />
      )
    case 'feats':
      return (
        <FeatEditor
          record={find(pack.feats)}
          onSave={(record) => onSaveSimple('feats', record)}
          onCancel={onClose}
        />
      )
    case 'spells':
      return (
        <SpellEditor
          record={find(pack.spells)}
          onSave={(record) => onSaveSimple('spells', record)}
          onCancel={onClose}
        />
      )
    case 'equipment':
      return (
        <EquipmentEditor
          record={find(pack.equipment)}
          onSave={(record) => onSaveSimple('equipment', record)}
          onCancel={onClose}
        />
      )
  }
}
