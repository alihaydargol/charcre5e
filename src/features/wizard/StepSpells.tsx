import { useMemo, useState } from 'react'
import { classes, type Collection } from '../../data/registry.ts'
import type { Spell } from '../../data/schema.ts'
import type { Character } from '../../rules/character.ts'
import { createRng, pickMany, randomSeed } from '../../rules/dice.ts'
import { maxSpellLevelFor, spellcasting, wizardSpellbookSize } from '../../rules/spellcasting.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import Section from './Section.tsx'

/**
 * Büyü seçimi.
 *
 * 5e'de iki farklı model vardır ve karıştırılmamalıdır:
 *  - **Bilen** sınıflar (Bard, Ranger, Sorcerer, Warlock) sabit sayıda büyü seçer.
 *  - **Hazırlayan** sınıflar (Cleric, Druid, Paladin) tüm sınıf listesine erişir;
 *    her gün yeniden hazırlar, bu yüzden oluşturmada büyü seçmezler.
 *  - **Wizard** ikisinin arası: büyü defterine 6 büyü yazar, sonra hazırlar.
 */
export default function StepSpells({
  character,
  spells,
}: {
  character: Character
  spells: Collection<Spell>
}) {
  const { toggleCantrip, toggleSpell } = useCharacterStore()
  const [query, setQuery] = useState('')

  const casting = spellcasting(character)
  const info = casting[0]
  const cls = info ? classes.require(info.classId) : undefined

  const maxLevel = info ? maxSpellLevelFor(info.classId, character.classes[0].level) : 0

  const available = useMemo(() => {
    if (!info) return { cantrips: [], leveled: [] }
    const forClass = spells.all().filter((s) => s.classes.includes(info.classId))
    return {
      cantrips: forClass.filter((s) => s.level === 0),
      leveled: forClass.filter((s) => s.level > 0 && s.level <= maxLevel),
    }
  }, [spells, info, maxLevel])

  if (!info || !cls) {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
        Bu sınıf 1. seviyede büyü yapmıyor.
      </p>
    )
  }

  const cantripCount = info.cantripsKnown ?? 0
  // Wizard'ın defteri seviyeyle büyür; bilen sınıflarda sayı tablodan gelir.
  const spellCount =
    info.classId === 'wizard'
      ? wizardSpellbookSize(character.classes[0].level)
      : (info.spellsKnown ?? 0)
  const prepares = info.preparedCount !== undefined && info.classId !== 'wizard'

  const matches = (list: Spell[]) => {
    const q = query.trim().toLocaleLowerCase('tr')
    return q ? list.filter((s) => s.name.toLocaleLowerCase('tr').includes(q)) : list
  }

  const pickRandom = () => {
    const rng = createRng(randomSeed())
    for (const id of [...character.spells.cantrips]) toggleCantrip(id, cantripCount)
    for (const id of [...character.spells.known]) toggleSpell(id, spellCount)
    for (const spell of pickMany(available.cantrips, Math.min(cantripCount, available.cantrips.length), rng)) {
      toggleCantrip(spell.id, cantripCount)
    }
    if (spellCount > 0) {
      for (const spell of pickMany(available.leveled, Math.min(spellCount, available.leveled.length), rng)) {
        toggleSpell(spell.id, spellCount)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pickRandom}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Benim yerime seç
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Büyü ara"
          className="min-w-48 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {cantripCount > 0 && (
        <Section
          title="Cantrip"
          hint={`${cantripCount} cantrip seç. ${character.spells.cantrips.length}/${cantripCount} seçildi. Cantrip'ler slot harcamaz, sınırsız kullanılır.`}
        >
          <SpellList
            spells={matches(available.cantrips)}
            selected={character.spells.cantrips}
            onToggle={(id) => toggleCantrip(id, cantripCount)}
            full={character.spells.cantrips.length >= cantripCount}
          />
        </Section>
      )}

      {spellCount > 0 && (
        <Section
          title={info.classId === 'wizard' ? 'Büyü defteri' : 'Bilinen büyüler'}
          hint={
            info.classId === 'wizard'
              ? `Defterine ${spellCount} büyü yaz. ${character.spells.known.length}/${spellCount} seçildi.`
              : `${spellCount} büyü seç. ${character.spells.known.length}/${spellCount} seçildi.`
          }
        >
          <SpellList
            spells={matches(available.leveled)}
            selected={character.spells.known}
            onToggle={(id) => toggleSpell(id, spellCount)}
            full={character.spells.known.length >= spellCount}
          />
        </Section>
      )}

      {prepares && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {cls.name} büyü <em>hazırlar</em>: sınıfın tüm büyü listesine erişirsin ve her uzun
          dinlenmede yeniden hazırlarsın. Bu yüzden burada büyü seçmene gerek yok — bugün
          hazırlayabileceğin büyü sayısı <strong>{info.preparedCount}</strong>.
        </p>
      )}
    </div>
  )
}

function SpellList({
  spells,
  selected,
  onToggle,
  full,
}: {
  spells: Spell[]
  selected: string[]
  onToggle: (id: string) => void
  full: boolean
}) {
  if (spells.length === 0) {
    return <p className="text-sm text-slate-500">Aramaya uyan büyü yok.</p>
  }

  return (
    <ul className="grid max-h-96 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2">
      {spells.map((spell) => {
        const isSelected = selected.includes(spell.id)
        return (
          <li key={spell.id}>
            <button
              type="button"
              onClick={() => onToggle(spell.id)}
              disabled={full && !isSelected}
              aria-pressed={isSelected}
              className={[
                'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : full
                    ? 'cursor-not-allowed border-slate-100 opacity-50'
                    : 'border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="font-medium">{spell.name}</span>
              <span className="mt-0.5 block text-xs capitalize text-slate-500">
                {spell.level === 0 ? 'Cantrip' : `${spell.level}. seviye`} · {spell.school}
                {spell.concentration && ' · Conc.'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
