import { useEffect, useState } from 'react'
import {
  classes,
  getClassLevel,
  loadEquipment,
  loadSpells,
  races,
  subraces,
} from '../data/registry.ts'
import type { Equipment, Spell } from '../data/schema.ts'

/**
 * SRD içeriğini gözden geçirmek için basit bir tarayıcı.
 *
 * Bu sayfa aynı zamanda veri katmanının uçtan uca çalıştığını doğrular: eager
 * koleksiyonlar (ırk, sınıf) anında gelir; büyü ve ekipman ise sekmeye
 * tıklandığında ayrı bir chunk olarak indirilir.
 */

type Tab = 'races' | 'classes' | 'spells' | 'equipment'

const TABS: { id: Tab; label: string }[] = [
  { id: 'races', label: 'Irklar' },
  { id: 'classes', label: 'Sınıflar' },
  { id: 'spells', label: 'Büyüler' },
  { id: 'equipment', label: 'Ekipman' },
]

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('races')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">SRD içeriği</h1>
        <p className="text-sm text-slate-600">
          Uygulamanın kullandığı SRD 5.1 verisi. Oyun terimleri özgün
          İngilizce hâliyle bırakılmıştır.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={[
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'races' && <RaceList />}
      {tab === 'classes' && <ClassList />}
      {tab === 'spells' && <SpellList />}
      {tab === 'equipment' && <EquipmentList />}
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </li>
  )
}

function RaceList() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {races.all().map((race) => {
        const bonuses = race.abilityBonuses
          .map((b) => `${b.ability.toUpperCase()} +${b.bonus}`)
          .join(', ')
        const subraceNames = race.subraces.map((id) => subraces.require(id).name)
        return (
          <Card key={race.id} title={race.name} subtitle={`${race.speed} ft · ${race.size}`}>
            <p>{bonuses || 'Sabit yetenek bonusu yok'}</p>
            {race.abilityBonusChoice && (
              <p className="mt-1">
                Ayrıca {race.abilityBonusChoice.choose} yetenekten +
                {race.abilityBonusChoice.bonus} seçilir.
              </p>
            )}
            {subraceNames.length > 0 && (
              <p className="mt-1 text-slate-500">Alt ırk: {subraceNames.join(', ')}</p>
            )}
          </Card>
        )
      })}
    </ul>
  )
}

function ClassList() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {classes.all().map((cls) => {
        const saves = cls.savingThrows.map((s) => s.toUpperCase()).join(', ')
        const level20 = getClassLevel(cls.id, 20)
        const topSlot = level20?.spellcasting?.spellSlots.reduce(
          (max, count, i) => (count > 0 ? i + 1 : max),
          0,
        )
        return (
          <Card key={cls.id} title={cls.name} subtitle={`d${cls.hitDie}`}>
            <p>Kurtarma atışı: {saves}</p>
            <p className="mt-1">
              Alt sınıf {cls.subclassLevel}. seviyede seçilir
              {cls.skillChoice ? ` · ${cls.skillChoice.choose} beceri seçilir` : ''}
            </p>
            {cls.spellcasting && (
              <p className="mt-1 text-slate-500">
                {cls.spellcasting.pactMagic ? 'Pact Magic' : 'Büyü'} ·{' '}
                {cls.spellcasting.ability.toUpperCase()} · {cls.spellcasting.startLevel}. seviyede
                başlar{topSlot ? ` · en yüksek ${topSlot}. seviye slot` : ''}
              </p>
            )}
          </Card>
        )
      })}
    </ul>
  )
}

/** Lazy koleksiyonları yüklerken kullanılan ortak durum yönetimi. */
function useLazy<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    load()
      .then((v) => active && setValue(v))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      active = false
    }
  }, [load])

  return { value, error }
}

function Loading({ error }: { error?: string }) {
  if (error) return <p className="text-sm text-accent">Veri yüklenemedi: {error}</p>
  return <p className="text-sm text-slate-500">Yükleniyor…</p>
}

function SpellList() {
  const { value: spells, error } = useLazy(loadSpells)
  const [query, setQuery] = useState('')

  if (!spells) return <Loading error={error} />

  const matches = spells
    .all()
    .filter((s: Spell) => s.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Büyü ara</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Büyü ara (ör. Fireball)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-slate-500">
        {matches.length} / {spells.size} büyü
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {matches.slice(0, 60).map((spell) => (
          <Card
            key={spell.id}
            title={spell.name}
            subtitle={spell.level === 0 ? 'Cantrip' : `${spell.level}. seviye`}
          >
            <p className="capitalize">
              {spell.school} · {spell.castingTime} · {spell.range}
              {spell.concentration ? ' · Concentration' : ''}
              {spell.ritual ? ' · Ritual' : ''}
            </p>
            <p className="mt-1 text-slate-500">{spell.classes.join(', ')}</p>
          </Card>
        ))}
      </ul>
      {matches.length > 60 && (
        <p className="text-xs text-slate-500">İlk 60 sonuç gösteriliyor; aramayı daraltın.</p>
      )}
    </div>
  )
}

function EquipmentList() {
  const { value: equipment, error } = useLazy(loadEquipment)

  if (!equipment) return <Loading error={error} />

  const describe = (item: Equipment) => {
    switch (item.category) {
      case 'weapon':
        return `${item.weaponCategory} ${item.weaponRange}${
          item.damage ? ` · ${item.damage.dice} ${item.damage.type}` : ''
        }`
      case 'armor':
        return `${item.armorCategory} · AC ${item.armorClass.base}${
          item.armorClass.dexBonus
            ? ` + DEX${item.armorClass.maxDexBonus !== null ? ` (en fazla ${item.armorClass.maxDexBonus})` : ''}`
            : ''
        }`
      default:
        return item.gearCategory?.replaceAll('-', ' ') ?? item.category
    }
  }

  const armorAndWeapons = equipment
    .all()
    .filter((i) => i.category === 'armor' || i.category === 'weapon')

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {armorAndWeapons.length} silah ve zırh (toplam {equipment.size} eşya)
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {armorAndWeapons.map((item) => (
          <Card
            key={item.id}
            title={item.name}
            subtitle={item.cost ? `${item.cost.quantity} ${item.cost.unit}` : undefined}
          >
            {describe(item)}
          </Card>
        ))}
      </ul>
    </div>
  )
}
