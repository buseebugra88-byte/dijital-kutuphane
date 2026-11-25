// PDF Atölyem — araçlar
'use strict';
const CATS=[['org','Düzenle ve organize et'],['opt','Optimize et'],['to','PDF\'e dönüştür'],['from','PDF\'den dönüştür'],['edit','Düzenleme ve imza'],['sec','Güvenlik'],['ai','Yapay zekâ']];
const T=[
  {id:'merge',cat:'org',name:'PDF Birleştir',icon:'merge',col:'#e5533d',d:'Birden çok PDF\'i istediğin sırayla tek dosyada birleştir.'},
  {id:'split',cat:'org',name:'PDF Böl',icon:'split',col:'#e5533d',d:'Aralıklara göre ayır, sayfaları çıkar ya da her sayfayı ayrı dosya yap.'},
  {id:'organize',cat:'org',name:'Sayfaları Düzenle',icon:'org',col:'#e5533d',d:'Sürükleyerek sırala, sil, kopyala, boş sayfa ya da başka PDF ekle.'},
  {id:'rotate',cat:'org',name:'PDF Döndür',icon:'rot',col:'#e5533d',d:'Tüm sayfaları ya da seçtiklerini döndür.'},
  {id:'crop',cat:'org',name:'PDF Kırp',icon:'crop',col:'#e5533d',d:'Kenar boşluklarını kes, sayfanın bir bölgesini bırak.'},
  {id:'ocr',cat:'opt',name:'OCR · Aranabilir PDF',icon:'ocr',col:'#2e9d5b',d:'Taranmış PDF\'teki yazıyı tanır; aranabilir ve kopyalanabilir yapar. Türkçe + İngilizce.'},
  {id:'compress',cat:'opt',name:'PDF Sıkıştır',icon:'compress',col:'#2e9d5b',d:'Dosya boyutunu küçült.',soon:2},
  {id:'repair',cat:'opt',name:'PDF Onar',icon:'repair',col:'#2e9d5b',d:'Bozuk PDF\'i kurtarmayı dene.',soon:4},
  {id:'scan',cat:'to',name:'Tara · Görselden PDF',icon:'cam',col:'#e3a008',d:'Kamerayla belge tara ya da JPG/PNG görsellerden PDF yap. İstersen OCR uygula.'},
  {id:'word2pdf',cat:'to',name:'Word → PDF',icon:'word',col:'#2b6cd8',d:'DOCX belgelerini PDF yap.',soon:3},
  {id:'ppt2pdf',cat:'to',name:'PowerPoint → PDF',icon:'ppt',col:'#d9653b',d:'Sunumları PDF yap.',soon:3},
  {id:'xls2pdf',cat:'to',name:'Excel → PDF',icon:'xls',col:'#1f8a4c',d:'Tabloları PDF yap.',soon:3},
  {id:'html2pdf',cat:'to',name:'HTML → PDF',icon:'html',col:'#6b7280',d:'HTML içeriğini PDF yap.',soon:3},
  {id:'pdf2img',cat:'from',name:'PDF → JPG / PNG',icon:'img',col:'#e3a008',d:'Sayfaları yüksek çözünürlüklü görsele çevir.'},
  {id:'pdf2word',cat:'from',name:'PDF → Word',icon:'word',col:'#2b6cd8',d:'Düzenlenebilir DOCX belgesine çevir.',soon:3},
  {id:'pdf2ppt',cat:'from',name:'PDF → PowerPoint',icon:'ppt',col:'#d9653b',d:'Her sayfa bir slayt olsun.',soon:3},
  {id:'pdf2xls',cat:'from',name:'PDF → Excel',icon:'xls',col:'#1f8a4c',d:'Tabloları Excel\'e aktar.',soon:3},
  {id:'pdfa',cat:'from',name:'PDF → PDF/A',icon:'pdfa',col:'#6b7280',d:'Uzun süreli arşiv formatı.',soon:3},
  {id:'edit',cat:'edit',name:'PDF\'i Düzenle',icon:'edit',col:'#8b5cf6',d:'Metin, görsel, şekil, çizim, not ve vurgu ekle.'},
  {id:'sign',cat:'edit',name:'PDF İmzala',icon:'sign',col:'#8b5cf6',d:'İmzanı çiz, yaz ya da yükle; belgeye yerleştir.'},
  {id:'watermark',cat:'edit',name:'Filigran Ekle',icon:'wm',col:'#8b5cf6',d:'Sayfalara yazı ya da görsel filigran bas.'},
  {id:'pagenum',cat:'edit',name:'Sayfa Numarası',icon:'num',col:'#8b5cf6',d:'Konum, biçim ve başlangıç numarasını seç.'},
  {id:'redact',cat:'edit',name:'PDF Karart',icon:'redact',col:'#8b5cf6',d:'Gizli bilgileri kalıcı olarak sil.',soon:2},
  {id:'compare',cat:'edit',name:'PDF Karşılaştır',icon:'comp',col:'#8b5cf6',d:'İki sürüm arasındaki farkları göster.',soon:4},
  {id:'protect',cat:'sec',name:'PDF Koru',icon:'lock',col:'#334155',d:'Şifre ile koru.',soon:4},
  {id:'unlock',cat:'sec',name:'Kilidi Aç',icon:'unlock',col:'#334155',d:'Bildiğin şifreyi kaldır.',soon:4},
  {id:'translate',cat:'ai',name:'PDF Çevir',icon:'ai',col:'#0ea5a4',d:'Belgeyi başka dile çevir.',soon:5},
  {id:'summary',cat:'ai',name:'PDF Özetle',icon:'ai',col:'#0ea5a4',d:'Uzun belgenin özetini çıkar.',soon:5},
];
const toolById=id=>T.find(t=>t.id===id);

/* ---------- ana ekran ---------- */
async function renderHome(){const app=$('#app');const docs=await Docs.list();const libHtml='';
  app.innerHTML=`<header class="top"><a class="brand" href="#/"><span class="logo">PDF</span>PDF Atölyem</a><div class="sp"></div>
    <a class="btn ghost hide-s" href="../">${ic('back')} Kütüphanem</a><button class="btn pri" id="hOpen">${ic('open')} PDF aç</button></header>
  <div class="home">
    <div class="hero"><div class="drop" id="hDrop">${ic('file','i" style="width:40px;height:40px;color:var(--ac)')}<h2>PDF'i buraya bırak</h2><p>ya da bilgisayarından seç. Birden çok dosya bırakabilirsin.</p>
      <div style="display:flex;gap:8px;margin-top:6px"><button class="btn pri" id="hOpen2">${ic('open')} Dosya seç</button><a class="btn" href="#/arac/scan">${ic('cam')} Belge tara</a></div></div>
      <div class="privacy"><b>🔒 Dosyaların cihazında kalır</b>Tüm işlemler bu tarayıcının içinde yapılır. Hiçbir dosya bir sunucuya yüklenmez; internet olmadan da çalışır.<div style="margin-top:10px;font-size:12.5px">${docs.length} belge · ${fmtSize(docs.reduce((a,d)=>a+(d.size||0),0))}</div></div></div>
    ${libHtml}
    <h3 class="sec">Son belgeler</h3>
    ${docs.length?`<div class="docs">${docs.map(d=>`<div class="doc" data-id="${d.id}"><div class="th" style="background-image:url('${d.thumb||''}')"></div><div class="nm" title="${esc(d.name)}">${esc(baseName(d.name))}</div><div class="mt">${d.pages||'?'} sayfa · ${fmtSize(d.size)}${d.annCount?` · ${d.annCount} not`:''}</div><button class="ib menu">${ic('dots')}</button></div>`).join('')}</div>`:'<div class="empty">Henüz belge yok. Bir PDF açtığında burada görünür.</div>'}
    ${CATS.map(([c,label])=>`<h3 class="sec">${label}</h3><div class="tools">${T.filter(t=>t.cat===c).map(toolCard).join('')}</div>`).join('')}
  </div>`;
  const open=async()=>{const fs=await pickFiles({multiple:true});importFiles(fs)};$('#hOpen').onclick=open;$('#hOpen2').onclick=open;
  dropZone($('#hDrop'),fs=>importFiles(fs.filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name))));
  $$('.doc[data-id]').forEach(el=>{el.onclick=e=>{if(e.target.closest('.menu'))return;location.hash='#/oku/'+el.dataset.id};
    $('.menu',el).onclick=async e=>{e.stopPropagation();const id=el.dataset.id;const d=await Docs.get(id);const r=e.currentTarget.getBoundingClientRect();
      popMenu(r.left,r.bottom+4,[{icon:'open',label:'Aç',fn:()=>location.hash='#/oku/'+id},
        {icon:'edit',label:'Yeniden adlandır',fn:async()=>{const n=await promptBox('Yeniden adlandır','Belge adı',baseName(d.name));if(n){d.name=n.trim()+'.pdf';await Docs.update(d);renderHome()}}},
        {icon:'dl',label:'İndir (orijinal)',fn:async()=>download(await Docs.bytes(id),d.name)},
        {icon:'org',label:'Sayfaları düzenle',fn:()=>location.hash='#/arac/organize?doc='+id},
        {icon:'ocr',label:'Aranabilir yap (OCR)',fn:()=>location.hash='#/arac/ocr?doc='+id},
        '-',{icon:'trash',label:'Sil',danger:true,fn:async()=>{if(await confirmBox('Belgeyi sil',`<b>${esc(d.name)}</b> ve üzerindeki tüm notlar silinecek.`,'Sil',true)){await Docs.remove(id);renderHome()}}}])}});
  $$('.tool[data-id]').forEach(el=>el.onclick=()=>{const t=toolById(el.dataset.id);if(!t.soon)location.hash='#/arac/'+t.id});Lib.bindSection()}
