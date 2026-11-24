// Öğrenme Asistanı arayüzü
const $ = (s, k = document) => k.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => (window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(s || "")) : esc(s).replace(/\n/g, "<br>"));

function bildir(mesaj, hata = false) {
  const b = $("#bildirim");
  b.textContent = mesaj; b.className = hata ? "hata" : ""; b.style.display = "block";
  clearTimeout(b._t); b._t = setTimeout(() => (b.style.display = "none"), hata ? 6000 : 3000);
}

// Eski sunucu yerine tarayıcı içi motor (motor.js) yanıt verir.
async function api(yol, secenek = {}) {
  try { return await Motor.api(yol, secenek); }
  catch (e) { throw new Error(e?.message || String(e)); }
}

// Butonu meşgul gösterip işi çalıştırır
async function mesgul(btn, is) {
  const eski = btn.innerHTML;
  btn.disabled = true; btn.classList.add("yukleniyor");
  try { return await is(); }
  catch (e) { bildir(e.message, true); }
  finally { btn.disabled = false; btn.classList.remove("yukleniyor"); btn.innerHTML = eski; }
}

const cubuk = (oran) => `<div class="cubuk"><span style="width:${Math.round((oran || 0) * 100)}%"></span></div>`;
const yuzde = (x) => `${Math.round((x || 0) * 100)}%`;

// ---------------- Menü ----------------
const yukleyiciler = {};
$("#menu").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  document.querySelectorAll("#menu button").forEach((x) => x.classList.toggle("aktif", x === b));
  document.querySelectorAll("section.sayfa").forEach((s) => s.classList.toggle("aktif", s.id === b.dataset.sayfa));
  yukleyiciler[b.dataset.sayfa]?.();
});

// ---------------- Genel bakış ----------------
yukleyiciler.genel = async () => {
  const o = await api("/api/ozet");
  const dogru = o.gunluk.reduce((a, g) => a + (g.dogru || 0), 0), deneme = o.gunluk.reduce((a, g) => a + g.deneme, 0);
  $("#genel-sayilar").innerHTML = [
    ["Tekrarı gelen kart", o.vadesi_gelen, `toplam ${o.toplam_kart} kart`],
    ["Belge", o.belge_sayisi, "yüklenmiş"],
    ["Son 14 gün başarı", deneme ? yuzde(dogru / deneme) : "–", `${deneme} deneme`],
  ].map(([e, s, a]) => `<div class="kart"><div class="etiket">${e}</div><div class="sayi">${s}</div><div class="etiket">${a}</div></div>`).join("");

  $("#genel-zayif").innerHTML = o.zayif_kavramlar.length ? `<table><tr><th>Kavram</th><th>Modül</th><th>Hâkimiyet</th></tr>${
    o.zayif_kavramlar.map((k) => `<tr><td>${esc(k.ad)}${k.belge ? `<div class="etiket">${esc(k.belge)}</div>` : ""}</td><td><span class="rozet">${k.modul}</span></td><td>${cubuk(k.hakimiyet)} <span class="etiket">${yuzde(k.hakimiyet)}</span></td></tr>`).join("")}</table>`
    : `<div class="bos">Henüz veri yok. Quiz çöz, kart tekrar et ya da kod yaz.</div>`;

  $("#genel-hatalar").innerHTML = o.hata_turleri.length ? o.hata_turleri.map((h) =>
    `<div class="liste-ogesi"><span><span class="rozet uyari">${h.modul}</span> ${esc(h.hata_turu)}</span><b>${h.sayi}</b></div>`).join("")
    : `<div class="bos">Kayıtlı hata yok.</div>`;

  const enCok = Math.max(1, ...o.gunluk.map((g) => g.deneme));
  $("#genel-gunluk").innerHTML = o.gunluk.length ? `<div style="display:flex;gap:6px;align-items:flex-end;height:120px">${
    o.gunluk.map((g) => `<div title="${g.gun}: ${g.dogru || 0}/${g.deneme} doğru" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
      <div style="background:var(--accent-soft);height:${(g.deneme - (g.dogru || 0)) / enCok * 100}%"></div>
      <div style="background:var(--accent);height:${(g.dogru || 0) / enCok * 100}%"></div>
      <div class="etiket" style="text-align:center;font-size:11px">${g.gun.slice(5)}</div></div>`).join("")}</div>
      <div class="etiket">Koyu: doğru, açık: yanlış</div>`
    : `<div class="bos">Son 14 günde etkinlik yok.</div>`;
};

