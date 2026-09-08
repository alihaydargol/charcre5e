import { useState } from 'react'
import { backgrounds, skills } from '../../data/registry.ts'
import type { Character, CustomBackground } from '../../rules/character.ts'
import { getValidChoices } from '../../rules/choices.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import OptionGrid from './OptionGrid.tsx'
import Section from './Section.tsx'
import { input } from '../../components/ui.ts'

const EMPTY_CUSTOM: CustomBackground = {
  name: '',
  featureName: '',
  featureDesc: '',
  skillIds: [],
  toolIds: [],
  languageCount: 0,
}

/**
 * Geçmiş adımı.
 *
 * SRD yalnızca tek geçmiş (Acolyte) içerir. Bu bir eksik değil, lisansın
 * sınırı; kalanı kullanıcının kendi geçmişini tanımlamasıyla karşılanır
 * (bkz. CLAUDE.md). Bu yüzden özel geçmiş ikinci sınıf bir seçenek gibi değil,
 * eşit bir seçenek olarak sunulur.
 */
export default function StepBackground({ character }: { character: Character }) {
  const { setSrdBackground, setCustomBackground } = useCharacterStore()
  const isCustom = character.background?.kind === 'custom'
  const [custom, setCustom] = useState<CustomBackground>(
    character.background?.kind === 'custom' ? character.background.value : EMPTY_CUSTOM,
  )

  const choices = getValidChoices(character, { kind: 'background' })
  const selectedSrd = character.background?.kind === 'srd' ? [character.background.id] : []

  const updateCustom = (patch: Partial<CustomBackground>) => {
    const next = { ...custom, ...patch }
    setCustom(next)
    setCustomBackground(next)
  }

  const toggleCustomSkill = (id: string) => {
    const has = custom.skillIds.includes(id)
    updateCustom({
      skillIds: has ? custom.skillIds.filter((s) => s !== id) : [...custom.skillIds, id],
    })
  }

  const srdBackground = character.background?.kind === 'srd'
    ? backgrounds.get(character.background.id)
    : undefined

  return (
    <div className="space-y-6">
      <Section
        title="Geçmiş"
        hint="Geçmişin karakterinin maceradan önceki hayatını ve iki beceri yeterliliğini belirler."
      >
        <OptionGrid options={choices.options} selected={selectedSrd} onToggle={setSrdBackground} />

        <button
          type="button"
          onClick={() => setCustomBackground(custom)}
          aria-pressed={isCustom}
          className={[
            'mt-2 w-full rounded-lg border p-3 text-left transition-colors',
            isCustom
              ? 'border-accent bg-accent-soft'
              : 'border-dashed border-border-strong bg-surface hover:bg-surface-muted',
          ].join(' ')}
        >
          <span className="font-medium">Kendi geçmişimi tanımlayacağım</span>
          <span className="mt-0.5 block text-sm text-muted">
            SRD yalnızca Acolyte içerir. Kendi geçmişini yazmak resmî kurallara aykırı değil;
            oyun kitabı da bunu önerir.
          </span>
        </button>
      </Section>

      {srdBackground && (
        <Section title={`${srdBackground.name} ayrıntıları`}>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <span className="font-medium text-ink">Beceriler:</span>{' '}
              {srdBackground.proficiencies
                .map((id) => skills.get(id)?.name ?? id)
                .join(', ')}
            </li>
            {srdBackground.languageChoiceCount > 0 && (
              <li>
                <span className="font-medium text-ink">Dil:</span> istediğin{' '}
                {srdBackground.languageChoiceCount} dil
              </li>
            )}
            <li>
              <span className="font-medium text-ink">Başlangıç altını:</span>{' '}
              {srdBackground.startingGold} gp
            </li>
            <li>
              <span className="font-medium text-ink">{srdBackground.feature.name}:</span>{' '}
              {srdBackground.feature.desc[0]}
            </li>
          </ul>
        </Section>
      )}

      {isCustom && (
        <Section title="Özel geçmiş" hint="En az bir beceri seçmelisin.">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Geçmişin adı</span>
              <input
                type="text"
                value={custom.name}
                onChange={(e) => updateCustom({ name: e.target.value })}
                placeholder="ör. Şehir Muhafızı, Gezgin Tüccar"
                className={input}
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium">
                Beceriler ({custom.skillIds.length} seçildi)
              </span>
              <OptionGrid
                options={skills.all().map((s) => ({
                  id: s.id,
                  name: s.name,
                  description: s.ability.toUpperCase(),
                }))}
                selected={custom.skillIds}
                onToggle={toggleCustomSkill}
                columns={3}
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Özellik adı (isteğe bağlı)</span>
              <input
                type="text"
                value={custom.featureName}
                onChange={(e) => updateCustom({ featureName: e.target.value })}
                placeholder="ör. Kapı Ağzı"
                className={input}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Özellik açıklaması</span>
              <textarea
                value={custom.featureDesc}
                onChange={(e) => updateCustom({ featureDesc: e.target.value })}
                rows={3}
                placeholder="Bu geçmişin sana oyunda ne sağladığını yaz."
                className={input}
              />
            </label>
          </div>
        </Section>
      )}
    </div>
  )
}
