// Veri Analisti arayüzü
const $ = (s, k = document) => k.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => (window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(s || "")) : esc(s));
const sayiBicim = (x) => (typeof x === "number" ? x.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : x ?? "");

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
async function mesgul(btn, is) {
  const eski = btn.innerHTML; btn.disabled = true; btn.classList.add("yukleniyor");
  try { return await is(); } catch (e) { bildir(e.message, true); } finally { btn.disabled = false; btn.classList.remove("yukleniyor"); btn.innerHTML = eski; }
}

// ---------------- Menü ----------------
const yukleyiciler = {};
function sayfaAc(ad) {
  document.querySelectorAll("#menu button").forEach((x) => x.classList.toggle("aktif", x.dataset.sayfa === ad));
  document.querySelectorAll("section.sayfa").forEach((s) => s.classList.toggle("aktif", s.id === ad));
  yukleyiciler[ad]?.();
}
$("#menu").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) sayfaAc(b.dataset.sayfa); });

// ---------------- Tablo & grafik ----------------
function tabloHtml(t, limit = 200) {
  if (!t.satirlar.length) return `<div class="bos">Sonuç boş.</div>`;
  return `<div class="tablo-kap"><table><tr>${t.kolonlar.map((k) => `<th>${esc(k)}</th>`).join("")}</tr>${
    t.satirlar.slice(0, limit).map((r) => `<tr>${r.map((v) => `<td>${v === null ? '<span class="etiket">∅</span>' : esc(sayiBicim(v))}</td>`).join("")}</tr>`).join("")}</table></div>
    <div class="etiket" style="margin-top:6px">${t.satirlar.length.toLocaleString("tr-TR")} satır${t.kesildi ? " (ilk 5.000 satır gösteriliyor)" : ""}${t.satirlar.length > limit ? `, tabloda ilk ${limit}` : ""}</div>`;
}

const RENKLER = ["#24365a", "#d4a857", "#5b7bb5", "#8c6d2e", "#9db4e0", "#3f5d4a", "#b35c44", "#7a6aa8"];
const grafikler = new WeakMap();
function grafikCiz(kap, g, t) {
  if (!g || !t?.satirlar.length || g.tur === "tablo") return false;
  const xi = t.kolonlar.indexOf(g.x);
  const yler = (g.y || []).map((y) => t.kolonlar.indexOf(y)).filter((i) => i >= 0);
  if (g.tur === "sayi") {
    const i = yler[0] ?? t.kolonlar.findIndex((_, j) => typeof t.satirlar[0][j] === "number");
    if (i < 0) return false;
    kap.innerHTML = `<div class="buyuk-sayi">${esc(sayiBicim(t.satirlar[0][i]))}</div><div class="etiket" style="text-align:center">${esc(g.baslik || t.kolonlar[i])}</div>`;
    return true;
  }
  if (xi < 0 || !yler.length || !window.Chart) return false;
  const satirlar = t.satirlar.slice(0, g.tur === "pasta" ? 8 : 500);
  const tur = { cubuk: "bar", yatay_cubuk: "bar", cizgi: "line", alan: "line", pasta: "doughnut", dagilim: "scatter" }[g.tur] || "bar";
  const karanlik = matchMedia("(prefers-color-scheme: dark)").matches;
  const yaziRengi = karanlik ? "#9d9b95" : "#6b6a66", cizgiRengi = karanlik ? "#33322f" : "#e4e2dc";
  const veri = tur === "scatter"
    ? { datasets: yler.map((yi, n) => ({ label: t.kolonlar[yi], data: satirlar.map((r) => ({ x: r[xi], y: r[yi] })), backgroundColor: RENKLER[n] + "aa" })) }
    : { labels: satirlar.map((r) => r[xi]), datasets: yler.map((yi, n) => ({
        label: t.kolonlar[yi], data: satirlar.map((r) => r[yi]),
        backgroundColor: tur === "doughnut" ? RENKLER : (g.tur === "alan" ? RENKLER[n] + "33" : RENKLER[n]),
        borderColor: tur === "doughnut" ? (karanlik ? "#1f1f1d" : "#fff") : RENKLER[n],
        fill: g.tur === "alan", tension: 0.25, pointRadius: satirlar.length > 60 ? 0 : 3, borderRadius: 4 })) };
  kap.innerHTML = `<div class="grafik-kap"><canvas></canvas></div>`;
  const eski = grafikler.get(kap); if (eski) eski.destroy();
  grafikler.set(kap, new Chart($("canvas", kap), {
    type: tur, data: veri,
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: g.tur === "yatay_cubuk" ? "y" : "x",
      plugins: { legend: { display: yler.length > 1 || tur === "doughnut", labels: { color: yaziRengi } },
        title: { display: !!g.baslik, text: g.baslik, color: yaziRengi } },
      scales: tur === "doughnut" ? {} : {
        x: { ticks: { color: yaziRengi, maxRotation: 45 }, grid: { color: cizgiRengi }, title: { display: tur === "scatter", text: g.x, color: yaziRengi } },
        y: { ticks: { color: yaziRengi }, grid: { color: cizgiRengi }, beginAtZero: tur === "bar" },
      },
    },
  }));
  return true;
}