// ---------------- Belgeler ----------------
let seciliBelge = null;
yukleyiciler.belgeler = async () => {
  const liste = await api("/api/belgeler");
  $("#belge-listesi").innerHTML = liste.length ? liste.map((b) => `
    <div class="liste-ogesi tikla" data-id="${b.id}">
      <div><b>${esc(b.baslik)}</b><div class="etiket">${b.kart} kart · ${b.soru} soru · ${b.olusturma.slice(0, 10)}</div></div>
      <div style="width:90px">${cubuk(b.hakimiyet)}</div>
    </div>`).join("") : `<div class="bos">Henüz belge yok. Sağ üstten bir PDF yükle.</div>`;
  if (seciliBelge) belgeGoster(seciliBelge);
};
$("#belge-listesi").addEventListener("click", (e) => {
  const o = e.target.closest("[data-id]"); if (o) belgeGoster(+o.dataset.id);
});

$("#belge-dosya").addEventListener("change", async (e) => {
  const dosya = e.target.files[0]; if (!dosya) return;
  const etiket = $("#yukle-btn");
  etiket.classList.add("yukleniyor"); etiket.firstChild.textContent = "Analiz ediliyor (1-2 dk) ";
  try {
    const fd = new FormData(); fd.append("dosya", dosya);
    const r = await api("/api/belgeler", { method: "POST", body: fd });
    bildir(`${r.kart} kart ve ${r.soru} soru üretildi.`);
    seciliBelge = r.id; await yukleyiciler.belgeler();
  } catch (err) { bildir(err.message, true); }
  finally { etiket.classList.remove("yukleniyor"); etiket.firstChild.textContent = "Belge yükle"; e.target.value = ""; }
});

let belgeSohbet = [];
async function belgeGoster(id) {
  if (seciliBelge !== id) belgeSohbet = [];
  seciliBelge = id;
  const b = await api(`/api/belgeler/${id}`);
  $("#belge-detay").innerHTML = `
    <div class="kart">
      <div class="satir" style="justify-content:space-between"><h3 style="margin:0">${esc(b.baslik)}</h3>
        <span class="satir"><button class="btn kucuk" id="daha-fazla">Zayıf konulara ek materyal</button>
        <button class="btn kucuk" id="belge-sil">Sil</button></span></div>
      <div class="md" style="margin-top:12px">${md(b.ozet)}</div>
    </div>
    <div class="kart"><h3>Kavramlar</h3>${b.kavramlar.map((k) => `
      <div class="liste-ogesi"><span>${esc(k.ad)} <span class="etiket">${k.dogru}/${k.deneme}</span></span><span style="width:100px">${cubuk(k.hakimiyet)}</span></div>`).join("")}</div>
    <div class="kart">
      <div class="satir" style="justify-content:space-between"><h3 style="margin:0">Belgeye sor</h3>
        <label class="etiket satir" style="gap:6px"><input type="checkbox" id="sokratik" style="width:auto"> Sokratik mod</label></div>
      <div class="sohbet" id="belge-sohbet" style="margin:10px 0"></div>
      <form id="belge-sor" class="satir"><input class="esnek" id="belge-soru" placeholder="Bu belgede … ne demek?"><button class="btn ana">Sor</button></form>
    </div>`;
  belgeSohbetCiz();
  $("#belge-sil").onclick = async () => {
    if (!confirm("Belge ve ona ait kart/soruların hepsi silinsin mi?")) return;
    await api(`/api/belgeler/${id}`, { method: "DELETE" }); seciliBelge = null;
    $("#belge-detay").innerHTML = ""; yukleyiciler.belgeler();
  };
  $("#daha-fazla").onclick = (e) => mesgul(e.target, async () => {
    const r = await api(`/api/belgeler/${id}/daha-fazla`, { method: "POST" });
    bildir(`${r.kart} yeni kart, ${r.soru} yeni soru eklendi.`); yukleyiciler.belgeler();
  });
  $("#belge-sor").onsubmit = async (e) => {
    e.preventDefault();
    const soru = $("#belge-soru").value.trim(); if (!soru) return;
    $("#belge-soru").value = "";
    const gecmis = belgeSohbet.slice();
    belgeSohbet.push({ role: "user", content: soru }); belgeSohbetCiz(true);
    try {
      const r = await api(`/api/belgeler/${id}/sor`, { method: "POST", body: { soru, sokratik: $("#sokratik").checked, gecmis } });
      belgeSohbet.push({ role: "assistant", content: r.cevap });
    } catch (err) { belgeSohbet.pop(); bildir(err.message, true); }
    belgeSohbetCiz();
  };
}
function belgeSohbetCiz(bekliyor = false) {
  const k = $("#belge-sohbet"); if (!k) return;
  k.innerHTML = belgeSohbet.map((m) => `<div class="balon ${m.role} ${m.role === "assistant" ? "md" : ""}">${m.role === "assistant" ? md(m.content) : esc(m.content)}</div>`).join("")
    + (bekliyor ? `<div class="balon assistant yukleniyor">Düşünüyor</div>` : "");
  k.scrollTop = k.scrollHeight;
}

