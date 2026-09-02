import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  classes,
  loadEquipment,
  loadSpells,
  races,
  skills,
  type Collection,
} from '../../data/registry.ts'
import type { Equipment, Spell } from '../../data/schema.ts'
import { abilityScores, formatModifier } from '../../rules/abilities.ts'
import { ABILITY_IDS, totalLevel, type Character } from '../../rules/character.ts'
import { armorClass, skillProficiencies } from '../../rules/derived.ts'
import { randomSeed, seedFromString } from '../../rules/dice.ts'
import { generateCharacter } from '../../rules/generate.ts'
import { maxHitPoints } from '../../rules/hitpoints.ts'
import { spellcasting } from '../../rules/spellcasting.ts'
import { useCharacterStore } from '../../state/characterStore.ts'

/**
 * Rastgele karakter oluşturma.
 *
 * Hedef (bkz. CLAUDE.md): D&D hiç oynamamış biri tek tuşla oynanabilir bir
 * karakter alabilmeli. Bu yüzden sayfa açılır açılmaz bir karakter üretilir —
 * kullanıcı önce form doldurmak zorunda kalmaz, beğenmezse yeniden atar.
 */
export default function GeneratePage() {
  const navigate = useNavigate()
  const importCharacter = useCharacterStore((s) => s.importCharacter)

  const [spells, setSpells] = useState<Collection<Spell>>()
  const [equipment, setEquipment] = useState<Map<string, Equipment>>()
  const [character, setCharacter] = useState<Character>()

  const [level, setLevel] = useState(1)
  const [classId, setClassId] = useState('')
  const [raceId, setRaceId] = useState('')
  const [seedText, setSeedText] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([loadSpells(), loadEquipment()]).then(([s, e]) => {
      if (!active) return
      setSpells(s)
      setEquipment(new Map(e.all().map((i) => [i.id, i])))
    })
    return () => {
      active = false
    }
  }, [])

  const roll = (seed?: number) => {
    setCharacter(
      generateCharacter({
        seed: seed ?? (seedText.trim() ? seedFromString(seedText.trim()) : randomSeed()),
        level,
        classId: classId || undefined,
        raceId: raceId || undefined,
        spells,
        equipment,
      }),
    )
  }

  // Veri hazır olur olmaz ilk karakteri üret; kullanıcı boş ekranla karşılaşmasın.
  useEffect(() => {
    if (spells && equipment && !character) {
      setCharacter(
        generateCharacter({ seed: randomSeed(), level: 1, spells, equipment }),
      )
    }
  }, [spells, equipment, character])

  const save = () => {
    if (!character) return
    importCharacter(character)
    navigate(`/karakter/${character.id}`)
  }

  const selectClass =
    'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Rastgele karakter</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          D&amp;D&apos;yi hiç oynamadıysan buradan başla. Tek tuşla kurallara uygun ve
          oynanabilir bir karakter üretilir; beğenmezsen yeniden at, beğenirsen kaydet ve
          istediğin yerini değiştir.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Seviye</span>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Sınıf</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={selectClass}
            >
              <option value="">Rastgele</option>
              {classes.all().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Irk</span>
            <select value={raceId} onChange={(e) => setRaceId(e.target.value)} className={selectClass}>
              <option value="">Rastgele</option>
              {races.all().map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Tohum (isteğe bağlı)
            </span>
            <input
              type="text"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder="Aynı tohum aynı karakteri verir"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => roll()}
            disabled={!spells || !equipment}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {character ? 'Yeniden at' : 'Karakter üret'}
          </button>
          {character && (
            <button
              type="button"
              onClick={save}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Bunu kaydet
            </button>
          )}
        </div>
      </section>

      {!spells || !equipment ? (
        <p role="status" className="text-sm text-slate-500">
          Büyü ve ekipman verisi yükleniyor…
        </p>
      ) : character ? (
        <Preview character={character} equipment={equipment} />
      ) : null}
    </div>
  )
}

function Preview({
  character,
  equipment,
}: {
  character: Character
  equipment: Map<string, Equipment>
}) {
  const scores = abilityScores(character)
  const hp = maxHitPoints(character)
  const ac = armorClass(character, equipment)
  const casting = spellcasting(character)
  const race = character.raceId ? races.get(character.raceId) : undefined
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined
  const proficient = [...skillProficiencies(character)].map((id) => skills.get(id)?.name ?? id)

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-xl font-semibold">{character.name}</h2>
        <p className="text-sm text-slate-600">
          {race?.name} {cls?.name} · {totalLevel(character)}. seviye ·{' '}
          {character.notes.alignment}
        </p>
        <p className="mt-1 text-xs text-slate-400">Tohum: {character.seed}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['HP', hp.total],
          ['AC', ac.value],
          ['Hız', `${race?.speed ?? 30} ft`],
          ['Hit dice', `${totalLevel(character)}d${hp.hitDie}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-slate-50 px-3 py-2 text-center">
            <dt className="text-[10px] font-semibold tracking-wide text-slate-400">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITY_IDS.map((ability) => (
          <li key={ability} className="rounded-md border border-slate-200 px-2 py-1.5 text-center">
            <span className="block text-[10px] font-semibold text-slate-400">
              {ability.toUpperCase()}
            </span>
            <span className="block text-lg font-semibold leading-tight">
              {scores[ability].total}
            </span>
            <span className="block text-[11px] text-slate-500">
              {formatModifier(scores[ability].modifier)}
            </span>
          </li>
        ))}
      </ul>

      {proficient.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium">Beceriler:</span>{' '}
          {proficient.join(', ')}
        </p>
      )}

      {casting.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium">Büyü:</span> Save DC {casting[0].saveDC} ·{' '}
          {character.spells.cantrips.length} cantrip, {character.spells.known.length} büyü
        </p>
      )}

      {character.equipment.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium">Ekipman:</span>{' '}
          {character.equipment
            .map((e) => {
              const item = equipment.get(e.itemId)
              return e.quantity > 1 ? `${item?.name} ×${e.quantity}` : item?.name
            })
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
    </section>
  )
}
