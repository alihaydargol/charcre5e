/**
 * Tema tercihi: aydınlık, karanlık ya da sistem.
 *
 * Üç seçenek var çünkü ikisi yetmiyor — "sistem" seçen kullanıcı telefonunun
 * akşam koyuya geçmesini bekler, aydınlık seçen ise sistemi ne derse desin
 * aydınlık kalmasını.
 *
 * Uygulanan tema `<html data-theme="...">` üzerinden yazılır; CSS'te tüm
 * jetonlar bu seçiciye bağlı (bkz. index.css).
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const THEME_KEY = 'charcre5e:theme'

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // Gizli sekme ya da engellenmiş depolama; sisteme düşülür.
  }
  return 'system'
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Kaydedilememesi kullanıcıyı engellemez; tema bu oturumda geçerli kalır.
  }
}

/** Sistem koyu tema istiyor mu? */
export function systemPrefersDark(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

/**
 * Temayı belgeye uygular.
 *
 * `data-theme` her zaman somut bir değer taşır ("system" yazılmaz): CSS'in
 * `prefers-color-scheme` medya sorgusuyla ayrıca uğraşması gerekmesin,
 * jetonlar tek bir seçiciden okunsun.
 */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
  return resolved
}

/**
 * Sistem tercihi değişince haber verir; yalnızca "system" seçiliyken anlamlı.
 * Aboneliği bırakan fonksiyonu döner.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const query = matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
