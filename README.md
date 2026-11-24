# Dijital Kütüphanem: web sürümü

Kitaplar tarayıcının içinde, cihazının kendi depolamasında saklanır; 1 GB sınırı yoktur. Hiçbir veri bir sunucuya gönderilmez.
Bu depo sadece uygulamanın kodunu içerir, kitapların ve notların burada değildir.

## Mühürlü Mektuplar

`mektup/`: vintage mektup yazma uygulaması (daktilo, kuru çiçek ve mühür süsleri, günün kurgusu). Kütüphanede Hayatım → Mektuplarım sekmesinden açılır; ayrı olarak ana ekrana da eklenebilir. Mektuplar bu tarayıcıda saklanır; Kutu sekmesindeki "Yedek al" / "Yedekten yükle" ile dosyaya alınıp geri yüklenebilir (Kütüphanem yedekleriyle uyumlu).

## PDF Atölyem

`pdf/`: PDF okuyucu ve düzenleyici. Kütüphanede Uygulamalarım'dan açılır; ayrı olarak ana ekrana da eklenebilir. Her işlem tarayıcının içinde yapılır, dosyalar hiçbir sunucuya gönderilmez.

- **Okuyucu:** küçük resimler, içindekiler, arama, yakınlaştırma, iki sayfa görünümü, gece ve sepya modu, kaldığın sayfayı hatırlama.
- **İşaretleme:** vurgulama, altını ve üstünü çizme, kalem, dikdörtgen, elips, çizgi, ok, metin kutusu, yapışkan not, imza, görsel, damga, silgi, geri al ve yinele. Notlar ayrı bir katmanda saklanır; dışa aktarırken "düzenlenebilir" ya da "kalıcı" olarak PDF'e yazılır. Notlar Markdown olarak da dışa aktarılabilir.
- **Araçlar:** Birleştir, Böl, Sayfaları Düzenle, Döndür, Kırp, OCR (Türkçe ve İngilizce; taranmış PDF'i aranabilir yapar), Tara / Görselden PDF, PDF'den JPG ve PNG'ye, Sayfa numarası, Filigran.
- **Kütüphaneler** `pdf/lib/` içinde durur, internet gerekmez: pdf.js 3.11.174, pdf-lib 1.17.1, @pdf-lib/fontkit, SortableJS, tesseract.js 5 (tur ve eng dil verisi), Liberation Sans yazı tipi. OCR motoru büyük olduğu için önceden önbelleğe alınmaz, ilk kullanımda alınır.

## Sürüm yükseltme (geliştirici notu)
index.html değiştiğinde üçü birlikte yükseltilir: `index.html` içindeki `DK_VER`, `sw.js` içindeki `kutuphane-vN` ve `version.json` (`{"v":"vN"}`). Uygulamadaki "Yeni sürüm hazır" uyarısı yalnızca `version.json`a bakar; sadece `mektup.html` gibi diğer sayfalar değiştiyse `sw.js` yükseltmek yeterli, `version.json`a dokunma.