// ---------------- Veri kümeleri ----------------
let seciliVeri = null;
yukleyiciler.veriler = async () => {
  const liste = await api("/api/veriler");
  $("#veri-listesi").innerHTML = liste.length ? `<table><tr><th>Ad</th><th>Tablo</th><th>Satır</th><th>Sütun</th><th>Öneri</th><th></th></tr>${liste.map((v) => `
    <tr class="tikla" data-id="${v.id}"><td><b>${esc(v.ad)}</b>${v.aciklama ? `<div class="etiket">${esc(v.aciklama)}</div>` : ""}</td>
    <td><code>${esc(v.tablo)}</code></td><td>${(v.satir || 0).toLocaleString("tr-TR")}</td><td>${v.sutun}</td>
    <td>${v.oneri_sayisi ? `<span class="rozet uyari">${v.oneri_sayisi}</span>` : `<span class="rozet iyi">temiz</span>`}</td>
    <td><button class="btn kucuk" data-sor="${v.id}">Soru sor →</button></td></tr>`).join("")}</table>`
    : `<div class="bos">Henüz veri yok. Sağ üstten bir CSV, Excel, JSON ya da Parquet dosyası yükle. Dosyan bu cihazda kalır.</div>`;
  if (seciliVeri) veriGoster(seciliVeri);
};
$("#veri-listesi").addEventListener("click", (e) => {
  const s = e.target.closest("[data-sor]");
  if (s) { e.stopPropagation(); $("#sor-veri").dataset.hedef = s.dataset.sor; sayfaAc("sor"); return; }
  const r = e.target.closest("[data-id]"); if (r) veriGoster(+r.dataset.id);
});
$("#veri-dosya").addEventListener("change", async (e) => {
  const dosya = e.target.files[0]; if (!dosya) return;
  const etiket = $("#yukle-btn"); etiket.classList.add("yukleniyor"); etiket.firstChild.textContent = "Yükleniyor ";
  try {
    const fd = new FormData(); fd.append("dosya", dosya);
    const r = await api("/api/veriler", { method: "POST", body: fd });
    bildir(`${r.length} tablo yüklendi ve profillendi.`); seciliVeri = r[0].id; await yukleyiciler.veriler();
  } catch (err) { bildir(err.message, true); }
  finally { etiket.classList.remove("yukleniyor"); etiket.firstChild.textContent = "Dosya yükle"; e.target.value = ""; }
});

