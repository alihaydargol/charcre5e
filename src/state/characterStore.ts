import { create } from 'zustand'
import type { AbilityId } from '../data/schema.ts'
import {
  createEmptyCharacter,
  type AbilityMethod,
  type Character,
  type CustomBackground,
  type HpMethod,
  type LevelChoice,
} from '../rules/character.ts'
import { clearDraft, loadCharacters, loadDraft, saveCharacters, saveDraft } from './storage.ts'

/**
 * Sihirbazın üzerinde çalıştığı karakter taslağı ve kayıtlı karakterler.
 *
 * Taslak her değişiklikte localStorage'a yazılır; sekme kapansa bile kaybolmaz.
 * Türetilmiş hiçbir değer burada tutulmaz — hepsi `src/rules/` fonksiyonlarıyla
 * anlık hesaplanır.
 */

interface CharacterState {
  draft: Character
  saved: Character[]
  loadErrors: { id: string; message: string }[]
  /** Kayıt yazılamadıysa (kota/gizli sekme) kullanıcıya bildirilir. */
  persistenceFailed: boolean

  update: (mutate: (draft: Character) => void) => void
  reset: () => void
  loadForEditing: (id: string) => void

  setRace: (raceId: string) => void
  setSubrace: (subraceId: string) => void
  toggleRaceAbilityBonus: (ability: AbilityId, max: number) => void
  setClass: (classId: string) => void
  setAbilityMethod: (method: AbilityMethod) => void
  setAbility: (ability: AbilityId, score: number) => void
  setAbilities: (scores: Record<AbilityId, number>) => void
  setSrdBackground: (id: string) => void
  setCustomBackground: (value: CustomBackground) => void
  toggleSkill: (skillId: string, max: number) => void
  toggleLanguage: (languageId: string, max: number, pool: string[]) => void
  toggleTool: (toolId: string, max: number, pool: string[]) => void
  setEquipment: (items: { itemId: string; quantity: number }[]) => void
  toggleEquipped: (itemId: string) => void
  toggleCantrip: (spellId: string, max: number) => void
  toggleSpell: (spellId: string, max: number) => void
  setName: (name: string) => void
  setNote: (key: keyof Character['notes'], value: string) => void

  setLevel: (level: number) => void
  setLevelChoice: (choice: LevelChoice) => void
  clearLevelChoice: (kind: LevelChoice['kind'], classId: string, level: number) => void
  setHpMethod: (method: HpMethod) => void
  setHpRoll: (levelIndex: number, value: number) => void
  setHpManualTotal: (total: number | undefined) => void

  saveDraftAsCharacter: () => string
  deleteCharacter: (id: string) => void
  duplicateCharacter: (id: string) => void
  importCharacter: (character: Character) => void
}

