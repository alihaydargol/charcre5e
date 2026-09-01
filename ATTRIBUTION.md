# Atıf ve Lisanslar

Bu depo iki ayrı lisans altındaki materyali barındırır.

## 1. Uygulama kodu — MIT

`src/` altındaki kaynak kod, yapılandırma dosyaları ve belgeler MIT
lisanslıdır &mdash; buna veri şeması (`src/data/schema.ts`), registry katmanı
(`src/data/registry.ts`) ve dönüştürme betiği (`scripts/build-srd-data.mjs`)
dahildir. Tek istisna `src/data/srd/` klasörüdür. Bkz. [LICENSE](./LICENSE).

## 2. Oyun verisi — SRD 5.1 / CC-BY-4.0

`src/data/srd/` altındaki oyun verisi (ırklar, sınıflar, alt sınıflar,
büyüler, ekipman, koşullar vb.) **System Reference Document 5.1** belgesinden
türetilmiştir.

Veri, [5e-bits/5e-database](https://github.com/5e-bits/5e-database) deposunun
SRD 5.1 (2014) derlemesinden `scripts/build-srd-data.mjs` ile bu projenin
şemasına dönüştürülmüştür. O deponun kendi kodu MIT lisanslıdır; içerdiği oyun
verisi ise aşağıdaki SRD atfına tabidir.

> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> <https://dnd.wizards.com/resources/systems-reference-document>. The SRD 5.1
> is licensed under the Creative Commons Attribution 4.0 International License
> available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

Bu atıf metni CC-BY-4.0 gereği zorunludur ve kaldırılmamalıdır.

## Kapsam notu

SRD 5.1, D&D 5. edisyonun serbestçe kullanılabilen kısmıdır ve
*Player's Handbook* içeriğinin tamamını kapsamaz. Özellikle:

- Her sınıf için **yalnızca bir** alt sınıf içerir.
- **Tek** geçmiş (background) içerir: Acolyte.
- **Tek** feat içerir: Grappler.

SRD dışında kalan resmî içerik telif nedeniyle bu depoya eklenmez. Bunun
yerine uygulama, kullanıcının kendi geçmiş ve feat tanımlarını girmesine izin
veren "özel giriş" desteği sunar.

## Bağlantı beyanı

Bu proje bağımsız, hayran yapımı bir araçtır. Wizards of the Coast LLC
tarafından desteklenmemekte, onaylanmamakta veya onunla ilişkilendirilmemektedir.