async function veriGoster(id) {
  seciliVeri = id;
  const v = await api(`/api/veriler/${id}`), p = v.profil;
  const onemRenk = { yuksek: "kotu", orta: "uyari", dusuk: "" };
  $("#veri-detay").innerHTML = `
    <div class="kart">
      <div class="satir" style="justify-content:space-between">
        <div><h3 style="margin:0">${esc(v.ad)}</h3><div class="etiket">${p.satir.toLocaleString("tr-TR")} satır · ${p.sutun} sütun · ${p.tekrar_eden} tekrar eden satır · tablo <code>${esc(v.tablo)}</code></div></div>
        <span class="satir"><button class="btn kucuk" id="onizle">Veriyi göster</button><button class="btn kucuk" id="veri-sil">Sil</button></span>
      </div>
      <div id="onizleme" style="margin-top:12px"></div>
    </div>
    <div class="kart"><h3>Kalite önerileri</h3>${p.oneriler.length ? p.oneriler.map((o) => `
      <div class="liste-ogesi"><div><span class="rozet ${onemRenk[o.onem]}">${o.onem}</span> <b>${esc(o.baslik)}</b>
        <div class="etiket">${esc(o.aciklama)}</div><details><summary>SQL</summary><code>${esc(o.sql)}</code></details></div>
        <button class="btn kucuk" data-oneri="${o.no}">Uygula</button></div>`).join("")
      : `<div class="bos">Belirgin bir kalite sorunu bulunmadı.</div>`}
      ${v.islemler.length ? `<details style="margin-top:10px"><summary>Uygulanan işlemler (${v.islemler.length})</summary>${v.islemler.map((i) => `<div class="etiket">${esc(i.zaman.slice(0, 16))} · ${esc(i.islem)}</div>`).join("")}</details>` : ""}
    </div>
    <h3>Sütunlar</h3>
    <div class="izgara">${p.sutunlar.map(sutunKart).join("")}</div>
    ${p.korelasyon.length ? `<div class="kart" style="margin-top:16px"><h3>En güçlü korelasyonlar</h3><table><tr><th>Sütun A</th><th>Sütun B</th><th>r</th></tr>${
      p.korelasyon.slice(0, 8).map((k) => `<tr><td>${esc(k.a)}</td><td>${esc(k.b)}</td><td><span class="rozet ${Math.abs(k.r) > 0.7 ? "kotu" : Math.abs(k.r) > 0.4 ? "uyari" : ""}">${k.r}</span></td></tr>`).join("")}</table></div>` : ""}`;
  $("#veri-sil").onclick = async () => {
    if (!confirm(`"${v.ad}" ve ona ait tüm sorular silinsin mi? Bu geri alınamaz.`)) return;
    await api(`/api/veriler/${id}`, { method: "DELETE" }); seciliVeri = null; $("#veri-detay").innerHTML = ""; yukleyiciler.veriler();
  };
  $("#onizle").onclick = async () => { $("#onizleme").innerHTML = tabloHtml(await api(`/api/veriler/${id}/onizleme`)); };
  document.querySelectorAll("[data-oneri]").forEach((b) => (b.onclick = () => mesgul(b, async () => {
    await api(`/api/veriler/${id}/oneri/${b.dataset.oneri}`, { method: "POST" });
    bildir("Uygulandı, profil yenilendi."); yukleyiciler.veriler();
  })));
}
function sutunKart(s) {
  const hist = s.histogram?.length ? (() => { const m = Math.max(...s.histogram.map((h) => h.sayi)); return `<div class="mini-hist" title="Dağılım">${s.histogram.map((h) => `<span style="height:${h.sayi / m * 100}%" title="${sayiBicim(h.aralik)}: ${h.sayi}"></span>`).join("")}</div>`; })() : "";
  const sik = s.en_sik?.length ? `<div style="margin-top:8px">${s.en_sik.slice(0, 5).map((x) => `<div class="satir etiket" style="justify-content:space-between"><span>${esc(String(x.deger).slice(0, 30))}</span><span>${x.sayi}</span></div>`).join("")}</div>` : "";
  const ist = s.ortalama !== null && s.ortalama !== undefined
    ? `<dl class="istatistik"><dt>min</dt><dd>${sayiBicim(s.min)}</dd><dt>medyan</dt><dd>${sayiBicim(s.medyan)}</dd><dt>ortalama</dt><dd>${sayiBicim(s.ortalama)}</dd><dt>max</dt><dd>${sayiBicim(s.max)}</dd>${s.aykiri ? `<dt>aykırı</dt><dd>${s.aykiri}</dd>` : ""}</dl>`
    : /DATE|TIMESTAMP/.test(s.tip) && s.min ? `<dl class="istatistik"><dt>ilk</dt><dd>${esc(s.min)}</dd><dt>son</dt><dd>${esc(s.max)}</dd></dl>` : "";
  return `<div class="sutun-kart"><div class="ust"><b>${esc(s.ad)}</b><span class="etiket">${esc(s.tip)}</span></div>
    <div class="etiket">${(s.benzersiz ?? 0).toLocaleString("tr-TR")} benzersiz · %${s.bos_yuzde} boş</div>
    ${s.uyarilar.map((u) => `<span class="rozet uyari" style="margin:6px 4px 0 0">${esc(u)}</span>`).join("")}${hist}${ist}${sik}</div>`;
}