function newId(): string {
  return `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const initialLoad = loadCharacters()

export const useCharacterStore = create<CharacterState>((set, get) => ({
  draft: loadDraft() ?? createEmptyCharacter(newId()),
  saved: initialLoad.characters,
  loadErrors: initialLoad.errors,
  persistenceFailed: false,

  /**
   * Taslağı değiştirir ve diske yazar. Mutasyon fonksiyonu bir kopya üzerinde
   * çalışır; store'daki nesne asla yerinde değiştirilmez.
   */
  update: (mutate) =>
    set((state) => {
      const draft: Character = structuredClone(state.draft)
      mutate(draft)
      draft.updatedAt = new Date().toISOString()
      const written = saveDraft(draft)
      return { draft, persistenceFailed: !written }
    }),

  reset: () => {
    clearDraft()
    set({ draft: createEmptyCharacter(newId()) })
  },

  loadForEditing: (id) => {
    const character = get().saved.find((c) => c.id === id)
    if (!character) return
    const draft = structuredClone(character)
    saveDraft(draft)
    set({ draft })
  },

  setRace: (raceId) =>
    get().update((draft) => {
      if (draft.raceId === raceId) return
      draft.raceId = raceId
      // Irk değişince ona bağlı seçimler geçersizleşir.
      draft.subraceId = undefined
      draft.raceAbilityChoice = []
      draft.proficiencies.languages = []
    }),

  setSubrace: (subraceId) => get().update((draft) => void (draft.subraceId = subraceId)),

  toggleRaceAbilityBonus: (ability, max) =>
    get().update((draft) => {
      const current = draft.raceAbilityChoice
      const index = current.indexOf(ability)
      if (index >= 0) current.splice(index, 1)
      else if (current.length < max) current.push(ability)
    }),

  setClass: (classId) =>
    get().update((draft) => {
      if (draft.classes[0]?.classId === classId) return
      draft.classes = [{ classId, level: 1 }]
      // Sınıf değişince sınıfa bağlı her şey sıfırlanır.
      draft.proficiencies.skills = []
      draft.spells = { cantrips: [], known: [], prepared: [] }
      draft.levelChoices = []
      draft.equipment = []
    }),

  setAbilityMethod: (method) =>
    get().update((draft) => {
      draft.abilityMethod = method
      if (method === 'pointbuy') {
        draft.abilities = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
      }
    }),

  setAbility: (ability, score) => get().update((draft) => void (draft.abilities[ability] = score)),

  setAbilities: (scores) => get().update((draft) => void (draft.abilities = { ...scores })),

  setSrdBackground: (id) =>
    get().update((draft) => {
      draft.background = { kind: 'srd', id }
      // Geçmiş değişince onun verdiği becerilerle çakışan sınıf seçimleri
      // geçersizleşebilir; kullanıcı adımda düzeltsin diye temizliyoruz.
      draft.proficiencies.skills = []
    }),

  setCustomBackground: (value) =>
    get().update((draft) => {
      draft.background = { kind: 'custom', value }
      draft.proficiencies.skills = []
    }),

  toggleSkill: (skillId, max) =>
    get().update((draft) => {
      const list = draft.proficiencies.skills
      const index = list.indexOf(skillId)
      if (index >= 0) list.splice(index, 1)
      else if (list.length < max) list.push(skillId)
    }),

  toggleLanguage: (languageId, max, pool) =>
    get().update((draft) => {
      const list = draft.proficiencies.languages
      const index = list.indexOf(languageId)
      if (index >= 0) {
        list.splice(index, 1)
        return
      }
      // Sınır yalnızca bu havuzdan seçilenler için geçerli.
      const fromPool = list.filter((id) => pool.includes(id))
      if (fromPool.length < max) list.push(languageId)
    }),

  toggleTool: (toolId, max, pool) =>
    get().update((draft) => {
      const list = draft.proficiencies.tools
      const index = list.indexOf(toolId)
      if (index >= 0) {
        list.splice(index, 1)
        return
      }
      const fromPool = list.filter((id) => pool.includes(id))
      if (fromPool.length < max) list.push(toolId)
    }),

  setEquipment: (items) =>
    get().update((draft) => {
      draft.equipment = items.map((item) => ({ ...item, equipped: false }))
    }),

  toggleEquipped: (itemId) =>
    get().update((draft) => {
      const entry = draft.equipment.find((e) => e.itemId === itemId)
      if (entry) entry.equipped = !entry.equipped
    }),

  toggleCantrip: (spellId, max) =>
    get().update((draft) => {
      const list = draft.spells.cantrips
      const index = list.indexOf(spellId)
      if (index >= 0) list.splice(index, 1)
      else if (list.length < max) list.push(spellId)
    }),

  toggleSpell: (spellId, max) =>
    get().update((draft) => {
      const list = draft.spells.known
      const index = list.indexOf(spellId)
      if (index >= 0) list.splice(index, 1)
      else if (list.length < max) list.push(spellId)
    }),

  setName: (name) => get().update((draft) => void (draft.name = name)),

  setNote: (key, value) => get().update((draft) => void (draft.notes[key] = value)),

  /**
   * Sınıf seviyesini değiştirir.
   *
   * Seviye düşürülünce o seviyenin üstünde yapılmış seçimler ve atılan hit
   * die'lar silinir — aksi hâlde karakterde artık geçerli olmayan seçimler
   * kalır ve türetilmiş değerler yanlış çıkar.
   */
  setLevel: (level) =>
    get().update((draft) => {
      const primary = draft.classes[0]
      if (!primary) return
      const next = Math.min(20, Math.max(1, level))
      primary.level = next
      draft.levelChoices = draft.levelChoices.filter((c) => c.level <= next)
      draft.hp.rolls = draft.hp.rolls.slice(0, Math.max(0, next - 1))
    }),

  /** Bir karar noktasının cevabını kaydeder; aynı noktanın eski cevabı düşer. */
  setLevelChoice: (choice) =>
    get().update((draft) => {
      // ASI ve feat aynı karar noktasının iki cevabıdır; biri diğerini siler.
      const conflicting: LevelChoice['kind'][] =
        choice.kind === 'asi' || choice.kind === 'feat' ? ['asi', 'feat'] : [choice.kind]

      draft.levelChoices = draft.levelChoices.filter(
        (c) =>
          !(
            conflicting.includes(c.kind) &&
            c.classId === choice.classId &&
            c.level === choice.level
          ),
      )
      draft.levelChoices.push(choice)
      draft.levelChoices.sort((a, b) => a.level - b.level)
    }),

  clearLevelChoice: (kind, classId, level) =>
    get().update((draft) => {
      const conflicting: LevelChoice['kind'][] =
        kind === 'asi' || kind === 'feat' ? ['asi', 'feat'] : [kind]
      draft.levelChoices = draft.levelChoices.filter(
        (c) => !(conflicting.includes(c.kind) && c.classId === classId && c.level === level),
      )
    }),

  setHpMethod: (method) => get().update((draft) => void (draft.hp.method = method)),

  /** `levelIndex` 0 = 2. seviye (1. seviyede zar atılmaz, hit die maks alınır). */
  setHpRoll: (levelIndex, value) =>
    get().update((draft) => {
      const rolls = [...draft.hp.rolls]
      rolls[levelIndex] = value
      draft.hp.rolls = rolls
    }),

  setHpManualTotal: (total) => get().update((draft) => void (draft.hp.manualTotal = total)),

  /** Taslağı kalıcı listeye taşır. Var olan bir karakterse üzerine yazar. */
  saveDraftAsCharacter: () => {
    const { draft, saved } = get()
    const record = structuredClone(draft)
    record.updatedAt = new Date().toISOString()

    const existing = saved.findIndex((c) => c.id === record.id)
    // Array.prototype.with ES2023'tür; eski tarayıcılarda da çalışsın diye elle kopyalıyoruz.
    const next =
      existing >= 0 ? saved.map((c, i) => (i === existing ? record : c)) : [...saved, record]

    const written = saveCharacters(next)
    clearDraft()
    set({ saved: next, draft: createEmptyCharacter(newId()), persistenceFailed: !written })
    return record.id
  },

  deleteCharacter: (id) =>
    set((state) => {
      const next = state.saved.filter((c) => c.id !== id)
      return { saved: next, persistenceFailed: !saveCharacters(next) }
    }),

  duplicateCharacter: (id) =>
    set((state) => {
      const source = state.saved.find((c) => c.id === id)
      if (!source) return state
      const copy = structuredClone(source)
      copy.id = newId()
      copy.name = `${source.name} (kopya)`
      copy.createdAt = new Date().toISOString()
      copy.updatedAt = copy.createdAt
      const next = [...state.saved, copy]
      return { saved: next, persistenceFailed: !saveCharacters(next) }
    }),

  importCharacter: (character) =>
    set((state) => {
      const record = structuredClone(character)
      // İçe aktarılan karakter var olanın üzerine yazmasın.
      if (state.saved.some((c) => c.id === record.id)) record.id = newId()
      const next = [...state.saved, record]
      return { saved: next, persistenceFailed: !saveCharacters(next) }
    }),
}))
