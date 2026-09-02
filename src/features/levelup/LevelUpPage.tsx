import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { classes, loadFeatures, loadSpells, subclasses, type Collection } from '../../data/registry.ts'
import { getClassLevel } from '../../data/classLevels.ts'
import type { Feature, Spell } from '../../data/schema.ts'
import { formatModifier } from '../../rules/abilities.ts'
import { totalLevel, type Character, type LevelChoice } from '../../rules/character.ts'
import { decisionsAtLevel, pendingDecisions } from '../../rules/progression.ts'
import { maxHitPoints, averageHitDie, rollHitDie } from '../../rules/hitpoints.ts'
import { createRng, randomSeed } from '../../rules/dice.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import LevelDecision from './LevelDecision.tsx'

/**
 * Seviye atlama ve seviye geçmişi.
 *
 * Karakterin her seviyesi ayrı bir kart olarak listelenir; geçmiş bir seviyedeki
 * seçim değiştirilebilir. Türetilmiş değerler saklanmadığı için (bkz.
 * `rules/character.ts`) 8. seviyedeki bir değişiklik 20. seviye değerlerini
 * kendiliğinden düzeltir — ekstra bir yeniden hesaplama adımı yoktur.
 */
export default function LevelUpPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const saved = useCharacterStore((s) => s.saved)
  const draft = useCharacterStore((s) => s.draft)
  const loadForEditing = useCharacterStore((s) => s.loadForEditing)
  const saveDraftAsCharacter = useCharacterStore((s) => s.saveDraftAsCharacter)
  const setLevel = useCharacterStore((s) => s.setLevel)
  const setHpMethod = useCharacterStore((s) => s.setHpMethod)
  const setHpRoll = useCharacterStore((s) => s.setHpRoll)

  const [features, setFeatures] = useState<Collection<Feature>>()
  const [spells, setSpells] = useState<Collection<Spell>>()

  // Düzenlenecek karakteri taslağa al.
  useEffect(() => {
    if (id && draft.id !== id && saved.some((c) => c.id === id)) loadForEditing(id)
  }, [id, draft.id, saved, loadForEditing])

  useEffect(() => {
    let active = true
    loadFeatures().then((c) => active && setFeatures(c))
    loadSpells().then((c) => active && setSpells(c))
    return () => {
      active = false
    }
  }, [])

  const primary = draft.classes[0]
  const level = totalLevel(draft)
  const hp = maxHitPoints(draft)
  const pending = useMemo(() => pendingDecisions(draft), [draft])

  // Kayıtlı karakter yoksa ile sınıfsız karakter farklı durumlardır; ayrı söyle.
  const exists = saved.some((c) => c.id === id) || draft.id === id
  if (!exists) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Karakter bulunamadı</h1>
        <p className="text-slate-600">
          Bu bağlantıdaki karakter kayıtlı değil. Silinmiş ya da başka bir tarayıcıda
          oluşturulmuş olabilir.
        </p>
        <Link to="/" className="text-accent underline">
          Karakterlerime dön
        </Link>
      </div>
    )
  }

  if (!primary) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Seviye atlama</h1>
        <p className="text-slate-600">Bu karakterin sınıfı yok. Önce sihirbazı tamamla.</p>
        <Link to="/olustur" className="text-accent underline">
          Sihirbaza git
        </Link>
      </div>
    )
  }

  const cls = classes.require(primary.classId)
  const save = () => {
    saveDraftAsCharacter()
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {draft.name || 'İsimsiz karakter'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {cls.name} · {level}. seviye · {hp.total} HP
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Kaydet
        </button>
      </header>

      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            {pending.length} seçim bekliyor
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Aşağıdaki seviye kartlarında sarı işaretli olanları tamamla.
          </p>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLevel(level - 1)}
            disabled={level <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            − Seviye düşür
          </button>
          <span className="min-w-16 text-center text-lg font-semibold">{level}</span>
          <button
            type="button"
            onClick={() => setLevel(level + 1)}
            disabled={level >= 20}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            + Seviye atla
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Seviye düşürürsen o seviyenin üstündeki seçimler silinir.
        </p>
      </section>

      <HitPointsPanel
        character={draft}
        onMethodChange={setHpMethod}
        onRollChange={setHpRoll}
        onRollAll={() => {
          const rng = createRng(randomSeed())
          for (let l = 2; l <= level; l += 1) setHpRoll(l - 2, rollHitDie(draft, rng))
        }}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Seviye geçmişi
        </h2>
        <ol className="space-y-3">
          {Array.from({ length: level }, (_, i) => i + 1).map((l) => (
            <LevelCard
              key={l}
              character={draft}
              classId={primary.classId}
              level={l}
              features={features}
              spells={spells}
            />
          ))}
        </ol>
      </section>
    </div>
  )
}

