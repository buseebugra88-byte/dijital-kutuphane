# Dijital Kütüphanem: web sürümü

Kitaplar tarayıcının içinde, cihazının kendi depolamasında saklanır; 1 GB sınırı yoktur. Hiçbir veri bir sunucuya gönderilmez.
Bu depo sadece uygulamanın kodunu içerir, kitapların ve notların burada değildir.

## Mühürlü Mektuplar

`mektup.html`: vintage mektup yazma uygulaması (daktilo, kuru çiçek ve mühür süsleri, günün kurgusu). Kütüphanede Hayatım → Mektuplarım sekmesinden açılır; ayrı olarak ana ekrana da eklenebilir. Mektuplar bu tarayıcıda saklanır.

## Sürüm yükseltme (geliştirici notu)
index.html değiştiğinde üçü birlikte yükseltilir: `index.html` içindeki `DK_VER`, `sw.js` içindeki `kutuphane-vN` ve `version.json` (`{"v":"vN"}`). Uygulamadaki "Yeni sürüm hazır" uyarısı yalnızca `version.json`a bakar; sadece `mektup.html` gibi diğer sayfalar değiştiyse `sw.js` yükseltmek yeterli, `version.json`a dokunma.
