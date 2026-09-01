# charcre5e — D&D 5e Karakter Oluşturucu

SRD 5.1 kurallarına göre seviye 1&ndash;20 D&D 5e karakteri oluşturmak için
tarayıcıda çalışan bir araç. Sunucu yok, hesap yok; karakterler senin
cihazında kalır.

**Canlı:** <https://alihaydargol.github.io/charcre5e/>

## Durum

Proje aşamalı olarak geliştiriliyor.

- [x] **Aşama 1** &mdash; İskelet ve GitHub Pages yayın hattı
- [x] **Aşama 2** &mdash; SRD 5.1 veri katmanı (ırk, sınıf, büyü, ekipman)
- [x] **Aşama 3** &mdash; Kural motoru (HP, AC, büyü slotları, seviye tabloları) + testler
- [ ] **Aşama 3B** &mdash; Silah/zırh mekanikleri, ekipman kategorileri, sihirli eşyalar
- [ ] **Aşama 4** &mdash; Karakter oluşturma sihirbazı
- [ ] **Aşama 5** &mdash; Seviye atlama (1&ndash;20), ASI/feat, alt sınıflar
- [ ] **Aşama 6** &mdash; Karakter sayfası, yazdırma/PDF, JSON dışa/içe aktarma
- [ ] **Aşama 7** &mdash; Karakter listesi ve localStorage yönetimi
- [ ] **Aşama 8** &mdash; Mobil uyum, erişilebilirlik, tema
- [ ] **Aşama 9** &mdash; Rastgele karakter oluşturma (yeni başlayanlar için tek tuş)
- [ ] **Aşama 10** &mdash; Homebrew içerik (kendi ırk/sınıf/büyü/eşyanı tanımla)
- [ ] **Aşama 11** &mdash; Görsel tasarım ve arayüz yenilemesi

Aşama 9 ve 10 sonraya bırakıldı, ancak veri ve kural katmanı baştan bunları
kaldıracak şekilde tasarlanıyor &mdash; ayrıntılar için [CLAUDE.md](./CLAUDE.md).

## Kapsam

Bu araç **yalnızca D&D 5e** kurallarını uygular. Eski edisyonlar, Pathfinder
veya başka rol yapma sistemleri için destek eklenmeyecektir.

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