// ---------------- Soru sor ----------------
let sohbetGecmisi = [];
yukleyiciler.sor = async () => {
  const sec = $("#sor-veri"), liste = await api("/api/veriler");
  const hedef = sec.dataset.hedef || sec.value; delete sec.dataset.hedef;
  sec.innerHTML = liste.length ? liste.map((v) => `<option value="${v.id}">${esc(v.ad)} (${(v.satir || 0).toLocaleString("tr-TR")} satır)</option>`).join("") : `<option value="">Önce veri yükle</option>`;
  if (hedef && liste.some((v) => String(v.id) === String(hedef))) sec.value = hedef;
  oneriCiz(); gecmisCiz();
};
$("#sor-veri").addEventListener("change", () => { sohbetGecmisi = []; $("#cevaplar").innerHTML = ""; oneriCiz(); gecmisCiz(); });
$("#sor-temizle").onclick = () => { sohbetGecmisi = []; $("#cevaplar").innerHTML = ""; bildir("Yeni konu: önceki sorular bağlam olarak kullanılmayacak."); };

async function oneriCiz() {
  const id = $("#sor-veri").value; if (!id) { $("#sor-oneriler").innerHTML = ""; return; }
  const v = await api(`/api/veriler/${id}`);
  const sayisal = v.profil.sutunlar.filter((s) => s.ortalama != null).map((s) => s.ad);
  const kategori = v.profil.sutunlar.filter((s) => s.en_sik && s.benzersiz > 1 && s.benzersiz <= 50).map((s) => s.ad);
  const tarih = v.profil.sutunlar.filter((s) => /DATE|TIMESTAMP/.test(s.tip)).map((s) => s.ad);
  const oneriler = ["Bu veride öne çıkan 3 bulgu ne?"];
  if (kategori[0] && sayisal[0]) oneriler.push(`${kategori[0]} bazında ortalama ${sayisal[0]}`);
  if (tarih[0] && sayisal[0]) oneriler.push(`Aylara göre toplam ${sayisal[0]} nasıl değişti?`);
  if (kategori[0]) oneriler.push(`${kategori[0]} dağılımı`);
  $("#sor-oneriler").innerHTML = oneriler.map((o) => `<button class="btn kucuk" data-oneri-soru="${esc(o)}">${esc(o)}</button>`).join("");
}
$("#sor-oneriler").addEventListener("click", (e) => { const b = e.target.closest("[data-oneri-soru]"); if (b) { $("#sor-girdi").value = b.dataset.oneriSoru; $("#sor-form").requestSubmit(); } });

$("#sor-form").onsubmit = async (e) => {
  e.preventDefault();
  const soru = $("#sor-girdi").value.trim(), veri_id = +$("#sor-veri").value;
  if (!soru || !veri_id) return;
  const btn = $("#sor-form button"), kap = document.createElement("div");
  kap.className = "kart cevap"; kap.innerHTML = `<b>${esc(soru)}</b><div class="etiket yukleniyor" style="margin-top:8px">SQL yazılıyor, çalıştırılıyor ve yorumlanıyor</div>`;
  $("#cevaplar").prepend(kap);
  btn.disabled = true;
  try {
    const r = await api("/api/sor", { method: "POST", body: { veri_id, soru, gecmis: sohbetGecmisi } });
    $("#sor-girdi").value = "";
    if (r.netlestirme) {
      kap.innerHTML = `<b>${esc(soru)}</b><div style="margin-top:8px">🤔 ${esc(r.netlestirme)}</div><div class="etiket">Soruyu netleştirip tekrar sor.</div>`;
    } else if (r.hata) {
      kap.innerHTML = `<b>${esc(soru)}</b><div class="rozet kotu" style="margin-top:8px">3 denemede çalışan sorgu yazılamadı</div><pre class="cikti">${esc(r.hata)}</pre>`
        + sqlDuzenleyici(r.sql, null, kap);
      sqlBagla(kap, { tur: "tablo" });
    } else {
      sohbetGecmisi.push({ soru, sql: r.sql });
      cevapCiz(kap, { ...r, soru });
      gecmisCiz();
    }
  } catch (err) { kap.remove(); bildir(err.message, true); }
  btn.disabled = false;
};

