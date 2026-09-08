/**
 * `virtual:pwa-register/react` yerine geçen boş uygulama.
 *
 * Tek dosya derlemesinde (BUILD_TARGET=single) PWA eklentisi yüklenmiyor,
 * dolayısıyla sanal modül de yok. `UpdatePrompt`'u o derlemeden elle çıkarmak
 * yerine modül takma adla buraya yönlendiriliyor: bileşen aynı kalıyor,
 * yalnızca hiçbir zaman görünmüyor.
 *
 * Doğru davranış bu — tek dosya çıktısında güncellenecek bir service worker
 * yok, dosyanın kendisi zaten çevrimdışı ve elle değiştirilir.
 */
export function useRegisterSW(): {
  needRefresh: [boolean, (value: boolean) => void]
  offlineReady: [boolean, (value: boolean) => void]
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
} {
  const noop = () => {}
  return {
    needRefresh: [false, noop],
    offlineReady: [false, noop],
    updateServiceWorker: async () => {},
  }
}
