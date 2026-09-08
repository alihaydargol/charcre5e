import { useState } from 'react'
import { ABILITY_IDS } from '../../rules/character.ts'
import type { AbilityId, Feat } from '../../data/schema.ts'
import { Field, NumberField, ParagraphsField, TextField, inputClass } from './fields.tsx'
import EditorShell from './EditorShell.tsx'
import { slugify } from '../../data/ids.ts'
import { btnSmallSecondary } from '../../components/ui.ts'

/**
 * Feat düzenleyicisi.
 *
 * SRD'de tek bir feat var (Grappler); bu ekran o kısıtın telafisi
 * (bkz. CLAUDE.md §2) — resmî içerik kopyalamak yerine kullanıcı kendi
 * feat'ini tanımlar.
 */
export default function FeatEditor({
  record,
  onSave,
  onCancel,
}: {
  record?: Feat
  onSave: (feat: Feat) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [desc, setDesc] = useState<string[]>(record?.desc ?? [])
  const [prerequisites, setPrerequisites] = useState(record?.prerequisites ?? [])
  const [bonuses, setBonuses] = useState<Record<AbilityId, number>>(() => {
    const base = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    for (const bonus of record?.abilityBonuses ?? []) base[bonus.ability] = bonus.bonus
    return base
  })

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (desc.length === 0) issues.push('Feat ne yapıyor, en az bir paragraf yaz.')

  const save = () =>
    onSave({
      id: record?.id ?? slugify(name),
      name: name.trim(),
      source: 'homebrew',
      desc,
      prerequisites,
      abilityBonuses: ABILITY_IDS.filter((ability) => bonuses[ability] !== 0).map((ability) => ({
        ability,
        bonus: bonuses[ability],
      })),
    })

  return (
    <EditorShell title="Feat" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Savage Reflexes" />
      <ParagraphsField label="Açıklama" value={desc} onChange={setDesc} />

      <Field
        label="Yetenek puanı artışı"
        hint='Bir yetenekte +1 veren "yarım feat"ler için. Vermiyorsa hepsini 0 bırak.'
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITY_IDS.map((ability) => (
            <label key={ability} className="text-center">
              <span className="mb-1 block text-[11px] font-semibold text-faint">
                {ability.toUpperCase()}
              </span>
              <input
                type="number"
                min={0}
                max={2}
                value={bonuses[ability]}
                onChange={(e) => setBonuses({ ...bonuses, [ability]: Number(e.target.value) })}
                className={inputClass + ' text-center'}
              />
            </label>
          ))}
        </div>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted">Ön koşullar</legend>
        <p className="text-xs text-faint">
          Belirli bir yetenek puanı gerektiriyorsa ekle; gerekmiyorsa boş bırak.
        </p>
        {prerequisites.map((prerequisite, index) => (
          <div key={index} className="flex items-end gap-2">
            <select
              value={prerequisite.ability}
              onChange={(e) =>
                setPrerequisites(
                  prerequisites.map((p, i) =>
                    i === index ? { ...p, ability: e.target.value as AbilityId } : p,
                  ),
                )
              }
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            >
              {ABILITY_IDS.map((ability) => (
                <option key={ability} value={ability}>
                  {ability.toUpperCase()}
                </option>
              ))}
            </select>
            <div className="w-24">
              <NumberField
                label="En az"
                min={1}
                max={20}
                value={prerequisite.minimumScore}
                onChange={(value) =>
                  setPrerequisites(
                    prerequisites.map((p, i) => (i === index ? { ...p, minimumScore: value } : p)),
                  )
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setPrerequisites(prerequisites.filter((_, i) => i !== index))}
              className="pb-2 text-sm text-muted underline hover:text-accent"
            >
              kaldır
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPrerequisites([...prerequisites, { ability: 'str', minimumScore: 13 }])}
          className={btnSmallSecondary}
        >
          Ön koşul ekle
        </button>
      </fieldset>
    </EditorShell>
  )
}
