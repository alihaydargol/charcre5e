import { useState } from 'react'
import { damageTypes, weaponProperties } from '../../data/registry.ts'
import type { Equipment } from '../../data/schema.ts'
import EditorShell from './EditorShell.tsx'
import { slugify } from './text.ts'
import {
  CheckboxPool,
  NumberField,
  ParagraphsField,
  SelectField,
  TextField,
} from './fields.tsx'

type Kind = 'weapon' | 'armor' | 'gear'

/**
 * Eşya düzenleyicisi.
 *
 * Şema silah, zırh ve eşyayı `category` üzerinden ayırıyor; form da öyle. Silah
 * ve zırh alanları kural motoruna bağlıdır (saldırı bonusu, AC, stealth
 * dezavantajı), o yüzden serbest metin değil yapılı girilir.
 */
export default function EquipmentEditor({
  record,
  onSave,
  onCancel,
}: {
  record?: Equipment
  onSave: (item: Equipment) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<Kind>(
    record?.category === 'weapon' || record?.category === 'armor' ? record.category : 'gear',
  )
  const [name, setName] = useState(record?.name ?? '')
  const [cost, setCost] = useState(record?.cost?.quantity ?? 0)
  const [costUnit, setCostUnit] = useState(record?.cost?.unit ?? 'gp')
  const [weight, setWeight] = useState(record?.weight ?? 0)
  const [desc, setDesc] = useState<string[]>(record?.desc ?? [])

  const weapon = record?.category === 'weapon' ? record : undefined
  const [weaponCategory, setWeaponCategory] = useState(weapon?.weaponCategory ?? 'Simple')
  const [weaponRange, setWeaponRange] = useState(weapon?.weaponRange ?? 'Melee')
  const [damageDice, setDamageDice] = useState(weapon?.damage?.dice ?? '1d6')
  const [damageType, setDamageType] = useState(weapon?.damage?.type ?? 'slashing')
  const [twoHandedDice, setTwoHandedDice] = useState(weapon?.twoHandedDamage?.dice ?? '')
  const [properties, setProperties] = useState<string[]>(weapon?.properties ?? [])

  const armor = record?.category === 'armor' ? record : undefined
  const [armorCategory, setArmorCategory] = useState(armor?.armorCategory ?? 'Light')
  const [acBase, setAcBase] = useState(armor?.armorClass.base ?? 11)
  const [strMinimum, setStrMinimum] = useState(armor?.strMinimum ?? 0)
  const [stealthDisadvantage, setStealthDisadvantage] = useState(
    armor?.stealthDisadvantage ?? false,
  )

  const issues: string[] = []
  if (!name.trim()) issues.push('Bir isim vermelisin.')
  if (kind === 'weapon' && !/^\d+d\d+$/.test(damageDice.trim())) {
    issues.push('Hasar zarını "1d8" biçiminde yaz.')
  }
  if (kind === 'weapon' && twoHandedDice.trim() && !/^\d+d\d+$/.test(twoHandedDice.trim())) {
    issues.push('İki elle hasarı "1d10" biçiminde yaz ya da boş bırak.')
  }
  if (kind === 'weapon' && properties.includes('versatile') && !twoHandedDice.trim()) {
    issues.push('Versatile bir silahın iki elle hasarı yazılmalı.')
  }

  const save = () => {
    const base = {
      id: record?.id ?? slugify(name),
      name: name.trim(),
      source: 'homebrew' as const,
      cost: cost > 0 ? { quantity: cost, unit: costUnit as 'gp' } : undefined,
      weight: weight > 0 ? weight : undefined,
      desc,
    }

    if (kind === 'weapon') {
      onSave({
        ...base,
        category: 'weapon',
        weaponCategory: weaponCategory as 'Simple' | 'Martial',
        weaponRange: weaponRange as 'Melee' | 'Ranged',
        damage: { dice: damageDice.trim(), type: damageType },
        twoHandedDamage: twoHandedDice.trim()
          ? { dice: twoHandedDice.trim(), type: damageType }
          : undefined,
        properties,
      })
      return
    }

    if (kind === 'armor') {
      const isShield = armorCategory === 'Shield'
      onSave({
        ...base,
        category: 'armor',
        armorCategory: armorCategory as 'Light' | 'Medium' | 'Heavy' | 'Shield',
        armorClass: {
          base: acBase,
          // Kalkan sabit bonus verir; ağır zırh DEX eklemez; orta zırh +2 ile sınırlıdır.
          dexBonus: !isShield && armorCategory !== 'Heavy',
          maxDexBonus: armorCategory === 'Medium' ? 2 : null,
        },
        strMinimum,
        stealthDisadvantage,
      })
      return
    }

    onSave({ ...base, category: 'gear' })
  }

  return (
    <EditorShell title="Eşya" issues={issues} onSave={save} onCancel={onCancel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tür"
          value={kind}
          onChange={(value) => setKind(value as Kind)}
          options={[
            { value: 'weapon', label: 'Silah' },
            { value: 'armor', label: 'Zırh / kalkan' },
            { value: 'gear', label: 'Eşya' },
          ]}
        />
        <TextField label="İsim" value={name} onChange={setName} placeholder="Gökdemir Baltası" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Fiyat" min={0} value={cost} onChange={setCost} />
        <SelectField
          label="Para birimi"
          value={costUnit}
          onChange={(value) => setCostUnit(value as 'gp')}
          options={['cp', 'sp', 'ep', 'gp', 'pp'].map((u) => ({ value: u, label: u }))}
        />
        <NumberField label="Ağırlık (lb)" min={0} value={weight} onChange={setWeight} />
      </div>

      {kind === 'weapon' && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <SelectField
              label="Kategori"
              value={weaponCategory}
              onChange={(value) => setWeaponCategory(value as 'Simple')}
              options={[
                { value: 'Simple', label: 'Simple' },
                { value: 'Martial', label: 'Martial' },
              ]}
            />
            <SelectField
              label="Menzil"
              value={weaponRange}
              onChange={(value) => setWeaponRange(value as 'Melee')}
              options={[
                { value: 'Melee', label: 'Melee' },
                { value: 'Ranged', label: 'Ranged' },
              ]}
            />
            <TextField label="Hasar zarı" value={damageDice} onChange={setDamageDice} />
            <SelectField
              label="Hasar tipi"
              value={damageType}
              onChange={setDamageType}
              options={damageTypes.all().map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>

          <CheckboxPool
            label="Silah özellikleri"
            columns={4}
            options={weaponProperties.all().map((p) => ({ value: p.id, label: p.name }))}
            selected={properties}
            onToggle={(id) =>
              setProperties(
                properties.includes(id)
                  ? properties.filter((p) => p !== id)
                  : [...properties, id],
              )
            }
          />

          {properties.includes('versatile') && (
            <TextField
              label="İki elle hasar"
              hint="Longsword tek elle 1d8, iki elle 1d10 atar."
              value={twoHandedDice}
              onChange={setTwoHandedDice}
            />
          )}
        </>
      )}

      {kind === 'armor' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Zırh sınıfı"
              value={armorCategory}
              onChange={(value) => setArmorCategory(value as 'Light')}
              options={['Light', 'Medium', 'Heavy', 'Shield'].map((c) => ({
                value: c,
                label: c,
              }))}
            />
            <NumberField
              label={armorCategory === 'Shield' ? 'AC bonusu' : 'Taban AC'}
              min={0}
              max={20}
              value={acBase}
              onChange={setAcBase}
            />
            <NumberField
              label="STR gereksinimi"
              hint="0 = yok."
              min={0}
              max={20}
              value={strMinimum}
              onChange={setStrMinimum}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stealthDisadvantage}
              onChange={(e) => setStealthDisadvantage(e.target.checked)}
              className="accent-accent"
            />
            Stealth dezavantajı
          </label>
        </>
      )}

      <ParagraphsField label="Açıklama" value={desc} onChange={setDesc} rows={3} />
    </EditorShell>
  )
}
