// PDF Atölyem — Dijital Kütüphanem bağlantısı
// Kütüphanenin verisi aynı tarayıcıdaki 'dijital-kutuphane' veritabanındadır: docs ('books/<id>' → kitap bilgisi), blobs (<assetId> → {blob}).
// Buradan yalnızca OKUNUR. Kütüphaneye kayıt, kütüphanenin kendi "Yeni ekle / Kaydı düzenle" formuyla yapılır
// (dosya 'handoff' olarak bırakılır, kütüphane açılınca forma yerleşir) — böylece Drive eşitlemesi ve kapaklar bozulmaz.
'use strict';
const Lib={
  _db:undefined,
  open(){if(this._db!==undefined)return Promise.resolve(this._db);return new Promise(ok=>{let r;try{r=indexedDB.open('dijital-kutuphane',1)}catch(e){return ok(this._db=null)}
    r.onupgradeneeded=()=>{r.transaction.abort()};// kütüphane hiç kurulmamışsa boş veritabanı oluşturma
    r.onsuccess=()=>{const d=r.result;if(!d.objectStoreNames.contains('docs')||!d.objectStoreNames.contains('blobs')){d.close();return ok(this._db=null)}ok(this._db=d)};r.onerror=()=>ok(this._db=null)})},
  async req(store,fn){const d=await this.open();if(!d)return null;return new Promise((ok,no)=>{const t=d.transaction(store,'readonly');const q=fn(t.objectStore(store));q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})},
  isPdf:b=>b&&!b.deleted&&b.kind!=='roman'&&b.kind!=='kitap'&&b.fileType!=='epub'&&!/\.k?epub$/i.test(b.fileName||'')&&(b.assetId||(b.parts&&b.parts.length)),
  async list(){const d=await this.open();if(!d)return[];
    const[keys,vals]=await Promise.all([this.req('docs',s=>s.getAllKeys(IDBKeyRange.bound('books/','books/￿'))),this.req('docs',s=>s.getAll(IDBKeyRange.bound('books/','books/￿')))]);
    const blobKeys=new Set((await this.req('blobs',s=>s.getAllKeys()))||[]);
    return(keys||[]).map((k,i)=>({...vals[i],id:String(k).slice(6)})).filter(b=>this.isPdf(b)).map(b=>({...b,
      local:(b.parts&&b.parts.length?b.parts.every(p=>blobKeys.has(p.id)):blobKeys.has(b.assetId)),hasCover:b.coverId&&blobKeys.has(b.coverId)}))
      .sort((a,b)=>String(b.lastOpened||b.updatedAt||b.addedAt||'').localeCompare(String(a.lastOpened||a.updatedAt||a.addedAt||'')))},
  async get(id){const v=await this.req('docs',s=>s.get('books/'+id));return v?{...v,id}:null},
  async blob(id){const v=await this.req('blobs',s=>s.get(id));return v&&v.blob},
  // Kitabın PDF'ini getir (büyük kitaplar kütüphanede parçalara bölünmüş olabilir: birleştir)
  async bytes(b){if(b.parts&&b.parts.length>1){const L=await pdflib();const out=await L.PDFDocument.create();
      for(const p of b.parts){const bl=await this.blob(p.id);if(!bl)throw new Error('Bu kitabın bir parçası bu cihazda yok.');const src=await L.PDFDocument.load(new Uint8Array(await bl.arrayBuffer()),{ignoreEncryption:true});(await out.copyPages(src,src.getPageIndices())).forEach(pg=>out.addPage(pg))}
      return out.save()}
    const id=b.parts&&b.parts.length?b.parts[0].id:b.assetId;const bl=await this.blob(id);
    if(!bl)throw new Error('Bu kitabın dosyası bu cihazda değil'+(b.driveId?' (Google Drive\'da duruyor). Önce Dijital Kütüphanem\'de bir kez açıp cihaza indir.':'.'));
    return new Uint8Array(await bl.arrayBuffer())},
  title:b=>b.title||baseName(b.fileName)||'Adsız kitap',
  // Kütüphanedeki kitabı PDF Atölyem'de aç (daha önce açıldıysa notlarıyla birlikte aynı kopyayı aç)
  async openBook(id){const b=await this.get(id);if(!b||!this.isPdf(b)){alertBox('Kitap bulunamadı','Bu kitap kütüphanede yok ya da PDF değil.');location.hash='#/';return}
    const docs=await Docs.list();let rec=docs.find(d=>d.libId===id);const asset=b.parts&&b.parts.length?b.parts.map(p=>p.id).join(','):b.assetId;
    if(rec&&rec.libAsset===asset){location.replace('#/oku/'+rec.id);return}
    let bytes;try{bytes=await withBusy('Kitap kütüphaneden alınıyor…',()=>this.bytes(b))}catch(e){location.hash='#/';return}
    if(rec){// kütüphanedeki dosya değişmiş: yeni dosyayı al, notlar sayfa numaralarıyla kalır
      await Docs.replaceBytes(rec.id,bytes);rec=await Docs.get(rec.id);rec.libAsset=asset;rec.name=this.title(b)+'.pdf';await Docs.update(rec)}
    else rec=await Docs.add(this.title(b)+'.pdf',bytes,{libId:id,libAsset:asset,lastPage:b.currentPage||1});
    location.replace('#/oku/'+rec.id)},
  // Dosyayı kütüphaneye gönder: bookId verilirse o kitabın dosyası güncellenir, yoksa yeni kitap eklenir
  async send(bytes,name,bookId){if(!await this.open()){alertBox('Dijital Kütüphanem bulunamadı','Bu tarayıcıda Dijital Kütüphanem henüz kurulmamış. Önce kütüphaneyi bir kez aç.');return}
    await DB.put('kv',{bytes:new Uint8Array(bytes),name,title:baseName(name),bookId:bookId||null,at:Date.now()},'handoff');
    const ok=await confirmBox(bookId?'Kütüphanedeki kitabı güncelle':'Kütüphaneme ekle',bookId?'Dijital Kütüphanem açılacak ve kitabın düzenleme formu bu yeni dosyayla gelecek. <b>Kaydet</b>\'e basınca kitabın dosyası güncellenir; adı, rafı ve diğer bilgileri aynı kalır.':'Dijital Kütüphanem açılacak ve "Yeni ekle" formu bu dosyayla gelecek. Rafını ve bilgilerini seçip <b>Kaydet</b>\'e bas.','Kütüphaneye git');
    if(!ok){DB.del('kv','handoff');return}location.href='../?pdfa=1'},
  // Ana ekrandaki "Kütüphanemdeki PDF'ler" bölümü
  async section(){let list=[];try{list=await this.list()}catch(e){console.warn(e)}if(!list.length)return'';
    const covers={};await Promise.all(list.slice(0,40).map(async b=>{if(b.hasCover){try{covers[b.id]=URL.createObjectURL(await this.blob(b.coverId))}catch(e){}}}));
    return `<h3 class="sec">Kütüphanemdeki PDF'ler <span style="text-transform:none;letter-spacing:0;font-weight:500">· ${list.length} kitap</span></h3>
      <div class="docs" id="libDocs">${list.slice(0,40).map(b=>`<div class="doc${b.local?'':' off'}" data-lib="${esc(b.id)}" title="${b.local?'PDF Atölyem\'de aç':'Dosya bu cihazda değil'}"><div class="th" style="${covers[b.id]?`background-image:url('${covers[b.id]}');background-size:cover`:''}">${covers[b.id]?'':`<span class="libt">${esc(this.title(b))}</span>`}</div>
        <div class="nm">${esc(this.title(b))}</div><div class="mt">${esc(b.author||'')}${b.pages?(b.author?' · ':'')+b.pages+' sayfa':''}${b.local?'':' · ☁️ Drive\'da'}</div></div>`).join('')}</div>
      ${list.length>40?`<p style="color:var(--tx2)">İlk 40 kitap gösteriliyor. Diğerlerini Dijital Kütüphanem'deki okuyucudan "PDF Atölyem'de aç" ile açabilirsin.</p>`:''}`},
  bindSection(){$$('#libDocs .doc').forEach(el=>el.onclick=()=>{if(el.classList.contains('off')){alertBox('Dosya bu cihazda değil','Bu kitap Google Drive\'da duruyor. Dijital Kütüphanem\'de bir kez açarsan cihaza iner, sonra burada da açılır.');return}location.hash='#/kutuphane/'+el.dataset.lib})},
};
