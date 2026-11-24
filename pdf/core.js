// PDF Atölyem — ortak altyapı: depolama, kütüphaneler, yardımcılar, arayüz parçaları
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const LIB='./lib/';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtSize=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
const fmtDate=t=>new Date(t).toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'});
const baseName=n=>String(n||'belge').replace(/\.pdf$/i,'');

/* ---------- Simgeler (çizgi simgeler) ---------- */
const IC={
  back:'<path d="M15 18l-6-6 6-6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',side:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  up:'<path d="M18 15l-6-6-6 6"/>',down:'<path d="M6 9l6 6 6-6"/>',x:'<path d="M18 6L6 18M6 6l12 12"/>',check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
  sel:'<path d="M5 3l14 8-6 1.5L10 19z"/>',hl:'<path d="M9 15l-4 4h6l1.5-1.5"/><path d="M12.5 17.5l-5-5L16 4l5 5z"/>',
  ul:'<path d="M7 4v7a5 5 0 0010 0V4"/><path d="M5 20h14"/>',st:'<path d="M4 12h16"/><path d="M16.5 7.5C16 5.5 14.3 4.5 12 4.5c-2.8 0-4.5 1.4-4.5 3.5 0 4.5 9.5 3 9.5 8 0 2.3-2 3.5-5 3.5-2.4 0-4.2-1-4.9-3"/>',
  pen:'<path d="M4 20l4-1L19.5 7.5a2.1 2.1 0 00-3-3L5 16z"/>',rect:'<rect x="4" y="5" width="16" height="14" rx="1"/>',ell:'<ellipse cx="12" cy="12" rx="8.5" ry="7"/>',
  line:'<path d="M5 19L19 5"/>',arrow:'<path d="M5 19L19 5M10 5h9v9"/>',text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',note:'<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  erase:'<path d="M8 20h12M5.5 13.5l8-8a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L13 18H9z"/>',undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
  save:'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',share:'<path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v8h12v-8"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z"/>',two:'<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/>',
  fitw:'<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>',fitp:'<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/>',
  full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',dots:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',rot:'<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',rotl:'<path d="M4 11a8 8 0 112.3 5.7"/><path d="M4 4v7h7"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  merge:'<path d="M7 4v5a4 4 0 004 4h2a4 4 0 014 4v3M17 4v5a4 4 0 01-4 4"/><path d="M14 17l3 3 3-3"/>',split:'<path d="M12 4v6M12 10l-6 10M12 10l6 10"/>',
  org:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  crop:'<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',ocr:'<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',
  cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L5 20"/>',
  num:'<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',wm:'<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  sign:'<path d="M3 17c3 0 4-9 7-9s-1 9 2 9 3-4 5-4 2 3 4 3"/><path d="M3 21h18"/>',zip:'<path d="M6 3h9l4 4v14H6z"/><path d="M11 6h2M11 9h2M11 12h2M11 15h2v2h-2z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>',
  word:'<path d="M6 3h9l4 4v14H6z"/><path d="M8.5 11l1.5 6 2-5 2 5 1.5-6"/>',xls:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 11l6 6M15 11l-6 6"/>',ppt:'<path d="M6 3h9l4 4v14H6z"/><path d="M10 17v-6h2.5a2 2 0 010 4H10"/>',
  html:'<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',comp:'<path d="M4 4h6v16H4zM14 4h6v16h-6z"/>',redact:'<rect x="3" y="6" width="18" height="5" rx="1" fill="currentColor"/><path d="M3 15h18M3 19h12"/>',
  repair:'<path d="M14.5 5.5a4 4 0 00-5.2 5.2L4 16l4 4 5.3-5.3a4 4 0 005.2-5.2l-2.5 2.5-2.7-.6-.6-2.7z"/>',pdfa:'<path d="M6 3h9l4 4v14H6z"/><path d="M9.5 17l2.5-7 2.5 7M10.4 14.5h3.2"/>',
  compress:'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',ai:'<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  file:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',open:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  blank:'<path d="M6 3h9l4 4v14H6z"/><path d="M12 10v6M9 13h6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',stamp:'<path d="M9 4h6l-1 7h4l1 4H5l1-4h4z"/><path d="M5 19h14"/>',
};
const ic=(n,cls='i')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;

