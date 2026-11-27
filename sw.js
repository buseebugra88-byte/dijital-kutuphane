// Dijital Kütüphanem — çevrimdışı çalışma (service worker)
// Sürüm yükseltirken: C'yi, index.html'deki DK_VER'i ve version.json'u birlikte değiştir.
const C='kutuphane-v235';
const ONBELLEK=[
  './','./ortak/tema.css','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./config.js','./gizlilik.html',
  './mektup/','./mektup/manifest.webmanifest','./mektup/icon-192.png','./mektup/icon-180.png',
  './defter/','./defter/manifest.webmanifest','./defter/icon-192.png','./defter/icon-180.png',
  // Eski adresler (ana ekrandaki eski kısayollar internetsiz de doğru uygulamayı açsın)
  './mektup.html','./defter.html','./kamera.html','./mantar.html','./asistan.html','./hediye-24.html','./calisma.html',
  './masa/','./masa/manifest.webmanifest','./calisma-192.png','./calisma-180.png',
  './yazar/','./yazar/manifest.webmanifest','./yazar-192.png','./yazar-180.png',
  // PDF Atölyem (OCR motoru ve dil dosyaları ilk kullanımda önbelleğe girer)
  './pdf/','./pdf/manifest.webmanifest','./pdf/icon-192.png','./pdf/icon-180.png','./pdf/style.css','./pdf/core.js','./pdf/viewer.js','./pdf/textedit.js','./pdf/tools.js','./pdf/library.js','./pdf/convert.js','./pdf/tools2.js',
  './pdf/lib/pdf.min.js','./pdf/lib/pdf.worker.min.js','./pdf/lib/pdf-lib.min.js','./pdf/lib/fontkit.umd.min.js','./pdf/lib/Sortable.min.js',
  './pdf/lib/fonts/LiberationSans-Regular.ttf','./pdf/lib/fonts/LiberationSans-Bold.ttf',
  // Veri Analisti (büyük veri motoru duckdb-eh.wasm ilk açılışta önbelleğe girer)
  './veri/','./veri/manifest.webmanifest','./veri/icon-192.png','./veri/icon-180.png','./veri/style.css','./veri/motor.js','./veri/app.js',
  './veri/lib/duckdb.min.js','./veri/lib/chart.umd.min.js','./veri/lib/marked.min.js','./veri/lib/purify.min.js','./veri/lib/xlsx.full.min.js',
  // Öğrenme Asistanı (Python motoru Pyodide ilk kod çalıştırmada önbelleğe girer)
  './ortak/gemini.js','./ogrenme/','./ogrenme/manifest.webmanifest','./ogrenme/icon-192.png','./ogrenme/icon-180.png','./ogrenme/style.css','./ogrenme/motor.js','./ogrenme/app.js','./ogrenme/kod-isci.js',
  './ogrenme/lib/marked.min.js','./ogrenme/lib/purify.min.js'
];
// Her dosya ayrı eklenir: biri eksik olsa bile geri kalanı önbelleğe girer.
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(ONBELLEK.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('kutuphane-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function kaydet(r,res){if(res&&res.ok&&res.type!=='opaque'){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}
// Çevrimdışıyken sayfa bulunamazsa, bulunduğu klasörün ana sayfası (yoksa kütüphane) açılır.
function yedek(r){const u=new URL(r.url);const kl=u.pathname.replace(/[^/]*$/,'');
  return caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match(kl).then(k=>k||caches.match('./index.html')):undefined)).then(m=>m||Response.error())}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    // Kütüphanenin dışındaki depolar (ör. /spss-tez-rehberi/) bu önbelleğe karışmasın.
    if(!u.pathname.startsWith(new URL('./',self.registration.scope).pathname))return;
    // PDF Atölyem ve Veri Analisti kütüphaneleri değişmez ve büyüktür (OCR motoru, dil dosyaları): önce önbellekten
    if(u.pathname.includes('/pdf/lib/')||u.pathname.includes('/veri/lib/')||u.pathname.includes('/ogrenme/lib/')){e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(res=>kaydet(r,res))));return}
    const taze=r.mode==='navigate'||u.pathname.endsWith('/')||/\.(html|js|json|webmanifest)$/.test(u.pathname);
    e.respondWith((taze?fetch(r.url,{cache:'no-store',credentials:'same-origin'}):fetch(r)).then(res=>kaydet(r,res)).catch(()=>yedek(r)));return}
  if(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host)){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})))}
});
