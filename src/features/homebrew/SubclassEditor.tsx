import { useState } from 'react'
import { classes } from '../../data/registry.ts'
import type { Feature, Subclass } from '../../data/schema.ts'
import EditorShell from './EditorShell.tsx'
import { childId, slugify } from './text.ts'
import { NumberField, ParagraphsField, SelectField, TextField } from './fields.tsx'

/**
 * Alt sınıf düzenleyicisi.
 *
 * SRD sınıf başına tek alt sınıf içerir (Champion, Thief, Life Domain…);
 * ikinci bir seçenek isteyen kullanıcı burada tanımlar. Alt sınıfın seviye
 * özellikleri, sınıfınkiyle aynı `features` tablosuna `subclassId` ile yazılır;
 * kural motoru ikisini ayırt etmek zorunda kalmaz.
 */

interface FeatureDraft {
  key: string
  level: number
  name: string
  desc: string[]
}

export default function SubclassEditor({
  record,
  existingFeatures,
  onSave,
  onCancel,
}: {
  record?: Subclass
  existingFeatures: Feature[]
  onSave: (subclass: Subclass, features: Feature[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [classId, setClassId] = useState(record?.classId ?? '')
  const [flavor, setFlavor] = useState(record?.flavor ?? '')
  const [desc, setDesc] = useState<string[]>(record?.desc ?? [])
  const [features, setFeatures] = useState<FeatureDraft[]>(() =>
    existingFeatures
      .slice()
      .sort((a, b) => a.level - b.level)
      .map((f, index) => ({ key: `${index}`, level: f.level, name: f.name, desc: f.desc })),
  )

  const parent = classId ? classes.get(classId) : undefined

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (!classId) issues.push('Hangi sınıfın alt sınıfı olduğunu seçmelisin.')
  if (features.some((f) => !f.name.trim())) issues.push('Adı boş bir özellik var.')
  if (parent && features.some((f) => f.level < parent.subclassLevel)) {
    issues.push(
      `${parent.name} alt sınıfını ${parent.subclassLevel}. seviyede seçer; daha erken bir özellik veremezsin.`,
    )
  }

  const save = () => {
    const subclassId = record?.id ?? slugify(name)
    const featureRecords: Feature[] = features.map((draft, index) => ({
      id: childId(subclassId, draft.name, index),
      name: draft.name.trim(),
      source: 'homebrew',
      classId,
      subclassId,
      level: draft.level,
      desc: draft.desc,
    }))

    onSave(
      {
        id: subclassId,
        name: name.trim(),
        source: 'homebrew',
        classId,
        flavor: flavor.trim(),
        desc,
      },
      featureRecords,
    )
  }

  const updateFeature = (key: string, patch: Partial<FeatureDraft>) =>
    setFeatures(features.map((f) => (f.key === key ? { ...f, ...patch } : f)))

  return (
    <EditorShell title="Alt sınıf" issues={issues} onSave={save} onCancel={onCancel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="İsim" value={name} onChange={setName} placeholder="School of Chaos" />
        <SelectField
          label="Sınıf"
          value={classId}
          onChange={setClassId}
          placeholder="Seç…"
          options={classes.all().map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <TextField
        label="Alt sınıf türü"
        hint="Sınıfın alt sınıflarına verdiği ad: Arcane Tradition, Divine Domain, Martial Archetype…"
        value={flavor}
        onChange={setFlavor}
      />
      <ParagraphsField label="Açıklama" value={desc} onChange={setDesc} rows={3} />

      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-500">Seviye özellikleri</legend>
        {features.map((feature) => (
          <div key={feature.key} className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="flex items-end gap-2">
              <div className="w-24">
                <NumberField
                  label="Seviye"
                  min={1}
                  max={20}
                  value={feature.level}
                  onChange={(value) => updateFeature(feature.key, { level: value })}
                />
              </div>
              <div className="flex-1">
                <TextField
                  label="Özellik adı"
                  value={feature.name}
                  onChange={(value) => updateFeature(feature.key, { name: value })}
                />
              </div>
              <button
                type="button"
                onClick={() => setFeatures(features.filter((f) => f.key !== feature.key))}
                className="pb-2 text-sm text-slate-500 underline hover:text-accent"
              >
                kaldır
              </button>
            </div>
            <ParagraphsField
              label="Açıklama"
              rows={3}
              value={feature.desc}
              onChange={(value) => updateFeature(feature.key, { desc: value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setFeatures([
              ...features,
              {
                key: crypto.randomUUID(),
                level: parent?.subclassLevel ?? 3,
                name: '',
                desc: [],
              },
            ])
          }
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Özellik ekle
        </button>
      </fieldset>
    </EditorShell>
  )
}