/* ---------- Dosya yükleme (kütüphaneler) ---------- */
const _scripts={};
function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete _scripts[src];no(new Error('Yüklenemedi: '+src))};document.head.appendChild(s)}))}
async function pdfjs(){if(!window.pdfjsLib){await loadScript(LIB+'pdf.min.js')}pdfjsLib.GlobalWorkerOptions.workerSrc=LIB+'pdf.worker.min.js';return pdfjsLib}
async function pdflib(){if(!window.PDFLib)await loadScript(LIB+'pdf-lib.min.js');return PDFLib}
async function getFontkit(){if(!window.fontkit)await loadScript(LIB+"fontkit.umd.min.js");return window.fontkit}
async function sortable(){if(!window.Sortable)await loadScript(LIB+'Sortable.min.js');return window.Sortable}
const _fontBytes={};
async function fontBytes(bold){const k=bold?'Bold':'Regular';return _fontBytes[k]||(_fontBytes[k]=fetch(LIB+'fonts/LiberationSans-'+k+'.ttf').then(r=>r.arrayBuffer()))}
// Türkçe karakterleri destekleyen yazı tipini belgeye göm
async function embedFont(doc,bold){const fk=await getFontkit();doc.registerFontkit(fk);return doc.embedFont(await fontBytes(bold),{subset:true})}
async function openPdf(bytes,password){const L=await pdfjs();
  const task=L.getDocument({data:bytes.slice?bytes.slice(0):bytes,password,cMapUrl:LIB+'cmaps/',cMapPacked:true,standardFontDataUrl:LIB+'standard_fonts/',isEvalSupported:false});
  return task.promise}
// pdf-lib ile yükle (şifreli dosyalarda uyarı ver)
async function loadLib(bytes){const {PDFDocument}=await pdflib();
  try{return await PDFDocument.load(bytes,{ignoreEncryption:false})}
  catch(e){if(/encrypt/i.test(e.message)){const d=await PDFDocument.load(bytes,{ignoreEncryption:true});d.__encrypted=true;return d}throw e}}

/* ---------- IndexedDB ---------- */
const DB={_db:null,
  open(){return this._db||(this._db=new Promise((ok,no)=>{const r=indexedDB.open('pdf-atolyem',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('docs',{keyPath:'id'});d.createObjectStore('files');d.createObjectStore('ann');d.createObjectStore('kv')};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}))},
  async tx(store,mode,fn){const d=await this.open();return new Promise((ok,no)=>{const t=d.transaction(store,mode);const s=t.objectStore(store);const r=fn(s);t.oncomplete=()=>ok(r instanceof IDBRequest?r.result:r);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})},
  get(s,k){return this.tx(s,'readonly',st=>st.get(k))},
  put(s,v,k){return this.tx(s,'readwrite',st=>k===undefined?st.put(v):st.put(v,k))},
  del(s,k){return this.tx(s,'readwrite',st=>st.delete(k))},
  all(s){return this.tx(s,'readonly',st=>st.getAll())},
};
const Docs={
  async list(){return (await DB.all('docs')).sort((a,b)=>(b.opened||b.added)-(a.opened||a.added))},
  async add(name,bytes,extra={}){const id=uid();const u8=new Uint8Array(bytes);
    let pages=0,thumb='';try{const p=await openPdf(u8);pages=p.numPages;thumb=await thumbData(p,1,220);p.destroy()}catch(e){if(e.name==='PasswordException')extra.locked=true;else throw e}
    const rec={id,name,size:u8.byteLength,pages,thumb,added:Date.now(),opened:Date.now(),lastPage:1,...extra};
    await DB.put('files',u8,id);await DB.put('docs',rec);return rec},
  async replaceBytes(id,bytes){const u8=new Uint8Array(bytes);const r=await DB.get('docs',id);let p=await openPdf(u8);r.pages=p.numPages;r.thumb=await thumbData(p,1,220);r.size=u8.byteLength;r.modified=Date.now();p.destroy();await DB.put('files',u8,id);await DB.put('docs',r);return r},
  get(id){return DB.get('docs',id)},bytes(id){return DB.get('files',id)},
  update(r){return DB.put('docs',r)},
  async remove(id){await DB.del('docs',id);await DB.del('files',id);await DB.del('ann',id)},
};
async function thumbData(pdf,n,w){const pg=await pdf.getPage(n);const v1=pg.getViewport({scale:1});const vp=pg.getViewport({scale:w/v1.width});
  const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  await pg.render({canvasContext:x,viewport:vp}).promise;return c.toDataURL('image/jpeg',.75)}