function sqlDuzenleyici(sql) {
  return `<details style="margin-top:12px"><summary>SQL'i gör / düzenle</summary>
    <textarea class="sql-kutu" spellcheck="false">${esc(sql)}</textarea>
    <div class="satir" style="margin-top:6px"><button class="btn kucuk" data-sql-calistir>Çalıştır</button><button class="btn kucuk" data-sql-csv>CSV indir</button></div></details>`;
}
function sqlBagla(kap, grafik) {
  $("[data-sql-calistir]", kap).onclick = (e) => mesgul(e.target, async () => {
    const t = await api("/api/sql", { method: "POST", body: { sql: $(".sql-kutu", kap).value } });
    const g = $(".grafik-alan", kap); if (g && !grafikCiz(g, grafik, t)) g.innerHTML = "";
    const ta = $(".tablo-alan", kap); if (ta) ta.innerHTML = tabloHtml(t); else kap.insertAdjacentHTML("beforeend", `<div class="tablo-alan" style="margin-top:12px">${tabloHtml(t)}</div>`);
  });
  $("[data-sql-csv]", kap).onclick = (e) => mesgul(e.target, async () => {
    const blob = await Motor.csvIndir($(".sql-kutu", kap).value);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sonuc.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}
function cevapCiz(kap, r) {
  kap.innerHTML = `
    <div class="satir" style="justify-content:space-between"><b>${esc(r.soru)}</b>
      <span class="satir">${r.denemeler?.length ? `<span class="rozet uyari">${r.denemeler.length} düzeltme denemesi</span>` : ""}
      <button class="btn kucuk" data-sabitle>${r.sabit ? "Panelden kaldır" : "Panele sabitle"}</button></span></div>
    <div class="md" style="margin:10px 0">${md(r.yorum)}</div>
    <div class="grafik-alan"></div>
    <details style="margin-top:12px"><summary>Tablo (${r.sonuc.satirlar.length} satır)</summary><div class="tablo-alan" style="margin-top:8px">${tabloHtml(r.sonuc)}</div></details>
    ${r.varsayimlar?.length ? `<details style="margin-top:8px"><summary>Varsayımlar (${r.varsayimlar.length})</summary><ul>${r.varsayimlar.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></details>` : ""}
    ${sqlDuzenleyici(r.sql)}`;
  if (!grafikCiz($(".grafik-alan", kap), r.grafik, r.sonuc)) $(".tablo-alan", kap).closest("details").open = true;
  sqlBagla(kap, r.grafik);
  let sabit = !!r.sabit;
  $("[data-sabitle]", kap).onclick = async (e) => {
    sabit = !sabit; await api(`/api/sorular/${r.id}/sabitle`, { method: "POST", body: { sabit } });
    e.target.textContent = sabit ? "Panelden kaldır" : "Panele sabitle"; bildir(sabit ? "Panele eklendi." : "Panelden kaldırıldı.");
  };
}

async function gecmisCiz() {
  const id = $("#sor-veri").value;
  const liste = id ? await api(`/api/sorular?veri_id=${id}`) : [];
  $("#gecmis").innerHTML = liste.length ? liste.map((s) => `
    <div class="liste-ogesi"><span class="tikla" data-gecmis="${s.id}">${s.sabit ? "📌 " : ""}${esc(s.soru)}</span>
      <span class="satir"><span class="etiket">${esc(s.zaman.slice(0, 16))}</span><button class="btn kucuk" data-gecmis-sil="${s.id}">Sil</button></span></div>`).join("")
    : `<div class="bos">Bu veri kümesine henüz soru sorulmadı.</div>`;
  $("#gecmis").onclick = async (e) => {
    const sil = e.target.closest("[data-gecmis-sil]");
    if (sil) { await api(`/api/sorular/${sil.dataset.gecmisSil}`, { method: "DELETE" }); gecmisCiz(); return; }
    const g = e.target.closest("[data-gecmis]"); if (!g) return;
    const s = liste.find((x) => x.id === +g.dataset.gecmis);
    const kap = document.createElement("div"); kap.className = "kart cevap"; $("#cevaplar").prepend(kap);
    try { const sonuc = await api("/api/sql", { method: "POST", body: { sql: s.sql } }); cevapCiz(kap, { ...s, sonuc }); kap.scrollIntoView({ behavior: "smooth" }); }
    catch (err) { kap.remove(); bildir(err.message, true); }
  };
}

// ---------------- Panel ----------------
yukleyiciler.panel = async () => {
  const alan = $("#panel-alan");
  alan.innerHTML = `<div class="kart etiket yukleniyor">Panel güncelleniyor</div>`;
  const kartlar = await api("/api/panel");
  if (!kartlar.length) { alan.innerHTML = `<div class="kart bos" style="grid-column:1/-1">Henüz sabitlenmiş soru yok. "Soru sor" ekranında bir cevabı panele sabitle.</div>`; return; }
  alan.innerHTML = "";
  kartlar.forEach((s) => {
    const k = document.createElement("div"); k.className = "kart";
    k.innerHTML = `<div class="satir" style="justify-content:space-between"><b>${esc(s.soru)}</b><button class="btn kucuk" data-kaldir>Kaldır</button></div>
      <div class="etiket" style="margin-bottom:8px">${esc(s.veri || "")}</div><div class="grafik-alan"></div>`;
    alan.appendChild(k);
    if (s.hata) $(".grafik-alan", k).innerHTML = `<div class="rozet kotu">Sorgu artık çalışmıyor</div><div class="etiket">${esc(s.hata)}</div>`;
    else if (!grafikCiz($(".grafik-alan", k), s.grafik, s.sonuc)) $(".grafik-alan", k).innerHTML = tabloHtml(s.sonuc, 15);
    $("[data-kaldir]", k).onclick = async () => { await api(`/api/sorular/${s.id}/sabitle`, { method: "POST", body: { sabit: false } }); k.remove(); };
  });
};
$("#panel-yenile").onclick = () => yukleyiciler.panel();

// ---------------- Ayarlar (Gemini anahtarı) ve yedek ----------------
function ayarlarAc() {
  const d = $("#ayarlar");
  $("#ayar-anahtar").value = Motor.anahtar();
  $("#ayar-model").innerHTML = Motor.MODELLER.map((m) => `<option ${m === (localStorage.getItem(Motor.MODEL_KEY) || Motor.MODELLER[0]) ? "selected" : ""}>${m}</option>`).join("");
  $("#ayar-durum").textContent = "";
  d.showModal();
}
$("#ayarlar-btn").onclick = ayarlarAc;
$("#ayar-kapat").onclick = () => $("#ayarlar").close();
$("#ayar-kaydet").onclick = (e) => mesgul(e.target, async () => {
  const k = $("#ayar-anahtar").value.trim();
  if (k) { await Motor.anahtarDene(k); localStorage.setItem(Motor.ANAHTAR_KEY, k); } else localStorage.removeItem(Motor.ANAHTAR_KEY);
  localStorage.setItem(Motor.MODEL_KEY, $("#ayar-model").value);
  $("#anahtar-uyari").hidden = !!k;
  $("#ayarlar").close(); bildir(k ? "Anahtar kaydedildi; artık soru sorabilirsin." : "Anahtar silindi.");
});
$("#yedek-al").onclick = (e) => mesgul(e.target, async () => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(await Motor.yedekAl());
  a.download = `veri-analisti-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$("#yedek-dosya").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!confirm("Yedek yüklenince bu cihazdaki mevcut veri kümeleri ve sorular yedektekilerle değiştirilecek. Devam edilsin mi?")) return;
  try { const n = await Motor.yedekYukle(f); seciliVeri = null; $("#veri-detay").innerHTML = ""; $("#ayarlar").close(); bildir(`Yedek yüklendi: ${n} veri kümesi.`); sayfaAc("veriler"); }
  catch (err) { bildir(err.message, true); }
});
$("#anahtar-uyari").hidden = !!Motor.anahtar();
$("#anahtar-uyari button").onclick = ayarlarAc;

// İlk açılış: DuckDB motoru yüklenirken bilgi ver
(async () => {
  const durum = $("#motor-durum");
  durum.hidden = false;
  try { await Motor.hazir(); durum.hidden = true; await yukleyiciler.veriler(); }
  catch (e) { durum.className = "kart rozet kotu"; durum.textContent = "Veri motoru başlatılamadı: " + (e?.message || e); }
})();
