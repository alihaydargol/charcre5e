/**
 * Arayüzün ortak sınıf jetonları.
 *
 * Bu dizeler on beş dosyada elle tekrarlanıyordu ve zamanla ayrışmıştı: aynı
 * işi gören iki düğmenin dolgusu farklıydı, bazılarının odak halkası yoktu.
 * Tek noktada durunca hem tutarlılık hem de değiştirilebilirlik geliyor.
 *
 * Bileşen değil sabit olmalarının nedeni: düğmeler `type`, `disabled`,
 * `aria-*`, `onClick` gibi pek çok özellik alıyor ve hepsini saran bir bileşen
 * bunları tek tek geçirmek zorunda kalırdı. Sınıf jetonu `className` içine
 * konur, gerisi standart HTML kalır.
 */

/** Dokunma hedefi en az 40px yüksek olsun — telefonda parmakla basılabilmeli. */
const TOUCH = 'min-h-10'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-45 ' +
  TOUCH

/** Ana eylem: sayfada tek olmalı. */
export const btnPrimary = `${BUTTON_BASE} bg-accent text-on-accent hover:bg-accent-hover`

/** İkincil eylem: kenarlıklı, zeminsiz. */
export const btnSecondary = `${BUTTON_BASE} border border-border-strong bg-surface text-ink hover:bg-surface-hover`

/** Üçüncül eylem: yalnızca metin; silme gibi geri alınamayan işler için. */
export const btnGhost = `${BUTTON_BASE} text-muted hover:bg-surface-hover hover:text-accent`

/** Küçük düğme — kart içi eylemler, sayfalama. */
export const btnSmall =
  'inline-flex min-h-8 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-45'

export const btnSmallPrimary = `${btnSmall} bg-accent text-on-accent hover:bg-accent-hover`
export const btnSmallSecondary = `${btnSmall} border border-border-strong bg-surface text-ink hover:bg-surface-hover`
export const btnSmallGhost = `${btnSmall} text-muted hover:bg-surface-hover hover:text-accent`

/** Form girdisi. */
export const input =
  'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-faint'

/** Kart yüzeyi. */
export const card = 'rounded-xl border border-border bg-surface'

/** Kart yüzeyi + standart iç dolgu. */
export const cardPadded = `${card} p-4 sm:p-5`

/** Bölüm başlığı — kartların ve panellerin üstündeki küçük etiket. */
export const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-faint'
