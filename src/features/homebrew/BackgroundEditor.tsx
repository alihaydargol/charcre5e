import { useState } from 'react'
import { skills } from '../../data/registry.ts'
import type { Background } from '../../data/schema.ts'
import EditorShell from './EditorShell.tsx'
import { slugify } from './text.ts'
import { CheckboxPool, NumberField, ParagraphsField, TextField } from './fields.tsx'

/**
 * Geçmiş (background) düzenleyicisi.
 *
 * SRD'de yalnızca Acolyte var. Sihirbazda zaten "özel geçmiş" girişi vardı;
 * burada tanımlanan geçmiş ondan farklı olarak kalıcıdır ve paylaşılabilir.
 */
export default function BackgroundEditor({
  record,
  onSave,
  onCancel,
}: {
  record?: Background
  onSave: (background: Background) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [featureName, setFeatureName] = useState(record?.feature.name ?? '')
  const [featureDesc, setFeatureDesc] = useState<string[]>(record?.feature.desc ?? [])
  const [skillIds, setSkillIds] = useState<string[]>(
    record?.proficiencies.filter((id) => skills.has(id)) ?? [],
  )
  const [languageCount, setLanguageCount] = useState(record?.languageChoiceCount ?? 0)
  const [gold, setGold] = useState(record?.startingGold ?? 0)

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (skillIds.length !== 2) {
    issues.push(`Geçmişler iki beceri verir; ${skillIds.length} seçtin.`)
  }
  if (!featureName.trim()) issues.push('Geçmişin özelliğine bir isim ver.')

  const save = () =>
    onSave({
      id: record?.id ?? slugify(name),
      name: name.trim(),
      source: 'homebrew',
      feature: { name: featureName.trim(), desc: featureDesc },
      proficiencies: skillIds,
      languageChoiceCount: languageCount,
      startingEquipment: record?.startingEquipment ?? [],
      startingEquipmentChoices: record?.startingEquipmentChoices ?? [],
      startingGold: gold,
      personalityTraits: record?.personalityTraits ?? [],
      ideals: record?.ideals ?? [],
      bonds: record?.bonds ?? [],
      flaws: record?.flaws ?? [],
    })

  return (
    <EditorShell title="Geçmiş" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Sokak Çocuğu" />

      <CheckboxPool
        label="Beceri yeterlilikleri"
        hint="Geçmiş iki beceri verir."
        max={2}
        options={skills.all().map((s) => ({ value: s.id, label: s.name }))}
        selected={skillIds}
        onToggle={(id) =>
          setSkillIds(skillIds.includes(id) ? skillIds.filter((s) => s !== id) : [...skillIds, id])
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Seçilebilecek dil sayısı"
          hint="Acolyte iki dil seçtirir."
          min={0}
          max={4}
          value={languageCount}
          onChange={setLanguageCount}
        />
        <NumberField
          label="Başlangıç altını (gp)"
          min={0}
          value={gold}
          onChange={setGold}
        />
      </div>

      <TextField
        label="Geçmiş özelliğinin adı"
        value={featureName}
        onChange={setFeatureName}
        placeholder="Sokakların Dili"
      />
      <ParagraphsField label="Özelliğin açıklaması" value={featureDesc} onChange={setFeatureDesc} />
    </EditorShell>
  )
}