function toolCard(t){return `<div class="tool${t.soon?' soon':''}" data-id="${t.id}"><div class="ti" style="background:${t.col}">${ic(t.icon)}</div><div><b>${t.name}</b><span class="d">${t.d}</span></div>${t.soon?`<span class="badge">Yakında</span>`:''}</div>`}
function dropZone(el,cb){['dragenter','dragover'].forEach(k=>el.addEventListener(k,e=>{e.preventDefault();el.classList.add('over')}));['dragleave','drop'].forEach(k=>el.addEventListener(k,e=>{e.preventDefault();el.classList.remove('over')}));
  el.addEventListener('drop',e=>{const fs=[...e.dataTransfer.files];if(fs.length)cb(fs)})}
async function importFiles(fs){if(!fs.length)return;let last;await withBusy('Belgeler ekleniyor…',async()=>{for(const f of fs){last=await Docs.add(f.name,await readBytes(f))}});
  if(fs.length===1)location.hash='#/oku/'+last.id;else{toast(fs.length+' belge eklendi');renderHome()}}

/* ---------- ortak araç iskeleti ---------- */
function toolShell(t,inner){$('#app').innerHTML=`<header class="top"><a class="brand" href="#/"><span class="logo">PDF</span>PDF Atölyem</a><div class="sep"></div><b style="padding:0 6px">${t.name}</b><div class="sp"></div><a class="btn ghost" href="#/">${ic('back')} Tüm araçlar</a></header>
  <div class="toolpage"><div class="toolhead"><div class="ti" style="background:${t.col}">${ic(t.icon)}</div><div><h1>${t.name}</h1><p>${t.d}</p></div></div><div id="tBody">${inner||''}</div></div>`;return $('#tBody')}
