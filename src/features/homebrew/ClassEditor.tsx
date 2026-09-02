import { useState } from 'react'
import { proficiencies, skills } from '../../data/registry.ts'
import type { AbilityId, CharacterClass, ClassLevel, Feature } from '../../data/schema.ts'
import { ABILITY_IDS } from '../../rules/character.ts'
import {
  STANDARD_ASI_LEVELS,
  buildClassLevels,
  buildSpellcasting,
  spellcastingModels,
} from '../../rules/classTable.ts'
import EditorShell from './EditorShell.tsx'
import { childId, slugify } from './text.ts'
import {
  CheckboxPool,
  Field,
  NumberField,
  ParagraphsField,
  SelectField,
  TextField,
} from './fields.tsx'

const HIT_DICE = [6, 8, 10, 12]

/**
 * Sınıf düzenleyicisi.
 *
 * Bir sınıfı elle 20 satırlık tabloyla tanımlatmak yorucu ve hataya açık
 * olurdu; tablo `rules/classTable.ts` tarafından üretilir. Kullanıcı yalnızca
 * sınıfın kimliğini (hit die, kurtarma atışları, yeterlilikler), ASI
 * seviyelerini ve seviye seviye özellikleri girer.
 *
 * Büyü ilerlemesi türetilmez, kopyalanır: "hangi sınıf gibi büyü yapsın"
 * sorusu sorulur ve o sınıfın slot tablosu aynen alınır. Tam kaster, yarı
 * kaster ve Pact Magic tabloları birbirinin türevi değildir.
 */

/** Zırh, silah ve alet yeterlilikleri — beceriler ayrı seçilir. */
function equipmentProficiencyOptions() {
  return proficiencies
    .all()
    .filter((p) => p.type !== 'Skills' && p.type !== 'Saving Throws')
    .map((p) => ({ value: p.id, label: p.name }))
}

interface FeatureDraft {
  key: string
  level: number
  name: string
  desc: string[]
}

