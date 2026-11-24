// Veri Analisti — tarayıcı içi motor.
// Python sunucusunun yaptığı her şeyi burada yapar: veriyi DuckDB-WASM ile işler, IndexedDB'de saklar,
// soruları doğrudan Gemini'ye sorar. Hiçbir veri bir sunucuya gönderilmez (yalnızca soru sorarken
// tablo şeması, birkaç örnek satır ve sorgu sonucunun ilk satırları Gemini'ye gider).
"use strict";

const Motor = (() => {
  const SONUC_LIMIT = 5000;
  const ANAHTAR_KEY = "veri-analisti-gemini-anahtar";
  const MODEL_KEY = "veri-analisti-gemini-model";
  const MODELLER = ["gemini-4-hydrogen", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

  class Hata extends Error {}

  // ------------------------------------------------------------------
  // Yardımcılar
  // ------------------------------------------------------------------
  const kimlik = (ad) => '"' + String(ad).replace(/"/g, '""') + '"';
  const metinSabiti = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const simdi = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

  function tabloAdiUret(ad) {
    let a = String(ad).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^\x00-\x7f]/g, "");
    a = a.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "veri";
    if (/^\d/.test(a)) a = "t_" + a;
    return a.slice(0, 40);
  }

  function temiz(x) {
    if (typeof x === "number") return Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null;
    if (typeof x === "bigint") return Number(x);
    if (x === null || x === undefined) return null;
    if (typeof x === "string" || typeof x === "boolean") return x;
    if (x instanceof Date) return isNaN(x) ? null : x.toISOString().replace("T", " ").replace(/\.000Z$|Z$/, "");
    try { return JSON.stringify(x, (_, v) => (typeof v === "bigint" ? Number(v) : v)); } catch { return String(x); }
  }

  // ------------------------------------------------------------------
  // DuckDB
  // ------------------------------------------------------------------
  let db = null, con = null, hazirSoz = null;
  const T = () => window.ArrowDataType;

  function hucre(v, tip) {
    if (v === null || v === undefined) return null;
    const DT = T();
    if (DT.isDate(tip) || DT.isTimestamp(tip)) {
      const d = new Date(typeof v === "bigint" ? Number(v) : v);
      if (isNaN(d)) return null;
      const s = d.toISOString();
      if (DT.isDate(tip)) return s.slice(0, 10);
      return s.slice(11, 19) === "00:00:00" && !/\.\d*[1-9]/.test(s) ? s.slice(0, 10) + " 00:00:00" : s.slice(0, 19).replace("T", " ");
    }
    if (DT.isTime && DT.isTime(tip)) return String(v);
    if (v && typeof v === "object" && typeof v.toJSON === "function" && !(v instanceof Date)) return temiz(v.toJSON());
    if (v instanceof Uint8Array) return `<${v.length} bayt>`;
    return temiz(v);
  }

  function tabloyaCevir(t) {
    const alanlar = t.schema.fields;
    const kolonlar = alanlar.map((f) => f.name);
    const tipler = alanlar.map((f) => String(f.type));
    const sutunlar = alanlar.map((_, i) => t.getChildAt(i));
    const satirlar = [];
    for (let r = 0; r < t.numRows; r++) satirlar.push(sutunlar.map((c, i) => hucre(c?.get(r), alanlar[i].type)));
    return { kolonlar, tipler, satirlar };
  }

  async function q(sql, params) {
    await hazir();
    let t;
    if (params && params.length) {
      const st = await con.prepare(sql);
      try { t = await st.query(...params); } finally { await st.close(); }
    } else t = await con.query(sql);
    return tabloyaCevir(t);
  }
  const sozluk = (t) => t.satirlar.map((r) => Object.fromEntries(t.kolonlar.map((k, i) => [k, r[i]])));
  const tekDeger = async (sql, params) => (await q(sql, params)).satirlar[0]?.[0];

  function hazir() {
    if (hazirSoz) return hazirSoz;
    hazirSoz = (async () => {
      const taban = new URL("lib/", document.baseURI).href;
      const isci = new Worker(taban + "duckdb-browser-eh.worker.js");
      const kayit = new window.duckdb.VoidLogger();
      db = new window.duckdb.AsyncDuckDB(kayit, isci);
      await db.instantiate(taban + "duckdb-eh.wasm");
      await db.open({ query: { castDecimalToDouble: true } });
      con = await db.connect();
      await depoYukle();
    })();
    hazirSoz.catch(() => { hazirSoz = null; });
    return hazirSoz;
  }

  // ------------------------------------------------------------------
  // Kalıcı depo (IndexedDB): meta bilgiler + her tablonun Arrow kopyası
  // (bu DuckDB-WASM sürümünde Parquet'e yazma bozuk olduğu için Arrow IPC kullanılır; sütun tipleri korunur)
  // ------------------------------------------------------------------
  let meta = { sayac: 0, veriler: [], sorular: [], islemler: [] };
  let idb = null;
  function idbAc() {
    if (idb) return idb;
    idb = new Promise((ok, red) => {
      const r = indexedDB.open("veri-analisti", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("tablolar"); };
      r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error);
    });
    return idb;
  }
  async function idbIs(depo, kip, is) {
    const d = await idbAc();
    return new Promise((ok, red) => {
      const tx = d.transaction(depo, kip), s = tx.objectStore(depo); let sonuc;
      const r = is(s); if (r) r.onsuccess = () => { sonuc = r.result; };
      tx.oncomplete = () => ok(sonuc); tx.onerror = () => red(tx.error); tx.onabort = () => red(tx.error || new Hata("Kaydedilemedi (depolama dolu olabilir)."));
    });
  }
  const metaKaydet = () => idbIs("kv", "readwrite", (s) => s.put(JSON.parse(JSON.stringify(meta)), "meta"));
  const yeniId = () => ++meta.sayac;

  async function tabloKaydet(tablo) {
    const t = await con.query(`SELECT * FROM ${kimlik(tablo)}`);
    const bayt = window.ArrowIPC.tableToIPC(t, "stream");
    await idbIs("tablolar", "readwrite", (s) => s.put(bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength), tablo));
  }

  async function depoYukle() {
    try { navigator.storage?.persist?.(); } catch {}
    const m = await idbIs("kv", "readonly", (s) => s.get("meta"));
    if (m) meta = m;
    for (const v of meta.veriler) {
      const tampon = await idbIs("tablolar", "readonly", (s) => s.get(v.tablo));
      if (!tampon) { v.kayip = true; continue; }
      await con.query(`DROP TABLE IF EXISTS ${kimlik(v.tablo)}`);
      await con.insertArrowFromIPCStream(new Uint8Array(tampon), { name: v.tablo, create: true });
    }
    meta.veriler = meta.veriler.filter((v) => !v.kayip);
  }

  // ------------------------------------------------------------------
  // Dosya okuma
  // ------------------------------------------------------------------
  function metneCevir(bayt) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bayt).replace(/^﻿/, ""); }
    catch { return new TextDecoder("windows-1254").decode(bayt); }
  }

  function ayiriciBul(metin) {
    const satirlar = metin.split(/\r?\n/).filter((s) => s.trim()).slice(0, 30);
    let en = ",", enPuan = -1;
    for (const a of [",", ";", "\t", "|"]) {
      const sayilar = satirlar.map((s) => s.replace(/"[^"]*"/g, "").split(a).length - 1);
      if (!sayilar.length || !sayilar[0]) continue;
      const tutarli = sayilar.filter((n) => n === sayilar[0]).length / sayilar.length;
      const puan = tutarli * 100 + Math.min(sayilar[0], 50);
      if (puan > enPuan) { enPuan = puan; en = a; }
    }
    return en;
  }

  function csvYap(kolonlar, satirlar) {
    const alan = (v) => {
      if (v === null || v === undefined || v === "") return "";
      if (v instanceof Date) {
        if (isNaN(v)) return "";
        const s = new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString();
        return s.slice(11, 19) === "00:00:00" ? s.slice(0, 10) : s.slice(0, 19).replace("T", " ");
      }
      if (typeof v === "object") v = JSON.stringify(v);
      const s = String(v);
      return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [kolonlar.map(alan).join(","), ...satirlar.map((r) => r.map(alan).join(","))].join("\n");
  }

  function nesnelerdenCsv(nesneler) {
    const kolonlar = [];
    const gorulen = new Set();
    for (const n of nesneler.slice(0, 5000)) for (const k of Object.keys(n || {})) if (!gorulen.has(k)) { gorulen.add(k); kolonlar.push(k); }
    return { kolonlar, csv: csvYap(kolonlar, nesneler.map((n) => kolonlar.map((k) => n?.[k]))) };
  }

  async function dosyaOku(dosya) {
    const ad = dosya.name || "veri.csv", k = ad.toLowerCase();
    const bayt = new Uint8Array(await dosya.arrayBuffer());
    if (/\.(xlsx|xlsm|xls|ods)$/.test(k)) {
      const kitap = XLSX.read(bayt, { type: "array", cellDates: true });
      const sonuc = [];
      for (const sayfa of kitap.SheetNames) {
        const nesneler = XLSX.utils.sheet_to_json(kitap.Sheets[sayfa], { defval: null, raw: true });
        if (!nesneler.length) continue;
        sonuc.push({ ad: kitap.SheetNames.length === 1 ? ad : `${ad} - ${sayfa}`, tur: "csv", metin: nesnelerdenCsv(nesneler).csv, ayirici: "," });
      }
      return sonuc;
    }
    if (/\.(csv|tsv|txt)$/.test(k)) {
      const metin = metneCevir(bayt);
      return [{ ad, tur: "csv", metin, ayirici: k.endsWith(".tsv") ? "\t" : ayiriciBul(metin) }];
    }
    if (k.endsWith(".json")) {
      let veri;
      try { veri = JSON.parse(metneCevir(bayt)); }
      catch {
        // Satır satır JSON (JSON Lines)
        veri = metneCevir(bayt).split(/\r?\n/).filter((s) => s.trim()).map((s) => JSON.parse(s));
      }
      if (!Array.isArray(veri) && veri && typeof veri === "object") {
        const degerler = Object.values(veri);
        if (degerler.length && degerler.every((d) => Array.isArray(d))) {
          const n = Math.max(...degerler.map((d) => d.length));
          const anahtarlar = Object.keys(veri);
          veri = Array.from({ length: n }, (_, i) => Object.fromEntries(anahtarlar.map((a) => [a, veri[a][i]])));
        } else if (degerler.length && degerler.every((d) => d && typeof d === "object" && !Array.isArray(d))) {
          const sutunlar = Object.keys(veri), satirAnahtarlari = Object.keys(degerler[0]);
          veri = satirAnahtarlari.map((r) => Object.fromEntries(sutunlar.map((s) => [s, veri[s][r]])));
        } else {
          const dizi = degerler.find((d) => Array.isArray(d) && d.length && typeof d[0] === "object");
          veri = dizi || [veri];
        }
      }
      if (!Array.isArray(veri)) throw new Hata("JSON dosyası bir tablo içermiyor.");
      veri = veri.map((x) => (x && typeof x === "object" && !Array.isArray(x) ? x : { deger: x }));
      return [{ ad, tur: "csv", metin: nesnelerdenCsv(veri).csv, ayirici: "," }];
    }
    if (k.endsWith(".parquet")) return [{ ad, tur: "parquet", bayt }];
    throw new Hata("Desteklenen biçimler: CSV, TSV, Excel, JSON, Parquet.");
  }

  async function tabloOlustur(tablo, parca) {
    const dosya = `_giris_${tablo}.${parca.tur}`;
    if (parca.tur === "parquet") {
      await db.registerFileBuffer(dosya, parca.bayt);
      await con.query(`CREATE TABLE ${kimlik(tablo)} AS SELECT * FROM read_parquet(${metinSabiti(dosya)})`);
    } else {
      await db.registerFileText(dosya, parca.metin);
      await con.query(`CREATE TABLE ${kimlik(tablo)} AS SELECT * FROM read_csv(${metinSabiti(dosya)}, ` +
        `delim=${metinSabiti(parca.ayirici)}, header=true, quote='"', escape='"', sample_size=-1, null_padding=true, ignore_errors=false)`);
    }
    await db.dropFile(dosya);
    // Boş/isimsiz sütun adlarını düzelt
    const kolonlar = (await q(`SELECT * FROM ${kimlik(tablo)} LIMIT 0`)).kolonlar;
    for (let i = 0; i < kolonlar.length; i++) {
      const yeni = String(kolonlar[i]).trim() || `sutun_${i}`;
      if (yeni !== kolonlar[i] && !kolonlar.includes(yeni)) await con.query(`ALTER TABLE ${kimlik(tablo)} RENAME ${kimlik(kolonlar[i])} TO ${kimlik(yeni)}`);
    }
  }

  // ------------------------------------------------------------------
  // Otomatik profil (EDA) ve kalite önerileri — profil.py'nin karşılığı
  // ------------------------------------------------------------------
  const SAYISAL = ["TINYINT", "SMALLINT", "INTEGER", "BIGINT", "HUGEINT", "FLOAT", "DOUBLE", "DECIMAL", "UTINYINT", "USMALLINT", "UINTEGER", "UBIGINT"];
  const sayisalMi = (tip) => SAYISAL.some((s) => String(tip).toUpperCase().startsWith(s));
  const TARIH_FORMATLARI = ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M"];
  const sayi = (x) => { if (x === null || x === undefined) return null; const n = Number(x); return Number.isNaN(n) ? x : n; };

  async function profilCikar(tablo) {
    const t = kimlik(tablo);
    const satir = await tekDeger(`SELECT COUNT(*) FROM ${t}`);
    const ozet = sozluk(await q(`SUMMARIZE ${t}`));
    const tekrar = await tekDeger(`SELECT COUNT(*) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ${t})) FROM ${t}`);
    const sutunlar = [], oneriler = [];
    const oner = (baslik, aciklama, sql, onem = "orta") => oneriler.push({ no: oneriler.length, baslik, aciklama, sql, onem });

    if (tekrar) oner(`${tekrar} tekrar eden satır`, "Tamamen aynı olan satırlar silinsin.", `CREATE OR REPLACE TABLE ${t} AS SELECT DISTINCT * FROM ${t}`, "yuksek");

    for (const s of ozet) {
      const ad = s.column_name, tip = s.column_type, c = kimlik(ad);
      const bosYuzde = Number(s.null_percentage || 0);
      const sayisal = sayisalMi(tip);
      const deger = sayisal ? (x) => temiz(sayi(x)) : temiz;
      const bilgi = {
        ad, tip, bos_yuzde: Math.round(bosYuzde * 100) / 100, benzersiz: s.approx_unique,
        min: deger(s.min), max: deger(s.max),
        ortalama: sayisal ? deger(s.avg) : null, std: sayisal ? deger(s.std) : null,
        q25: deger(s.q25), medyan: deger(s.q50), q75: deger(s.q75), uyarilar: [],
      };
      if (s.approx_unique !== null && s.approx_unique <= 1 && satir > 1) {
        bilgi.uyarilar.push("Sabit sütun (tek değer)");
        oner(`'${ad}' sabit`, "Tüm satırlarda aynı değer var; analize katkısı yok. Sütun silinsin.", `ALTER TABLE ${t} DROP COLUMN ${c}`, "dusuk");
      }
      if (bosYuzde > 0) bilgi.uyarilar.push(`%${bosYuzde.toFixed(1)} boş`);

      if (sayisal) {
        const q1 = Number(s.q25), q3 = Number(s.q75);
        if (Number.isFinite(q1) && Number.isFinite(q3)) {
          const iqr = q3 - q1, alt = q1 - 1.5 * iqr, ust = q3 + 1.5 * iqr;
          const aykiri = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE ${c} < ? OR ${c} > ?`, [alt, ust]);
          bilgi.aykiri = aykiri; bilgi.aykiri_sinirlar = [temiz(alt), temiz(ust)];
          if (iqr > 0 && aykiri) bilgi.uyarilar.push(`${aykiri} aykırı değer`);
        }
        bilgi.histogram = (await q(
          `SELECT FLOOR((${c} - m.mn) / NULLIF((m.mx - m.mn) / 12.0, 0)) * (m.mx - m.mn) / 12.0 + m.mn AS _kova, COUNT(*) ` +
          `FROM ${t}, (SELECT MIN(${c}) mn, MAX(${c}) mx FROM ${t}) m WHERE ${c} IS NOT NULL GROUP BY _kova ORDER BY _kova`)).satirlar
          .map((r) => ({ aralik: temiz(r[0]), sayi: r[1] }));
        if (bosYuzde > 0 && bosYuzde < 40)
          oner(`'${ad}' boş değerleri`, `%${bosYuzde.toFixed(1)} boş değer medyan ile doldurulsun.`,
            `UPDATE ${t} SET ${c} = (SELECT MEDIAN(${c}) FROM ${t}) WHERE ${c} IS NULL`, "orta");
      } else if (String(tip).toUpperCase().startsWith("VARCHAR")) {
        const dolu = (await tekDeger(`SELECT COUNT(${c}) FROM ${t} WHERE trim(${c}) <> ''`)) || 0;
        bilgi.en_sik = (await q(`SELECT ${c}, COUNT(*) n FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 8`)).satirlar
          .map((r) => ({ deger: temiz(r[0]), sayi: r[1] }));
        if (dolu) {
          let tarihBulundu = false;
          for (const fmt of TARIH_FORMATLARI) {
            const n = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE TRY_STRPTIME(trim(${c}), ?) IS NOT NULL`, [fmt]);
            if (n / dolu >= 0.95) {
              tarihBulundu = true;
              bilgi.uyarilar.push(`Tarih olarak saklanmalı (${fmt})`);
              const hedef = fmt.includes("%H") ? "TIMESTAMP" : "DATE";
              oner(`'${ad}' tarihe çevrilsin`, `Değerler ${fmt} biçiminde tarih ama metin olarak kaydedilmiş.`,
                `ALTER TABLE ${t} ALTER ${c} TYPE ${hedef} USING CAST(TRY_STRPTIME(trim(${c}), '${fmt}') AS ${hedef})`, "yuksek");
              break;
            }
          }
          const sayiNokta = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE TRY_CAST(trim(${c}) AS DOUBLE) IS NOT NULL AND trim(${c}) <> ''`);
          const sayiTr = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE regexp_full_match(trim(${c}), '-?\\d{1,3}(\\.\\d{3})*(,\\d+)?|-?\\d+(,\\d+)?')`);
          if (tarihBulundu) { /* tarih önceliklidir */ }
          else if (sayiNokta / dolu >= 0.95) {
            bilgi.uyarilar.push("Sayı olarak saklanmalı");
            oner(`'${ad}' sayıya çevrilsin`, "Değerlerin çoğu sayı ama metin olarak kaydedilmiş.",
              `ALTER TABLE ${t} ALTER ${c} TYPE DOUBLE USING TRY_CAST(trim(${c}) AS DOUBLE)`, "yuksek");
          } else if (sayiTr / dolu >= 0.95) {
            bilgi.uyarilar.push("Türkçe sayı biçimi (1.234,56)");
            oner(`'${ad}' sayıya çevrilsin`, "Değerler 1.234,56 biçiminde metin olarak kaydedilmiş.",
              `ALTER TABLE ${t} ALTER ${c} TYPE DOUBLE USING TRY_CAST(replace(replace(trim(${c}), '.', ''), ',', '.') AS DOUBLE)`, "yuksek");
          }
        }
        const bosluk = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE ${c} <> trim(${c})`);
        if (bosluk) {
          bilgi.uyarilar.push(`${bosluk} değerde baş/son boşluk`);
          oner(`'${ad}' boşlukları`, `${bosluk} değerin başında/sonunda boşluk var; kırpılsın.`, `UPDATE ${t} SET ${c} = trim(${c}) WHERE ${c} <> trim(${c})`, "dusuk");
        }
        const bosMetin = await tekDeger(`SELECT COUNT(*) FROM ${t} WHERE trim(${c}) = ''`);
        if (bosMetin) {
          bilgi.uyarilar.push(`${bosMetin} boş metin`);
          oner(`'${ad}' boş metinleri`, `${bosMetin} boş metin NULL olarak işaretlensin.`, `UPDATE ${t} SET ${c} = NULL WHERE trim(${c}) = ''`, "dusuk");
        }
      }
      sutunlar.push(bilgi);
    }

    const sayisallar = sutunlar.filter((s) => sayisalMi(s.tip)).map((s) => s.ad).slice(0, 12);
    const korelasyon = [];
    for (let i = 0; i < sayisallar.length; i++) for (const b of sayisallar.slice(i + 1)) {
      const r = await tekDeger(`SELECT CORR(${kimlik(sayisallar[i])}, ${kimlik(b)}) FROM ${t}`);
      if (typeof r === "number" && Number.isFinite(r)) korelasyon.push({ a: sayisallar[i], b, r: Math.round(r * 1000) / 1000 });
    }
    korelasyon.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    const ornek = sozluk(await q(`SELECT * FROM ${t} LIMIT 8`));
    return { satir, sutun: sutunlar.length, tekrar_eden: tekrar, sutunlar, korelasyon: korelasyon.slice(0, 15), oneriler, ornek };
  }

  async function profilKaydet(v) {
    const p = await profilCikar(v.tablo);
    Object.assign(v, { satir: p.satir, sutun: p.sutun, profil: p });
    return p;
  }

  // ------------------------------------------------------------------
  // Salt okunur SQL denetimi
  // ------------------------------------------------------------------
  const YASAK = /\b(insert|update|delete|drop|create|alter|attach|detach|copy|export|import|install|load|pragma|call|set|checkpoint|vacuum|truncate|grant|begin|commit|rollback|use)\b|read_\w+\s*\(|glob\s*\(|_kayit_|_yukle_|_giris_/i;
  function sqlDogrula(sql) {
    sql = String(sql).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").trim().replace(/;+\s*$/, "").trim();
    if (sql.includes(";")) throw new Hata("Tek bir SQL ifadesine izin veriliyor.");
    if (!/^(select|with|from)\b/i.test(sql)) throw new Hata("Yalnızca SELECT sorgularına izin veriliyor.");
    const sade = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
    if (YASAK.test(sade)) throw new Hata("Sorgu salt okunur olmayan bir ifade içeriyor.");
    return sql;
  }
  async function calistir(sql) {
    const guvenli = sqlDogrula(sql);
    const t = await q(`SELECT * FROM (${guvenli}) AS _sonuc LIMIT ${SONUC_LIMIT + 1}`);
    t.kesildi = t.satirlar.length > SONUC_LIMIT;
    t.satirlar = t.satirlar.slice(0, SONUC_LIMIT);
    return t;
  }

  // ------------------------------------------------------------------
  // Gemini
  // ------------------------------------------------------------------
  const anahtar = () => (localStorage.getItem(ANAHTAR_KEY) || "").trim();
  const modelListesi = () => [...new Set([localStorage.getItem(MODEL_KEY) || MODELLER[0], ...MODELLER].filter(Boolean))];

  function geminiSema(s) {
    if (Array.isArray(s)) return s.map(geminiSema);
    if (!s || typeof s !== "object") return s;
    const izinli = ["type", "properties", "required", "items", "enum", "description"], o = {};
    for (const [k, v] of Object.entries(s)) {
      if (!izinli.includes(k)) continue;
      o[k] = k === "properties" ? Object.fromEntries(Object.entries(v).map(([a, x]) => [a, geminiSema(x)])) : geminiSema(v);
    }
    return o;
  }

  async function gemini(sistem, mesajlar, { sema = null, maxTokens = 8000 } = {}) {
    const k = anahtar();
    if (!k) throw new Hata("Soru sorabilmek için Gemini API anahtarı gerekiyor. Sağ üstteki ⚙︎ Ayarlar'dan ekle.");
    const govde = {
      systemInstruction: { parts: [{ text: sistem }] },
      contents: mesajlar.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    };
    if (sema) { govde.generationConfig.responseMimeType = "application/json"; govde.generationConfig.responseJsonSchema = geminiSema(sema); }
    let sonHata = null;
    for (let tur = 0; tur < 2; tur++) {
      for (const model of modelListesi()) {
        let r;
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": k }, body: JSON.stringify(govde) });
        } catch (e) { throw new Hata("Gemini'ye ulaşılamadı. İnternet bağlantını kontrol et."); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const aday = (j.candidates || [])[0];
          const bitis = String(aday?.finishReason || "");
          if (/SAFETY|PROHIBITED|BLOCKLIST/.test(bitis) || j.promptFeedback?.blockReason) throw new Hata("Model bu isteği güvenlik nedeniyle yanıtlamadı.");
          if (bitis === "MAX_TOKENS") throw new Hata("Yanıt uzunluk sınırına takıldı; soruyu daraltıp tekrar dene.");
          const metin = (aday?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
          if (!metin) throw new Hata("Modelden boş yanıt geldi.");
          if (!sema) return metin;
          try { return JSON.parse(metin.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Hata("Modelin JSON yanıtı çözümlenemedi."); }
        }
        const mesaj = j.error?.message || `HTTP ${r.status}`;
        if (r.status === 400 && /api key|API_KEY/i.test(mesaj)) throw new Hata("Gemini API anahtarı geçersiz. ⚙︎ Ayarlar'dan kontrol et.");
        if (r.status === 401 || r.status === 403) throw new Hata("Gemini API anahtarı geçersiz ya da yetkisiz. ⚙︎ Ayarlar'dan kontrol et.");
        if ([404, 429, 500, 502, 503, 504].includes(r.status)) { sonHata = { kod: r.status, mesaj }; continue; }
        throw new Hata(`Gemini isteği reddedildi (${r.status}): ${mesaj}`);
      }
      if (tur === 0) await new Promise((ok) => setTimeout(ok, 3000));
    }
    if (sonHata?.kod === 429) throw new Hata("Gemini ücretsiz kullanım sınırına ulaşıldı. Bir dakika bekleyip tekrar dene.");
    throw new Hata("Gemini modelleri şu an çok yoğun. Biraz sonra tekrar dene.");
  }

  async function anahtarDene(k) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": k } }).catch(() => null);
    if (!r) throw new Hata("Gemini'ye ulaşılamadı. İnternet bağlantını kontrol et.");
    if (!r.ok) throw new Hata("Anahtar kabul edilmedi. Doğru kopyaladığından emin ol.");
    return true;
  }

  // ------------------------------------------------------------------
  // Soru → SQL → sonuç → yorum
  // ------------------------------------------------------------------
  const S = { type: "string" }, B = { type: "boolean" };
  const nesne = (o) => ({ type: "object", properties: o, required: Object.keys(o), additionalProperties: false });
  const dizi = (x) => ({ type: "array", items: x });
  const SQL_SEMASI = nesne({
    netlestirme_gerekli: B, netlestirme_sorusu: S, sql: S, varsayimlar: dizi(S),
    grafik: nesne({ tur: { type: "string", enum: ["cubuk", "yatay_cubuk", "cizgi", "alan", "pasta", "dagilim", "tablo", "sayi"] }, x: S, y: dizi(S), baslik: S }),
  });

  const SQL_SISTEM = `Sen titiz bir veri analistisin. Kullanıcının Türkçe sorusunu DuckDB SQL sorgusuna çevirirsin.
Kurallar:
- Yalnızca tek bir SELECT (veya WITH ... SELECT) sorgusu yaz. Tablo ve sütun adlarını çift tırnakla yaz.
- Yalnızca verilen şemadaki sütunları kullan. Hesaplamayı her zaman SQL yapsın; sayı uydurma.
- Soru gerçekten belirsizse ve makul bir varsayım yapılamıyorsa netlestirme_gerekli=true yap, netlestirme_sorusu'na
  kısa bir soru yaz ve sql'i boş bırak. Aksi halde netlestirme_gerekli=false, netlestirme_sorusu boş olsun.
- Yaptığın her varsayımı (hangi sütunu neden seçtin, filtreler, tarih aralığı) varsayimlar listesine Türkçe yaz.
- Sonucu okunur tut: gerekirse ORDER BY ve makul LIMIT (ör. ilk 20) kullan, ondalıkları ROUND ile yuvarla.
- grafik: sonuca en uygun gösterim. x bir sonuç sütunu, y bir veya daha fazla sayısal sonuç sütunu olmalı.
  Zaman serisi → cizgi; kategori karşılaştırma → cubuk (uzun etiketlerde yatay_cubuk); pay → pasta (en fazla 8 dilim);
  iki sayısal değişken → dagilim; tek değer → sayi; diğer → tablo. Grafik gerekmiyorsa x ve y boş olabilir.`;

  function semaMetni(v) {
    const p = v.profil || {};
    const satirlar = (p.sutunlar || []).map((s) => {
      const ek = [];
      if (s.en_sik?.length) ek.push("örnek değerler: " + s.en_sik.slice(0, 6).map((x) => JSON.stringify(x.deger)).join(", "));
      if (s.min !== null && s.min !== undefined) ek.push(`aralık: ${s.min} – ${s.max}`);
      if (s.bos_yuzde) ek.push(`%${s.bos_yuzde} boş`);
      return `  - ${kimlik(s.ad)} ${s.tip}` + (ek.length ? `  (${ek.join("; ")})` : "");
    });
    return `Tablo: ${kimlik(v.tablo)}  (${p.satir ?? "?"} satır)\nAçıklama: ${v.aciklama || "-"}\nSütunlar:\n${satirlar.join("\n")}\n` +
      `Örnek satırlar: ${JSON.stringify((p.ornek || []).slice(0, 3))}`;
  }

  // ------------------------------------------------------------------
  // "API": eski sunucunun uç noktalarıyla aynı biçimde yanıt verir
  // ------------------------------------------------------------------
  const veriBul = (id) => { const v = meta.veriler.find((x) => x.id === +id); if (!v) throw new Hata("Veri kümesi bulunamadı"); return v; };
  const veriOzet = (v) => ({ id: v.id, ad: v.ad, tablo: v.tablo, kaynak: v.kaynak, aciklama: v.aciklama, satir: v.satir, sutun: v.sutun,
    olusturma: v.olusturma, oneri_sayisi: v.profil?.oneriler?.length || 0 });
  const soruOzet = (s) => ({ ...s, veri: meta.veriler.find((v) => v.id === s.veri_id)?.ad || null });

  async function veriYukle(dosya, aciklama = "") {
    await hazir();
    const parcalar = await dosyaOku(dosya);
    if (!parcalar.length) throw new Hata("Dosyada veri bulunamadı.");
    const mevcut = new Set(meta.veriler.map((v) => v.tablo));
    const eklenenler = [];
    for (const parca of parcalar) {
      let tablo = tabloAdiUret(parca.ad), n = 2;
      while (mevcut.has(tablo)) tablo = `${tabloAdiUret(parca.ad)}_${n++}`;
      mevcut.add(tablo);
      try { await tabloOlustur(tablo, parca); }
      catch (e) { throw new Hata(`Dosya okunamadı: ${e.message}`); }
      const v = { id: yeniId(), ad: parca.ad, tablo, kaynak: dosya.name, aciklama, olusturma: simdi() };
      await profilKaydet(v);
      await tabloKaydet(tablo);
      meta.veriler.push(v);
      eklenenler.push({ id: v.id, ad: v.ad, tablo });
    }
    await metaKaydet();
    return eklenenler;
  }

  async function sor({ veri_id, soru, gecmis = [] }) {
    await hazir();
    const v = veriBul(veri_id);
    const mesajlar = [];
    for (const g of gecmis.slice(-4)) if (g.soru && g.sql)
      mesajlar.push({ role: "user", content: g.soru }, { role: "assistant", content: JSON.stringify({ sql: g.sql }) });
    mesajlar.push({ role: "user", content: soru });
    const sistem = SQL_SISTEM + "\n\n<sema>\n" + semaMetni(v) + "\n</sema>";

    let plan = null, sonuc = null, hata = null;
    const denemeler = [];
    for (let i = 0; i < 3; i++) {
      plan = await gemini(sistem, mesajlar, { sema: SQL_SEMASI, maxTokens: 8000 });
      plan.varsayimlar = plan.varsayimlar || [];
      if (plan.netlestirme_gerekli) return { netlestirme: plan.netlestirme_sorusu, varsayimlar: plan.varsayimlar };
      try { sonuc = await calistir(plan.sql); hata = null; break; }
      catch (e) {
        hata = e.message; denemeler.push({ sql: plan.sql, hata });
        mesajlar.push({ role: "assistant", content: JSON.stringify(plan) }, { role: "user", content: `Bu sorgu hata verdi:\n${hata}\nDüzeltilmiş sorguyu yaz.` });
      }
    }
    if (hata) return { hata, sql: plan?.sql || "", denemeler };

    const yorum = await gemini(
      "Sen bir veri analistisin. Sorgu sonucunu Türkçe, 2-5 cümleyle yorumla. Yalnızca tablodaki sayıları kullan, " +
      "yeni sayı hesaplama veya uydurma. Önemli bulguyu öne al. Sonuç kesilmişse bunu belirt. Markdown kullanabilirsin.",
      [{ role: "user", content: `Soru: ${soru}\nSQL: ${plan.sql}\nToplam satır: ${sonuc.satirlar.length}${sonuc.kesildi ? " (kesildi)" : ""}\n` +
        `Sütunlar: ${JSON.stringify(sonuc.kolonlar)}\nİlk satırlar: ${JSON.stringify(sonuc.satirlar.slice(0, 60))}` }],
      { maxTokens: 2000 });

    const kayit = { id: yeniId(), veri_id: v.id, soru, sql: plan.sql, grafik: plan.grafik, yorum, varsayimlar: plan.varsayimlar, sabit: false, zaman: simdi() };
    meta.sorular.push(kayit);
    await metaKaydet();
    return { id: kayit.id, sql: plan.sql, varsayimlar: plan.varsayimlar, grafik: plan.grafik, sonuc, yorum, denemeler };
  }

  async function csvIndir(sql) {
    await hazir();
    const t = await q(sqlDogrula(sql));
    return new Blob(["\uFEFF" + csvYap(t.kolonlar, t.satirlar)], { type: "text/csv;charset=utf-8" });
  }

  function sorular({ veri_id = null, sabit = false } = {}) {
    return meta.sorular.filter((s) => (!veri_id || s.veri_id === +veri_id) && (!sabit || s.sabit))
      .sort((a, b) => b.id - a.id).slice(0, 100).map(soruOzet);
  }

  // Yönlendirici: eski arayüzdeki api("/api/...") çağrıları buraya gelir.
  async function api(yol, secenek = {}) {
    const yontem = (secenek.method || "GET").toUpperCase();
    const govde = secenek.body;
    const u = new URL(yol, "http://yerel");
    const p = u.pathname.split("/").filter(Boolean).slice(1); // "api" atlanır
    await hazir();

    if (p[0] === "veriler") {
      if (p.length === 1 && yontem === "GET") return [...meta.veriler].sort((a, b) => b.id - a.id).map(veriOzet);
      if (p.length === 1 && yontem === "POST") return veriYukle(govde.get("dosya"), govde.get("aciklama") || "");
      const v = veriBul(p[1]);
      if (p.length === 2 && yontem === "GET")
        return { ...veriOzet(v), profil: v.profil, islemler: meta.islemler.filter((i) => i.veri_id === v.id).sort((a, b) => b.id - a.id) };
      if (p.length === 2 && yontem === "DELETE") {
        await con.query(`DROP TABLE IF EXISTS ${kimlik(v.tablo)}`);
        await idbIs("tablolar", "readwrite", (s) => s.delete(v.tablo));
        meta.veriler = meta.veriler.filter((x) => x !== v);
        meta.sorular = meta.sorular.filter((s) => s.veri_id !== v.id);
        meta.islemler = meta.islemler.filter((s) => s.veri_id !== v.id);
        await metaKaydet();
        return { ok: true };
      }
      if (p[2] === "oneri") {
        const o = (v.profil?.oneriler || [])[+p[3]];
        if (!o) throw new Hata("Öneri bulunamadı (profil değişmiş olabilir).");
        try { await con.query(o.sql); } catch (e) { throw new Hata(`Uygulanamadı: ${e.message}`); }
        meta.islemler.push({ id: yeniId(), veri_id: v.id, islem: o.baslik, sql: o.sql, zaman: simdi() });
        const pr = await profilKaydet(v);
        await tabloKaydet(v.tablo); await metaKaydet();
        return pr;
      }
      if (p[2] === "yeniden-profil") { const pr = await profilKaydet(v); await metaKaydet(); return pr; }
      if (p[2] === "onizleme") {
        const boyut = Math.min(+(u.searchParams.get("boyut") || 50), 500), sayfa = Math.max(+(u.searchParams.get("sayfa") || 0), 0);
        return q(`SELECT * FROM ${kimlik(v.tablo)} LIMIT ${boyut} OFFSET ${sayfa * boyut}`);
      }
    }
    if (p[0] === "sor") return sor(govde);
    if (p[0] === "sql" && p.length === 1) return calistir(govde.sql);
    if (p[0] === "sorular") {
      if (p.length === 1) return sorular({ veri_id: u.searchParams.get("veri_id"), sabit: u.searchParams.get("sabit") === "true" });
      const s = meta.sorular.find((x) => x.id === +p[1]);
      if (p[2] === "sabitle") { if (s) s.sabit = !!govde.sabit; await metaKaydet(); return { ok: true }; }
      if (yontem === "DELETE") { meta.sorular = meta.sorular.filter((x) => x.id !== +p[1]); await metaKaydet(); return { ok: true }; }
    }
    if (p[0] === "panel") {
      const kartlar = [];
      for (const s of sorular({ sabit: true })) {
        try { s.sonuc = await calistir(s.sql); } catch (e) { s.hata = e.message; }
        kartlar.push(s);
      }
      return kartlar;
    }
    throw new Hata(`Bilinmeyen işlem: ${yontem} ${yol}`);
  }

  // ------------------------------------------------------------------
  // Yedek: tüm veri kümeleri + sorular tek dosyada
  // ------------------------------------------------------------------
  async function yedekAl() {
    await hazir();
    const tablolar = {};
    for (const v of meta.veriler) {
      const tampon = await idbIs("tablolar", "readonly", (s) => s.get(v.tablo));
      if (tampon) tablolar[v.tablo] = btoa(Array.from(new Uint8Array(tampon), (b) => String.fromCharCode(b)).join(""));
    }
    return new Blob([JSON.stringify({ uygulama: "veri-analisti", surum: 2, tarih: simdi(), meta, tablolar })], { type: "application/json" });
  }
  async function yedekYukle(dosya) {
    await hazir();
    let y;
    try { y = JSON.parse(await dosya.text()); } catch { throw new Hata("Yedek dosyası okunamadı."); }
    if (y?.uygulama !== "veri-analisti" || !y.meta) throw new Hata("Bu dosya bir Veri Analisti yedeği değil.");
    for (const v of meta.veriler) await con.query(`DROP TABLE IF EXISTS ${kimlik(v.tablo)}`);
    await idbIs("tablolar", "readwrite", (s) => s.clear());
    for (const [tablo, b64] of Object.entries(y.tablolar || {})) {
      const bin = atob(b64), bayt = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bayt[i] = bin.charCodeAt(i);
      await idbIs("tablolar", "readwrite", (s) => s.put(bayt.buffer, tablo));
    }
    meta = { sayac: 0, veriler: [], sorular: [], islemler: [], ...y.meta };
    await metaKaydet();
    await depoYukle();
    await metaKaydet();
    return meta.veriler.length;
  }

  return { api, hazir, csvIndir, anahtar, anahtarDene, yedekAl, yedekYukle, MODELLER, ANAHTAR_KEY, MODEL_KEY, Hata,
    _ic: { sqlDogrula, ayiriciBul, tabloAdiUret } };
})();
