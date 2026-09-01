const roadmap = [
  { label: 'İskelet ve yayın hattı', done: true },
  { label: 'SRD 5.1 veri katmanı', done: true },
  { label: 'Kural motoru (HP, AC, büyü slotları)', done: true },
  { label: 'Silah/zırh mekanikleri ve ekipman kategorileri', done: false },
  { label: 'Karakter oluşturma sihirbazı', done: false },
  { label: 'Seviye atlama (1-20)', done: false },
  { label: 'Karakter sayfası, yazdırma, JSON aktarımı', done: false },
  { label: 'Rastgele karakter oluşturma', done: false },
  { label: 'Homebrew içerik desteği', done: false },
  { label: 'Görsel tasarım ve arayüz yenilemesi', done: false },
]

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          D&amp;D 5e karakter oluşturucu
        </h1>
        <p className="max-w-2xl text-slate-600">
          SRD 5.1 kurallarına göre seviye 1&ndash;20 karakter oluşturmanı
          sağlayacak bir araç. Tamamen tarayıcıda çalışır: hesap gerekmez,
          karakterlerin kendi cihazında kalır.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Yapım aşamasında
        </h2>
        <ul className="mt-4 space-y-2">
          {roadmap.map((step) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={[
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step.done
                    ? 'bg-accent text-white'
                    : 'border border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {step.done ? '✓' : ''}
              </span>
              <span className={step.done ? 'text-slate-900' : 'text-slate-500'}>
                {step.label}
              </span>
              <span className="sr-only">
                {step.done ? '(tamamlandı)' : '(bekliyor)'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