// ---------------- Tekrar ----------------
let kartlar = [], kartIdx = 0;
yukleyiciler.tekrar = async () => { kartlar = await api("/api/kartlar/bugun"); kartIdx = 0; kartCiz(false); };
function kartCiz(acik) {
  const alan = $("#tekrar-alan");
  if (kartIdx >= kartlar.length) {
    alan.innerHTML = `<div class="kart bos">${kartlar.length ? "Bugünlük bu kadar, harika iş!" : "Bugün tekrar edilecek kart yok."}</div>`;
    return;
  }
  const k = kartlar[kartIdx];
  alan.innerHTML = `
    <div class="etiket" style="margin-bottom:8px">${kartIdx + 1} / ${kartlar.length} · ${esc(k.belge || (k.modul === "dil" ? "Dil partneri kelimesi" : ""))} ${k.kavram ? `· <span class="rozet">${esc(k.kavram)}</span>` : ""}</div>
    <div class="kart flashcard"><div>${esc(k.on_yuz)}</div>${acik ? `<div class="arka md">${md(k.arka_yuz)}</div>` : ""}</div>
    <div class="satir" style="justify-content:center">${acik
      ? [["Tekrar", 0], ["Zor", 1], ["İyi", 2], ["Kolay", 3]].map(([e, p]) => `<button class="btn ${p === 2 ? "ana" : ""}" data-puan="${p}">${e}</button>`).join("")
      : `<button class="btn ana" id="kart-goster">Cevabı göster (boşluk)</button>`}</div>`;
  $("#kart-goster")?.addEventListener("click", () => kartCiz(true));
  alan.querySelectorAll("[data-puan]").forEach((b) => b.addEventListener("click", () => kartPuanla(+b.dataset.puan)));
}
async function kartPuanla(puan) {
  try { await api(`/api/kartlar/${kartlar[kartIdx].id}/degerlendir`, { method: "POST", body: { puan } }); kartIdx++; kartCiz(false); }
  catch (e) { bildir(e.message, true); }
}
document.addEventListener("keydown", (e) => {
  if (!$("#tekrar").classList.contains("aktif") || ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (e.code === "Space" && $("#kart-goster")) { e.preventDefault(); kartCiz(true); }
  if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code) && $("[data-puan]")) kartPuanla(+e.code.slice(-1) - 1);
});

