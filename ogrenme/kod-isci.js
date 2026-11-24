// Kod mentoru: Python kodunu Pyodide ile ayrı bir işçide çalıştırır.
// Ana sayfa 10 saniyede cevap alamazsa bu işçiyi kapatır (sonsuz döngü koruması).
"use strict";
const TABAN = new URL("lib/pyodide/", self.location.href).href;
let py = null;

(async () => {
  try {
    importScripts(TABAN + "pyodide.js");
    py = await loadPyodide({ indexURL: TABAN });
    self.postMessage({ tur: "hazir" });
  } catch (e) {
    self.postMessage({ tur: "yukleme-hatasi", mesaj: String(e && e.message || e) });
  }
})();

self.onmessage = async (e) => {
  const { tur, no, kod, stdin } = e.data || {};
  if (tur !== "calistir" || !py) return;
  let stdout = "", stderr = "", cikis = 0;
  py.setStdout({ batched: (s) => { stdout += s + "\n"; } });
  py.setStderr({ batched: (s) => { stderr += s + "\n"; } });
  try {
    // Her çalıştırma temiz bir ad alanında; input() verilen girdiyi okur
    const ad = py.globals.get("dict")();
    ad.set("__name__", "__main__");
    py.globals.set("_girdi", stdin || "");
    py.runPython("import sys, io\nsys.stdin = io.StringIO(_girdi)");
    await py.runPythonAsync(kod, { globals: ad, filename: "main.py" });
    ad.destroy();
  } catch (err) {
    cikis = 1;
    // Pyodide'nin kendi iç satırlarını göstermeden Python hata izini ver
    const m = String(err && err.message || err).split("\n");
    const i = m.findIndex((s) => s.includes('File "main.py"'));
    stderr += (i > 0 ? ["Traceback (most recent call last):", ...m.slice(i)] : m).join("\n").trim() + "\n";
  }
  try { py.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch {}
  self.postMessage({ no, stdout, stderr, kod: cikis });
};
