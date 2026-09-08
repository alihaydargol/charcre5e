import { cardPadded, sectionLabel } from '../components/ui.ts'

/**
 * Yol haritası.
 *
 * Ana sayfada duruyordu ama orası kullanıcının karakterlerinin yeri; projenin
 * geliştirme durumu buraya ait. Kaynak: README.md.
 */
const ROADMAP = [
  { label: 'İskelet ve yayın hattı', done: true },
  { label: 'SRD 5.1 veri katmanı', done: true },
  { label: 'Kural motoru (HP, AC, büyü slotları)', done: true },
  { label: 'Silah/zırh mekanikleri ve ekipman kategorileri', done: true },
  { label: 'Karakter oluşturma sihirbazı', done: true },
  { label: 'Seviye atlama (1-20)', done: true },
  { label: 'Karakter sayfası, yazdırma, JSON aktarımı', done: true },
  { label: 'Karakter listesi ve depolama yönetimi', done: true },
  { label: 'Rastgele karakter oluşturma', done: true },
  { label: 'Homebrew içerik desteği', done: true },
  { label: 'Mobil uyum, erişilebilirlik, tema ve görsel tasarım', done: true },
  { label: 'Multiclass', done: true },
  { label: 'Hazırlanan büyüler ve para kesesi', done: true },
  { label: 'dnd-data biçiminde içe aktarma', done: true },
  { label: 'Çevrimdışı kullanım: PWA ve tek dosya', done: true },
]

export default function AboutPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Hakkında</h1>
        <p className="text-muted">
          D&amp;D 5e (SRD 5.1) kurallarına göre seviye 1&ndash;20 karakter oluşturmak için
          tarayıcıda çalışan bir araç.
        </p>
      </header>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-lg font-semibold text-ink">İçerik kaynağı</h2>
        <p>
          Uygulamadaki tüm oyun verisi <em>Systems Reference Document 5.1</em> (SRD 5.1)
          belgesinden gelir. SRD, D&amp;D 5. edisyonun serbestçe kullanılabilen açık kısmıdır;{' '}
          <em>Player&rsquo;s Handbook</em> içeriğinin tamamını kapsamaz &mdash; SRD&rsquo;de tek
          geçmiş (Acolyte), tek feat (Grappler) ve sınıf başına tek alt sınıf vardır.
        </p>
        <p>
          Bu dar kapsam resmî içerik kopyalanarak değil, <strong>homebrew</strong> desteğiyle
          telafi edilir: kendi ırk, sınıf, alt sınıf, geçmiş, feat, büyü ve eşyanı
          tanımlayabilir, paket olarak dışa aktarıp paylaşabilirsin.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-lg font-semibold text-ink">Kapsam</h2>
        <p>
          Bu araç yalnızca D&amp;D 5e kurallarını uygular. Eski edisyonlar, Pathfinder veya
          başka rol yapma sistemleri için destek eklenmeyecektir.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-lg font-semibold text-ink">Gizlilik</h2>
        <p>
          Sunucu yok. Oluşturduğun karakterler yalnızca tarayıcının yerel depolamasında
          (localStorage) tutulur ve hiçbir yere gönderilmez. Yedeklemek için karakterlerini
          JSON olarak dışa aktarabilirsin.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-lg font-semibold text-ink">Lisans</h2>
        <p>
          Uygulama kodu MIT lisanslıdır. SRD 5.1 içeriği Wizards of the Coast LLC tarafından
          CC-BY-4.0 ile lisanslanmıştır. Bu proje Wizards of the Coast tarafından
          desteklenmemektedir.
        </p>
      </section>

      <section className={`${cardPadded} space-y-3`}>
        <h2 className="font-display text-lg font-semibold text-ink">Çevrimdışı kullanım</h2>
        <p className="text-sm text-muted">
          Uygulama internet olmadan da çalışır. İki yolu var:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            <strong className="text-ink">Kur.</strong> Tarayıcının adres çubuğundaki kurulum
            simgesiyle ana ekrana ekleyebilirsin. Bir kez açtıktan sonra çevrimdışı açılır ve
            yeni sürüm çıkınca haber verir.
          </li>
          <li>
            <strong className="text-ink">Tek dosya indir.</strong>{' '}
            <a
              href={`${import.meta.env.BASE_URL}indir/charcre5e.html`}
              download="charcre5e.html"
              className="font-medium text-accent underline underline-offset-2 hover:no-underline"
            >
              charcre5e.html
            </a>{' '}
            (~1,7 MB) &mdash; uygulamanın tamamı ve SRD verisi tek bir dosyada. İstediğin yere
            kopyala, çift tıkla; sunucu, kurulum ve internet gerekmez. Karakterlerin o dosyanın
            açıldığı tarayıcıda saklanır.
          </li>
        </ul>
      </section>

      <section className={`${cardPadded} space-y-3`}>
        <h2 className={sectionLabel}>Yol haritası</h2>
        <ul className="space-y-2">
          {ROADMAP.map((step) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={[
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step.done ? 'bg-accent text-on-accent' : 'border border-border-strong text-faint',
                ].join(' ')}
              >
                {step.done ? '✓' : ''}
              </span>
              <span className={step.done ? 'text-ink' : 'text-muted'}>{step.label}</span>
              <span className="sr-only">{step.done ? '(tamamlandı)' : '(bekliyor)'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