async function renderTo(canvas,page,width,rotate=0){const v1=page.getViewport({scale:1,rotation:(page.rotate+rotate)%360});const vp=page.getViewport({scale:width/v1.width,rotation:(page.rotate+rotate)%360});
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:x,viewport:vp}).promise;return canvas}

/* ---------- Dosya seçme, indirme ---------- */
function pickFiles({accept='application/pdf,.pdf',multiple=false,capture}={}){return new Promise(ok=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.multiple=multiple;if(capture)i.capture=capture;
  i.onchange=()=>ok([...i.files]);i.addEventListener('cancel',()=>ok([]));i.click()})}
const readBytes=f=>f.arrayBuffer().then(b=>new Uint8Array(b));
function download(data,name,type='application/pdf'){const b=data instanceof Blob?data:new Blob([data],{type});const u=URL.createObjectURL(b);
  const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function shareFile(data,name,type='application/pdf'){const f=new File([data],name,{type});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:name});return true}catch(e){if(e.name==='AbortError')return true}}
  download(data,name,type);return false}
// Basit ZIP (sıkıştırmasız) — birden çok dosyayı tek seferde indirmek için
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function makeZip(files){const enc=new TextEncoder();const parts=[],cent=[];let off=0;const d=new Date();
  const dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xffff,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xffff;
  for(const f of files){const nm=enc.encode(f.name),data=f.data instanceof Uint8Array?f.data:new Uint8Array(f.data),crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dt,true);h.setUint16(12,dd,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,dt,true);c.setUint16(14,dd,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cent.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+data.length}
  const cs=cent.reduce((a,b)=>a+b.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cent,new Uint8Array(e.buffer)],{type:'application/zip'})}

/* ---------- Arayüz: bildirim, bekleme, pencere, menü ---------- */
let _tt;function toast(m,ms=2600){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}t.textContent=m;t.classList.remove('hide');clearTimeout(_tt);_tt=setTimeout(()=>t.classList.add('hide'),ms)}
const Busy={el:null,show(msg='İşleniyor…'){if(!this.el){this.el=document.createElement('div');this.el.className='busy';this.el.innerHTML='<div class="bx"><div class="spin"></div><div><div class="m"></div><div class="prog hide"><i></i></div></div></div>';document.body.appendChild(this.el)}
    this.el.classList.remove('hide');$('.m',this.el).textContent=msg;$('.prog',this.el).classList.add('hide')},
  msg(m){if(this.el)$('.m',this.el).textContent=m},
  prog(p){if(!this.el)return;const g=$('.prog',this.el);g.classList.remove('hide');$('i',g).style.width=Math.round(p*100)+'%'},
  hide(){this.el&&this.el.classList.add('hide')}};
