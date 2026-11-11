# Dijital Kütüphanem: web sürümü

Kitaplar tarayıcının içinde, cihazının kendi depolamasında saklanır; 1 GB sınırı yoktur. Hiçbir veri bir sunucuya gönderilmez.
Bu depo sadece uygulamanın kodunu içerir, kitapların ve notların burada değildir.

## Mühürlü Mektuplar

`mektup.html`: vintage mektup yazma uygulaması (daktilo, kuru çiçek ve mühür süsleri, günün kurgusu). Kütüphanede Hayatım → Mektuplarım sekmesinden açılır; ayrı olarak ana ekrana da eklenebilir. Mektuplar bu tarayıcıda saklanır; Kutu sekmesindeki "Yedek al" / "Yedekten yükle" ile dosyaya alınıp geri yüklenebilir (Kütüphanem yedekleriyle uyumlu).

## Sürüm yükseltme (geliştirici notu)
index.html değiştiğinde üçü birlikte yükseltilir: `index.html` içindeki `DK_VER`, `sw.js` içindeki `kutuphane-vN` ve `version.json` (`{"v":"vN"}`). Uygulamadaki "Yeni sürüm hazır" uyarısı yalnızca `version.json`a bakar; sadece `mektup.html` gibi diğer sayfalar değiştiyse `sw.js` yükseltmek yeterli, `version.json`a dokunma.

## 24. yaş hediyesi

`hediye-24.html`: 7 Kasım 2026 doğum günü hediyesi (mühürlü mektup, dilek mumu, 24 notluk "başlayan yıl kavanozu"). Hayatım → Mektuplarım sekmesinden açılır. Çekilen notlar bu tarayıcıda (`buse24-kavanoz`) saklanır.

`malzeme.html`: Malzemelerim — mektup malzemeleri (mühür, mum, kalem, mürekkep, kâğıt, zarf, pul, süs) ve alışveriş listesi. Ayrı olarak ana ekrana eklenir. Veriler bu tarayıcıda (`muhurlu-malzeme-v1`) saklanır; Kütüphanem yedeğine dahildir, kendi Yedek al / Yedekten yükle düğmeleri de vardır.
