import { useRegisterSW } from 'virtual:pwa-register/react'
import { btnSmallPrimary, btnSmallSecondary } from './ui.ts'

/**
 * Yeni sürüm bildirimi.
 *
 * Güncelleme sessizce uygulanmıyor: kullanıcı sihirbazın ortasında olabilir ve
 * sayfanın altından yenilenmesi yarım kalmış bir karakteri bozardı. Bunun
 * yerine soruluyor; "Sonra" denirse bir sonraki açılışta yine sorulur.
 *
 * `registerType: 'prompt'` (bkz. vite.config.ts) bu davranışın karşılığı.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null

  return (
    <div
      role="status"
      className="no-print fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border border-border bg-surface p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      {needRefresh ? (
        <>
          <p className="text-sm font-medium">Yeni sürüm hazır.</p>
          <p className="mt-1 text-sm text-muted">
            Yenileyince güncellenir. Yarım kalan bir karakterin varsa önce onu kaydet.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className={btnSmallPrimary}
            >
              Şimdi güncelle
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className={btnSmallSecondary}
            >
              Sonra
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Çevrimdışı kullanıma hazır.</p>
          <p className="mt-1 text-sm text-muted">
            Uygulama artık internet olmadan da açılır.
          </p>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className={`${btnSmallSecondary} mt-3`}
          >
            Tamam
          </button>
        </>
      )}
    </div>
  )
}
