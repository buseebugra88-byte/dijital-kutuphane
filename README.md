# Dijital Kütüphanem: web sürümü

Kitaplar tarayıcının içinde, cihazının kendi depolamasında saklanır; 1 GB sınırı yoktur. Hiçbir veri bir sunucuya gönderilmez.
Bu depo sadece uygulamanın kodunu içerir, kitapların ve notların burada değildir.

## Mühürlü Mektuplar

`mektup/`: vintage mektup yazma uygulaması (daktilo, kuru çiçek ve mühür süsleri, günün kurgusu). Kütüphanede Hayatım → Mektuplarım sekmesinden açılır; ayrı olarak ana ekrana da eklenebilir. Mektuplar bu tarayıcıda saklanır; Kutu sekmesindeki "Yedek al" / "Yedekten yükle" ile dosyaya alınıp geri yüklenebilir (Kütüphanem yedekleriyle uyumlu).

## PDF Atölyem

`pdf/`: PDF okuyucu ve düzenleyici. Kütüphanede Uygulamalarım'dan açılır; ayrı olarak ana ekrana da eklenebilir. Her işlem tarayıcının içinde yapılır, dosyalar hiçbir sunucuya gönderilmez.

- **Okuyucu:** küçük resimler, içindekiler, arama, yakınlaştırma, iki sayfa görünümü, gece ve sepya modu, kaldığın sayfayı hatırlama.
- **Metni düzenle:** sayfadaki var olan yazıya tıklayıp değiştir. Yazı tipi, boyut ve renk orijinalden alınır; dışa aktarırken eski yazı dosyanın içinden silinir (arama ve kopyalamada da çıkmaz).
- **İşaretleme:** vurgulama, altını ve üstünü çizme, kalem, dikdörtgen, elips, çizgi, ok, metin kutusu, yapışkan not, imza, görsel, damga, silgi, geri al ve yinele. Notlar ayrı bir katmanda saklanır; dışa aktarırken "düzenlenebilir" ya da "kalıcı" olarak PDF'e yazılır. Notlar Markdown olarak da dışa aktarılabilir.
- **Araçlar:** Birleştir, Böl, Sayfaları Düzenle, Döndür, Kırp, OCR (Türkçe ve İngilizce; taranmış PDF'i aranabilir yapar), Tara / Görselden PDF, PDF'den JPG ve PNG'ye, Sayfa numarası, Filigran.
- **Dönüştürmeler:** Word (.docx), Excel (.xlsx, .xls, .ods, .csv), PowerPoint (.pptx) ve HTML → PDF (seçilebilir gerçek metin); PDF → Word (.docx, taranmış sayfalarda OCR), PDF → Excel (satır/sütun ve Türkçe sayı biçimi tanıma), PDF → PowerPoint (her sayfa bir slayt), PDF → PDF/A-2b. Kütüphaneler: mammoth, SheetJS, fflate (`pdf/lib/conv/`).
- **Dijital Kütüphanem bağlantısı:** PDF Atölyem'in ana ekranında kütüphanedeki PDF kitaplar listelenir; kütüphanedeki okuyucuda 🛠 düğmesi kitabı PDF Atölyem'de açar (kaldığın sayfadan). "Kütüphaneme ekle" / "Kütüphanemdeki kitabı güncelle" dosyayı kütüphanenin kendi ekleme formuna bırakır (`pdf-atolyem` veritabanında `kv/handoff`, kütüphane `?pdfa=1` ile açılınca forma yerleştirir); kayıt kütüphanenin normal yoluyla yapıldığı için Drive eşitlemesi bozulmaz. PDF Atölyem kütüphane verisini yalnızca okur.
- **Kütüphaneler** `pdf/lib/` içinde durur, internet gerekmez: pdf.js 3.11.174, pdf-lib 1.17.1, @pdf-lib/fontkit, SortableJS, tesseract.js 5 (tur ve eng dil verisi), Liberation yazı tipleri (Sans, Serif, Mono). OCR motoru büyük olduğu için önceden önbelleğe alınmaz, ilk kullanımda alınır.

## Sürüm yükseltme (geliştirici notu)
index.html değiştiğinde üçü birlikte yükseltilir: `index.html` içindeki `DK_VER`, `sw.js` içindeki `kutuphane-vN` ve `version.json` (`{"v":"vN"}`). Uygulamadaki "Yeni sürüm hazır" uyarısı yalnızca `version.json`a bakar; sadece `mektup.html` gibi diğer sayfalar değiştiyse `sw.js` yükseltmek yeterli, `version.json`a dokunma.
