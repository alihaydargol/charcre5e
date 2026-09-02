import { create } from 'zustand'
import { HOMEBREW_KINDS, type HomebrewKind } from '../data/registry.ts'
import {
  emptyPack,
  installPack,
  loadHomebrew,
  mergePacks,
  saveHomebrew,
  type HomebrewPack,
} from './homebrew.ts'

/**
 * Homebrew içeriğin tek gerçek kaynağı.
 *
 * Paket değiştiğinde iki şey birden yapılır: registry'ye kurulur (kural motoru
 * ve sihirbaz anında görsün) ve localStorage'a yazılır. İkisi ayrı ayrı
 * çağrılabilseydi, kurulmuş ama kaydedilmemiş içerik sayfa yenilenince
 * kaybolurdu.
 */

interface HomebrewState {
  pack: HomebrewPack
  /** Yükleme ya da kurulum hatası; kullanıcıya gösterilir. */
  error?: string
  /** localStorage'a yazılamadıysa (kota/gizli sekme). */
  persistenceFailed: boolean

  /** Paketi değiştirir, kurar ve kaydeder. */
  commit: (mutate: (pack: HomebrewPack) => HomebrewPack) => void
  /** Bir türdeki kaydı ekler ya da aynı id'liyi günceller. */
  upsert: (kind: HomebrewKind, record: { id: string }) => void
  /** Bir kaydı ve ona bağlı türetilmiş satırları siler. */
  remove: (kind: HomebrewKind, id: string) => void
  /** İçe aktarılan paketi mevcut içeriğe ekler. */
  merge: (incoming: HomebrewPack) => void
  clearAll: () => void
}

/**
 * Açılışta kurulum.
 *
 * Store oluşturulurken yapılır ki uygulamanın hiçbir ekranı homebrew içeriği
 * olmayan bir registry görmesin. Kayıtlı paket bozuksa uygulama açılmaya devam
 * eder, hata kullanıcıya gösterilir.
 */
function bootstrap(): { pack: HomebrewPack; error?: string } {
  const { pack, error } = loadHomebrew()
  if (error) return { pack, error }
  try {
    installPack(pack)
    return { pack }
  } catch (cause) {
    return {
      pack: emptyPack(),
      error: `Homebrew içerik kurulamadı: ${(cause as Error).message}`,
    }
  }
}

export const useHomebrewStore = create<HomebrewState>((set, get) => {
  const initial = bootstrap()

  /** Kur, kaydet, state'e yaz. Kurulum başarısızsa hiçbiri değişmez. */
  const apply = (next: HomebrewPack) => {
    try {
      installPack(next)
    } catch (cause) {
      set({ error: `Kaydedilemedi: ${(cause as Error).message}` })
      return
    }
    const written = saveHomebrew(next)
    set({ pack: next, error: undefined, persistenceFailed: !written })
  }

  return {
    pack: initial.pack,
    error: initial.error,
    persistenceFailed: false,

    commit: (mutate) => apply(mutate(get().pack)),

    upsert: (kind, record) =>
      apply({
        ...get().pack,
        [kind]: [
          ...(get().pack[kind] as { id: string }[]).filter((r) => r.id !== record.id),
          record,
        ],
      } as HomebrewPack),

    remove: (kind, id) => {
      const pack = get().pack
      const next = {
        ...pack,
        [kind]: (pack[kind] as { id: string }[]).filter((r) => r.id !== id),
      } as HomebrewPack

      // Sınıf silinince ona ait seviye tablosu ve özellikler de gider;
      // aksi hâlde var olmayan bir sınıfa bakan satırlar kalırdı.
      if (kind === 'classes') {
        next.classLevels = pack.classLevels.filter((row) => row.classId !== id)
        next.features = pack.features.filter((f) => f.classId !== id)
        next.subclasses = pack.subclasses.filter((s) => s.classId !== id)
      }
      if (kind === 'races') {
        next.subraces = pack.subraces.filter((s) => s.raceId !== id)
      }
      apply(next)
    },

    merge: (incoming) => apply(mergePacks(get().pack, incoming)),

    clearAll: () => apply(emptyPack()),
  }
})

/** Bir türün homebrew kayıt sayısı — rozet ve sekme sayaçları için. */
export function homebrewCounts(pack: HomebrewPack): Record<HomebrewKind, number> {
  const counts = {} as Record<HomebrewKind, number>
  for (const kind of HOMEBREW_KINDS) counts[kind] = pack[kind].length
  return counts
}
