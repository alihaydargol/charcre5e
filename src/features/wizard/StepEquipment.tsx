import { useMemo, useState } from 'react'
import type { Equipment } from '../../data/schema.ts'
import type { Character } from '../../rules/character.ts'
import { createRng, randomSeed } from '../../rules/dice.ts'
import {
  carriedWeight,
  fixedStartingEquipment,
  mergeQuantities,
  randomStartingEquipment,
  startingEquipmentChoices,
  startingGold,
  type ResolvedOption,
} from '../../rules/equipment.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import Section from './Section.tsx'

/**
 * Ekipman adımı.
 *
 * Sınıf ve geçmişin sunduğu seçenekler özyinelemelidir; `startingEquipmentChoices`
 * onları düz listeye çevirir. "Bir martial silah seç" gibi alt seçimler ikinci
 * bir açılır listeyle sorulur — bu, Aşama 3B'de eklenen ekipman kategorileri
 * sayesinde mümkün.
 */
export default function StepEquipment({
  character,
  equipment,
}: {
  character: Character
  equipment: Map<string, Equipment>
}) {
  const { setEquipment, toggleEquipped } = useCharacterStore()

  const groups = useMemo(
    () => startingEquipmentChoices(character, equipment),
    [character, equipment],
  )

  /** Grup indeksine göre seçilen seçenek indeksi ve alt seçim. */
  const [picked, setPicked] = useState<Record<number, { option: number; sub: string[] }>>({})

  const applySelection = (next: Record<number, { option: number; sub: string[] }>) => {
    setPicked(next)
    const items = [...fixedStartingEquipment(character)]
    for (const [groupIndex, choice] of Object.entries(next)) {
      const group = groups[Number(groupIndex)]
      const option = group?.options[choice.option]
      if (!option) continue
      items.push(...option.items)
      for (const id of choice.sub) items.push({ itemId: id, quantity: 1 })
    }
    setEquipment(mergeQuantities(items))
  }

  const chooseOption = (groupIndex: number, optionIndex: number) => {
    applySelection({ ...picked, [groupIndex]: { option: optionIndex, sub: [] } })
  }

  const chooseSub = (groupIndex: number, itemId: string, slot: number) => {
    const current = picked[groupIndex]
    if (!current) return
    const sub = [...current.sub]
    sub[slot] = itemId
    applySelection({ ...picked, [groupIndex]: { ...current, sub } })
  }

  const rollRandom = () => {
    const items = randomStartingEquipment(character, equipment, createRng(randomSeed()))
    setPicked({})
    setEquipment(items)
  }

  const weight = carriedWeight(character, equipment)
  const gold = startingGold(character)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={rollRandom}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Benim yerime seç
        </button>
        <button
          type="button"
          onClick={() => {
            setPicked({})
            setEquipment([])
          }}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Temizle
        </button>
        <p className="text-sm text-slate-500">
          Ekipman zorunlu değil — masan sonra dağıtacaksa boş bırakabilirsin.
        </p>
      </div>

      {groups.map((group, groupIndex) => (
        <Section key={`${group.source}-${groupIndex}`} title={group.source} hint={group.desc}>
          <ul className="grid gap-2">
            {group.options.map((option, optionIndex) => (
              <li key={optionIndex}>
                <button
                  type="button"
                  onClick={() => chooseOption(groupIndex, optionIndex)}
                  aria-pressed={picked[groupIndex]?.option === optionIndex}
                  className={[
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    picked[groupIndex]?.option === optionIndex
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  ].join(' ')}
                >
                  {optionLabel(option)}
                </button>

                {picked[groupIndex]?.option === optionIndex && option.pendingChoice && (
                  <div className="mt-2 space-y-2 pl-4">
                    {Array.from({ length: option.pendingChoice.choose }, (_, slot) => (
                      <label key={slot} className="block">
                        <span className="mb-1 block text-sm text-slate-600">
                          {option.pendingChoice!.label}
                          {option.pendingChoice!.choose > 1 && ` (${slot + 1}.)`}
                        </span>
                        <select
                          value={picked[groupIndex]?.sub[slot] ?? ''}
                          onChange={(e) => chooseSub(groupIndex, e.target.value, slot)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Seç…</option>
                          {option.pendingChoice!.from.map((id) => (
                            <option key={id} value={id}>
                              {equipment.get(id)?.name ?? id}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section
        title="Envanter"
        hint={`${weight.total} lb / ${weight.capacity} lb taşıma kapasitesi${gold > 0 ? ` · ${gold} gp` : ''}`}
      >
        {character.equipment.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Henüz eşya yok.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {character.equipment.map((entry) => {
                const item = equipment.get(entry.itemId)
                const equippable = item?.category === 'armor' || item?.category === 'weapon'
                return (
                  <li key={entry.itemId} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1">
                      {item?.name ?? entry.itemId}
                      {entry.quantity > 1 && (
                        <span className="text-slate-500"> ×{entry.quantity}</span>
                      )}
                    </span>
                    {item?.weight !== undefined && (
                      <span className="text-xs text-slate-400">
                        {item.weight * entry.quantity} lb
                      </span>
                    )}
                    {equippable && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.equipped}
                          onChange={() => toggleEquipped(entry.itemId)}
                        />
                        Kuşan
                      </label>
                    )}
                  </li>
                )
              })}
            </ul>
            {weight.effect && (
              <p className="mt-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
                {weight.effect}
              </p>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

function optionLabel(option: ResolvedOption): string {
  if (option.items.length === 0 && option.pendingChoice) return option.pendingChoice.label
  return option.label
}
