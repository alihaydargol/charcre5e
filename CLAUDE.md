# Proje Kuralları — charcre5e

Bu dosya projenin değişmez kısıtlarını tanımlar. Herhangi bir değişiklik
yapmadan önce okunmalıdır.

## 1. Yalnızca D&D 5e — pazarlık konusu değil

Bu araç **sadece** Dungeons & Dragons 5. edisyon (5e) kurallarını uygular.

**Kesinlikle eklenmeyecek olanlar:**

- Eski edisyonlar (AD&D, 3.0, 3.5, 4e) veya Pathfinder
- 5e olmayan diğer d20 sistemleri veya OSR retroklonları
- D&D dışı rol yapma sistemleri (Call of Cthulhu, Vampire, Cyberpunk vb.)
- "Sistem seçici" / çoklu ruleset soyutlaması

Veri modeli ve kural motoru **5e'ye özel** olarak yazılır. Başka sistemleri de
destekleyebilmek adına genelleştirme yapılmaz; bu tür bir soyutlama kodu
gereksiz karmaşıklaştırır ve projenin amacına aykırıdır.

**Sürüm notu:** Temel alınan metin SRD 5.1'dir (2014 kuralları). SRD 5.2
(2024 "One D&D" revizyonu) ileride ayrı bir kural seti olarak *değerlendirilebilir*,
ancak bu ayrı bir karardır ve kullanıcı açıkça istemeden yapılmaz.

## 2. Telif — SRD 5.1 sınırı

Depoya yalnızca SRD 5.1 (CC-BY-4.0) içeriği konur. *Player's Handbook*,
*Xanathar's*, *Tasha's* gibi kaynaklardan **hiçbir metin veya oyun verisi
kopyalanmaz**. Atıf metni `ATTRIBUTION.md` içindedir ve kaldırılamaz.

SRD'nin dar kapsamı (tek background, tek feat, sınıf başına tek alt sınıf)
homebrew desteğiyle telafi edilir — resmî içerik kopyalanarak değil.

## 3. Planlanan yetenekler — mimariyi bunlara göre kur

Bu ikisi henüz yazılmadı, ama veri ve kural katmanı **baştan** bunları
kaldıracak şekilde tasarlanmalı. Sonradan eklemek için yeniden yazım gerekmemeli.

### Homebrew içerik

Kullanıcı kendi ırk, sınıf, alt sınıf, geçmiş, feat, büyü ve eşyalarını
tanımlayabilecek.

**Mimari gereksinim:** Tüm veri kayıtları `source: 'srd' | 'homebrew'` alanı
taşır. Arama/listeleme, SRD verisi ile kullanıcı verisini birleştiren tek bir
**registry** katmanı üzerinden yapılır. Kural motoru bir içeriğin nereden
geldiğini umursamaz; hepsi aynı şemayı kullanır. Kodun hiçbir yerinde
`import races from './data/races.json'` gibi doğrudan JSON erişimi olmamalı —
her zaman registry üzerinden.

### Rastgele karakter oluşturma

D&D hiç oynamamış biri tek tuşla oynanabilir, kurallara uygun bir karakter
alabilmeli. Ayrıca sihirbazın herhangi bir adımında "benim yerime seç"
seçeneği bulunmalı.

**Mimari gereksinim:** Her karar noktası için "şu an geçerli seçenekler nedir"
sorusunu yanıtlayan saf bir fonksiyon katmanı olmalı
(`getValidChoices(character, decisionPoint)`). Sihirbaz bu katmanı kullanıcıya
göstermek için, rastgele oluşturucu ise aralarından seçim yapmak için kullanır.
Böylece rastgele oluşturucu kural mantığını **tekrar etmez** ve ürettiği
karakter tanım gereği geçerlidir.

Rastgeleliğin tohumlanabilir (seeded) olması tercih edilir — aynı tohum aynı
karakteri üretir, hem test hem paylaşım için değerlidir.

## 4. Dil

Arayüz Türkçedir. Oyun terimleri İngilizce özgün hâliyle bırakılır
(*Fighter*, *Dexterity*, *Fireball*) — çeviri, oyuncuların masadaki kitapla
eşleştirmesini zorlaştırır. Açıklama ve yönlendirme metinleri Türkçedir.
