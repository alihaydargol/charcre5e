export default function AboutPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Hakkında</h1>

      <section className="space-y-2 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">İçerik kaynağı</h2>
        <p>
          Uygulamadaki tüm oyun verisi <em>Systems Reference Document 5.1</em>{' '}
          (SRD 5.1) belgesinden gelir. SRD, D&amp;D 5. edisyonun serbestçe
          kullanılabilen açık kısmıdır; <em>Player&rsquo;s Handbook</em>{' '}
          içeriğinin tamamını kapsamaz. Bu nedenle SRD dışında kalan geçmiş
          (background) ve feat seçenekleri için &ldquo;özel giriş&rdquo;
          desteği sunulacak &mdash; kendi seçeneğini tanımlayabileceksin.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">Gizlilik</h2>
        <p>
          Sunucu yok. Oluşturduğun karakterler yalnızca tarayıcının yerel
          depolamasında (localStorage) tutulur ve hiçbir yere gönderilmez.
          Yedeklemek için karakterlerini JSON olarak dışa aktarabileceksin.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">Lisans</h2>
        <p>
          Uygulama kodu MIT lisanslıdır. SRD 5.1 içeriği Wizards of the Coast
          LLC tarafından CC-BY-4.0 ile lisanslanmıştır. Bu proje Wizards of the
          Coast tarafından desteklenmemektedir.
        </p>
      </section>
    </div>
  )
}
