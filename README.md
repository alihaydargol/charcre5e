# charcre5e — D&D 5e Karakter Oluşturucu

SRD 5.1 kurallarına göre seviye 1&ndash;20 D&D 5e karakteri oluşturmak için
tarayıcıda çalışan bir araç. Sunucu yok, hesap yok; karakterler senin
cihazında kalır.

**Canlı:** <https://alihaydargol.github.io/charcre5e/>

## Durum

Proje aşama aşama geliştirildi.

- [x] **Aşama 1** &mdash; İskelet ve GitHub Pages yayın hattı
- [x] **Aşama 2** &mdash; SRD 5.1 veri katmanı (ırk, sınıf, büyü, ekipman)
- [x] **Aşama 3** &mdash; Kural motoru (HP, AC, büyü slotları, seviye tabloları) + testler
- [x] **Aşama 3B** &mdash; Silah/zırh mekanikleri, ekipman kategorileri, sihirli eşyalar
- [x] **Aşama 4** &mdash; Karakter oluşturma sihirbazı
- [x] **Aşama 5** &mdash; Seviye atlama (1&ndash;20), ASI/feat, alt sınıflar
- [x] **Aşama 6** &mdash; Karakter sayfası, yazdırma/PDF, JSON dışa/içe aktarma
- [x] **Aşama 7** &mdash; Karakter listesi ve localStorage yönetimi
- [x] **Aşama 9** &mdash; Rastgele karakter oluşturma (yeni başlayanlar için tek tuş)
- [x] **Aşama 10** &mdash; Homebrew içerik (kendi ırk/sınıf/büyü/eşyanı tanımla)
- [x] **Aşama 8+11** &mdash; Mobil uyum, erişilebilirlik, karanlık tema, görsel tasarım
- [x] **Aşama 12** &mdash; Multiclass
- [x] **Aşama 13** &mdash; Hazırlanan büyüler ve para kesesi
- [x] **Aşama 14** &mdash; dnd-data biçiminde homebrew içe aktarma
- [x] **Aşama 15** &mdash; Çevrimdışı kullanım: PWA ve tek dosya indirme

Yol haritası tamamlandı. Mimari kararların gerekçesi için
[CLAUDE.md](./CLAUDE.md).

## Kapsam

Bu araç **yalnızca D&D 5e** kurallarını uygular. Eski edisyonlar, Pathfinder
veya başka rol yapma sistemleri için destek eklenmeyecektir.

Depoya yalnızca SRD 5.1 (CC-BY-4.0) içeriği konur; *Player's Handbook* ve diğer
kaynaklardan metin ya da oyun verisi kopyalanmaz. SRD'nin dar kapsamı (tek
background, tek feat, sınıf başına tek alt sınıf) **homebrew** desteğiyle
telafi edilir: `/homebrew` sayfasından kendi ırk, sınıf, alt sınıf, geçmiş,
feat, büyü ve eşyanı tanımlayabilir, paket olarak dışa/içe aktarabilirsin.
Tanımladıkların sihirbazda, seviye atlamada ve rastgele oluşturmada SRD
içeriğiyle birlikte görünür.

## Çevrimdışı kullanım

Uygulama internet olmadan da çalışır:

- **Kurulabilir (PWA).** Tarayıcının kurulum simgesiyle ana ekrana eklenir. Bir
  kez açıldıktan sonra çevrimdışı açılır; yeni sürüm çıkınca sessizce
  güncellenmez, sorar &mdash; yarım kalan bir sihirbaz bozulmasın diye.
- **Tek dosya.** `npm run build:single` uygulamanın tamamını ve SRD verisini tek
  bir `.html` dosyasına gömer (~1,7 MB). `file://` altında, sunucusuz ve
  kurulumsuz açılır. Yayınlanan sitede
  [`/indir/charcre5e.html`](https://alihaydargol.github.io/charcre5e/indir/charcre5e.html)
  adresinden indirilebilir.

## Homebrew içe aktarma

`/homebrew` sayfası kendi paketlerinin yanında
[`nick-aschenbach/dnd-data`](https://github.com/nick-aschenbach/dnd-data)
biçimindeki dosyaları da okur (species, classes, spells, backgrounds, items).

**O veri bu depoda yok ve olmayacak:** kaynağı PHB 2024, Xanathar's, Tasha's ve
190'dan fazla kitabın birebir metni, üstelik onlarca üçüncü taraf yayıncıyı da
kapsıyor. Depoda yalnızca *çevirici* var; veriyi kendi makinende edinip kendi
tarayıcına yüklersin. Ayrıntı için [CLAUDE.md](./CLAUDE.md) §2.

## Arayüz

- **Aydınlık / karanlık / sistem** teması; tercih tarayıcıda saklanır ve ilk
  boyamadan önce uygulanır (tema geçişinde yanlış renk görünmez).
- Renkler rol adıyla anılan jetonlar üzerinden gelir (`surface`, `border`,
  `muted`), ton adıyla değil &mdash; ayrıntı için `src/index.css`.
- Telefonda tek sütun; gezinme açılır menüye dönüşür.
- Klavye erişimi: &ldquo;içeriğe atla&rdquo; bağlantısı, `:focus-visible` odak
  halkası, `aria-*` etiketleri. Ölçülen 28 renk çiftinin tamamı iki temada da
  WCAG AA (4.5:1) üstünde.
- `prefers-reduced-motion` seçili kullanıcılarda geçişler kapanır.

## Teknolojiler

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Zustand · Zod · Vitest

## Yerel geliştirme

```bash
npm install
npm run dev          # http://localhost:5173/charcre5e/
```

Diğer komutlar:

```bash
npm run typecheck    # TypeScript tip kontrolü
npm run lint         # ESLint
npm test             # Vitest (kural motoru testleri)
npm run build        # Üretim derlemesi -> dist/
npm run preview      # Derlenmiş çıktıyı yerelde çalıştır
```

## Yayınlama

`main` dalına yapılan her push, `.github/workflows/deploy.yml` üzerinden
otomatik olarak derlenip GitHub Pages'e yayınlanır.

**İlk kurulumda tek seferlik gereken ayar:** depo ayarlarında
*Settings → Pages → Build and deployment → Source* seçeneğinin
**GitHub Actions** olarak ayarlanması gerekir.

Uygulama bir proje sitesi (`/charcre5e/` alt yolu) olarak yayınlandığından
`vite.config.ts` içinde `base: '/charcre5e/'` tanımlıdır. Derin bağlantılarda
404 almamak için `HashRouter` kullanılır.

## Lisans

Kod MIT lisanslıdır. Oyun verisi SRD 5.1 kaynaklıdır ve CC-BY-4.0 ile
lisanslanmıştır &mdash; ayrıntılar için [ATTRIBUTION.md](./ATTRIBUTION.md).

Bu proje bağımsız bir hayran projesidir; Wizards of the Coast ile bağlantılı
değildir.