export default function ClassEditor({
  record,
  existingFeatures,
  existingLevels,
  onSave,
  onCancel,
}: {
  record?: CharacterClass
  existingFeatures: Feature[]
  existingLevels: ClassLevel[]
  onSave: (cls: CharacterClass, features: Feature[], levels: ClassLevel[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(record?.name ?? '')
  const [hitDie, setHitDie] = useState(record?.hitDie ?? 8)
  const [savingThrows, setSavingThrows] = useState<string[]>(record?.savingThrows ?? [])
  const [profIds, setProfIds] = useState<string[]>(record?.proficiencies ?? [])
  const [skillCount, setSkillCount] = useState(record?.skillChoice?.choose ?? 2)
  const [skillPool, setSkillPool] = useState<string[]>(
    record?.skillChoice?.from ?? skills.all().map((s) => s.id),
  )
  const [subclassLevel, setSubclassLevel] = useState(record?.subclassLevel ?? 3)
  const [modelId, setModelId] = useState(record?.spellcasting ? findModel(record) : '')
  const [castingAbility, setCastingAbility] = useState<AbilityId>(
    record?.spellcasting?.ability ?? 'int',
  )
  const [extraAsi, setExtraAsi] = useState<number[]>(() =>
    existingLevels
      .filter((row) => row.abilityScoreBonuses > 0 && !STANDARD_ASI_LEVELS.includes(row.level))
      .map((row) => row.level),
  )
  const [features, setFeatures] = useState<FeatureDraft[]>(() =>
    existingFeatures
      .slice()
      .sort((a, b) => a.level - b.level)
      .map((f, index) => ({ key: `${index}`, level: f.level, name: f.name, desc: f.desc })),
  )

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (savingThrows.length !== 2) {
    issues.push(`Sınıflar iki kurtarma atışı yeterliliği verir; ${savingThrows.length} seçtin.`)
  }
  if (skillPool.length < skillCount) {
    issues.push(`${skillCount} beceri seçtiriyorsun ama havuzda ${skillPool.length} beceri var.`)
  }
  if (features.some((f) => !f.name.trim())) issues.push('Adı boş bir özellik var.')

  const save = () => {
    const classId = record?.id ?? slugify(name)

    const featureRecords: Feature[] = features.map((draft, index) => ({
      id: childId(classId, draft.name, index),
      name: draft.name.trim(),
      source: 'homebrew',
      classId,
      level: draft.level,
      desc: draft.desc,
    }))

    const cls: CharacterClass = {
      id: classId,
      name: name.trim(),
      source: 'homebrew',
      hitDie,
      savingThrows: savingThrows as AbilityId[],
      proficiencies: profIds,
      skillChoice: { choose: skillCount, from: skillPool },
      proficiencyChoices: [],
      subclasses: record?.subclasses ?? [],
      subclassLevel,
      spellcasting: modelId ? buildSpellcasting(modelId, castingAbility) : undefined,
      startingEquipment: record?.startingEquipment ?? [],
      startingEquipmentChoices: record?.startingEquipmentChoices ?? [],
    }

    const levels = buildClassLevels({
      classId,
      spellcastingModelId: modelId || undefined,
      extraAsiLevels: extraAsi,
      features: featureRecords,
    })

    onSave(cls, featureRecords, levels)
  }

  const updateFeature = (key: string, patch: Partial<FeatureDraft>) =>
    setFeatures(features.map((f) => (f.key === key ? { ...f, ...patch } : f)))

  const asiLevels = [...new Set([...STANDARD_ASI_LEVELS, ...extraAsi])].sort((a, b) => a - b)

  return (
    <EditorShell title="Sınıf" issues={issues} onSave={save} onCancel={onCancel}>
      <TextField label="İsim" value={name} onChange={setName} placeholder="Witch Hunter" />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Hit die"
          value={String(hitDie)}
          onChange={(value) => setHitDie(Number(value))}
          options={HIT_DICE.map((d) => ({ value: String(d), label: `d${d}` }))}
        />
        <NumberField
          label="Alt sınıf seviyesi"
          hint="SRD sınıflarında 1, 2 veya 3."
          min={1}
          max={20}
          value={subclassLevel}
          onChange={setSubclassLevel}
        />
        <NumberField
          label="Seçilecek beceri sayısı"
          min={0}
          max={6}
          value={skillCount}
          onChange={setSkillCount}
        />
      </div>

      <CheckboxPool
        label="Kurtarma atışı yeterlilikleri"
        hint="Sınıf iki tane verir."
        max={2}
        columns={6}
        options={ABILITY_IDS.map((a) => ({ value: a, label: a.toUpperCase() }))}
        selected={savingThrows}
        onToggle={(id) =>
          setSavingThrows(
            savingThrows.includes(id)
              ? savingThrows.filter((s) => s !== id)
              : [...savingThrows, id],
          )
        }
      />

      <CheckboxPool
        label="Beceri havuzu"
        hint="Oyuncu bu listeden seçecek."
        columns={4}
        options={skills.all().map((s) => ({ value: s.id, label: s.name }))}
        selected={skillPool}
        onToggle={(id) =>
          setSkillPool(
            skillPool.includes(id) ? skillPool.filter((s) => s !== id) : [...skillPool, id],
          )
        }
      />

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Zırh, silah ve alet yeterlilikleri ({profIds.length} seçili)
        </summary>
        <div className="mt-3">
          <CheckboxPool
            label=""
            columns={3}
            options={equipmentProficiencyOptions()}
            selected={profIds}
            onToggle={(id) =>
              setProfIds(profIds.includes(id) ? profIds.filter((p) => p !== id) : [...profIds, id])
            }
          />
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Büyü ilerlemesi"
          hint="Seçilen sınıfın slot tablosu ve büyü listesi kullanılır."
          value={modelId}
          onChange={setModelId}
          placeholder="Büyü yapmaz"
          options={spellcastingModels().map((c) => ({ value: c.id, label: `${c.name} gibi` }))}
        />
        {modelId && (
          <SelectField
            label="Büyü yeteneği"
            value={castingAbility}
            onChange={(value) => setCastingAbility(value as AbilityId)}
            options={ABILITY_IDS.map((a) => ({ value: a, label: a.toUpperCase() }))}
          />
        )}
      </div>

      <Field
        label="ASI seviyeleri"
        hint={`Şu an: ${asiLevels.join(', ')}. Fighter 6 ve 14'te, Rogue 10'da fazladan hak verir.`}
      >
        <div className="grid grid-cols-10 gap-1 pt-1">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((level) => {
            const standard = STANDARD_ASI_LEVELS.includes(level)
            const active = standard || extraAsi.includes(level)
            return (
              <button
                key={level}
                type="button"
                disabled={standard}
                onClick={() =>
                  setExtraAsi(
                    extraAsi.includes(level)
                      ? extraAsi.filter((l) => l !== level)
                      : [...extraAsi, level],
                  )
                }
                title={standard ? 'Standart ASI seviyesi' : undefined}
                className={`rounded py-1 text-xs ${
                  active
                    ? 'bg-accent text-white'
                    : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                } ${standard ? 'opacity-70' : ''}`}
              >
                {level}
              </button>
            )
          })}
        </div>
      </Field>

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
                  placeholder="Hunter's Mark"
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
              { key: crypto.randomUUID(), level: 1, name: '', desc: [] },
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

/**
 * Kayıtlı bir sınıfın hangi SRD sınıfını model aldığını geri bulur.
 *
 * Model id'si `spellList` alanında duruyor. Bu alan eklenmeden önce kaydedilmiş
 * bir sınıf için başlangıç seviyesi ve Pact Magic bayrağından tahmin edilir.
 */
function findModel(cls: CharacterClass): string {
  const casting = cls.spellcasting
  if (!casting) return ''
  if (casting.spellList) return casting.spellList
  const match = spellcastingModels().find(
    (model) =>
      model.spellcasting?.startLevel === casting.startLevel &&
      model.spellcasting?.pactMagic === casting.pactMagic,
  )
  return match?.id ?? ''
}
