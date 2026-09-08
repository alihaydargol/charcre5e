import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { classes, loadFeatures, loadSpells, subclasses, type Collection } from '../../data/registry.ts'
import { getClassLevel } from '../../data/classLevels.ts'
import type { Feature, Spell } from '../../data/schema.ts'
import { formatModifier } from '../../rules/abilities.ts'
import { totalLevel, type Character, type LevelChoice } from '../../rules/character.ts'
import { classSummary, isMulticlass, levelTrack } from '../../rules/multiclass.ts'
import { characterProficiencyBonus } from '../../rules/progression.ts'
import { spellcasting } from '../../rules/spellcasting.ts'
import { decisionsAtLevel, pendingDecisions } from '../../rules/progression.ts'
import { maxHitPoints, averageHitDie, rollHitDie } from '../../rules/hitpoints.ts'
import { createRng, randomSeed } from '../../rules/dice.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import LevelDecision from './LevelDecision.tsx'
import OptionGrid from '../wizard/OptionGrid.tsx'
import { getValidChoices } from '../../rules/choices.ts'
import { btnPrimary, btnSmallPrimary, btnSmallSecondary } from '../../components/ui.ts'

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
  const addClassLevel = useCharacterStore((s) => s.addClassLevel)
  const removeLastLevel = useCharacterStore((s) => s.removeLastLevel)
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
        <p className="text-muted">
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
        <p className="text-muted">Bu karakterin sınıfı yok. Önce sihirbazı tamamla.</p>
        <Link to="/olustur" className="text-accent underline">
          Sihirbaza git
        </Link>
      </div>
    )
  }

  const save = () => {
    saveDraftAsCharacter()
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {draft.name || 'İsimsiz karakter'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {classSummary(draft)} · {level}. seviye · {hp.total} HP
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          className={btnPrimary}
        >
          Kaydet
        </button>
      </header>

      {pending.length > 0 && (
        <div className="rounded-lg border border-warn bg-warn-soft p-4">
          <p className="font-medium text-warn-ink">
            {pending.length} seçim bekliyor
          </p>
          <p className="mt-1 text-sm text-warn-ink">
            Aşağıdaki seviye kartlarında sarı işaretli olanları tamamla.
          </p>
        </div>
      )}

      <LevelControls
        character={draft}
        onAdd={addClassLevel}
        onRemove={removeLastLevel}
      />

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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Seviye geçmişi
        </h2>
        <ol className="space-y-3">
          {levelTrack(draft).map((entry) => (
            <LevelCard
              key={entry.characterLevel}
              character={draft}
              classId={entry.classId}
              level={entry.classLevel}
              characterLevel={entry.characterLevel}
              multiclassEntry={entry.classId !== draft.classes[0]?.classId}
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
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Hit Points: {hp.total}</h2>
        <p className="text-xs text-muted">
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
                : 'border-border-strong text-muted hover:bg-surface-muted',
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
            className={btnSmallSecondary}
          >
            Hepsini yeniden at
          </button>
          <ul className="flex flex-wrap gap-2">
            {Array.from({ length: level - 1 }, (_, i) => (
              <li key={i} className="flex items-center gap-1 text-sm">
                <label className="text-xs text-muted">sv{i + 2}</label>
                <input
                  type="number"
                  min={1}
                  max={hp.hitDie}
                  value={character.hp.rolls[i] ?? ''}
                  placeholder={String(averageHitDie(hp.hitDie))}
                  onChange={(e) => onRollChange(i, Number(e.target.value))}
                  aria-label={`${i + 2}. seviye hit die`}
                  className="w-14 rounded border border-border-strong px-2 py-1 text-center"
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
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
            className="w-24 rounded border border-border-strong px-2 py-1"
          />
        </label>
      )}
    </section>
  )
}

/**
 * Seviye ekleme ve geri alma.
 *
 * Multiclass'ın girişi burası: seviye tek bir sınıfa değil, SEÇİLEN sınıfa
 * veriliyor. Mevcut sınıflar kısayol olarak duruyor; başka bir sınıfa geçmek
 * `getValidChoices` katmanından geliyor, yani ön koşul kuralı burada
 * tekrarlanmıyor (bkz. CLAUDE.md §3).
 */
function LevelControls({
  character,
  onAdd,
  onRemove,
}: {
  character: Character
  onAdd: (classId: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const level = totalLevel(character)
  const choices = getValidChoices(character, { kind: 'newClass' })

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={level <= 1}
          className={btnSmallSecondary}
        >
          − Seviye düşür
        </button>
        <span className="min-w-10 text-center text-lg font-semibold">{level}</span>

        {/* Mevcut sınıflara seviye vermek en sık yapılan şey; kısayol olsun. */}
        {character.classes.map((cls) => (
          <button
            key={cls.classId}
            type="button"
            onClick={() => onAdd(cls.classId)}
            disabled={level >= 20}
            className={btnSmallPrimary}
          >
            + {classes.get(cls.classId)?.name ?? cls.classId}
          </button>
        ))}

        {choices.applicable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={btnSmallSecondary}
          >
            {open ? 'Kapat' : '+ Başka sınıf (multiclass)'}
          </button>
        )}
      </div>

      <p className="text-sm text-muted">
        Seviye düşürmek son kazanılan seviyeyi geri alır ve o seviyenin seçimlerini siler.
      </p>

      {open && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm text-muted">
            Multiclass için hem yeni sınıfın hem mevcut sınıflarının yetenek eşiğini
            karşılamalısın. Girdiğin sınıf yeterliliklerinin tamamını değil, kısıtlı bir
            bölümünü verir.
          </p>
          <OptionGrid
            options={choices.options}
            selected={[]}
            onToggle={(classId) => {
              onAdd(classId)
              setOpen(false)
            }}
            columns={3}
          />
        </div>
      )}
    </section>
  )
}

function LevelCard({
  character,
  classId,
  level,
  characterLevel,
  multiclassEntry,
  features,
  spells,
}: {
  character: Character
  classId: string
  /** Sınıf içindeki seviye — özellikler ve karar noktaları buna bağlı. */
  level: number
  /** Karakterin toplam seviyesi bu kartta kaçıncı — PB buna bağlı. */
  characterLevel: number
  /** Bu sınıfa multiclass ile mi girildi? İlk sınıf için false. */
  multiclassEntry: boolean
  features?: Collection<Feature>
  spells?: Collection<Spell>
}) {
  const row = getClassLevel(classId, level)
  const decisions = decisionsAtLevel(classId, level, { multiclassEntry })
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

  const multiclass = isMulticlass(character)

  /*
   * Slot gösterimi: multiclass'ta sınıfın kendi tablosu yanıltıcı olur —
   * slotlar birleşik havuzdan gelir (bkz. rules/multiclass.ts). Bu yüzden
   * karakterin gerçek slotları gösteriliyor, satırınki değil.
   */
  const slotSource = multiclass
    ? spellcasting(character).find((info) => !info.pactMagic)?.spellSlots
    : row?.spellcasting?.spellSlots
  const slots = slotSource
    ?.map((n, i) => (n > 0 ? `${n}×${i + 1}` : null))
    .filter(Boolean)
    .join(' ')

  // Bu seviyede büyü sayısı arttıysa göster.
  const previous = level > 1 ? getClassLevel(classId, level - 1) : undefined
  const newSpells =
    (row?.spellcasting?.spellsKnown ?? 0) - (previous?.spellcasting?.spellsKnown ?? 0)
  const newCantrips =
    (row?.spellcasting?.cantripsKnown ?? 0) - (previous?.spellcasting?.cantripsKnown ?? 0)

  return (
    <li
      className={[
        'rounded-lg border bg-surface p-4',
        hasPending ? 'border-warn bg-warn-soft/40' : 'border-border',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {characterLevel}. seviye
          {multiclass && (
            <span className="ml-2 font-normal text-muted">
              {classes.get(classId)?.name} {level}
            </span>
          )}
        </h3>
        <span className="text-xs text-muted">
          {/*
            Proficiency bonus KARAKTER seviyesinden gelir, sınıf seviyesinden
            değil. Sınıf tablosunun satırındaki değer yalnızca tek sınıflı bir
            karakter için doğrudur.
          */}
          Proficiency bonus {formatModifier(characterProficiencyBonus(character))}
          {slots && ` · slot ${slots}`}
        </span>
      </div>

      {featureNames.length > 0 && (
        <p className="mt-1 text-sm capitalize text-muted">{featureNames.join(', ')}</p>
      )}

      {(newSpells > 0 || newCantrips > 0) && (
        <p className="mt-1 text-sm text-muted">
          {newCantrips > 0 && `+${newCantrips} cantrip`}
          {newCantrips > 0 && newSpells > 0 && ' · '}
          {newSpells > 0 && `+${newSpells} büyü öğrenirsin`}
        </p>
      )}

      {decisions.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
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
    <p className="mt-2 text-sm text-muted">
      <span className="font-medium">{subclasses.get(id)?.name}:</span>{' '}
      {gained.map((f) => f.name).join(', ')}
    </p>
  )
}