// ---------------- Quiz ----------------
yukleyiciler.quiz = async () => {
  const sec = $("#quiz-belge"), deger = sec.value;
  const liste = await api("/api/belgeler");
  sec.innerHTML = `<option value="">Tüm belgeler</option>` + liste.map((b) => `<option value="${b.id}">${esc(b.baslik)}</option>`).join("");
  sec.value = deger; quizYeni();
};
$("#quiz-belge").addEventListener("change", () => quizYeni());
async function quizYeni() {
  const id = $("#quiz-belge").value;
  const s = await api(`/api/quiz${id ? `?belge_id=${id}` : ""}`);
  const alan = $("#quiz-alan");
  if (s.bitti) { alan.innerHTML = `<div class="kart bos">Şu an sorulacak soru yok. Belge yükle ya da birkaç gün sonra tekrar gel.</div>`; return; }
  alan.innerHTML = `<div class="kart">
    <div class="satir etiket" style="margin-bottom:10px"><span class="rozet">${esc(s.kavram || "")}</span> ${esc(s.belge || "")} · zorluk ${"●".repeat(s.zorluk)}${"○".repeat(3 - s.zorluk)} · hâkimiyet ${yuzde(s.hakimiyet)}</div>
    <div style="font-size:17px;font-weight:600;margin-bottom:8px">${esc(s.soru)}</div>
    ${s.secenekler.map((o, i) => `<button class="secenek" data-i="${i}">${"ABCD"[i] || i + 1}) ${esc(o)}</button>`).join("")}
    <div id="quiz-sonuc"></div></div>`;
  alan.querySelectorAll(".secenek").forEach((b) => b.addEventListener("click", async () => {
    alan.querySelectorAll(".secenek").forEach((x) => (x.disabled = true));
    try {
      const r = await api(`/api/quiz/${s.id}/cevap`, { method: "POST", body: { secim: +b.dataset.i } });
      alan.querySelectorAll(".secenek")[r.dogru_index].classList.add("dogru");
      if (!r.dogru) b.classList.add("yanlis");
      $("#quiz-sonuc").innerHTML = `<div class="kart" style="margin:12px 0 0;background:${r.dogru ? "var(--good-soft)" : "var(--bad-soft)"}">
        <b>${r.dogru ? "Doğru!" : "Yanlış."}</b> ${esc(r.aciklama)}
        <div class="etiket" style="margin-top:6px">Yeni hâkimiyet: ${yuzde(r.hakimiyet)}</div></div>
        <button class="btn ana" style="margin-top:12px" id="quiz-sonraki">Sonraki soru →</button>`;
      $("#quiz-sonraki").onclick = quizYeni;
    } catch (e) { bildir(e.message, true); }
  }));
}

