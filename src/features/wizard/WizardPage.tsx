import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadEquipment, loadSpells, type Collection } from '../../data/registry.ts'
import type { Equipment, Spell } from '../../data/schema.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import { storageAvailable } from '../../state/storage.ts'
import LivePreview from './LivePreview.tsx'
import StepAbilities from './StepAbilities.tsx'
import StepBackground from './StepBackground.tsx'
import StepClass from './StepClass.tsx'
import StepDetails from './StepDetails.tsx'
import StepEquipment from './StepEquipment.tsx'
import StepProficiencies from './StepProficiencies.tsx'
import StepRace from './StepRace.tsx'
import StepSpells from './StepSpells.tsx'
import StepSummary from './StepSummary.tsx'
import { applicableSteps, validateStep, type StepId } from './steps.ts'

/**
 * Karakter oluşturma sihirbazı.
 *
 * Adımlar arasında serbest gezinilir; ileri butonu adım geçersizken kilitlenir
 * ve **nedeni somut olarak yazılır**. Taslak her değişiklikte localStorage'a
 * yazıldığı için sekme kapansa bile kaybolmaz.
 */
export default function WizardPage() {
  const navigate = useNavigate()
  const draft = useCharacterStore((s) => s.draft)
  const persistenceFailed = useCharacterStore((s) => s.persistenceFailed)
  const reset = useCharacterStore((s) => s.reset)
  const saveDraftAsCharacter = useCharacterStore((s) => s.saveDraftAsCharacter)

  const [current, setCurrent] = useState<StepId>('race')
  const [equipment, setEquipment] = useState<Map<string, Equipment>>(new Map())
  const [spells, setSpells] = useState<Collection<Spell>>()

  // Ekipman ve büyüler lazy chunk; sihirbaz açılır açılmaz arka planda inerler.
  useEffect(() => {
    let active = true
    loadEquipment().then((collection) => {
      if (active) setEquipment(new Map(collection.all().map((item) => [item.id, item])))
    })
    loadSpells().then((collection) => {
      if (active) setSpells(collection)
    })
    return () => {
      active = false
    }
  }, [])

  const steps = useMemo(() => applicableSteps(draft), [draft])
  const index = Math.max(0, steps.findIndex((s) => s.id === current))
  const status = validateStep(draft, current)
  const isLast = index === steps.length - 1

  // Büyü adımı sınıf değişince kaybolabilir; öyleyse geçerli bir adıma düşeriz.
  useEffect(() => {
    if (!steps.some((s) => s.id === current)) setCurrent(steps[0].id)
  }, [steps, current])

  const save = () => {
    saveDraftAsCharacter()
    // Karakter sayfası Aşama 6'da gelecek; şimdilik listeye dönüyoruz.
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Karakter oluştur</h1>
          <p className="mt-1 text-sm text-slate-600">
            Adım adım ilerle. Verdiğin her karar sağdaki önizlemeye anında yansır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Taslak silinecek ve baştan başlayacaksın. Emin misin?')) reset()
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Baştan başla
        </button>
      </header>

      {!storageAvailable() && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Tarayıcın yerel depolamayı engelliyor: sayfayı kapatırsan taslağın kaybolur.
        </p>
      )}
      {persistenceFailed && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Taslak kaydedilemedi (depolama alanı dolu olabilir). Karakterini kaybetmemek için
          tamamlayıp dışa aktar.
        </p>
      )}

      <Stepper steps={steps} current={current} onSelect={setCurrent} draft={draft} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {current === 'race' && <StepRace character={draft} />}
          {current === 'class' && <StepClass character={draft} />}
          {current === 'abilities' && <StepAbilities character={draft} />}
          {current === 'background' && <StepBackground character={draft} />}
          {current === 'proficiencies' && <StepProficiencies character={draft} />}
          {current === 'equipment' && <StepEquipment character={draft} equipment={equipment} />}
          {current === 'spells' &&
            (spells ? (
              <StepSpells character={draft} spells={spells} />
            ) : (
              <p className="text-sm text-slate-500">Büyüler yükleniyor…</p>
            ))}
          {current === 'details' && <StepDetails character={draft} />}
          {current === 'summary' && (
            <StepSummary character={draft} equipment={equipment} onSave={save} />
          )}

          {!isLast && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              {status.issues.length > 0 && (
                <ul className="space-y-1 text-sm text-accent" role="status">
                  {status.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
              {/* Uyarılar ilerlemeyi engellemez; farklı renkte gösterilir. */}
              {status.warnings.length > 0 && (
                <ul className="space-y-1 text-sm text-amber-700">
                  {status.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrent(steps[index - 1].id)}
                  disabled={index === 0}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  ‹ Geri
                </button>
                <button
                  type="button"
                  onClick={() => setCurrent(steps[index + 1].id)}
                  disabled={!status.complete}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  İleri ›
                </button>
              </div>
            </div>
          )}
        </div>

        <LivePreview character={draft} equipment={equipment} />
      </div>
    </div>
  )
}

function Stepper({
  steps,
  current,
  onSelect,
  draft,
}: {
  steps: { id: StepId; label: string }[]
  current: StepId
  onSelect: (id: StepId) => void
  draft: Parameters<typeof validateStep>[0]
}) {
  return (
    <nav aria-label="Sihirbaz adımları">
      <ol className="flex flex-wrap gap-1">
        {steps.map((step, i) => {
          const complete = validateStep(draft, step.id).complete
          const active = step.id === current
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
                className={[
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent text-white'
                    : complete
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:bg-slate-100',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold',
                    active
                      ? 'bg-white/25'
                      : complete
                        ? 'bg-accent-soft text-accent'
                        : 'border border-slate-300',
                  ].join(' ')}
                >
                  {complete && !active ? '✓' : i + 1}
                </span>
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