async function withBusy(msg,fn){Busy.show(msg);await sleep(30);try{return await fn()}catch(e){console.error(e);alertBox('Bir sorun oluştu',esc(errText(e)));throw e}finally{Busy.hide()}}
function errText(e){const m=e&&e.message||String(e);if(e&&e.name==='PasswordException')return 'Bu PDF şifreli. Önce "Kilidi Aç" aracıyla şifresini kaldır.';if(/encrypt/i.test(m))return 'Bu PDF şifreli. Önce şifresini kaldır.';if(/Invalid PDF|No PDF header/i.test(m))return 'Dosya geçerli bir PDF değil ya da bozuk.';return m}
function modal({title,body,ok='Tamam',cancel='Vazgeç',danger=false,wide=false,onOpen}){return new Promise(res=>{const bg=document.createElement('div');bg.className='modalbg';
  bg.innerHTML=`<div class="modal"${wide?' style="width:min(760px,100%)"':''}><div class="mh">${title}<button class="ib x">${ic('x')}</button></div><div class="mb">${body||''}</div><div class="mf">${cancel?`<button class="btn c">${cancel}</button>`:''}<button class="btn pri o"${danger?' style="background:var(--bad);border-color:var(--bad)"':''}>${ok}</button></div></div>`;
  document.body.appendChild(bg);const close=v=>{bg.remove();document.removeEventListener('keydown',kd);res(v)};
  const kd=e=>{if(e.key==='Escape')close(null);if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();close(bg.querySelector('.mb'))}};document.addEventListener('keydown',kd);
  $('.x',bg).onclick=()=>close(null);const c=$('.c',bg);if(c)c.onclick=()=>close(null);$('.o',bg).onclick=()=>close($('.mb',bg));bg.onclick=e=>{if(e.target===bg)close(null)};
  onOpen&&onOpen($('.mb',bg));const f=$('input,textarea,select',bg);f&&setTimeout(()=>f.focus(),30)})}
const alertBox=(t,b)=>modal({title:t,body:`<div>${b}</div>`,cancel:null});
const confirmBox=(t,b,ok='Evet',danger)=>modal({title:t,body:`<div>${b}</div>`,ok,danger}).then(r=>!!r);
async function promptBox(t,label,val=''){const r=await modal({title:t,body:`<label class="fld">${label}<input type="text" value="${esc(val)}"></label>`});return r?$('input',r).value:null}
function popMenu(x,y,items){$$('.menu-pop').forEach(m=>m.remove());const m=document.createElement('div');m.className='menu-pop';
  m.innerHTML=items.map((it,i)=>it==='-'?'<hr>':`<button data-i="${i}"${it.danger?' style="color:var(--bad)"':''}>${it.icon?ic(it.icon):''}${it.label}</button>`).join('');
  document.body.appendChild(m);const r=m.getBoundingClientRect();m.style.left=Math.min(x,innerWidth-r.width-8)+'px';m.style.top=Math.min(y,innerHeight-r.height-8)+'px';
  m.onclick=e=>{const b=e.target.closest('button');if(!b)return;m.remove();items[b.dataset.i].fn()};setTimeout(()=>document.addEventListener('pointerdown',function f(e){if(!m.contains(e.target)){m.remove();document.removeEventListener('pointerdown',f)}}),0)}
// Sayfa aralığı yazımı: "1-3, 5, 8-" → [0,1,2,4,7,...]
function parseRanges(str,max){const out=[];for(const part of String(str).split(/[,;]+/)){const p=part.trim();if(!p)continue;const m=p.match(/^(\d*)\s*-\s*(\d*)$/);
  if(m){let a=m[1]?+m[1]:1,b=m[2]?+m[2]:max;if(a>b)[a,b]=[b,a];for(let i=Math.max(1,a);i<=Math.min(max,b);i++)out.push(i-1)}else if(/^\d+$/.test(p)){const n=+p;if(n>=1&&n<=max)out.push(n-1)}else return null}
  return out}
function rangeGroups(str,max){return String(str).split(/[,;]+/).map(s=>s.trim()).filter(Boolean).map(s=>({label:s,pages:parseRanges(s,max)}))}
