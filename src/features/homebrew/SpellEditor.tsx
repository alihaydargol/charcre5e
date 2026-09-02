import { useState } from 'react'
import { classes, magicSchools } from '../../data/registry.ts'
import type { Spell } from '../../data/schema.ts'
import EditorShell from './EditorShell.tsx'
import { slugify } from './text.ts'
import {
  CheckboxPool,
  Field,
  ParagraphsField,
  SelectField,
  TextField,
  inputClass,
} from './fields.tsx'

const COMPONENTS = ['V', 'S', 'M'] as const

/**
 * Büyü düzenleyicisi.
 *
 * Şemadaki her alan doldurulmaz: hasar tabloları ve alan etkisi gibi yapılı
 * alanlar SRD verisini işlemek için var, elle girilmesi zahmetli ve hataya
 * açık. Homebrew büyü metnini serbest yazar; kural motoru zaten büyü hasarını
 * otomatik hesaplamıyor, karakter sayfasında gösteriyor.
 */
export default function SpellEditor({
  record,
  onSave,
  onCancel,
}: {
  record?: Spell
  onSave: (spell: Spell) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [level, setLevel] = useState(record?.level ?? 1)
  const [school, setSchool] = useState(record?.school ?? 'evocation')
  const [castingTime, setCastingTime] = useState(record?.castingTime ?? '1 action')
  const [range, setRange] = useState(record?.range ?? '60 feet')
  const [duration, setDuration] = useState(record?.duration ?? 'Instantaneous')
  const [components, setComponents] = useState<string[]>(record?.components ?? ['V', 'S'])
  const [material, setMaterial] = useState(record?.material ?? '')
  const [concentration, setConcentration] = useState(record?.concentration ?? false)
  const [ritual, setRitual] = useState(record?.ritual ?? false)
  const [classIds, setClassIds] = useState<string[]>(record?.classes ?? [])
  const [desc, setDesc] = useState<string[]>(record?.desc ?? [])
  const [higherLevel, setHigherLevel] = useState<string[]>(record?.higherLevel ?? [])

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (desc.length === 0) issues.push('Büyü ne yapıyor, en az bir paragraf yaz.')
  if (components.length === 0) issues.push('En az bir bileşen (V/S/M) seçmelisin.')
  if (classIds.length === 0) {
    issues.push('En az bir sınıf seçmelisin; yoksa büyüyü hiçbir karakter alamaz.')
  }
  if (components.includes('M') && !material.trim()) {
    issues.push('Materyal bileşeni seçildi ama malzeme yazılmadı.')
  }

  const save = () =>
    onSave({
      id: record?.id ?? slugify(name),
      name: name.trim(),
      source: 'homebrew',
      level,
      school,
      castingTime: castingTime.trim(),
      range: range.trim(),
      components: components as Spell['components'],
      material: components.includes('M') ? material.trim() : undefined,
      duration: duration.trim(),
      concentration,
      ritual,
      classes: classIds,
      subclasses: record?.subclasses ?? [],
      desc,
      higherLevel,
    })

  return (
    <EditorShell title="Büyü" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Thorn Whip" />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Seviye"
          value={String(level)}
          onChange={(value) => setLevel(Number(value))}
          options={Array.from({ length: 10 }, (_, i) => ({
            value: String(i),
            label: i === 0 ? 'Cantrip' : `${i}. seviye`,
          }))}
        />
        <SelectField
          label="Okul"
          value={school}
          onChange={setSchool}
          options={magicSchools.all().map((s) => ({ value: s.id, label: s.name }))}
        />
        <TextField label="Casting time" value={castingTime} onChange={setCastingTime} />
        <TextField label="Range" value={range} onChange={setRange} />
        <TextField label="Duration" value={duration} onChange={setDuration} />
        <Field label="Bileşenler">
          <div className="flex items-center gap-4 pt-1.5">
            {COMPONENTS.map((component) => (
              <label key={component} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={components.includes(component)}
                  onChange={() =>
                    setComponents(
                      components.includes(component)
                        ? components.filter((c) => c !== component)
                        : [...components, component],
                    )
                  }
                  className="accent-accent"
                />
                {component}
              </label>
            ))}
          </div>
        </Field>
      </div>

      {components.includes('M') && (
        <TextField
          label="Materyal"
          value={material}
          onChange={setMaterial}
          placeholder="a pinch of soot and salt"
        />
      )}

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={concentration}
            onChange={(e) => setConcentration(e.target.checked)}
            className="accent-accent"
          />
          Concentration
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ritual}
            onChange={(e) => setRitual(e.target.checked)}
            className="accent-accent"
          />
          Ritual
        </label>
      </div>

      <CheckboxPool
        label="Bu büyüyü kullanabilen sınıflar"
        options={classes.all().map((c) => ({ value: c.id, label: c.name }))}
        selected={classIds}
        onToggle={(id) =>
          setClassIds(classIds.includes(id) ? classIds.filter((c) => c !== id) : [...classIds, id])
        }
      />

      <ParagraphsField label="Açıklama" value={desc} onChange={setDesc} rows={6} />
      <Field
        label="Daha yüksek seviyede"
        hint="Boş bırakabilirsin; cantrip'lerde genelde gerekmez."
      >
        <textarea
          rows={2}
          value={higherLevel.join('\n\n')}
          onChange={(e) => setHigherLevel(e.target.value.trim() ? [e.target.value.trim()] : [])}
          className={inputClass}
        />
      </Field>
    </EditorShell>
  )
}
