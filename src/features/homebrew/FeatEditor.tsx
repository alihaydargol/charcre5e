import { useState } from 'react'
import { ABILITY_IDS } from '../../rules/character.ts'
import type { AbilityId, Feat } from '../../data/schema.ts'
import { NumberField, ParagraphsField, TextField } from './fields.tsx'
import EditorShell from './EditorShell.tsx'
import { slugify } from './text.ts'

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
    })

  return (
    <EditorShell title="Feat" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Savage Reflexes" />
      <ParagraphsField label="Açıklama" value={desc} onChange={setDesc} />

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-500">Ön koşullar</legend>
        <p className="text-xs text-slate-400">
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
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
              className="pb-2 text-sm text-slate-500 underline hover:text-accent"
            >
              kaldır
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPrerequisites([...prerequisites, { ability: 'str', minimumScore: 13 }])}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Ön koşul ekle
        </button>
      </fieldset>
    </EditorShell>
  )
}