// Dosya seçme aşaması: cihazdan, sürükle-bırak ya da "Belgelerim"den
function pickStage(body,{multiple=false,accept='pdf',title}={},cb){
  body.innerHTML=`<div class="drop" id="pDrop" style="min-height:240px">${ic(accept==='img'?'img':'file','i" style="width:40px;height:40px;color:var(--ac)')}<h2>${title||(multiple?'PDF dosyalarını seç':'PDF dosyasını seç')}</h2><p>Sürükleyip bırakabilir ya da aşağıdan seçebilirsin.</p>
    <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center"><button class="btn pri" id="pDev">${ic('open')} Cihazdan seç</button>${accept==='pdf'?`<button class="btn" id="pLib">${ic('file')} Belgelerimden seç</button>`:''}</div></div>`;
  const done=async fs=>{if(!fs.length)return;const out=[];await withBusy('Dosyalar okunuyor…',async()=>{for(const f of fs)out.push(f.id?f:{name:f.name,bytes:await readBytes(f),file:f})});cb(out)};
  $('#pDev',body).onclick=async()=>done(await pickFiles({multiple,accept:accept==='img'?'image/*':'application/pdf,.pdf'}));
  dropZone($('#pDrop',body),fs=>done(fs.filter(f=>accept==='img'?/^image\//.test(f.type):(/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)))));
  const lb=$('#pLib',body);if(lb)lb.onclick=async()=>{const sel=await pickFromLibrary(multiple);if(sel.length)cb(sel)}}
async function pickFromLibrary(multiple){const docs=await Docs.list();if(!docs.length){toast('Belgelerinde henüz PDF yok');return[]}
  const r=await modal({title:'Belgelerimden seç',wide:true,ok:'Seç',body:`<div class="docs" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${docs.map(d=>`<label class="doc" style="cursor:pointer"><input type="${multiple?'checkbox':'radio'}" name="lb" value="${d.id}" style="position:absolute;top:8px;left:8px;z-index:2"><div class="th" style="background-image:url('${d.thumb||''}')"></div><div class="nm">${esc(baseName(d.name))}</div><div class="mt">${d.pages} sayfa</div></label>`).join('')}</div>`});
  if(!r)return[];const ids=$$('input:checked',r).map(i=>i.value);const out=[];for(const id of ids){const d=await Docs.get(id);out.push({id,name:d.name,bytes:await Docs.bytes(id)})}return out}
async function fromQueryDoc(){const id=new URLSearchParams(location.hash.split('?')[1]||'').get('doc');if(!id)return null;const d=await Docs.get(id);if(!d)return null;return{id,name:d.name,bytes:await Docs.bytes(id)}}
// Sonuç ekranı
function resultStage(body,files,{msg,again,sourceDoc}={}){const one=files.length===1;const total=files.reduce((a,f)=>a+f.data.length,0);
  body.innerHTML=`<div class="card result"><div class="ok">${ic('check')}</div><h2 style="margin:0">${msg||'Hazır!'}</h2><div style="color:var(--tx2)">${one?esc(files[0].name):files.length+' dosya'} · ${fmtSize(total)}</div>
    <div class="row"><button class="btn pri" id="rDl">${ic('dl')} ${one?'İndir':'Hepsini ZIP olarak indir'}</button>${one?`<button class="btn" id="rSh">${ic('share')} Paylaş</button>`:''}
    ${files.every(f=>/\.pdf$/i.test(f.name))?`<button class="btn" id="rSave">${ic('save')} Belgelerime kaydet</button>`:''}${one&&/\.pdf$/i.test(files[0].name)?`<button class="btn" id="rOpen">${ic('open')} Aç ve oku</button><button class="btn" id="rLib">${ic('file')} Kütüphaneme ekle</button>`:''}
    ${sourceDoc&&one&&/\.pdf$/i.test(files[0].name)?`<button class="btn" id="rRep">${ic('save')} Orijinal belgenin yerine kaydet</button>`:''}</div>
    ${!one?`<details style="width:100%;max-width:520px;text-align:left"><summary style="cursor:pointer;color:var(--tx2)">Dosyaları tek tek indir</summary>${files.map((f,k)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(f.name)}</span><a href="#" data-k="${k}">İndir</a></div>`).join('')}</details>`:''}
    <button class="btn ghost" id="rAgain">${ic('rotl')} Baştan başla</button></div>`;
  const type=n=>/\.png$/i.test(n)?'image/png':/\.jpe?g$/i.test(n)?'image/jpeg':/\.txt$/i.test(n)?'text/plain':/\.docx$/i.test(n)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':/\.xlsx$/i.test(n)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':/\.pptx$/i.test(n)?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/pdf';
  $('#rDl',body).onclick=()=>one?download(files[0].data,files[0].name,type(files[0].name)):download(makeZip(files),(files[0].zip||'pdf-atolyem')+'.zip');
  const sh=$('#rSh',body);if(sh)sh.onclick=()=>shareFile(files[0].data,files[0].name,type(files[0].name));
  const lb=$('#rLib',body);if(lb)lb.onclick=()=>Lib.send(files[0].data,files[0].name);
  const sv=$('#rSave',body);let saved=null;if(sv)sv.onclick=async()=>{await withBusy('Kaydediliyor…',async()=>{for(const f of files)saved=await Docs.add(f.name,f.data)});sv.disabled=true;sv.innerHTML=ic('check')+' Kaydedildi'};
  const op=$('#rOpen',body);if(op)op.onclick=async()=>{if(!saved)saved=await withBusy('Açılıyor…',()=>Docs.add(files[0].name,files[0].data));location.hash='#/oku/'+saved.id};
  const rp=$('#rRep',body);if(rp)rp.onclick=async()=>{if(!await confirmBox('Orijinalin yerine kaydet',`<b>${esc(sourceDoc.name)}</b> bu yeni hâliyle değiştirilecek.`,'Değiştir'))return;await withBusy('Kaydediliyor…',()=>Docs.replaceBytes(sourceDoc.id,files[0].data));if(sourceDoc.onReplace)await sourceDoc.onReplace();rp.disabled=true;rp.innerHTML=ic('check')+' Kaydedildi'};
  $$('[data-k]',body).forEach(a=>a.onclick=e=>{e.preventDefault();const f=files[+a.dataset.k];download(f.data,f.name,type(f.name))});
  $('#rAgain',body).onclick=()=>again?again():route()}
// Sayfa küçük resimleri (tembel çizim)
function lazyThumbs(container,getPage,w=150){const io=new IntersectionObserver(es=>es.forEach(async e=>{if(!e.isIntersecting)return;const el=e.target;io.unobserve(el);
  try{const pg=await getPage(el);const c=el.querySelector('canvas');await renderTo(c,pg,w*1.5);c.style.maxWidth=w+'px'}catch(err){console.warn(err)}}),{rootMargin:'400px'});
  $$('[data-thumb]',container).forEach(el=>io.observe(el));return io}
const bar=(info,btns)=>{$$('.bar').forEach(b=>b.remove());const b=document.createElement('div');b.className='bar';b.innerHTML=`<div class="info">${info}</div>${btns}`;document.body.appendChild(b);return b};
const clearBar=()=>$$('.bar').forEach(b=>b.remove());

/* ---------- Birleştir ---------- */
async function toolMerge(t){const body=toolShell(t);let files=[];
  const list=async()=>{body.innerHTML=`<div class="grid" id="mG">${files.map((f,k)=>`<div class="pcard" data-k="${k}"><span class="src" style="background:${SRC_COL[k%SRC_COL.length]}"></span><div class="cv dragh" data-thumb data-k="${k}"><canvas></canvas></div><div class="cap" title="${esc(f.name)}">${esc(f.name)}</div><div class="cap">${f.pages} sayfa · ${fmtSize(f.bytes.length)}</div><div class="acts"><button class="ib" data-del="${k}" data-tip="Kaldır">${ic('trash')}</button></div></div>`).join('')}
    <button class="pcard" id="mAdd" style="border-style:dashed;cursor:pointer;display:grid;place-items:center;min-height:240px;color:var(--ac)">${ic('plus','i" style="width:34px;height:34px')}<b>Dosya ekle</b></button></div>
    <p style="color:var(--tx2);margin-top:14px">Sırayı değiştirmek için kartları sürükle.</p>`;
    lazyThumbs(body,async el=>{const f=files[+el.dataset.k];f.pdf=f.pdf||await openPdf(f.bytes);return f.pdf.getPage(1)});
    $('#mAdd').onclick=async()=>{const fs=await pickFiles({multiple:true});await add(fs.map(f=>f))};
    $$('[data-del]',body).forEach(b=>b.onclick=()=>{files.splice(+b.dataset.del,1);list()});
    const S=await sortable();S.create($('#mG'),{animation:150,filter:'#mAdd',onMove:e=>e.related.id!=='mAdd',onEnd:()=>{const order=$$('#mG .pcard[data-k]').map(e=>+e.dataset.k);files=order.map(k=>files[k]);list()}});
    bar(`${files.length} dosya · ${files.reduce((a,f)=>a+f.pages,0)} sayfa`,`<button class="btn pri" id="mGo"${files.length<2?' disabled':''}>${ic('merge')} PDF'leri birleştir</button>`);
    $('#mGo').onclick=go};
  const add=async fs=>{await withBusy('Dosyalar okunuyor…',async()=>{for(const f of fs){const o=f.bytes?f:{name:f.name,bytes:await readBytes(f)};const p=await openPdf(o.bytes);o.pages=p.numPages;o.pdf=p;files.push(o)}});list()};
  const go=async()=>{const out=await withBusy('Birleştiriliyor…',async()=>{const L=await pdflib();const doc=await L.PDFDocument.create();
      for(let k=0;k<files.length;k++){Busy.prog(k/files.length);const src=await loadLib(files[k].bytes);const ps=await doc.copyPages(src,src.getPageIndices());ps.forEach(p=>doc.addPage(p))}return doc.save()});
    clearBar();resultStage(body,[{name:baseName(files[0].name)+'_birlesik.pdf',data:out}],{msg:'PDF\'ler birleştirildi',again:()=>{files=[];start()}})};
  const start=()=>{clearBar();pickStage(body,{multiple:true,title:'Birleştirilecek PDF\'leri seç'},fs=>{files=[];add(fs)})};
  const q=await fromQueryDoc();if(q){await add([q])}else start()}
const SRC_COL=['#3352d6','#e5533d','#2e9d5b','#e3a008','#8b5cf6','#0ea5a4','#d9653b','#64748b'];

/* ---------- Sayfa ızgarası (Düzenle, Döndür, Böl, Görsel) ---------- */
// pages: [{src, idx, rot, blank:{w,h}}], sources: [{name,bytes,pdf}]
async function pageGrid(body,state,{mode}){const{pages,sources}=state;
  body.innerHTML=`<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px" id="gTools"></div><div class="grid" id="gG"></div>`;
  const tools=$('#gTools',body);const g=$('#gG',body);
  const getPg=async el=>{const p=pages[+el.dataset.k];const s=sources[p.src];s.pdf=s.pdf||await openPdf(s.bytes);return s.pdf.getPage(p.idx+1)};
  const tf=r=>`rotate(${r}deg)${r%180?' scale(.72)':''}`;
  const draw=()=>{g.innerHTML=pages.map((p,k)=>`<div class="pcard${p.sel?' selp':''}" data-k="${k}">${sources.length>1?`<span class="src" style="background:${SRC_COL[p.src%SRC_COL.length]}"></span>`:''}
      <div class="cv${mode==='organize'?' dragh':''}" ${p.blank?'':`data-thumb data-k="${k}"`}>${p.blank?`<div style="width:110px;height:150px;background:#fff;box-shadow:var(--sh);transform:${tf(p.rot)}"></div>`:`<canvas style="transform:${tf(p.rot)}"></canvas>`}</div>
      <div class="cap">${p.blank?'Boş sayfa':`${sources.length>1?esc(baseName(sources[p.src].name)).slice(0,14)+' · ':''}s. ${p.idx+1}`}${p.rot?` · ${p.rot}°`:''}</div>
      <div class="acts"><button class="ib" data-a="rl" data-tip="Sola döndür">${ic('rotl')}</button><button class="ib" data-a="rr" data-tip="Sağa döndür">${ic('rot')}</button>${mode==='organize'?`<button class="ib" data-a="dup" data-tip="Kopyala">${ic('copy')}</button><button class="ib" data-a="del" data-tip="Sil">${ic('trash')}</button>`:''}</div></div>`).join('');
    lazyThumbs(g,getPg);upd()};
  const upd=()=>{const n=pages.filter(p=>p.sel).length;state.onChange&&state.onChange(n)};
  g.onclick=e=>{const c=e.target.closest('.pcard');if(!c)return;const k=+c.dataset.k,p=pages[k];const a=e.target.closest('[data-a]');
    if(!a){if(e.shiftKey&&state.lastSel!=null){const[a1,b1]=[Math.min(k,state.lastSel),Math.max(k,state.lastSel)];for(let i=a1;i<=b1;i++)pages[i].sel=true}else p.sel=!p.sel;state.lastSel=k;c.classList.toggle('selp',p.sel);$$('.pcard',g).forEach((el,i)=>el.classList.toggle('selp',!!pages[i].sel));upd();return}
    const act=a.dataset.a;if(act==='rl'||act==='rr'){p.rot=(p.rot+(act==='rr'?90:270))%360;$('canvas,div[style]',c.querySelector('.cv')).style.transform=tf(p.rot);c.querySelector('.cap').innerHTML=c.querySelector('.cap').innerHTML.replace(/ · \d+°$/,'')+(p.rot?` · ${p.rot}°`:'');return}
    if(act==='dup'){pages.splice(k+1,0,{...p,sel:false});draw()}if(act==='del'){pages.splice(k,1);draw()}};
  if(mode==='organize'){const S=await sortable();S.create(g,{animation:150,handle:'.dragh',onEnd:e=>{const[m]=pages.splice(e.oldIndex,1);pages.splice(e.newIndex,0,m);draw()}})}
  state.redraw=draw;draw();return tools}
async function buildFromPages(pages,sources){const L=await pdflib();const doc=await L.PDFDocument.create();
  // Her kaynaktan tek seferde kopyala: ortak yazı tipleri ve görseller bir kez taşınır
  const copied={};for(const si of new Set(pages.filter(p=>!p.blank).map(p=>p.src))){const src=await loadLib(sources[si].bytes);const want=pages.filter(p=>!p.blank&&p.src===si);
    const cps=await doc.copyPages(src,want.map(p=>p.idx));copied[si]=cps;await sleep(0)}
  const used={};
  for(let k=0;k<pages.length;k++){const p=pages[k];if(k%20===0){Busy.prog(k/pages.length);await sleep(0)}
    if(p.blank){const pg=doc.addPage([p.blank.w,p.blank.h]);if(p.rot)pg.setRotation(L.degrees(p.rot));continue}
    const cp=copied[p.src][used[p.src]=(used[p.src]??-1)+1];const r0=cp.getRotation().angle;cp.setRotation(L.degrees((r0+p.rot)%360));doc.addPage(cp)}
  return doc.save()}
async function loadSources(list){const sources=[];for(const f of list){const pdf=await openPdf(f.bytes);sources.push({...f,pdf,n:pdf.numPages})}return sources}

/* ---------- Sayfaları düzenle ---------- */
async function toolOrganize(t){const body=toolShell(t);let source=null;
  const run=async list=>{const sources=await withBusy('Sayfalar hazırlanıyor…',()=>loadSources(list));const pages=[];sources.forEach((s,si)=>{for(let i=0;i<s.n;i++)pages.push({src:si,idx:i,rot:0})});
    const st={pages,sources};const tools=await pageGrid(body,st,{mode:'organize'});
    tools.innerHTML=`<button class="btn" id="oAddPdf">${ic('plus')} PDF ekle</button><button class="btn" id="oBlank">${ic('blank')} Boş sayfa ekle</button><div class="sep"></div>
      <button class="btn" id="oAll">Tümünü seç</button><button class="btn" id="oDelSel" disabled>${ic('trash')} Seçilenleri sil</button><button class="btn" id="oRotSel" disabled>${ic('rot')} Seçilenleri döndür</button>
      <button class="btn" id="oRev">Sırayı ters çevir</button><span style="color:var(--tx2);margin-left:auto;font-size:12.5px">Kartları sürükleyerek sırala · Shift ile aralık seç</span>`;
    const refresh=()=>{st.redraw();bb()};
    st.onChange=n=>{$('#oDelSel').disabled=!n;$('#oRotSel').disabled=!n;bb()};
    $('#oAddPdf').onclick=async()=>{const fs=await pickFiles({multiple:true});if(!fs.length)return;const add=await withBusy('Ekleniyor…',async()=>loadSources(await Promise.all(fs.map(async f=>({name:f.name,bytes:await readBytes(f)})))));
      add.forEach(s=>{const si=sources.push(s)-1;for(let i=0;i<s.n;i++)pages.push({src:si,idx:i,rot:0})});refresh()};
    $('#oBlank').onclick=async()=>{const ref=pages.find(p=>p.sel)||pages[pages.length-1];let w=595.28,h=841.89;if(ref&&!ref.blank){const pg=await sources[ref.src].pdf.getPage(ref.idx+1);const v=pg.getViewport({scale:1,rotation:0});[w,h]=pg.view?[pg.view[2]-pg.view[0],pg.view[3]-pg.view[1]]:[v.width,v.height]}else if(ref&&ref.blank)({w,h}=ref.blank);
      const at=pages.findIndex(p=>p.sel);pages.splice(at>=0?at+1:pages.length,0,{blank:{w,h},rot:0});refresh()};
    $('#oAll').onclick=()=>{const all=pages.every(p=>p.sel);pages.forEach(p=>p.sel=!all);refresh()};
    $('#oDelSel').onclick=()=>{for(let i=pages.length-1;i>=0;i--)if(pages[i].sel)pages.splice(i,1);refresh()};
    $('#oRotSel').onclick=()=>{pages.forEach(p=>{if(p.sel)p.rot=(p.rot+90)%360});refresh()};
    $('#oRev').onclick=()=>{pages.reverse();refresh()};
    const bb=()=>{bar(`${pages.length} sayfa${pages.some(p=>p.sel)?` · ${pages.filter(p=>p.sel).length} seçili`:''}`,`${pages.some(p=>p.sel)?`<button class="btn" id="oExt">Seçilenleri ayrı PDF yap</button>`:''}<button class="btn pri" id="oGo"${pages.length?'':' disabled'}>${ic('check')} Değişiklikleri uygula</button>`);
      $('#oGo').onclick=()=>go(pages);const ex=$('#oExt');if(ex)ex.onclick=()=>go(pages.filter(p=>p.sel),'_secilen')};
    const go=async(list,suf='_duzenlenmis')=>{const out=await withBusy('PDF oluşturuluyor…',()=>buildFromPages(list,sources));clearBar();
      const sd=source&&sources.length===1&&!suf.includes('secilen')?{...source,onReplace:()=>remapAnn(source.id,list)}:null;
      resultStage(body,[{name:baseName(sources[0].name)+suf+'.pdf',data:out}],{msg:'Sayfalar düzenlendi',sourceDoc:sd,again:start})};bb()};
  const start=()=>{clearBar();pickStage(body,{multiple:true},run)};
  source=await fromQueryDoc();if(source)run([source]);else start()}
// Kaynak belgenin notlarını yeni sayfa sırasına taşı
async function remapAnn(id,list){const items=(await DB.get('ann',id))||[];if(!items.length)return;const out=[];
  list.forEach((p,ni)=>{if(p.blank||p.src!==0)return;items.filter(i=>i.page===p.idx).forEach(i=>{const c=JSON.parse(JSON.stringify(i));c.page=ni;c.id=uid();out.push(c)})});await DB.put('ann',out,id)}

/* ---------- Döndür ---------- */
async function toolRotate(t){const body=toolShell(t);
  const run=async list=>{const sources=await withBusy('Sayfalar hazırlanıyor…',()=>loadSources(list.slice(0,1)));const pages=[];for(let i=0;i<sources[0].n;i++)pages.push({src:0,idx:i,rot:0});
    const st={pages,sources};const tools=await pageGrid(body,st,{mode:'rotate'});
    tools.innerHTML=`<button class="btn" id="rAL">${ic('rotl')} Tümünü sola</button><button class="btn" id="rAR">${ic('rot')} Tümünü sağa</button><button class="btn" id="rEven">Çift sayfaları döndür</button><button class="btn" id="rRst">Sıfırla</button><span style="color:var(--tx2);margin-left:auto;font-size:12.5px">Sayfa kartındaki düğmelerle tek tek döndür</span>`;
    $('#rAL').onclick=()=>{pages.forEach(p=>p.rot=(p.rot+270)%360);st.redraw()};$('#rAR').onclick=()=>{pages.forEach(p=>p.rot=(p.rot+90)%360);st.redraw()};
    $('#rEven').onclick=()=>{pages.forEach((p,i)=>{if(i%2)p.rot=(p.rot+180)%360});st.redraw()};$('#rRst').onclick=()=>{pages.forEach(p=>p.rot=0);st.redraw()};
    bar('Döndürmek istediğin sayfaları ayarla',`<button class="btn pri" id="rGo">${ic('check')} Döndür ve kaydet</button>`);
    $('#rGo').onclick=async()=>{const out=await withBusy('Döndürülüyor…',async()=>{const L=await pdflib();const d=await loadLib(sources[0].bytes);d.getPages().forEach((pg,i)=>{if(pages[i].rot)pg.setRotation(L.degrees((pg.getRotation().angle+pages[i].rot)%360))});return d.save()});
      clearBar();resultStage(body,[{name:baseName(sources[0].name)+'_dondurulmus.pdf',data:out}],{msg:'Sayfalar döndürüldü',sourceDoc:list[0].id?{...list[0],onReplace:()=>DB.put('ann',[],list[0].id)}:null,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Böl ---------- */
async function toolSplit(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const[src]=await withBusy('Hazırlanıyor…',()=>loadSources([f]));const n=src.n;const pages=[];for(let i=0;i<n;i++)pages.push({src:0,idx:i,rot:0});
    let mode='range';const st={pages,sources:[src]};
    body.innerHTML=`<div class="card"><div class="seg" id="sMode"><button data-m="range" class="on">Aralıklara göre</button><button data-m="fixed">Her N sayfada bir</button><button data-m="each">Her sayfa ayrı</button><button data-m="pick">Sayfa seç</button></div>
      <div class="opts" style="margin-top:14px" id="sOpts"></div></div><div id="sGrid"></div>`;
    const opts=()=>{const o=$('#sOpts');
      if(mode==='range')o.innerHTML=`<label class="fld">Aralıklar (her biri ayrı dosya)<input type="text" id="sR" value="1-${Math.ceil(n/2)}, ${Math.ceil(n/2)+1}-${n}" style="min-width:320px"></label><div style="color:var(--tx2);font-size:12.5px">Örn. <code>1-3, 4, 5-10</code> → 3 dosya · Belgede ${n} sayfa var</div>`;
      else if(mode==='fixed')o.innerHTML=`<label class="fld">Kaç sayfada bir bölünsün?<input type="number" id="sN" value="${Math.max(1,Math.min(5,n-1))}" min="1" max="${n}"></label><div style="color:var(--tx2);font-size:12.5px" id="sNi"></div>`;
      else if(mode==='each')o.innerHTML=`<div style="color:var(--tx2)">${n} sayfanın her biri ayrı PDF olur ve ZIP olarak indirilir.</div>`;
      else o.innerHTML=`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sMerge" checked> Seçilen sayfaları tek PDF'te topla</label><div style="color:var(--tx2);font-size:12.5px">Aşağıdan sayfalara tıklayarak seç (Shift ile aralık).</div>`;
      const nn=$('#sN');if(nn){const u=()=>$('#sNi').textContent=`→ ${Math.ceil(n/Math.max(1,+nn.value||1))} dosya`;nn.oninput=u;u()}
      if(mode==='pick'){pageGrid($('#sGrid'),st,{mode:'pick'}).then(tl=>{tl.innerHTML='<b>Sayfa seç</b>';tl.style.display='none';st.onChange=k=>bb(k)})}else $('#sGrid').innerHTML='';bb()};
    $$('#sMode button').forEach(b=>b.onclick=()=>{mode=b.dataset.m;$$('#sMode button').forEach(q=>q.classList.toggle('on',q===b));opts()});
    const bb=k=>{bar(mode==='pick'?`${k||0} sayfa seçili`:`${n} sayfa`,`<button class="btn pri" id="sGo">${ic('split')} PDF'i böl</button>`);$('#sGo').onclick=go};
    const go=async()=>{let groups;
      if(mode==='range'){groups=rangeGroups($('#sR').value,n);if(!groups.length||groups.some(g=>!g.pages||!g.pages.length)){alertBox('Aralık hatalı','Aralıkları <code>1-3, 5, 8-10</code> biçiminde yaz.');return}}
      else if(mode==='fixed'){const k=Math.max(1,+$('#sN').value||1);groups=[];for(let i=0;i<n;i+=k){const ps=[];for(let j=i;j<Math.min(n,i+k);j++)ps.push(j);groups.push({label:`${i+1}-${Math.min(n,i+k)}`,pages:ps})}}
      else if(mode==='each')groups=pages.map((p,i)=>({label:String(i+1),pages:[i]}));
      else{const sel=pages.map((p,i)=>p.sel?i:-1).filter(i=>i>=0);if(!sel.length){toast('Önce sayfa seç');return}groups=$('#sMerge').checked?[{label:'secilen',pages:sel}]:sel.map(i=>({label:String(i+1),pages:[i]}))}
      const files=await withBusy('Bölünüyor…',async()=>{const L=await pdflib();const s=await loadLib(f.bytes);const out=[];
        for(let k=0;k<groups.length;k++){Busy.prog(k/groups.length);const d=await L.PDFDocument.create();(await d.copyPages(s,groups[k].pages)).forEach(p=>d.addPage(p));out.push({name:`${baseName(f.name)}_${groups[k].label.replace(/\s/g,'')}.pdf`,data:await d.save(),zip:baseName(f.name)+'_bolunmus'})}return out});
      clearBar();resultStage(body,files,{msg:'PDF bölündü',again:start})};
    opts()};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Kırp ---------- */
// Görsel (döndürülmüş) koordinatları PDF koordinatlarına çevir
function visToPdf(page,vx,vy){const b=page.getCropBox(),R=((page.getRotation().angle%360)+360)%360;
  if(R===90)return[b.x+vy,b.y+vx];if(R===180)return[b.x+b.width-vx,b.y+vy];if(R===270)return[b.x+b.width-vy,b.y+b.height-vx];return[b.x+vx,b.y+b.height-vy]}
function visSize(page){const b=page.getCropBox(),R=((page.getRotation().angle%360)+360)%360;return R%180?[b.height,b.width]:[b.width,b.height]}
async function toolCrop(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Hazırlanıyor…',()=>openPdf(f.bytes));let cur=1;let box=null;// box: oranlar (0-1)
    body.innerHTML=`<div class="card opts"><label class="fld">Sayfa<select id="cP">${Array.from({length:pdf.numPages},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
      <label class="fld">Uygula<select id="cA"><option value="all">Tüm sayfalara</option><option value="this">Sadece bu sayfaya</option><option value="odd">Tek sayfalara</option><option value="even">Çift sayfalara</option></select></label>
      <button class="btn" id="cAuto">Boşlukları otomatik bul</button><button class="btn ghost" id="cRst">Sıfırla</button></div>
      <div class="card" style="text-align:center"><div class="croparea" id="cArea"><canvas id="cC"></canvas><div class="cropbox" id="cB"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>`;
    const area=$('#cArea'),cb=$('#cB'),cvs=$('#cC');
    const show=async()=>{const pg=await pdf.getPage(cur);await renderTo(cvs,pg,Math.min(900,body.clientWidth-60));if(!box)box={x:.05,y:.05,w:.9,h:.9};place()};
    const place=()=>{const W=cvs.clientWidth,H=cvs.clientHeight;Object.assign(cb.style,{left:box.x*W+'px',top:box.y*H+'px',width:box.w*W+'px',height:box.h*H+'px'})};
    let drag=null;cb.onpointerdown=e=>{e.preventDefault();cb.setPointerCapture(e.pointerId);drag={h:e.target.dataset.h||'m',x:e.clientX,y:e.clientY,b:{...box}}};
    cb.onpointermove=e=>{if(!drag)return;const W=cvs.clientWidth,H=cvs.clientHeight,dx=(e.clientX-drag.x)/W,dy=(e.clientY-drag.y)/H,b={...drag.b};
      if(drag.h==='m'){b.x=Math.min(Math.max(0,b.x+dx),1-b.w);b.y=Math.min(Math.max(0,b.y+dy),1-b.h)}
      else{if(drag.h.includes('w')){b.x=Math.min(Math.max(0,b.x+dx),b.x+b.w-.03);b.w=drag.b.x+drag.b.w-b.x}if(drag.h.includes('e'))b.w=Math.min(Math.max(.03,b.w+dx),1-b.x);
        if(drag.h.includes('n')){b.y=Math.min(Math.max(0,b.y+dy),b.y+b.h-.03);b.h=drag.b.y+drag.b.h-b.y}if(drag.h.includes('s'))b.h=Math.min(Math.max(.03,b.h+dy),1-b.y)}box=b;place()};
    cb.onpointerup=()=>drag=null;window.addEventListener('resize',place);
    $('#cP').onchange=e=>{cur=+e.target.value;show()};$('#cRst').onclick=()=>{box={x:0,y:0,w:1,h:1};place()};
    $('#cAuto').onclick=()=>{const x=cvs.getContext('2d');const{width:W,height:H}=cvs;const d=x.getImageData(0,0,W,H).data;let t=H,l=W,r=0,b=0;
      for(let y=0;y<H;y+=2)for(let X=0;X<W;X+=2){const i=(y*W+X)*4;if(d[i]<235||d[i+1]<235||d[i+2]<235){if(y<t)t=y;if(y>b)b=y;if(X<l)l=X;if(X>r)r=X}}
      if(r<=l){toast('Boşluk bulunamadı');return}const p=.012;box={x:Math.max(0,l/W-p),y:Math.max(0,t/H-p),w:0,h:0};box.w=Math.min(1,r/W+p)-box.x;box.h=Math.min(1,b/H+p)-box.y;place()};
    await show();
    bar('Kutuyu sürükleyerek kırpılacak alanı seç',`<button class="btn pri" id="cGo">${ic('crop')} Kırp</button>`);
    $('#cGo').onclick=async()=>{const ap=$('#cA').value;const out=await withBusy('Kırpılıyor…',async()=>{const d=await loadLib(f.bytes);d.getPages().forEach((pg,i)=>{const n=i+1;
        if(ap==='this'&&n!==cur||ap==='odd'&&n%2===0||ap==='even'&&n%2===1)return;const[W,H]=visSize(pg);const a=visToPdf(pg,box.x*W,box.y*H),c=visToPdf(pg,(box.x+box.w)*W,(box.y+box.h)*H);
        const x=Math.min(a[0],c[0]),y=Math.min(a[1],c[1]),w=Math.abs(c[0]-a[0]),h=Math.abs(c[1]-a[1]);pg.setCropBox(x,y,w,h);pg.setMediaBox(x,y,w,h)});return d.save()});
      clearBar();resultStage(body,[{name:baseName(f.name)+'_kirpilmis.pdf',data:out}],{msg:'PDF kırpıldı',again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- OCR ---------- */
const OCR={worker:null,langs:null,
  async get(langs,onProg){const key=langs.join('+');if(this.worker&&this.langs===key)return this.worker;if(this.worker){await this.worker.terminate();this.worker=null}
    await loadScript(LIB+'ocr/tesseract.min.js');const abs=p=>new URL(LIB+p,location.href).href;this._log=onProg;
    this.worker=await Tesseract.createWorker(langs,1,{workerPath:abs('ocr/worker.min.js'),corePath:abs('ocr/'),langPath:abs('ocr/lang'),gzip:true,workerBlobURL:false,logger:m=>this._log&&this._log(m)});
    this.langs=key;return this.worker},
  // Bir PDF'in metinsiz sayfalarına görünmez metin katmanı ekler
  async searchable(bytes,{langs=['tur','eng'],all=false,dpi=300,onProg}={}){const L=await pdflib();const pdf=await openPdf(bytes);const n=pdf.numPages;
    const doc=await L.PDFDocument.load(bytes,{ignoreEncryption:true});const font=await embedFont(doc);const pages=doc.getPages();let done=0,skipped=0,words=0;const allText=[];
    const w=await this.get(langs,m=>{if(m.status==='recognizing text'&&this._cur)onProg&&onProg(this._cur,m.progress)});
    for(let i=0;i<n;i++){const pg=await pdf.getPage(i+1);
      if(!all){const tc=await pg.getTextContent();const chars=tc.items.reduce((a,t)=>a+(t.str||'').trim().length,0);if(chars>30){skipped++;allText.push(tc.items.map(t=>t.str).join(' '));continue}}
      this._cur={page:i+1,total:n};onProg&&onProg(this._cur,0);
      const v1=pg.getViewport({scale:1});let sc=dpi/72;const mx=Math.max(v1.width,v1.height)*sc;if(mx>4200)sc*=4200/mx;
      const vp=pg.getViewport({scale:sc});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
      await pg.render({canvasContext:x,viewport:vp}).promise;
      const{data}=await w.recognize(c,{},{blocks:true,text:true});allText.push(data.text||'');
      const lines=[];(data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>lines.push(l))));
      const page=pages[i];const R=((page.getRotation().angle%360)+360)%360;const key=page.node.newFontDictionary('FOcr',font.ref);const a=R*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
      const ops=[L.pushGraphicsState(),L.beginText(),L.setTextRenderingMode(L.TextRenderingMode.Invisible)];
      for(const l of lines){const lh=(l.bbox.y1-l.bbox.y0)/sc;for(const wd of(l.words||[])){const t=(wd.text||'').trim();if(!t||wd.confidence<15)continue;
        const bw=(wd.bbox.x1-wd.bbox.x0)/sc;let size=Math.max(2,Math.min(lh,(wd.bbox.y1-wd.bbox.y0)/sc)*.92);
        const baseY=(l.baseline&&l.baseline.y0>0?(l.baseline.y0+(l.baseline.y1-l.baseline.y0)*((wd.bbox.x0-l.baseline.x0)/Math.max(1,l.baseline.x1-l.baseline.x0))):wd.bbox.y1-(wd.bbox.y1-wd.bbox.y0)*.2)/sc;
        const tw=font.widthOfTextAtSize(t,size)||1;const tz=Math.max(10,Math.min(400,bw/tw*100));const o=vp.convertToPdfPoint(wd.bbox.x0,baseY*sc);
        ops.push(L.setFontAndSize(key,size),L.setCharacterSqueeze(tz),L.setTextMatrix(ca,sa,-sa,ca,o[0],o[1]),L.showText(font.encodeText(t+' ')));words++}}
      ops.push(L.endText(),L.popGraphicsState());page.pushOperators(...ops);done++;pg.cleanup()}
    pdf.destroy();return{bytes:await doc.save(),done,skipped,words,text:allText.join('\n\n')}},
};
async function toolOcr(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Belge inceleniyor…',()=>openPdf(f.bytes));let noText=0;const N=Math.min(pdf.numPages,30);
    for(let i=1;i<=N;i++){const tc=await(await pdf.getPage(i)).getTextContent();if(tc.items.reduce((a,t)=>a+(t.str||'').trim().length,0)<=30)noText++}const n=pdf.numPages;pdf.destroy();
    body.innerHTML=`<div class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${ic('file','i" style="width:30px;height:30px;color:var(--ac)')}<div><b>${esc(f.name)}</b><div style="color:var(--tx2)">${n} sayfa · ${noText?`İlk ${N} sayfanın ${noText} tanesinde metin yok (taranmış görünüyor)`:'Sayfalarda zaten metin var'}</div></div></div>
      <div class="opts"><label class="fld">Belgenin dili<select id="oL"><option value="tur+eng">Türkçe + İngilizce</option><option value="tur">Türkçe</option><option value="eng">İngilizce</option></select></label>
      <label class="fld">Kalite<select id="oQ"><option value="200">Hızlı (200 dpi)</option><option value="300" selected>Önerilen (300 dpi)</option><option value="400">Yüksek (400 dpi, küçük yazılar)</option></select></label>
      <label class="fld">Sayfalar<select id="oA"><option value="0">Sadece metni olmayan sayfalar</option><option value="1">Tüm sayfalar</option></select></label></div>
      <p style="color:var(--tx2);font-size:12.5px;margin:14px 0 0">Tanıma tamamen bu cihazda yapılır. Sayfa başına birkaç saniye sürer. Görünüm değişmez; sayfanın üstüne görünmez bir metin katmanı eklenir, böylece aranabilir, seçilebilir ve kopyalanabilir olur.</p></div>`;
    bar('',`<button class="btn pri" id="oGo">${ic('ocr')} Aranabilir yap</button>`);
    $('#oGo').onclick=async()=>{const langs=$('#oL').value.split('+'),dpi=+$('#oQ').value,all=$('#oA').value==='1';clearBar();
      Busy.show('OCR motoru hazırlanıyor… (ilk seferde dil dosyası yüklenir)');let res;
      try{res=await OCR.searchable(f.bytes,{langs,dpi,all,onProg:(c,p)=>{Busy.msg(`Sayfa ${c.page} / ${c.total} tanınıyor…`);Busy.prog(((c.page-1)+p)/c.total)}})}
      catch(e){Busy.hide();console.error(e);alertBox('OCR yapılamadı',esc(errText(e)));return run(list)}Busy.hide();
      const files=[{name:baseName(f.name)+'_aranabilir.pdf',data:res.bytes}];
      resultStage(body,files,{msg:res.done?`${res.done} sayfa tanındı · ${res.words} kelime`:'Tüm sayfalarda zaten metin vardı',sourceDoc:f.id?f:null,again:start});
      const extra=document.createElement('div');extra.className='card';extra.innerHTML=`<b>Tanınan metin</b><textarea style="width:100%;height:220px;margin-top:10px;border:1px solid var(--line2);border-radius:8px;padding:10px;font:13px/1.5 inherit">${esc(res.text)}</textarea><div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="oCp">${ic('copy')} Kopyala</button><button class="btn" id="oTx">${ic('dl')} Metin dosyası (.txt)</button></div>`;
      body.appendChild(extra);$('#oCp').onclick=()=>navigator.clipboard.writeText(res.text).then(()=>toast('Kopyalandı'));$('#oTx').onclick=()=>download(res.text,baseName(f.name)+'_metin.txt','text/plain')}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Tara / Görselden PDF ---------- */
async function toolScan(t){const body=toolShell(t);let imgs=[];// {src(dataURL orijinal), rot, filter}
  const PAGE={a4:[595.28,841.89],letter:[612,792],fit:null};
  const add=async files=>{await withBusy('Görseller hazırlanıyor…',async()=>{for(const f of files){imgs.push({src:await downscale(await fileToDataURL(f),3000),rot:0,filter:'none',name:f.name})}});list()};
  const list=async()=>{if(!imgs.length)return start();
    body.innerHTML=`<div class="card opts"><label class="fld">Sayfa boyutu<select id="sP"><option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Görsel boyutunda</option></select></label>
      <label class="fld">Kenar boşluğu<select id="sM"><option value="0">Yok</option><option value="20" selected>Az</option><option value="45">Geniş</option></select></label>
      <label class="fld">Tüm sayfalara filtre<select id="sF"><option value="">— seç —</option><option value="none">Orijinal</option><option value="doc">Belge (net, gri)</option><option value="bw">Siyah-beyaz</option><option value="color">Canlı renk</option></select></label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="sO" checked> Aranabilir yap (OCR)</label></div>
      <div class="grid" id="sG">${imgs.map((m,k)=>`<div class="pcard" data-k="${k}"><div class="cv dragh"><canvas data-i="${k}"></canvas></div><div class="cap">Sayfa ${k+1}</div>
        <div class="acts"><button class="ib" data-a="rl">${ic('rotl')}</button><button class="ib" data-a="rr">${ic('rot')}</button><select data-a="f" class="zoomsel" style="height:28px;font-size:12px"><option value="none">Orijinal</option><option value="doc">Belge</option><option value="bw">S/B</option><option value="color">Canlı</option></select><button class="ib" data-a="del">${ic('trash')}</button></div></div>`).join('')}
        <div class="pcard" style="border-style:dashed;display:flex;flex-direction:column;gap:8px;justify-content:center;align-items:center;min-height:230px"><button class="btn" id="sAddI">${ic('img')} Görsel ekle</button><button class="btn" id="sCam">${ic('cam')} Kamerayla çek</button></div></div>`;
    imgs.forEach((m,k)=>{$(`select[data-a=f]`,$(`.pcard[data-k="${k}"]`)).value=m.filter;thumbImg(m,$(`canvas[data-i="${k}"]`))});
    $('#sG').onclick=e=>{const a=e.target.closest('[data-a]');if(!a||a.tagName==='SELECT')return;const k=+a.closest('.pcard').dataset.k;const m=imgs[k];
      if(a.dataset.a==='del'){imgs.splice(k,1);list()}else{m.rot=(m.rot+(a.dataset.a==='rr'?90:270))%360;thumbImg(m,$(`canvas[data-i="${k}"]`))}};
    $('#sG').onchange=e=>{if(e.target.dataset.a!=='f')return;const k=+e.target.closest('.pcard').dataset.k;imgs[k].filter=e.target.value;thumbImg(imgs[k],$(`canvas[data-i="${k}"]`))};
    $('#sF').onchange=e=>{if(!e.target.value)return;imgs.forEach(m=>m.filter=e.target.value);list()};
    $('#sAddI').onclick=async()=>add(await pickFiles({accept:'image/*',multiple:true}));$('#sCam').onclick=()=>camera(add);
    const S=await sortable();S.create($('#sG'),{animation:150,handle:'.dragh',filter:'.pcard:last-child',onEnd:e=>{const[m]=imgs.splice(e.oldIndex,1);imgs.splice(e.newIndex,0,m);list()}});
    bar(`${imgs.length} sayfa`,`<button class="btn pri" id="sGo">${ic('file')} PDF oluştur</button>`);$('#sGo').onclick=go};
  const go=async()=>{const ps=$('#sP').value,mg=+$('#sM').value,ocr=$('#sO').checked;clearBar();
    let bytes=await withBusy('PDF oluşturuluyor…',async()=>{const L=await pdflib();const doc=await L.PDFDocument.create();
      for(let k=0;k<imgs.length;k++){Busy.prog(k/imgs.length);const c=await processImg(imgs[k]);const jpg=dataUrlBytes(c.toDataURL('image/jpeg',.86));const im=await doc.embedJpg(jpg);
        let[W,H]=PAGE[ps]||[c.width*.75,c.height*.75];if(PAGE[ps]&&c.width>c.height)[W,H]=[H,W];const pg=doc.addPage([W,H]);
        const s=Math.min((W-2*mg)/im.width,(H-2*mg)/im.height);const w=im.width*s,h=im.height*s;pg.drawImage(im,{x:(W-w)/2,y:(H-h)/2,width:w,height:h})}return doc.save()});
    let msg='PDF oluşturuldu';
    if(ocr){Busy.show('OCR motoru hazırlanıyor…');try{const r=await OCR.searchable(bytes,{all:true,onProg:(c,p)=>{Busy.msg(`Sayfa ${c.page} / ${c.total} tanınıyor…`);Busy.prog(((c.page-1)+p)/c.total)}});bytes=r.bytes;msg=`PDF oluşturuldu ve aranabilir yapıldı · ${r.words} kelime`}catch(e){console.error(e);toast('OCR yapılamadı: '+errText(e),5000)}Busy.hide()}
    resultStage(body,[{name:'tarama_'+new Date().toISOString().slice(0,10)+'.pdf',data:bytes}],{msg,again:()=>{imgs=[];start()}})};
  const start=()=>{clearBar();body.innerHTML=`<div class="drop" id="sDrop" style="min-height:260px">${ic('cam','i" style="width:42px;height:42px;color:var(--ac)')}<h2>Belge tara ya da görsel ekle</h2><p>Telefon ve iPad'de arka kamera açılır; bilgisayarda web kamerası kullanılır. JPG, PNG, HEIC görselleri sürükleyip bırakabilirsin.</p>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center"><button class="btn pri" id="sCam0">${ic('cam')} Kamerayla tara</button><button class="btn" id="sImg0">${ic('img')} Görsel seç</button></div></div>`;
    $('#sImg0').onclick=async()=>add(await pickFiles({accept:'image/*',multiple:true}));$('#sCam0').onclick=()=>camera(add);dropZone($('#sDrop'),fs=>add(fs.filter(f=>/^image\//.test(f.type))))};
  start()}
async function camera(cb){const mobile=/iPhone|iPad|Android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent));
  if(mobile||!navigator.mediaDevices?.getUserMedia){const fs=await pickFiles({accept:'image/*',capture:'environment',multiple:false});if(fs.length)cb(fs);return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:2560},height:{ideal:1920}}})}catch(e){toast('Kameraya erişilemedi');const fs=await pickFiles({accept:'image/*',multiple:true});if(fs.length)cb(fs);return}
  const shots=[];const r=await modal({title:'Kamerayla tara',wide:true,ok:'Bitti',body:`<video autoplay playsinline style="width:100%;border-radius:10px;background:#000"></video><div style="display:flex;gap:10px;align-items:center"><button class="btn pri" id="cSnap">${ic('cam')} Çek</button><span id="cN" style="color:var(--tx2)">0 sayfa</span></div>`,
    onOpen:mb=>{const v=$('video',mb);v.srcObject=stream;$('#cSnap',mb).onclick=()=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);c.toBlob(b=>{shots.push(new File([b],'kamera.jpg',{type:'image/jpeg'}));$('#cN',mb).textContent=shots.length+' sayfa'},'image/jpeg',.92)}}});
  stream.getTracks().forEach(t=>t.stop());if(r&&shots.length)cb(shots)}
function downscale(src,max){return new Promise(ok=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height));if(k===1&&/^data:image\/jpeg/.test(src))return ok(src);const c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.92))};i.onerror=()=>ok(src);i.src=src})}
function loadImg(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src})}
async function processImg(m,max){const i=await loadImg(m.src);let w=i.width,h=i.height;const k=max?Math.min(1,max/Math.max(w,h)):1;w*=k;h*=k;const c=document.createElement('canvas');const sw=m.rot%180;c.width=sw?h:w;c.height=sw?w:h;const x=c.getContext('2d');
  x.translate(c.width/2,c.height/2);x.rotate(m.rot*Math.PI/180);x.drawImage(i,-w/2,-h/2,w,h);x.setTransform(1,0,0,1,0,0);
  if(m.filter!=='none'){const d=x.getImageData(0,0,c.width,c.height),p=d.data;
    if(m.filter==='color'){for(let j=0;j<p.length;j+=4)for(let q=0;q<3;q++)p[j+q]=Math.max(0,Math.min(255,(p[j+q]-128)*1.25+140))}
    else{// Belge modu: arka planı beyazlat, yazıyı koyulaştır (yerel ortalamaya göre)
      const g=new Float32Array(c.width*c.height);for(let j=0,n=0;j<p.length;j+=4,n++)g[n]=p[j]*.299+p[j+1]*.587+p[j+2]*.114;
      const bg=boxBlur(g,c.width,c.height,Math.max(8,Math.round(Math.max(c.width,c.height)/40)));
      for(let n=0,j=0;n<g.length;n++,j+=4){let v=g[n]/Math.max(1,bg[n])*255;v=m.filter==='bw'?(v>200?255:0):Math.max(0,Math.min(255,(v-40)*1.25));p[j]=p[j+1]=p[j+2]=v}}
    x.putImageData(d,0,0)}return c}
