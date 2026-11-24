// Öğrenme Asistanı — tarayıcı içi motor.
// Python sunucusunun (FastAPI + SQLite) yaptığı her şeyi burada yapar. Veriler bu tarayıcıda (IndexedDB) kalır;
// yalnızca yapay zekâ gereken işlerde ilgili metin Gemini'ye gönderilir. Python kodu tarayıcıda Pyodide ile çalışır.
"use strict";

const Motor = (() => {
  const MAKS_BELGE_KARAKTER = 600000;
  class Hata extends Error {}

  // ------------------------------------------------------------------
  // Yardımcılar
  // ------------------------------------------------------------------
  const p2 = (n) => String(n).padStart(2, "0");
  const gunStr = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const zamanStr = (d = new Date()) => `${gunStr(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  const gunEkle = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return gunStr(d); };
  const once = (gun) => zamanStr(new Date(Date.now() - gun * 864e5));
  const kopya = (x) => JSON.parse(JSON.stringify(x));

  // ------------------------------------------------------------------
  // Kalıcı depo: küçük tablolar tek "meta" kaydında, belge parçaları ayrı kayıtlarda
  // ------------------------------------------------------------------
  const BOS = () => ({ sayac: 0, belgeler: [], kavramlar: [], kartlar: [], sorular: [], denemeler: [], hatalar: [],
    dil_oturumlari: [], dil_mesajlari: [], kod_kayitlari: [] });
  let D = BOS();
  const PARCA = new Map(); // belge_id → [{id, sayfa, metin}]
  let idb = null, hazirSoz = null;

  function idbAc() {
    if (idb) return idb;
    idb = new Promise((ok, red) => {
      const r = indexedDB.open("ogrenme-asistani", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("parcalar"); };
      r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error);
    });
    return idb;
  }
  async function idbIs(depo, kip, is) {
    const d = await idbAc();
    return new Promise((ok, red) => {
      const tx = d.transaction(depo, kip), s = tx.objectStore(depo); let sonuc;
      const r = is(s); if (r) r.onsuccess = () => { sonuc = r.result; };
      tx.oncomplete = () => ok(sonuc); tx.onerror = () => red(tx.error);
      tx.onabort = () => red(tx.error || new Hata("Kaydedilemedi (depolama dolu olabilir)."));
    });
  }
  const kaydet = () => idbIs("kv", "readwrite", (s) => s.put(kopya(D), "meta"));
  const yeniId = () => ++D.sayac;

  function hazir() {
    if (hazirSoz) return hazirSoz;
    hazirSoz = (async () => {
      try { navigator.storage?.persist?.(); } catch {}
      const m = await idbIs("kv", "readonly", (s) => s.get("meta"));
      if (m) D = { ...BOS(), ...m };
    })();
    hazirSoz.catch(() => { hazirSoz = null; });
    return hazirSoz;
  }
  async function parcalar(belgeId) {
    if (!PARCA.has(belgeId)) PARCA.set(belgeId, (await idbIs("parcalar", "readonly", (s) => s.get(belgeId))) || []);
    return PARCA.get(belgeId);
  }

  // ------------------------------------------------------------------
  // Kavram hâkimiyeti ve SM-2 (db.py'nin karşılığı)
  // ------------------------------------------------------------------
  function kavramBulVeyaEkle(modul, ad, belgeId = null) {
    ad = String(ad).trim().slice(0, 120);
    let k = D.kavramlar.find((x) => x.modul === modul && x.ad === ad && (x.belge_id ?? null) === belgeId);
    if (!k) { k = { id: yeniId(), modul, ad, belge_id: belgeId, hakimiyet: 0.3, deneme: 0, dogru: 0, son_gorulme: null }; D.kavramlar.push(k); }
    return k.id;
  }
  function hakimiyetGuncelle(kavramId, dogru) {
    const k = D.kavramlar.find((x) => x.id === kavramId);
    if (!k) return;
    const m = k.hakimiyet;
    k.hakimiyet = Math.round((dogru ? m + 0.15 * (1 - m) : m - 0.25 * m) * 1e4) / 1e4;
    k.deneme++; k.dogru += dogru ? 1 : 0; k.son_gorulme = zamanStr();
  }
  function sm2(kolaylik, aralik, tekrar, puan) {
    const q = { 0: 1, 1: 3, 2: 4, 3: 5 }[puan];
    if (q < 3) { tekrar = 0; aralik = 1; }
    else {
      tekrar += 1;
      if (tekrar === 1) aralik = 1;
      else if (tekrar === 2) aralik = puan < 3 ? 3 : 4;
      else aralik = Math.round(aralik * kolaylik * (puan === 3 ? 1.3 : 1.0));
    }
    kolaylik = Math.max(1.3, kolaylik + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    return [Math.round(kolaylik * 1000) / 1000, aralik, tekrar, gunEkle(aralik)];
  }
  const deneme = (o) => D.denemeler.push({ id: yeniId(), kavram_id: null, soru_id: null, hata_turu: null, zaman: zamanStr(), ...o });

  // ------------------------------------------------------------------
  // Belgeden metin çıkarma (PDF Atölyem'in pdf.js kütüphanesi kullanılır)
  // ------------------------------------------------------------------
  let pdfSoz = null;
  function pdfjsYukle() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfSoz) return pdfSoz;
    pdfSoz = new Promise((ok, red) => {
      const s = document.createElement("script");
      s.src = new URL("../pdf/lib/pdf.min.js", document.baseURI).href;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../pdf/lib/pdf.worker.min.js", document.baseURI).href; ok(window.pdfjsLib); };
      s.onerror = () => { pdfSoz = null; red(new Hata("PDF okuyucu yüklenemedi.")); };
      document.head.appendChild(s);
    });
    return pdfSoz;
  }
  async function metniCikar(dosya) {
    const ad = (dosya.name || "").toLowerCase();
    if (ad.endsWith(".pdf")) {
      const lib = await pdfjsYukle();
      const belge = await lib.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()), cMapUrl: new URL("../pdf/lib/cmaps/", document.baseURI).href, cMapPacked: true }).promise;
      const sayfalar = [];
      for (let i = 1; i <= belge.numPages; i++) {
        const sayfa = await belge.getPage(i);
        const ic = await sayfa.getTextContent();
        let metin = "", sonY = null;
        for (const o of ic.items) {
          if (!("str" in o)) continue;
          const y = o.transform?.[5];
          if (sonY !== null && y !== undefined && Math.abs(y - sonY) > (o.height || 10) * 1.8 && metin && !metin.endsWith("\n")) metin += "\n\n";
          metin += o.str + (o.hasEOL ? "\n" : "");
          if (y !== undefined) sonY = y;
        }
        sayfalar.push([i, metin.replace(/[ \t]+\n/g, "\n").trim()]);
      }
      return sayfalar;
    }
    if (/\.(txt|md)$/.test(ad)) return [[1, new TextDecoder("utf-8").decode(await dosya.arrayBuffer())]];
    throw new Hata("Şimdilik PDF, TXT ve MD dosyaları destekleniyor.");
  }
  function parcala(sayfalar, hedef = 1800) {
    const sonuc = [];
    for (const [sayfa, metin] of sayfalar) {
      let paragraflar = metin.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      // Çok uzun paragrafları cümlelerden böl
      paragraflar = paragraflar.flatMap((p) => p.length <= hedef ? [p] : p.match(new RegExp(`[^]{1,${hedef}}(?:[.!?…](?=\\s)|$)|[^]{1,${hedef}}`, "g")).map((x) => x.trim()).filter(Boolean));
      let tampon = "";
      for (const p of paragraflar) {
        if (tampon.length + p.length > hedef && tampon) { sonuc.push([sayfa, tampon]); tampon = ""; }
        tampon += (tampon ? "\n\n" : "") + p;
      }
      if (tampon) sonuc.push([sayfa, tampon]);
    }
    return sonuc;
  }

  // ------------------------------------------------------------------
  // Belge içinde arama (SQLite FTS5 + bm25 yerine, Türkçe eklerine toleranslı önek araması)
  // ------------------------------------------------------------------
  const sade = (s) => String(s).toLocaleLowerCase("tr").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const kelimeler = (s) => sade(s).match(/[\p{L}\p{N}]+/gu) || [];
  function ara(parcaListesi, soru, limit = 8) {
    const onekler = [...new Set(kelimeler(soru).filter((k) => k.length > 2).slice(0, 12).map((k) => k.slice(0, Math.max(4, k.length - 3))))];
    if (!onekler.length) return [];
    const belgeler = parcaListesi.map((p) => ({ p, k: kelimeler(p.metin) }));
    const N = belgeler.length, ort = belgeler.reduce((t, b) => t + b.k.length, 0) / Math.max(N, 1);
    const df = onekler.map((o) => belgeler.filter((b) => b.k.some((w) => w.startsWith(o))).length);
    const puanli = belgeler.map((b) => {
      let puan = 0;
      onekler.forEach((o, i) => {
        const tf = b.k.filter((w) => w.startsWith(o)).length; if (!tf) return;
        const idf = Math.log(1 + (N - df[i] + 0.5) / (df[i] + 0.5));
        puan += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * b.k.length / ort));
      });
      return { p: b.p, puan };
    }).filter((x) => x.puan > 0).sort((a, b) => b.puan - a.puan);
    return puanli.slice(0, limit).map((x) => x.p);
  }

  // ------------------------------------------------------------------
  // Şemalar ve yönergeler (app.py ile aynı)
  // ------------------------------------------------------------------
  const S = { type: "string" }, I = { type: "integer" }, B = { type: "boolean" };
  const nesne = (o) => ({ type: "object", properties: o, required: Object.keys(o), additionalProperties: false });
  const dizi = (x) => ({ type: "array", items: x });
  const tur = (...e) => ({ type: "string", enum: e });

  const ANALIZ_SEMASI = nesne({
    ozet: S,
    kavramlar: dizi(nesne({ ad: S, aciklama: S })),
    kartlar: dizi(nesne({ kavram: S, on_yuz: S, arka_yuz: S })),
    sorular: dizi(nesne({ kavram: S, soru: S, secenekler: dizi(S), dogru_index: I, aciklama: S, zorluk: I })),
  });
  const ANALIZ_SISTEM = `Sen deneyimli bir öğretim tasarımcısısın. Verilen belgeden çalışma materyali üretirsin.
Kurallar:
- Belgenin dilinde yaz (belge Türkçeyse Türkçe).
- Yalnızca belgede geçen bilgiye dayan; belgede olmayan bilgi ekleme.
- ozet: 150-250 kelimelik, başlıklar halinde (markdown) yapılandırılmış özet.
- kavramlar: belgenin 6-15 temel kavramı; ad kısa olsun (1-4 kelime).
- kartlar: 12-25 flashcard. Ön yüz tek ve net bir soru, arka yüz kısa cevap. kavram alanı kavramlar listesindeki bir adla birebir aynı olsun.
- sorular: 8-15 çoktan seçmeli soru, her birinde 4 seçenek, tek doğru cevap (dogru_index 0-3).
  Çeldiriciler makul olsun. zorluk 1 (kolay) - 3 (zor). aciklama doğru cevabın neden doğru olduğunu söylesin.
  Doğru cevabın konumunu sorular arasında dağıt.`;

  const DIL_SEMASI = nesne({
    yanit: S,
    duzeltmeler: dizi(nesne({ orijinal: S, duzeltilmis: S, aciklama: S, tur: tur("dilbilgisi", "kelime", "yazim", "dogallik", "zaman_kipi", "edat", "artikel") })),
    yeni_kelimeler: dizi(nesne({ kelime: S, anlam: S })),
  });
  const dilSistem = (o) => `Sen sabırlı ve samimi bir ${o.dil} konuşma partnerisin. Öğrencinin seviyesi: ${o.seviye}.
Senaryo: ${o.senaryo}. Senaryodaki karşı tarafı canlandır ve konuşmayı doğal biçimde sürdür.
- yanit: Yalnızca ${o.dil} dilinde, seviyeye uygun uzunlukta (1-4 cümle) cevap ver ve konuşmayı ilerletecek bir soru sor.
- duzeltmeler: Öğrencinin SON mesajındaki hataları listele. Açıklamaları Türkçe yaz. Hata yoksa boş dizi.
  Anlaşılır ama doğal olmayan ifadeleri 'dogallik' türüyle belirt.
- yeni_kelimeler: Yanıtında kullandığın, seviyenin biraz üstündeki 0-3 kelime ve Türkçe anlamı.`;
  const ALISTIRMA_SEMASI = nesne({ analiz: S, alistirmalar: dizi(nesne({ yonerge: S, soru: S, cevap: S, hedef_hata: S })) });
  const IPUCU_SEMASI = nesne({
    durum: tur("dogru", "hatali", "eksik", "calismiyor"), ipucu: S,
    hata_turu: tur("yok", "sozdizimi", "mantik", "kavram", "sinir_durumu", "verimlilik", "okunabilirlik"),
    kavramlar: dizi(nesne({ ad: S, anliyor: B })),
  });
  const GOREV_SEMASI = nesne({ baslik: S, aciklama: S, hedef_kavram: S, baslangic_kodu: S, ornekler: dizi(nesne({ girdi: S, beklenen: S })) });

  // ------------------------------------------------------------------
  // 1) Belgeden öğren
  // ------------------------------------------------------------------
  function materyaliKaydet(belgeId, veri) {
    const kid = (ad) => kavramBulVeyaEkle("belge", ad, belgeId);
    for (const k of veri.kavramlar || []) kid(k.ad);
    let kart = 0, soru = 0;
    for (const k of veri.kartlar || []) {
      D.kartlar.push({ id: yeniId(), belge_id: belgeId, kavram_id: kid(k.kavram), modul: "belge", on_yuz: k.on_yuz, arka_yuz: k.arka_yuz,
        kolaylik: 2.5, aralik: 0, tekrar: 0, hata: 0, vade: gunStr() });
      kart++;
    }
    for (const s of veri.sorular || []) {
      if (!Array.isArray(s.secenekler) || s.secenekler.length < 2 || !(s.dogru_index >= 0 && s.dogru_index < s.secenekler.length)) continue;
      D.sorular.push({ id: yeniId(), belge_id: belgeId, kavram_id: kid(s.kavram), soru: s.soru, secenekler: s.secenekler,
        dogru_index: s.dogru_index, aciklama: s.aciklama, zorluk: Math.max(1, Math.min(3, s.zorluk || 2)) });
      soru++;
    }
    return { kart, soru };
  }

  async function belgeYukle(dosya) {
    const sayfalar = await metniCikar(dosya);
    const tamMetin = sayfalar.filter(([, m]) => m).map(([s, m]) => `[Sayfa ${s}]\n${m}`).join("\n\n");
    if (tamMetin.length < 200) throw new Hata("Belgeden yeterli metin çıkarılamadı (taranmış PDF olabilir; PDF Atölyem'deki OCR ile önce aranabilir yapabilirsin).");
    if (tamMetin.length > MAKS_BELGE_KARAKTER) throw new Hata(`Belge çok uzun (${tamMetin.length.toLocaleString("tr-TR")} karakter). Lütfen bölümlere ayırıp yükle.`);
    const analiz = await Gemini.sor(ANALIZ_SISTEM, [{ role: "user", content: `<belge baslik="${dosya.name}">\n${tamMetin}\n</belge>` }],
      { sema: ANALIZ_SEMASI, maxTokens: 32000 });
    const belgeId = yeniId();
    D.belgeler.push({ id: belgeId, baslik: dosya.name, ozet: analiz.ozet, karakter: tamMetin.length, olusturma: zamanStr() });
    const liste = parcala(sayfalar).map(([sayfa, metin]) => ({ id: yeniId(), sayfa, metin }));
    await idbIs("parcalar", "readwrite", (s) => s.put(liste, belgeId));
    PARCA.set(belgeId, liste);
    const n = materyaliKaydet(belgeId, analiz);
    await kaydet();
    return { id: belgeId, ...n };
  }

  async function belgeyeSor(belgeId, { soru, sokratik = false, gecmis = [] }) {
    const b = D.belgeler.find((x) => x.id === belgeId);
    if (!b) throw new Hata("Belge bulunamadı");
    const tum = await parcalar(belgeId);
    let secilen = ara(tum, soru, 8);
    if (secilen.length < 3) { const g = new Set(secilen.map((p) => p.id)); secilen = secilen.concat(tum.slice(0, 6).filter((p) => !g.has(p.id))); }
    const baglam = secilen.map((p) => `<parca sayfa="${p.sayfa}">\n${p.metin}\n</parca>`).join("\n\n");
    const mod = sokratik
      ? "Sokratik moddasın: cevabı doğrudan verme. Öğrenciyi düşündürecek 1-2 yönlendirici soru sor ve küçük bir ipucu ver. Öğrenci doğru cevaba yaklaştığında onayla."
      : "Soruyu açık ve öz biçimde cevapla.";
    const sistem = `"${b.baslik}" belgesi üzerine çalışan bir öğrenciye yardım eden bir öğretmensin. ${mod}\n` +
      "Yalnızca aşağıdaki belge parçalarına dayan. Kullandığın bilginin sonuna (s. N) biçiminde sayfa atfı ekle. " +
      "Parçalarda cevap yoksa bunu açıkça söyle; uydurma.\n\n" + baglam;
    const mesajlar = gecmis.slice(-10).filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
    mesajlar.push({ role: "user", content: soru });
    const cevap = await Gemini.sor(sistem, mesajlar, { maxTokens: 4000 });
    return { cevap, kaynak_sayfalar: [...new Set(secilen.map((p) => p.sayfa))].sort((a, b) => a - b) };
  }

  async function dahaFazla(belgeId) {
    const b = D.belgeler.find((x) => x.id === belgeId);
    if (!b) throw new Hata("Belge bulunamadı");
    const metin = (await parcalar(belgeId)).map((p) => `[Sayfa ${p.sayfa}]\n${p.metin}`).join("\n\n");
    const zayif = D.kavramlar.filter((k) => k.belge_id === belgeId).sort((a, c) => a.hakimiyet - c.hakimiyet).slice(0, 5).map((k) => k.ad);
    const eski = D.sorular.filter((s) => s.belge_id === belgeId).map((s) => s.soru);
    const sistem = ANALIZ_SISTEM + `\n\nBu ikinci tur. Özellikle şu zayıf kavramlara odaklan: ${zayif.join(", ")}. ` +
      "Mevcut sorulardan farklı, biraz daha zor sorular üret. ozet alanına tek cümle yaz.";
    const analiz = await Gemini.sor(sistem, [{ role: "user", content: `<belge>\n${metin}\n</belge>\n\n<mevcut_sorular>\n${eski.join("\n")}\n</mevcut_sorular>` }],
      { sema: ANALIZ_SEMASI, maxTokens: 32000 });
    const n = materyaliKaydet(belgeId, analiz);
    await kaydet();
    return n;
  }

  function belgeOzet(b) {
    const kv = D.kavramlar.filter((k) => k.belge_id === b.id);
    return { id: b.id, baslik: b.baslik, olusturma: b.olusturma, karakter: b.karakter,
      kart: D.kartlar.filter((k) => k.belge_id === b.id).length, soru: D.sorular.filter((s) => s.belge_id === b.id).length,
      hakimiyet: kv.length ? Math.round(kv.reduce((t, k) => t + k.hakimiyet, 0) / kv.length * 100) / 100 : null };
  }

  // ------------------------------------------------------------------
  // Kartlar ve quiz
  // ------------------------------------------------------------------
  function bugununKartlari(limit = 30) {
    const bugun = gunStr();
    return D.kartlar.filter((k) => k.vade <= bugun)
      .map((k) => ({ k, r: Math.random() })).sort((a, b) => a.k.vade.localeCompare(b.k.vade) || a.r - b.r).slice(0, limit)
      .map(({ k }) => ({ id: k.id, on_yuz: k.on_yuz, arka_yuz: k.arka_yuz, tekrar: k.tekrar, aralik: k.aralik, modul: k.modul,
        belge: D.belgeler.find((b) => b.id === k.belge_id)?.baslik ?? null, kavram: D.kavramlar.find((x) => x.id === k.kavram_id)?.ad ?? null }));
  }
  function kartDegerlendir(kartId, puan) {
    const k = D.kartlar.find((x) => x.id === kartId);
    if (!k) throw new Hata("Kart bulunamadı");
    if (!(puan >= 0 && puan <= 3)) throw new Hata("Geçersiz puan");
    const [kolaylik, aralik, tekrar, vade] = sm2(k.kolaylik, k.aralik, k.tekrar, puan);
    Object.assign(k, { kolaylik, aralik, tekrar, vade, hata: k.hata + (puan === 0 ? 1 : 0) });
    hakimiyetGuncelle(k.kavram_id, puan >= 2);
    deneme({ modul: "kart", kavram_id: k.kavram_id, dogru: puan >= 2 ? 1 : 0 });
    return { sonraki_vade: vade, aralik_gun: aralik };
  }
  function quizSorusu(belgeId) {
    const sinir = once(3);
    const yakinDogru = new Set(D.denemeler.filter((d) => d.soru_id && d.dogru && d.zaman >= sinir).map((d) => d.soru_id));
    const adaylar = D.sorular.filter((s) => (!belgeId || s.belge_id === belgeId) && !yakinDogru.has(s.id)).map((s) => {
      const kv = D.kavramlar.find((k) => k.id === s.kavram_id), h = kv?.hakimiyet ?? 0.3;
      return { s, kv, puan: Math.abs(h * 3 + 0.5 - s.zorluk) + h * 2 + Math.random() / 4 };
    }).sort((a, b) => a.puan - b.puan);
    if (!adaylar.length) return { bitti: true };
    const { s, kv } = adaylar[0];
    return { id: s.id, soru: s.soru, secenekler: s.secenekler, zorluk: s.zorluk, kavram: kv?.ad ?? null, hakimiyet: kv?.hakimiyet ?? null,
      belge: D.belgeler.find((b) => b.id === s.belge_id)?.baslik ?? null };
  }
  function quizCevapla(soruId, secim) {
    const s = D.sorular.find((x) => x.id === soruId);
    if (!s) throw new Hata("Soru bulunamadı");
    const dogru = secim === s.dogru_index;
    deneme({ modul: "quiz", kavram_id: s.kavram_id, soru_id: soruId, dogru: dogru ? 1 : 0 });
    hakimiyetGuncelle(s.kavram_id, dogru);
    return { dogru, dogru_index: s.dogru_index, aciklama: s.aciklama, hakimiyet: D.kavramlar.find((k) => k.id === s.kavram_id)?.hakimiyet ?? null };
  }

  // ------------------------------------------------------------------
  // 2) Dil partneri
  // ------------------------------------------------------------------
  async function dilOturumuBaslat({ dil = "İngilizce", seviye = "B1", senaryo = "Serbest sohbet" }) {
    const o = { dil, seviye, senaryo };
    const ilk = await Gemini.sor(dilSistem(o), [{ role: "user", content: "(Konuşmayı sen başlat. Öğrenci henüz bir şey yazmadı.)" }], { sema: DIL_SEMASI, maxTokens: 2000 });
    const id = yeniId();
    D.dil_oturumlari.push({ id, ...o, olusturma: zamanStr() });
    D.dil_mesajlari.push({ id: yeniId(), oturum_id: id, rol: "assistant", icerik: ilk.yanit, duzeltmeler: { yeni_kelimeler: ilk.yeni_kelimeler || [] }, zaman: zamanStr() });
    await kaydet();
    return { id };
  }
  async function dilMesaji(oid, metin) {
    const o = D.dil_oturumlari.find((x) => x.id === oid);
    if (!o) throw new Hata("Oturum bulunamadı");
    const gecmis = D.dil_mesajlari.filter((m) => m.oturum_id === oid).slice(-20).map((m) => ({ role: m.rol, content: m.icerik }));
    const mesajlar = gecmis.length && gecmis[0].role === "assistant" ? [{ role: "user", content: "(Konuşmayı sen başlat.)" }, ...gecmis] : gecmis;
    mesajlar.push({ role: "user", content: metin });
    const sonuc = await Gemini.sor(dilSistem(o), mesajlar, { sema: DIL_SEMASI, maxTokens: 3000 });
    sonuc.duzeltmeler = sonuc.duzeltmeler || []; sonuc.yeni_kelimeler = sonuc.yeni_kelimeler || [];
    D.dil_mesajlari.push({ id: yeniId(), oturum_id: oid, rol: "user", icerik: metin, duzeltmeler: { duzeltmeler: sonuc.duzeltmeler }, zaman: zamanStr() });
    D.dil_mesajlari.push({ id: yeniId(), oturum_id: oid, rol: "assistant", icerik: sonuc.yanit, duzeltmeler: { yeni_kelimeler: sonuc.yeni_kelimeler }, zaman: zamanStr() });
    for (const d of sonuc.duzeltmeler)
      D.hatalar.push({ id: yeniId(), modul: "dil", hata_turu: d.tur, kavram: o.dil, orijinal: d.orijinal, duzeltilmis: d.duzeltilmis, aciklama: d.aciklama, zaman: zamanStr() });
    deneme({ modul: "dil", dogru: sonuc.duzeltmeler.length ? 0 : 1, hata_turu: sonuc.duzeltmeler[0]?.tur || null });
    for (const k of sonuc.yeni_kelimeler)
      if (!D.kartlar.some((x) => x.modul === "dil" && x.on_yuz === k.kelime))
        D.kartlar.push({ id: yeniId(), belge_id: null, kavram_id: null, modul: "dil", on_yuz: k.kelime, arka_yuz: k.anlam, kolaylik: 2.5, aralik: 0, tekrar: 0, hata: 0, vade: gunStr() });
    await kaydet();
    return sonuc;
  }
  function dilHatalari() {
    const h = D.hatalar.filter((x) => x.modul === "dil");
    const say = {}; for (const x of h) say[x.hata_turu] = (say[x.hata_turu] || 0) + 1;
    return { dagilim: Object.entries(say).map(([hata_turu, sayi]) => ({ hata_turu, sayi })).sort((a, b) => b.sayi - a.sayi),
      son: [...h].sort((a, b) => b.id - a.id).slice(0, 40) };
  }
  async function dilAlistirmasi() {
    const h = D.hatalar.filter((x) => x.modul === "dil").sort((a, b) => b.id - a.id).slice(0, 40)
      .map((x) => ({ hata_turu: x.hata_turu, dil: x.kavram, orijinal: x.orijinal, duzeltilmis: x.duzeltilmis, aciklama: x.aciklama }));
    if (!h.length) throw new Hata("Henüz kayıtlı hata yok. Önce biraz sohbet edin.");
    return Gemini.sor("Sen bir dil öğretmenisin. Öğrencinin son hatalarındaki tekrar eden kalıpları bul. " +
      "analiz: Türkçe, 3-5 cümlelik kalıp analizi. alistirmalar: bu kalıplara yönelik 6-8 kısa alıştırma " +
      "(boşluk doldurma, cümle düzeltme, çeviri). Sorular hedef dilde, yönergeler Türkçe olsun.",
      [{ role: "user", content: JSON.stringify(h) }], { sema: ALISTIRMA_SEMASI, maxTokens: 6000 });
  }

  // ------------------------------------------------------------------
  // 3) Programlama mentoru — Python, tarayıcıda Pyodide ile (ayrı işçide, 10 sn sınır)
  // ------------------------------------------------------------------
  let isci = null, isciHazir = null;
  function isciAc() {
    if (isciHazir) return isciHazir;
    isci = new Worker(new URL("kod-isci.js", document.baseURI).href);
    isciHazir = new Promise((ok, red) => {
      const dinle = (e) => {
        if (e.data?.tur === "hazir") { isci.removeEventListener("message", dinle); ok(isci); }
        if (e.data?.tur === "yukleme-hatasi") { isci.removeEventListener("message", dinle); isciKapat(); red(new Hata("Python motoru yüklenemedi: " + e.data.mesaj)); }
      };
      isci.addEventListener("message", dinle);
      isci.onerror = (e) => { isciKapat(); red(new Hata("Python motoru başlatılamadı: " + (e.message || "bilinmeyen hata"))); };
    });
    return isciHazir;
  }
  function isciKapat() { try { isci?.terminate(); } catch {} isci = null; isciHazir = null; }

  async function kodCalistir({ kod, stdin = "" }) {
    const w = await isciAc();
    return new Promise((ok) => {
      const no = Math.random();
      const zaman = setTimeout(() => {
        isciKapat();
        ok({ stdout: "", stderr: "Zaman aşımı: kod 10 saniyede bitmedi (sonsuz döngü olabilir).", kod: -1 });
      }, 10000);
      const dinle = (e) => {
        if (e.data?.no !== no) return;
        clearTimeout(zaman); w.removeEventListener("message", dinle);
        ok({ stdout: e.data.stdout.slice(-20000), stderr: e.data.stderr.slice(-20000), kod: e.data.kod });
      };
      w.addEventListener("message", dinle);
      w.postMessage({ tur: "calistir", no, kod, stdin });
    });
  }

  async function kodIpucu({ gorev = "", kod, cikti = "", seviye = 1 }) {
    const seviyeler = {
      1: "Seviye 1: Yalnızca sorunun nerede olduğunu düşündürecek bir soru sor. Kod yazma.",
      2: "Seviye 2: Sorunu ve hangi kavramın gerektiğini açıkla; en fazla 2 satırlık örnek ver ama çözümü yazma.",
      3: "Seviye 3: Düzeltilmiş kodu ver ve her değişikliği kısaca açıkla.",
    };
    const sonuc = await Gemini.sor(
      "Sen sabırlı bir programlama mentorusun. Öğrenciye Türkçe yardım edersin. " + `${seviyeler[seviye] || seviyeler[1]}\n` +
      "ipucu markdown olabilir. kavramlar: bu kodun gerektirdiği 1-4 programlama kavramı (ör. 'döngüler', 'özyineleme', " +
      "'liste dilimleme') ve öğrencinin kodundan bu kavramı anlayıp anlamadığı. Kod doğruysa durum='dogru' ve " +
      "ipucunda kısa bir övgü ile varsa bir iyileştirme önerisi ver.",
      [{ role: "user", content: `<gorev>${gorev || "(belirtilmedi)"}</gorev>\n<kod>\n${kod}\n</kod>\n<cikti>\n${String(cikti).slice(-4000)}\n</cikti>` }],
      { sema: IPUCU_SEMASI, maxTokens: 6000 });
    sonuc.kavramlar = sonuc.kavramlar || [];
    D.kod_kayitlari.push({ id: yeniId(), gorev, kod, cikti, ipucu: sonuc.ipucu, zaman: zamanStr() });
    for (const k of sonuc.kavramlar) {
      const kid = kavramBulVeyaEkle("kod", String(k.ad).toLocaleLowerCase("tr"));
      hakimiyetGuncelle(kid, !!k.anliyor);
      deneme({ modul: "kod", kavram_id: kid, dogru: k.anliyor ? 1 : 0, hata_turu: sonuc.hata_turu });
    }
    if (sonuc.hata_turu !== "yok")
      D.hatalar.push({ id: yeniId(), modul: "kod", hata_turu: sonuc.hata_turu, kavram: sonuc.kavramlar.filter((k) => !k.anliyor).map((k) => k.ad).join(", "),
        orijinal: null, duzeltilmis: null, aciklama: String(sonuc.ipucu).slice(0, 500), zaman: zamanStr() });
    await kaydet();
    return sonuc;
  }
  function kodGorevi({ konu = "", zorluk = "orta" }) {
    const zayif = D.kavramlar.filter((k) => k.modul === "kod" && k.deneme > 0).sort((a, b) => a.hakimiyet - b.hakimiyet).slice(0, 4).map((k) => k.ad);
    const hedef = konu || (zayif.length ? zayif.join(", ") : "temel Python: değişkenler, döngüler, fonksiyonlar");
    return Gemini.sor("Python alıştırması tasarlayan bir eğitmensin. Türkçe yaz. Görev 15-30 dakikada çözülebilsin. " +
      "baslangic_kodu: fonksiyon imzası ve TODO yorumu içeren iskelet. ornekler: 2-4 girdi/beklenen çıktı örneği.",
      [{ role: "user", content: `Hedef kavramlar: ${hedef}. Zorluk: ${zorluk}.` }], { sema: GOREV_SEMASI, maxTokens: 4000 });
  }

  // ------------------------------------------------------------------
  // Genel bakış
  // ------------------------------------------------------------------
  function ozet() {
    const bugun = gunStr();
    const zayif = D.kavramlar.filter((k) => k.deneme > 0).sort((a, b) => a.hakimiyet - b.hakimiyet).slice(0, 8)
      .map((k) => ({ id: k.id, modul: k.modul, ad: k.ad, hakimiyet: k.hakimiyet, deneme: k.deneme, belge: D.belgeler.find((b) => b.id === k.belge_id)?.baslik ?? null }));
    const s30 = once(30), say = {};
    for (const h of D.hatalar) if (h.zaman >= s30) { const a = h.modul + "|" + h.hata_turu; say[a] = (say[a] || 0) + 1; }
    const hata_turleri = Object.entries(say).map(([a, sayi]) => { const [modul, hata_turu] = a.split("|"); return { modul, hata_turu, sayi }; })
      .sort((a, b) => b.sayi - a.sayi).slice(0, 10);
    const s14 = gunEkle(-13), gunler = {};
    for (const d of D.denemeler) { const g = d.zaman.slice(0, 10); if (g < s14) continue; gunler[g] ??= { gun: g, deneme: 0, dogru: 0 }; gunler[g].deneme++; gunler[g].dogru += d.dogru; }
    return { vadesi_gelen: D.kartlar.filter((k) => k.vade <= bugun).length, toplam_kart: D.kartlar.length, belge_sayisi: D.belgeler.length,
      zayif_kavramlar: zayif, hata_turleri, gunluk: Object.values(gunler).sort((a, b) => a.gun.localeCompare(b.gun)) };
  }

  // ------------------------------------------------------------------
  // Yönlendirici: eski arayüzdeki api("/api/...") çağrıları buraya gelir
  // ------------------------------------------------------------------
  async function api(yol, secenek = {}) {
    await hazir();
    const yontem = (secenek.method || "GET").toUpperCase(), g = secenek.body || {};
    const u = new URL(yol, "http://yerel"), p = u.pathname.split("/").filter(Boolean).slice(1), q = (k) => u.searchParams.get(k);
    const yaz = async (x) => { await kaydet(); return x; };

    if (p[0] === "ozet") return ozet();
    if (p[0] === "belgeler") {
      if (p.length === 1 && yontem === "GET") return [...D.belgeler].sort((a, b) => b.id - a.id).map(belgeOzet);
      if (p.length === 1 && yontem === "POST") return belgeYukle(g.get("dosya"));
      const id = +p[1];
      if (p.length === 2 && yontem === "GET") {
        const b = D.belgeler.find((x) => x.id === id); if (!b) throw new Hata("Belge bulunamadı");
        return { ...b, kavramlar: D.kavramlar.filter((k) => k.belge_id === id).sort((a, c) => a.hakimiyet - c.hakimiyet)
          .map(({ id, ad, hakimiyet, deneme, dogru }) => ({ id, ad, hakimiyet, deneme, dogru })) };
      }
      if (p.length === 2 && yontem === "DELETE") {
        const kv = new Set(D.kavramlar.filter((k) => k.belge_id === id).map((k) => k.id)), sr = new Set(D.sorular.filter((s) => s.belge_id === id).map((s) => s.id));
        D.belgeler = D.belgeler.filter((b) => b.id !== id); D.kartlar = D.kartlar.filter((k) => k.belge_id !== id);
        D.sorular = D.sorular.filter((s) => s.belge_id !== id); D.kavramlar = D.kavramlar.filter((k) => k.belge_id !== id);
        for (const d of D.denemeler) { if (kv.has(d.kavram_id)) d.kavram_id = null; if (sr.has(d.soru_id)) d.soru_id = null; }
        PARCA.delete(id); await idbIs("parcalar", "readwrite", (s) => s.delete(id));
        return yaz({ ok: true });
      }
      if (p[2] === "sor") return belgeyeSor(id, g);
      if (p[2] === "daha-fazla") return dahaFazla(id);
    }
    if (p[0] === "kartlar") {
      if (p[1] === "bugun") return bugununKartlari(+(q("limit") || 30));
      if (p[2] === "degerlendir") return yaz(kartDegerlendir(+p[1], g.puan));
    }
    if (p[0] === "quiz") {
      if (p.length === 1) return quizSorusu(q("belge_id") ? +q("belge_id") : null);
      if (p[2] === "cevap") return yaz(quizCevapla(+p[1], g.secim));
    }
    if (p[0] === "dil") {
      if (p[1] === "oturum" && p.length === 2) return dilOturumuBaslat(g);
      if (p[1] === "oturumlar") return [...D.dil_oturumlari].sort((a, b) => b.id - a.id).slice(0, 30)
        .map((o) => ({ ...o, mesaj: D.dil_mesajlari.filter((m) => m.oturum_id === o.id && m.rol === "user").length }));
      if (p[1] === "oturum" && p.length === 3) {
        const o = D.dil_oturumlari.find((x) => x.id === +p[2]); if (!o) throw new Hata("Oturum bulunamadı");
        return { ...o, mesajlar: D.dil_mesajlari.filter((m) => m.oturum_id === o.id) };
      }
      if (p[1] === "oturum" && p[3] === "mesaj") return dilMesaji(+p[2], g.metin);
      if (p[1] === "hatalar") return dilHatalari();
      if (p[1] === "alistirma") return dilAlistirmasi();
    }
    if (p[0] === "kod") {
      if (p[1] === "calistir") return kodCalistir(g);
      if (p[1] === "ipucu") return kodIpucu(g);
      if (p[1] === "gorev") return kodGorevi(g);
      if (p[1] === "kavramlar") return D.kavramlar.filter((k) => k.modul === "kod").sort((a, b) => a.hakimiyet - b.hakimiyet)
        .map(({ ad, hakimiyet, deneme, dogru }) => ({ ad, hakimiyet, deneme, dogru }));
    }
    throw new Hata(`Bilinmeyen işlem: ${yontem} ${yol}`);
  }

  // ------------------------------------------------------------------
  // Yedek
  // ------------------------------------------------------------------
  async function yedekAl() {
    await hazir();
    const p = {};
    for (const b of D.belgeler) p[b.id] = await parcalar(b.id);
    return new Blob([JSON.stringify({ uygulama: "ogrenme-asistani", surum: 1, tarih: zamanStr(), veri: D, parcalar: p })], { type: "application/json" });
  }
  async function yedekYukle(dosya) {
    await hazir();
    let y; try { y = JSON.parse(await dosya.text()); } catch { throw new Hata("Yedek dosyası okunamadı."); }
    if (y?.uygulama !== "ogrenme-asistani" || !y.veri) throw new Hata("Bu dosya bir Öğrenme Asistanı yedeği değil.");
    await idbIs("parcalar", "readwrite", (s) => s.clear());
    PARCA.clear();
    for (const [id, liste] of Object.entries(y.parcalar || {})) await idbIs("parcalar", "readwrite", (s) => s.put(liste, +id));
    D = { ...BOS(), ...y.veri };
    await kaydet();
    return D.belgeler.length;
  }

  return { api, hazir, yedekAl, yedekYukle, Hata, _ic: { sm2, ara, parcala } };
})();