// ---------------- Dil partneri ----------------
let dilOturum = null;
yukleyiciler.dil = async () => {
  const [oturumlar, hatalar] = await Promise.all([api("/api/dil/oturumlar"), api("/api/dil/hatalar")]);
  $("#dil-oturumlar").innerHTML = oturumlar.length ? oturumlar.map((o) => `
    <div class="liste-ogesi tikla" data-oid="${o.id}"><span>${esc(o.dil)} ${esc(o.seviye)} · ${esc(o.senaryo)}</span><span class="etiket">${o.mesaj} mesaj</span></div>`).join("")
    : `<div class="bos">Henüz konuşma yok.</div>`;
  $("#dil-hatalar").innerHTML = hatalar.dagilim.length
    ? hatalar.dagilim.map((h) => `<span class="rozet uyari" style="margin:0 6px 6px 0">${esc(h.hata_turu)}: ${h.sayi}</span>`).join("")
      + `<table style="margin-top:8px">${hatalar.son.slice(0, 8).map((h) => `<tr><td><s>${esc(h.orijinal)}</s> → <b>${esc(h.duzeltilmis)}</b><div class="etiket">${esc(h.aciklama)}</div></td></tr>`).join("")}</table>`
    : `<div class="bos">Hata kaydı yok.</div>`;
};
$("#dil-oturumlar").addEventListener("click", (e) => { const o = e.target.closest("[data-oid]"); if (o) dilAc(+o.dataset.oid); });
$("#dil-baslat").onclick = (e) => mesgul(e.target, async () => {
  const r = await api("/api/dil/oturum", { method: "POST", body: { dil: $("#dil-dil").value, seviye: $("#dil-seviye").value, senaryo: $("#dil-senaryo").value } });
  await dilAc(r.id); yukleyiciler.dil();
});
async function dilAc(id) {
  const o = await api(`/api/dil/oturum/${id}`);
  dilOturum = id;
  $("#dil-baslik").textContent = `${o.dil} ${o.seviye} · ${o.senaryo}`;
  $("#dil-sohbet").innerHTML = o.mesajlar.map(dilMesajHtml).join("");
  $("#dil-sohbet").scrollTop = 1e9;
  $("#dil-girdi").disabled = false; $("#dil-form button").disabled = false; $("#dil-girdi").focus();
}
function dilMesajHtml(m) {
  let h = `<div class="balon ${m.rol}">${esc(m.icerik)}</div>`;
  const d = m.duzeltmeler || {};
  (d.duzeltmeler || []).forEach((x) => { h += `<div class="duzeltme"><s>${esc(x.orijinal)}</s> → <b>${esc(x.duzeltilmis)}</b> <span class="rozet uyari">${esc(x.tur)}</span><div>${esc(x.aciklama)}</div></div>`; });
  if (d.yeni_kelimeler?.length) h += `<div class="kelime">Yeni: ${d.yeni_kelimeler.map((k) => `<b>${esc(k.kelime)}</b> (${esc(k.anlam)})`).join(", ")}</div>`;
  return h;
}
$("#dil-form").onsubmit = async (e) => {
  e.preventDefault();
  const girdi = $("#dil-girdi"), metin = girdi.value.trim(); if (!metin || !dilOturum) return;
  girdi.value = ""; girdi.disabled = true;
  const s = $("#dil-sohbet");
  s.insertAdjacentHTML("beforeend", `<div class="balon user">${esc(metin)}</div><div class="balon assistant yukleniyor" id="dil-bekle">…</div>`);
  s.scrollTop = 1e9;
  try { await api(`/api/dil/oturum/${dilOturum}/mesaj`, { method: "POST", body: { metin } }); await dilAc(dilOturum); }
  catch (err) { $("#dil-bekle")?.remove(); bildir(err.message, true); }
  girdi.disabled = false; girdi.focus();
};
$("#dil-alistirma-btn").onclick = (e) => mesgul(e.target, async () => {
  const r = await api("/api/dil/alistirma", { method: "POST" });
  $("#dil-alistirma").innerHTML = `<div class="kart"><h3>Hata kalıbı analizi</h3><div class="md">${md(r.analiz)}</div>
    <table style="margin-top:12px"><tr><th>#</th><th>Alıştırma</th><th>Cevap</th></tr>${r.alistirmalar.map((a, i) => `
      <tr><td>${i + 1}</td><td><div class="etiket">${esc(a.yonerge)}</div>${esc(a.soru)}<div class="etiket">Hedef: ${esc(a.hedef_hata)}</div></td>
      <td><details><summary class="tikla">Göster</summary>${esc(a.cevap)}</details></td></tr>`).join("")}</table></div>`;
  $("#dil-alistirma").scrollIntoView({ behavior: "smooth" });
});