function boxBlur(src,w,h,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length);
  for(let y=0;y<h;y++){let s=0;const o=y*w;for(let x=-r;x<=r;x++)s+=src[o+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){tmp[o+x]=s/(2*r+1);s+=src[o+Math.min(w-1,x+r+1)]-src[o+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/(2*r+1);s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x]}}return out}
async function thumbImg(m,canvas){const c=await processImg(m,500);canvas.width=c.width;canvas.height=c.height;canvas.getContext('2d').drawImage(c,0,0)}

/* ---------- PDF → görsel ---------- */
async function toolPdf2img(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Hazırlanıyor…',()=>openPdf(f.bytes));const n=pdf.numPages;
    body.innerHTML=`<div class="card opts"><label class="fld">Biçim<select id="iF"><option value="jpg">JPG</option><option value="png">PNG</option></select></label>
      <label class="fld">Çözünürlük<select id="iD"><option value="96">Ekran (96 dpi)</option><option value="150" selected>Normal (150 dpi)</option><option value="300">Baskı (300 dpi)</option></select></label>
      <label class="fld">Sayfalar<input type="text" id="iR" value="1-${n}"></label></div><p style="color:var(--tx2)">${esc(f.name)} · ${n} sayfa</p>`;
    bar('',`<button class="btn pri" id="iGo">${ic('img')} Görsele çevir</button>`);
    $('#iGo').onclick=async()=>{const fmt=$('#iF').value,dpi=+$('#iD').value,idx=parseRanges($('#iR').value,n);if(!idx||!idx.length){alertBox('Aralık hatalı','Örn. 1-3, 5');return}
      const files=await withBusy('Görseller oluşturuluyor…',async()=>{const out=[];for(let k=0;k<idx.length;k++){Busy.prog(k/idx.length);Busy.msg(`Sayfa ${idx[k]+1} çevriliyor…`);const pg=await pdf.getPage(idx[k]+1);const vp=pg.getViewport({scale:dpi/72});
        const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;
        const b=await new Promise(ok=>c.toBlob(ok,fmt==='png'?'image/png':'image/jpeg',.9));out.push({name:`${baseName(f.name)}_s${String(idx[k]+1).padStart(String(n).length,'0')}.${fmt}`,data:new Uint8Array(await b.arrayBuffer()),zip:baseName(f.name)+'_gorseller'});pg.cleanup()}return out});
      clearBar();resultStage(body,files,{msg:`${files.length} görsel hazır`,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Sayfa numarası ---------- */
async function toolPagenum(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Hazırlanıyor…',()=>openPdf(f.bytes));const n=pdf.numPages;let pos='bc';
    body.innerHTML=`<div class="card" style="display:flex;gap:26px;flex-wrap:wrap"><div><div class="fld" style="margin-bottom:6px">Konum</div><div id="nPos" style="display:grid;grid-template-columns:repeat(3,44px);gap:6px">${['tl','tc','tr','ml','mc','mr','bl','bc','br'].map(p=>`<button class="ib" data-p="${p}" style="border:1px solid var(--line2);${p[0]==='m'?'visibility:hidden':''}">•</button>`).join('')}</div></div>
      <div class="opts" style="flex:1"><label class="fld">Biçim<select id="nFmt"><option value="{n}">1</option><option value="{n} / {t}">1 / ${n}</option><option value="Sayfa {n}">Sayfa 1</option><option value="Sayfa {n} / {t}">Sayfa 1 / ${n}</option><option value="- {n} -">- 1 -</option></select></label>
      <label class="fld">Başlangıç numarası<input type="number" id="nStart" value="1"></label><label class="fld">Sayfalar<input type="text" id="nR" value="1-${n}"></label>
      <label class="fld">Yazı boyutu<input type="number" id="nSize" value="11" min="5" max="48"></label><label class="fld">Kenar boşluğu<input type="number" id="nMg" value="28" min="0" max="150"></label>
      <label class="fld">Renk<input type="color" id="nCol" value="#333333" style="height:34px;width:60px;border:1px solid var(--line2);border-radius:8px"></label></div></div>
      <div class="card" style="text-align:center"><canvas id="nPrev" style="box-shadow:var(--sh);max-width:100%"></canvas></div>`;
    const mark=()=>$$('#nPos [data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===pos));mark();
    const pg1=await pdf.getPage(1);const pc=$('#nPrev');await renderTo(pc,pg1,380);const base=pc.getContext('2d').getImageData(0,0,pc.width,pc.height);
    const prev=()=>{const x=pc.getContext('2d');x.putImageData(base,0,0);const k=pc.width/pg1.getViewport({scale:1}).width;const sz=+$('#nSize').value*k,mg=+$('#nMg').value*k;
      const txt=$('#nFmt').value.replace('{n}',$('#nStart').value).replace('{t}',n);x.font=`${sz}px Arial`;x.fillStyle=$('#nCol').value;const w=x.measureText(txt).width;
      const X=pos[1]==='l'?mg:pos[1]==='r'?pc.width-mg-w:(pc.width-w)/2,Y=pos[0]==='t'?mg+sz:pc.height-mg;x.fillText(txt,X,Y)};
    $('#nPos').onclick=e=>{const b=e.target.closest('[data-p]');if(b){pos=b.dataset.p;mark();prev()}};$$('.card input,.card select',body).forEach(i=>i.oninput=prev);prev();
    bar('',`<button class="btn pri" id="nGo">${ic('num')} Numara ekle</button>`);
    $('#nGo').onclick=async()=>{const idx=parseRanges($('#nR').value,n);if(!idx){alertBox('Aralık hatalı','Örn. 2-'+n);return}const set=new Set(idx);
      const out=await withBusy('Numaralar ekleniyor…',async()=>{const L=await pdflib();const d=await loadLib(f.bytes);const font=await embedFont(d);const size=+$('#nSize').value,mg=+$('#nMg').value,fmt=$('#nFmt').value,col=L.rgb(...hexRgb($('#nCol').value));let num=+$('#nStart').value;
        d.getPages().forEach((pg,i)=>{if(!set.has(i))return;const txt=fmt.replace('{n}',num++).replace('{t}',n);const[W,H]=visSize(pg);const w=font.widthOfTextAtSize(txt,size);
          const vx=pos[1]==='l'?mg:pos[1]==='r'?W-mg-w:(W-w)/2,vy=pos[0]==='t'?mg+size*.8:H-mg;const o=visToPdf(pg,vx,vy);pg.drawText(txt,{x:o[0],y:o[1],size,font,color:col,rotate:L.degrees(pg.getRotation().angle)})});return d.save()});
      clearBar();resultStage(body,[{name:baseName(f.name)+'_numarali.pdf',data:out}],{msg:'Sayfa numaraları eklendi',sourceDoc:f.id?f:null,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Filigran ---------- */
async function toolWatermark(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Hazırlanıyor…',()=>openPdf(f.bytes));const n=pdf.numPages;let kind='text',img=null;
    body.innerHTML=`<div class="card"><div class="seg" id="wK"><button data-k="text" class="on">Yazı</button><button data-k="img">Görsel</button></div>
      <div class="opts" style="margin-top:14px"><label class="fld" id="wTf">Yazı<input type="text" id="wT" value="GİZLİ" style="min-width:240px"></label><span id="wIf" class="hide"><button class="btn" id="wI">${ic('img')} Görsel seç</button></span>
      <label class="fld">Boyut<input type="range" id="wS" min="10" max="200" value="72"></label><label class="fld">Saydamlık<input type="range" id="wO" min="5" max="100" value="22"></label>
      <label class="fld">Açı<select id="wA"><option value="45">45°</option><option value="0">0°</option><option value="-45">-45°</option><option value="90">90°</option></select></label>
      <label class="fld">Yerleşim<select id="wL"><option value="c">Ortada tek</option><option value="tile">Döşeli (tekrar)</option></select></label>
      <label class="fld">Renk<input type="color" id="wC" value="#c53030" style="height:34px;width:60px;border:1px solid var(--line2);border-radius:8px"></label><label class="fld">Sayfalar<input type="text" id="wR" value="1-${n}"></label></div></div>
      <div class="card" style="text-align:center"><canvas id="wP" style="box-shadow:var(--sh);max-width:100%"></canvas></div>`;
    const pg1=await pdf.getPage(1);const pc=$('#wP');await renderTo(pc,pg1,380);const base=pc.getContext('2d').getImageData(0,0,pc.width,pc.height);const k0=pc.width/pg1.getViewport({scale:1}).width;
    const spots=(W,H,w,h)=>{if($('#wL').value==='c')return[[W/2,H/2]];const out=[];const sx=w*.8+50,sy=h*2.6+40;let row=0;for(let y=-sy/2;y<H+sy;y+=sy,row++)for(let x=-sx+(row%2?sx/2:0);x<W+sx;x+=sx)out.push([x,y]);return out};
    const prev=()=>{const x=pc.getContext('2d');x.putImageData(base,0,0);x.save();x.globalAlpha=$('#wO').value/100;const a=-$('#wA').value*Math.PI/180,sz=$('#wS').value*k0;
      if(kind==='text'){x.font=`bold ${sz}px Arial`;x.fillStyle=$('#wC').value;x.textAlign='center';x.textBaseline='middle';const t=$('#wT').value,w=x.measureText(t).width;
        spots(pc.width,pc.height,w,sz).forEach(([X,Y])=>{x.save();x.translate(X,Y);x.rotate(a);x.fillText(t,0,0);x.restore()})}
      else if(img){const w=sz*3,h=w*img.height/img.width;spots(pc.width,pc.height,w,h/3).forEach(([X,Y])=>{x.save();x.translate(X,Y);x.rotate(a);x.drawImage(img,-w/2,-h/2,w,h);x.restore()})}x.restore()};
    $$('#wK button').forEach(b=>b.onclick=()=>{kind=b.dataset.k;$$('#wK button').forEach(q=>q.classList.toggle('on',q===b));$('#wTf').classList.toggle('hide',kind!=='text');$('#wIf').classList.toggle('hide',kind==='text');prev()});
    $('#wI').onclick=async()=>{const[fl]=await pickFiles({accept:'image/png,image/jpeg'});if(!fl)return;let d=await fileToDataURL(fl);if(!/^data:image\/(png|jpeg)/.test(d))d=await toPng(d);img=await loadImg(d);img.data=d;prev()};
    $('#wL').addEventListener('change',e=>{$('#wS').value=e.target.value==='tile'?36:72;prev()});
    $$('.card input,.card select',body).forEach(i=>i.oninput=prev);prev();
    bar('',`<button class="btn pri" id="wGo">${ic('wm')} Filigran ekle</button>`);
    $('#wGo').onclick=async()=>{if(kind==='img'&&!img){toast('Önce görsel seç');return}const idx=parseRanges($('#wR').value,n);if(!idx){alertBox('Aralık hatalı','Örn. 1-'+n);return}const set=new Set(idx);
      const out=await withBusy('Filigran ekleniyor…',async()=>{const L=await pdflib();const d=await loadLib(f.bytes);const op=$('#wO').value/100,ang=+$('#wA').value,sz=+$('#wS').value;
        const font=kind==='text'?await embedFont(d,true):null;const im=kind==='img'?(/png/.test(img.data.slice(0,15))?await d.embedPng(dataUrlBytes(img.data)):await d.embedJpg(dataUrlBytes(img.data))):null;const col=L.rgb(...hexRgb($('#wC').value)),t=$('#wT').value;
        d.getPages().forEach((pg,i)=>{if(!set.has(i))return;const[W,H]=visSize(pg);const R=pg.getRotation().angle;
          let w,h;if(font){w=font.widthOfTextAtSize(t,sz);h=sz}else{w=sz*3;h=w*im.height/im.width}
          spots(W,H,w,font?h:h/3).forEach(([X,Y])=>{// merkez etrafında döndür: sol-alt köşeyi hesapla (görsel koordinatlarda, y aşağı)
            const a=ang*Math.PI/180,ox=-w/2,oy=font?h*.35:h/2;const vx=X+ox*Math.cos(a)+oy*Math.sin(a),vy=Y-ox*Math.sin(a)+oy*Math.cos(a);const o=visToPdf(pg,vx,vy);
            if(font)pg.drawText(t,{x:o[0],y:o[1],size:sz,font,color:col,opacity:op,rotate:L.degrees(ang+R)});else pg.drawImage(im,{x:o[0],y:o[1],width:w,height:h,opacity:op,rotate:L.degrees(ang+R)})})});return d.save()});
      clearBar();resultStage(body,[{name:baseName(f.name)+'_filigranli.pdf',data:out}],{msg:'Filigran eklendi',sourceDoc:f.id?f:null,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ---------- Okuyucuya yönlendiren araçlar ---------- */
async function toolOpenIn(t,tool){const body=toolShell(t);pickStage(body,{},async list=>{const f=list[0];const rec=f.id?{id:f.id}:await withBusy('Ekleniyor…',()=>Docs.add(f.name,f.bytes));sessionStorage.setItem('pdfTool',tool);location.hash='#/oku/'+rec.id})}

const RUN={merge:toolMerge,split:toolSplit,organize:toolOrganize,rotate:toolRotate,crop:toolCrop,ocr:toolOcr,scan:toolScan,pdf2img:toolPdf2img,pagenum:toolPagenum,watermark:toolWatermark,
  edit:t=>toolOpenIn(t,'text'),sign:t=>toolOpenIn(t,'sign')};
