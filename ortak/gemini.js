// Dijital Kütüphanem — ortak Gemini istemcisi (Öğrenme Asistanı, Veri Analisti).
// Anahtar yalnızca bu tarayıcıda saklanır; iki uygulama aynı anahtarı kullanır.
"use strict";

const Gemini = (() => {
  const ANAHTAR_KEY = "dk-gemini-anahtar";
  const ESKI_ANAHTAR_KEY = "veri-analisti-gemini-anahtar";
  const MODEL_KEY = "dk-gemini-model";
  const MODELLER = ["gemini-4-hydrogen", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

  class Hata extends Error {}

  const anahtar = () => (localStorage.getItem(ANAHTAR_KEY) || localStorage.getItem(ESKI_ANAHTAR_KEY) || "").trim();
  function anahtarKaydet(k) {
    k = (k || "").trim();
    for (const ad of [ANAHTAR_KEY, ESKI_ANAHTAR_KEY]) { if (k) localStorage.setItem(ad, k); else localStorage.removeItem(ad); }
  }
  const secilenModel = () => localStorage.getItem(MODEL_KEY) || localStorage.getItem("veri-analisti-gemini-model") || MODELLER[0];
  const modelKaydet = (m) => { localStorage.setItem(MODEL_KEY, m); localStorage.setItem("veri-analisti-gemini-model", m); };
  const modelListesi = () => [...new Set([secilenModel(), ...MODELLER])];

  function sema(s) {
    if (Array.isArray(s)) return s.map(sema);
    if (!s || typeof s !== "object") return s;
    const izinli = ["type", "properties", "required", "items", "enum", "description"], o = {};
    for (const [k, v] of Object.entries(s)) {
      if (!izinli.includes(k)) continue;
      o[k] = k === "properties" ? Object.fromEntries(Object.entries(v).map(([a, x]) => [a, sema(x)])) : sema(v);
    }
    return o;
  }

  // mesajlar: [{role: "user"|"assistant", content}]
  async function sor(sistem, mesajlar, { sema: jsonSema = null, maxTokens = 8000 } = {}) {
    const k = anahtar();
    if (!k) throw new Hata("Bu özellik için Gemini API anahtarı gerekiyor. Sağ üstteki ⚙︎ Ayarlar'dan ekle.");
    const govde = {
      systemInstruction: { parts: [{ text: sistem }] },
      contents: mesajlar.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    };
    if (jsonSema) { govde.generationConfig.responseMimeType = "application/json"; govde.generationConfig.responseJsonSchema = sema(jsonSema); }
    let sonHata = null;
    for (let tur = 0; tur < 2; tur++) {
      for (const model of modelListesi()) {
        let r;
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": k }, body: JSON.stringify(govde) });
        } catch { throw new Hata("Gemini'ye ulaşılamadı. İnternet bağlantını kontrol et."); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const aday = (j.candidates || [])[0];
          const bitis = String(aday?.finishReason || "");
          if (/SAFETY|PROHIBITED|BLOCKLIST/.test(bitis) || j.promptFeedback?.blockReason) throw new Hata("Model bu isteği güvenlik nedeniyle yanıtlamadı.");
          if (bitis === "MAX_TOKENS") throw new Hata("Yanıt uzunluk sınırına takıldı; daha küçük bir parça ile dene.");
          const metin = (aday?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
          if (!metin) throw new Hata("Modelden boş yanıt geldi.");
          if (!jsonSema) return metin;
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

  return { sor, anahtar, anahtarKaydet, anahtarDene, secilenModel, modelKaydet, MODELLER, Hata };
})();