// ---------------- Kod mentoru ----------------
let sonCikti = "";
yukleyiciler.kod = async () => {
  const k = await api("/api/kod/kavramlar");
  $("#kod-kavramlar").innerHTML = k.length ? k.map((x) => `<div class="liste-ogesi"><span>${esc(x.ad)} <span class="etiket">${x.dogru}/${x.deneme}</span></span><span style="width:110px">${cubuk(x.hakimiyet)}</span></div>`).join("")
    : `<div class="bos">İpucu aldıkça kavramların burada görünür.</div>`;
};
const editor = $("#kod-editor");
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") { e.preventDefault(); const s = editor.selectionStart; editor.setRangeText("    ", s, editor.selectionEnd, "end"); }
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#kod-calistir").click();
});
$("#kod-calistir").onclick = (e) => mesgul(e.target, async () => {
  const r = await api("/api/kod/calistir", { method: "POST", body: { kod: editor.value } });
  sonCikti = (r.stdout || "") + (r.stderr ? `\n${r.stderr}` : "");
  $("#kod-cikti").innerHTML = esc(r.stdout) + (r.stderr ? `<span class="hata">${esc(r.stderr)}</span>` : "") + (r.stdout || r.stderr ? "" : "(çıktı yok)")
    + `\n<span style="color:#888">— çıkış kodu ${r.kod}</span>`;
});
document.querySelectorAll("[data-seviye]").forEach((b) => (b.onclick = () => mesgul(b, async () => {
  if (!editor.value.trim()) throw new Error("Önce biraz kod yaz.");
  const r = await api("/api/kod/ipucu", { method: "POST", body: { gorev: $("#kod-gorev").value, kod: editor.value, cikti: sonCikti, seviye: +b.dataset.seviye } });
  const renk = { dogru: "iyi", hatali: "kotu", calismiyor: "kotu", eksik: "uyari" }[r.durum];
  const ipucu = $("#kod-ipucu"); ipucu.classList.remove("bos");
  ipucu.innerHTML = `<div class="satir" style="margin-bottom:8px"><span class="rozet ${renk}">${r.durum}</span>${r.hata_turu !== "yok" ? `<span class="rozet uyari">${r.hata_turu}</span>` : ""}</div>${md(r.ipucu)}`;
  yukleyiciler.kod();
})));
$("#kod-gorev-btn").onclick = (e) => mesgul(e.target, async () => {
  const g = await api("/api/kod/gorev", { method: "POST", body: { konu: $("#kod-konu").value, zorluk: $("#kod-zorluk").value } });
  $("#kod-gorev").value = `${g.baslik}\n\n${g.aciklama}\n\nÖrnekler:\n${g.ornekler.map((o) => `  ${o.girdi}  →  ${o.beklenen}`).join("\n")}`;
  $("#kod-gorev").rows = 8;
  editor.value = g.baslangic_kodu;
  bildir(`Hedef kavram: ${g.hedef_kavram}`);
});

yukleyiciler.genel().catch((e) => bildir(e.message, true));


// ---------------- Ayarlar (Gemini anahtarı) ve yedek ----------------
function ayarlarAc() {
  $("#ayar-anahtar").value = Gemini.anahtar();
  $("#ayar-model").innerHTML = Gemini.MODELLER.map((m) => `<option ${m === Gemini.secilenModel() ? "selected" : ""}>${m}</option>`).join("");
  $("#ayarlar").showModal();
}
$("#ayarlar-btn").onclick = ayarlarAc;
$("#ayar-kapat").onclick = () => $("#ayarlar").close();
$("#ayar-kaydet").onclick = (e) => mesgul(e.target, async () => {
  const k = $("#ayar-anahtar").value.trim();
  if (k) await Gemini.anahtarDene(k);
  Gemini.anahtarKaydet(k); Gemini.modelKaydet($("#ayar-model").value);
  $("#anahtar-uyari").hidden = !!k;
  $("#ayarlar").close(); bildir(k ? "Anahtar kaydedildi." : "Anahtar silindi.");
});
$("#yedek-al").onclick = (e) => mesgul(e.target, async () => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(await Motor.yedekAl());
  a.download = `ogrenme-asistani-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$("#yedek-dosya").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!confirm("Yedek yüklenince bu cihazdaki belgeler, kartlar ve konuşmalar yedektekilerle değiştirilecek. Devam edilsin mi?")) return;
  try { const n = await Motor.yedekYukle(f); $("#ayarlar").close(); bildir(`Yedek yüklendi: ${n} belge.`); sayfaAc("genel"); }
  catch (err) { bildir(err.message, true); }
});
$("#anahtar-uyari").hidden = !!Gemini.anahtar();
$("#anahtar-uyari button").onclick = ayarlarAc;
