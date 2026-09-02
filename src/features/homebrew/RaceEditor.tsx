import { useState } from 'react'
import { languages, skills } from '../../data/registry.ts'
import type { AbilityId, Race, Size, Trait } from '../../data/schema.ts'
import { ABILITY_IDS } from '../../rules/character.ts'
import EditorShell from './EditorShell.tsx'
import { childId, slugify } from './text.ts'
import {
  CheckboxPool,
  Field,
  NumberField,
  ParagraphsField,
  SelectField,
  TextField,
  inputClass,
} from './fields.tsx'

const SIZES: Size[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

/**
 * Irk düzenleyicisi.
 *
 * Irkın özellikleri (traits) ayrı kayıtlardır ama burada, ırkın içinde
 * düzenlenir: kullanıcı açısından "Darkvision" ırkın bir parçasıdır, ayrı bir
 * varlık değil. Kaydedince ırk ve özellikleri birlikte yazılır; ırk silinince
 * özellikleri de gider.
 *
 * Beceri veren özellikler `proficiencyChoice` üzerinden tanımlanır — SRD'deki
 * Half-Elf mekanizmasının aynısı. Böylece kural motoru homebrew bir ırkı
 * ayrıca tanımak zorunda kalmaz.
 */

interface TraitDraft {
  key: string
  name: string
  desc: string[]
  /** Bu özellik beceri seçtiriyorsa kaç tane. 0 = seçtirmiyor. */
  skillChoice: number
}

export default function RaceEditor({
  record,
  existingTraits,
  onSave,
  onCancel,
}: {
  record?: Race
  existingTraits: Trait[]
  onSave: (race: Race, traits: Trait[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [speed, setSpeed] = useState(record?.speed ?? 30)
  const [size, setSize] = useState<Size>(record?.size ?? 'Medium')
  const [sizeDesc, setSizeDesc] = useState(record?.sizeDesc ?? '')
  const [ageDesc, setAgeDesc] = useState(record?.ageDesc ?? '')
  const [alignmentDesc, setAlignmentDesc] = useState(record?.alignmentDesc ?? '')
  const [bonuses, setBonuses] = useState<Record<AbilityId, number>>(() => {
    const base = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    for (const bonus of record?.abilityBonuses ?? []) base[bonus.ability] = bonus.bonus
    return base
  })
  const [languageIds, setLanguageIds] = useState<string[]>(record?.languages ?? ['common'])
  const [languageChoiceCount, setLanguageChoiceCount] = useState(
    record?.languageChoice?.choose ?? 0,
  )
  const [traits, setTraits] = useState<TraitDraft[]>(() =>
    existingTraits.map((trait, index) => ({
      key: `${index}`,
      name: trait.name,
      desc: trait.desc,
      skillChoice: trait.proficiencyChoice?.choose ?? 0,
    })),
  )

  const totalBonus = ABILITY_IDS.reduce((sum, ability) => sum + bonuses[ability], 0)

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (languageIds.length === 0) issues.push('En az bir dil seçmelisin.')
  if (traits.some((t) => !t.name.trim())) issues.push('Adı boş bir özellik var.')
  if (totalBonus > 4) {
    issues.push(
      `Yetenek bonuslarının toplamı ${totalBonus}. SRD ırkları toplam +3 verir; +4'ten fazlası dengeyi bozar.`,
    )
  }

  const save = () => {
    const raceId = record?.id ?? slugify(name)

    const traitRecords: Trait[] = traits.map((draft, index) => ({
      id: childId(raceId, draft.name, index),
      name: draft.name.trim(),
      source: 'homebrew',
      desc: draft.desc,
      proficiencies: [],
      proficiencyChoice:
        draft.skillChoice > 0
          ? { choose: draft.skillChoice, from: skills.all().map((s) => s.id) }
          : undefined,
    }))

    onSave(
      {
        id: raceId,
        name: name.trim(),
        source: 'homebrew',
        speed,
        size,
        sizeDesc: sizeDesc.trim(),
        ageDesc: ageDesc.trim(),
        alignmentDesc: alignmentDesc.trim(),
        abilityBonuses: ABILITY_IDS.filter((ability) => bonuses[ability] !== 0).map((ability) => ({
          ability,
          bonus: bonuses[ability],
        })),
        languages: languageIds,
        languageDesc: '',
        languageChoice:
          languageChoiceCount > 0
            ? {
                choose: languageChoiceCount,
                from: languages.all().map((l) => l.id),
              }
            : undefined,
        traits: traitRecords.map((t) => t.id),
        subraces: [],
      },
      traitRecords,
    )
  }

  const updateTrait = (key: string, patch: Partial<TraitDraft>) =>
    setTraits(traits.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  return (
    <EditorShell title="Irk" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Aetherborn" />

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Hız (ft)" min={5} max={60} value={speed} onChange={setSpeed} />
        <SelectField
          label="Boyut"
          value={size}
          onChange={(value) => setSize(value as Size)}
          options={SIZES.map((s) => ({ value: s, label: s }))}
        />
        <NumberField
          label="Seçilebilecek ek dil"
          min={0}
          max={3}
          value={languageChoiceCount}
          onChange={setLanguageChoiceCount}
        />
      </div>

      <Field
        label="Yetenek bonusları"
        hint={`Toplam: +${totalBonus}. SRD ırkları toplam +3 verir.`}
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITY_IDS.map((ability) => (
            <label key={ability} className="text-center">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                {ability.toUpperCase()}
              </span>
              <input
                type="number"
                min={-2}
                max={4}
                value={bonuses[ability]}
                onChange={(e) => setBonuses({ ...bonuses, [ability]: Number(e.target.value) })}
                className={inputClass + ' text-center'}
              />
            </label>
          ))}
        </div>
      </Field>

      <CheckboxPool
        label="Bilinen diller"
        columns={4}
        options={languages.all().map((l) => ({ value: l.id, label: l.name }))}
        selected={languageIds}
        onToggle={(id) =>
          setLanguageIds(
            languageIds.includes(id)
              ? languageIds.filter((l) => l !== id)
              : [...languageIds, id],
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Boyut açıklaması" value={sizeDesc} onChange={setSizeDesc} />
        <TextField label="Yaş açıklaması" value={ageDesc} onChange={setAgeDesc} />
        <TextField label="Alignment açıklaması" value={alignmentDesc} onChange={setAlignmentDesc} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-500">Irk özellikleri</legend>
        {traits.map((trait) => (
          <div key={trait.key} className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Özellik adı"
                  value={trait.name}
                  onChange={(value) => updateTrait(trait.key, { name: value })}
                  placeholder="Darkvision"
                />
              </div>
              <div className="w-40">
                <NumberField
                  label="Seçtirdiği beceri"
                  min={0}
                  max={4}
                  value={trait.skillChoice}
                  onChange={(value) => updateTrait(trait.key, { skillChoice: value })}
                />
              </div>
              <button
                type="button"
                onClick={() => setTraits(traits.filter((t) => t.key !== trait.key))}
                className="pb-2 text-sm text-slate-500 underline hover:text-accent"
              >
                kaldır
              </button>
            </div>
            <ParagraphsField
              label="Açıklama"
              rows={3}
              value={trait.desc}
              onChange={(value) => updateTrait(trait.key, { desc: value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setTraits([
              ...traits,
              { key: crypto.randomUUID(), name: '', desc: [], skillChoice: 0 },
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
