import { useEffect, useState } from 'react'
import { classes, loadEquipment, loadMagicItems, loadSpells, races, subraces } from '../data/registry.ts'
import { getClassLevel } from '../data/classLevels.ts'
import SpellBrowser from '../features/content/SpellBrowser.tsx'
import EquipmentBrowser from '../features/content/EquipmentBrowser.tsx'
import MagicItemBrowser from '../features/content/MagicItemBrowser.tsx'

/**
 * SRD içeriğini gözden geçirmek için tarayıcı.
 *
 * Bu sayfa aynı zamanda veri katmanının uçtan uca çalıştığını doğrular: eager
 * koleksiyonlar (ırk, sınıf) anında gelir; büyü ve ekipman ise sekmeye
 * tıklandığında ayrı bir chunk olarak indirilir.
 */

type Tab = 'races' | 'classes' | 'spells' | 'equipment' | 'magic'

const TABS: { id: Tab; label: string }[] = [
  { id: 'races', label: 'Irklar' },
  { id: 'classes', label: 'Sınıflar' },
  { id: 'spells', label: 'Büyüler' },
  { id: 'equipment', label: 'Ekipman' },
  { id: 'magic', label: 'Sihirli Eşyalar' },
]

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('races')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">SRD içeriği</h1>
        <p className="text-sm text-slate-600">
          Uygulamanın kullandığı SRD 5.1 verisi. Oyun terimleri özgün İngilizce hâliyle
          bırakılmıştır. Ayrıntı için kartlara tıkla.
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
      {tab === 'spells' && <LazySpells />}
      {tab === 'equipment' && <LazyEquipment />}
      {tab === 'magic' && <LazyMagicItems />}
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
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
        const topSlot = getClassLevel(cls.id, 20)?.spellcasting?.spellSlots.reduce(
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
  return (
    <p role="status" className="text-sm text-slate-500">
      Yükleniyor…
    </p>
  )
}

function LazySpells() {
  const { value, error } = useLazy(loadSpells)
  return value ? <SpellBrowser spells={value} /> : <Loading error={error} />
}

function LazyEquipment() {
  const { value, error } = useLazy(loadEquipment)
  return value ? <EquipmentBrowser equipment={value} /> : <Loading error={error} />
}

function LazyMagicItems() {
  const { value, error } = useLazy(loadMagicItems)
  return value ? <MagicItemBrowser magicItems={value} /> : <Loading error={error} />
}