function HitPointsPanel({
  character,
  onMethodChange,
  onRollChange,
  onRollAll,
}: {
  character: Character
  onMethodChange: (m: Character['hp']['method']) => void
  onRollChange: (index: number, value: number) => void
  onRollAll: () => void
}) {
  const level = totalLevel(character)
  const hp = maxHitPoints(character)
  const setHpManualTotal = useCharacterStore((s) => s.setHpManualTotal)

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Hit Points: {hp.total}</h2>
        <p className="text-xs text-slate-500">
          d{hp.hitDie} maks {hp.firstLevel}
          {hp.laterLevels > 0 && ` + ${hp.laterLevels}`}
          {hp.constitution !== 0 && ` + CON ${formatModifier(hp.constitution)}`}
          {hp.traits > 0 && ` + ırk ${hp.traits}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['average', `Ortalama (${averageHitDie(hp.hitDie)}/seviye)`],
            ['roll', 'Zar at'],
            ['manual', 'Elle gir'],
          ] as const
        ).map(([method, label]) => (
          <button
            key={method}
            type="button"
            onClick={() => onMethodChange(method)}
            aria-pressed={character.hp.method === method}
            className={[
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              character.hp.method === method
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {character.hp.method === 'roll' && level > 1 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onRollAll}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Hepsini yeniden at
          </button>
          <ul className="flex flex-wrap gap-2">
            {Array.from({ length: level - 1 }, (_, i) => (
              <li key={i} className="flex items-center gap-1 text-sm">
                <label className="text-xs text-slate-500">sv{i + 2}</label>
                <input
                  type="number"
                  min={1}
                  max={hp.hitDie}
                  value={character.hp.rolls[i] ?? ''}
                  placeholder={String(averageHitDie(hp.hitDie))}
                  onChange={(e) => onRollChange(i, Number(e.target.value))}
                  aria-label={`${i + 2}. seviye hit die`}
                  className="w-14 rounded border border-slate-300 px-2 py-1 text-center"
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Boş bırakılan seviyeler ortalama değerle hesaplanır.
          </p>
        </div>
      )}

      {character.hp.method === 'manual' && (
        <label className="flex items-center gap-2 text-sm">
          <span>Toplam HP:</span>
          <input
            type="number"
            value={character.hp.manualTotal ?? ''}
            onChange={(e) =>
              setHpManualTotal(e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      )}
    </section>
  )
}

function LevelCard({
  character,
  classId,
  level,
  features,
  spells,
}: {
  character: Character
  classId: string
  level: number
  features?: Collection<Feature>
  spells?: Collection<Spell>
}) {
  const row = getClassLevel(classId, level)
  const decisions = decisionsAtLevel(classId, level)
  const answered = new Set(
    character.levelChoices
      .filter((c) => c.level === level && c.classId === classId)
      .map((c: LevelChoice) => (c.kind === 'feat' ? 'asi' : c.kind)),
  )
  const hasPending = decisions.some(
    (d) => !answered.has(d.kind === 'asiOrFeat' ? 'asi' : d.kind),
  )

  const featureNames = (row?.features ?? []).map(
    (id) => features?.get(id)?.name ?? id.replaceAll('-', ' '),
  )

  // Bu seviyede büyü sayısı arttıysa göster.
  const previous = level > 1 ? getClassLevel(classId, level - 1) : undefined
  const newSpells =
    (row?.spellcasting?.spellsKnown ?? 0) - (previous?.spellcasting?.spellsKnown ?? 0)
  const newCantrips =
    (row?.spellcasting?.cantripsKnown ?? 0) - (previous?.spellcasting?.cantripsKnown ?? 0)

  return (
    <li
      className={[
        'rounded-lg border bg-white p-4',
        hasPending ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{level}. seviye</h3>
        <span className="text-xs text-slate-500">
          Proficiency bonus {formatModifier(row?.profBonus ?? 2)}
          {row?.spellcasting &&
            ` · slot ${row.spellcasting.spellSlots
              .map((n, i) => (n > 0 ? `${n}×${i + 1}` : null))
              .filter(Boolean)
              .join(' ')}`}
        </span>
      </div>

      {featureNames.length > 0 && (
        <p className="mt-1 text-sm capitalize text-slate-600">{featureNames.join(', ')}</p>
      )}

      {(newSpells > 0 || newCantrips > 0) && (
        <p className="mt-1 text-sm text-slate-500">
          {newCantrips > 0 && `+${newCantrips} cantrip`}
          {newCantrips > 0 && newSpells > 0 && ' · '}
          {newSpells > 0 && `+${newSpells} büyü öğrenirsin`}
        </p>
      )}

      {decisions.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {decisions.map((decision) => (
            <LevelDecision
              key={`${decision.kind}-${level}`}
              character={character}
              decision={decision}
              spells={spells}
            />
          ))}
        </div>
      )}

      {/* Alt sınıf seçildiyse o seviyenin alt sınıf özelliklerini de göster. */}
      <SubclassFeatures character={character} classId={classId} level={level} features={features} />
    </li>
  )
}

function SubclassFeatures({
  character,
  classId,
  level,
  features,
}: {
  character: Character
  classId: string
  level: number
  features?: Collection<Feature>
}) {
  const choice = character.levelChoices.find(
    (c) => c.kind === 'subclass' && c.classId === classId,
  )
  const id = choice?.kind === 'subclass' ? choice.subclassId : undefined
  if (!id || !features) return null

  const gained = features
    .all()
    .filter((f) => f.subclassId === id && f.level === level)

  if (gained.length === 0) return null

  return (
    <p className="mt-2 text-sm text-slate-600">
      <span className="font-medium">{subclasses.get(id)?.name}:</span>{' '}
      {gained.map((f) => f.name).join(', ')}
    </p>
  )
}
