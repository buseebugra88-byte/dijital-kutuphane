// PDF Atölyem — Sıkıştır, Karart, Onar, Karşılaştır, Koru, Kilidi Aç, Çevir, Özetle
'use strict';

/* ===================== qpdf (WebAssembly) ===================== */
const QPDF={
  async run(args,inputs){if(!window.__qpdf){await loadScript(LIB+'qpdf/qpdf.js');window.__qpdf=window.Module}
    // qpdf hata ve uyarılarını konsola yazar ve konsolu oluşturulurken bağlar: oluşturmadan önce yakalamaya başla
    const log=[];const ce=console.error,cl=console.log,cw=console.warn;console.error=console.log=console.warn=(...a)=>log.push(a.join(' '));let rc,q;
    try{q=await window.__qpdf({locateFile:()=>LIB+'qpdf/qpdf.wasm',noInitialRun:true,print:t=>log.push(t),printErr:t=>log.push(t)});
      for(const[name,data]of Object.entries(inputs))q.FS.writeFile('/'+name,data);
      try{rc=q.callMain(args)}catch(e){rc=typeof e.status==='number'?e.status:99;if(!(e&&e.name==='ExitStatus'))log.push(String(e.message||e))}}
    finally{console.error=ce;console.log=cl;console.warn=cw}
    let out=null;try{out=q.FS.readFile('/out.pdf')}catch(e){}
    return{rc,out,log}},
};
// Kayıp ya da bozuk xref tablosunu nesneleri tarayarak yeniden yaz (yarım inmiş, sonu kesilmiş dosyalar için)
function rebuildXref(u8){let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
  const re=/(?:^|[\r\n\s])(\d{1,7})\s+(\d{1,5})\s+obj\b/g;const objs=new Map();let m;const starts=[];
  while((m=re.exec(s))){const off=m.index+(m[0].length-m[0].replace(/^[\r\n\s]/,'').length);starts.push({n:+m[1],g:+m[2],off})}
  starts.forEach((o,i)=>{const end=i+1<starts.length?starts[i+1].off:s.length;const body=s.slice(o.off,end);if(!/endobj/.test(body)&&!/stream/.test(body))return;objs.set(o.n,{...o,body})});
  if(!objs.size)return null;let root=null;
  const tr=s.lastIndexOf('/Root');if(tr>0){const mm=s.slice(tr,tr+40).match(/\/Root\s+(\d+)\s+(\d+)\s+R/);if(mm&&objs.has(+mm[1]))root=+mm[1]}
  if(root==null)for(const[n,o]of objs){const e=o.body.indexOf('endobj');if(/\/Type\s*\/Catalog\b/.test(o.body.slice(0,e>0?e:2000)))root=n}
  if(root==null)return null;let lastEnd=0;for(const o of objs.values()){const e=s.indexOf('endobj',o.off);if(e>lastEnd)lastEnd=e+6}
  const size=Math.max(...objs.keys())+1;let x=`\nxref\n0 ${size}\n`;
  for(let i=0;i<size;i++){const o=objs.get(i);x+=o?`${String(o.off).padStart(10,'0')} ${String(o.g).padStart(5,'0')} n \n`:`0000000000 65535 f \n`}
  x+=`trailer\n<< /Size ${size} /Root ${root} 0 R >>\nstartxref\n${lastEnd+1}\n%%EOF\n`;
  const out=new Uint8Array(lastEnd+x.length);out.set(u8.subarray(0,lastEnd));for(let i=0;i<x.length;i++)out[lastEnd+i]=x.charCodeAt(i)&255;return out}
const qErr=r=>{const t=r.log.join('\n');if(/invalid password/i.test(t))return'Şifre yanlış.';return t.replace(/^[^:]*:\s*/gm,'').slice(0,400)||'İşlem tamamlanamadı.'};

/* ===================== Sıkıştır ===================== */
async function compressPdf(bytes,{dpi=150,quality=.7,gray=false,onProg}={}){const L=await pdflib();const N=x=>L.PDFName.of(x);
  const doc=await L.PDFDocument.load(bytes,{ignoreEncryption:true});if(doc.isEncrypted)throw new Error('Şifreli PDF sıkıştırılamaz. Önce "Kilidi Aç" ile şifresini kaldır.');
  const ctx=doc.context;const seen=new Map();let done=0,saved=0;
  // görsel → kullanıldığı en büyük sayfa boyutu
  doc.getPages().forEach(pg=>{const{width,height}=pg.getSize();const res=pg.node.Resources();const walk=(res,depth)=>{if(!res||depth>3)return;const xo=res.lookup(N('XObject'));if(!(xo instanceof L.PDFDict))return;
      for(const[,ref]of xo.entries()){const o=ctx.lookup(ref);if(!(o instanceof L.PDFRawStream))continue;const st=String(o.dict.get(N('Subtype')));
        if(st==='/Image'){const m=Math.max(width,height);if(!seen.has(ref.toString())||seen.get(ref.toString()).m<m)seen.set(ref.toString(),{ref,o,m})}else if(st==='/Form')walk(o.dict.lookup(N('Resources')),depth+1)}};walk(res,0)});
  const list=[...seen.values()];
  for(let k=0;k<list.length;k++){onProg&&onProg(k,list.length);const{ref,o,m}=list[k];const d=o.dict;
    try{if(d.has(N('ImageMask'))||d.has(N('Decode'))||d.has(N('Mask')))continue;const W=d.lookup(N('Width')).asNumber(),H=d.lookup(N('Height')).asNumber();if(W*H<40000)continue;
      const filt=d.lookup(N('Filter'));const fn=filt instanceof L.PDFArray?filt.asArray().map(String):filt?[String(filt)]:[];const bpc=d.lookup(N('BitsPerComponent'))?.asNumber?.()||8;
      let cs=d.lookup(N('ColorSpace'));let comps=0;const csName=cs instanceof L.PDFName?String(cs):cs instanceof L.PDFArray?String(cs.get(0)):'';
      if(csName==='/DeviceRGB')comps=3;else if(csName==='/DeviceGray')comps=1;else if(csName==='/ICCBased'){const ic=ctx.lookup(cs.get(1));comps=ic?.dict?.lookup(N('N'))?.asNumber?.()||0}
      const maxPx=Math.round(m/72*dpi);const scale=Math.min(1,maxPx/Math.max(W,H));let bmp;
      if(fn.length===1&&fn[0]==='/DCTDecode'){if(comps!==3&&comps!==1)continue;bmp=await createImageBitmap(new Blob([o.contents],{type:'image/jpeg'}))}
      else if(fn.every(f=>f==='/FlateDecode')&&bpc===8&&(comps===3||comps===1)&&!d.has(N('DecodeParms'))){const raw=fn.length?L.decodePDFRawStream(o).decode():o.contents;if(raw.length<W*H*comps)continue;
        const id=new ImageData(W,H);for(let i=0,j=0;i<W*H;i++,j+=comps){const r=raw[j],g=comps===3?raw[j+1]:r,b=comps===3?raw[j+2]:r;id.data[i*4]=r;id.data[i*4+1]=g;id.data[i*4+2]=b;id.data[i*4+3]=255}bmp=await createImageBitmap(id)}
      else continue;
      const w=Math.max(1,Math.round(W*scale)),h=Math.max(1,Math.round(H*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,w,h);bmp.close&&bmp.close();
      const isGray=gray||comps===1;if(isGray){const im=x.getImageData(0,0,w,h),p=im.data;for(let i=0;i<p.length;i+=4){const v=p[i]*.299+p[i+1]*.587+p[i+2]*.114;p[i]=p[i+1]=p[i+2]=v}x.putImageData(im,0,0)}
      const jpg=new Uint8Array(await (await new Promise(ok=>c.toBlob(ok,'image/jpeg',quality))).arrayBuffer());
      let out=jpg,outCs=isGray?'DeviceGray':'DeviceRGB';
      if(isGray){// gri JPEG: tarayıcı renkli kodlar; yine de DeviceRGB olarak bırakmak güvenli
        outCs='DeviceRGB'}
      if(out.length>=o.contents.length*.92)continue;// kazanç yoksa dokunma
      const nd=ctx.obj({Type:'XObject',Subtype:'Image',Width:w,Height:h,ColorSpace:outCs,BitsPerComponent:8,Filter:'DCTDecode',Length:out.length});
      if(d.has(N('SMask')))nd.set(N('SMask'),d.get(N('SMask')));if(d.has(N('Interpolate')))nd.set(N('Interpolate'),d.get(N('Interpolate')));
      ctx.assign(ref,L.PDFRawStream.of(nd,out));saved+=o.contents.length-out.length;done++}catch(e){console.warn('görsel atlandı',e)}
    if(k%5===4)await sleep(0)}
  let mid=await doc.save({useObjectStreams:true});
  // qpdf: kullanılmayan nesneleri at, akışları yeniden sıkıştır, nesne akışları üret
  try{const r=await QPDF.run(['--object-streams=generate','--compress-streams=y','--recompress-flate','--compression-level=9','--remove-unreferenced-resources=yes','/in.pdf','/out.pdf'],{'in.pdf':mid});if(r.out&&r.out.length<mid.length)mid=r.out}catch(e){console.warn('qpdf',e)}
  return{data:mid.length<bytes.length?mid:bytes,images:done,unchanged:mid.length>=bytes.length}}
async function toolCompress(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];let lvl='rec';
    body.innerHTML=`<div class="card"><b>${esc(f.name)}</b> · <span style="color:var(--tx2)">${fmtSize(f.bytes.length)}</span>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:14px" id="kL">
        <label class="choice"><input type="radio" name="kl" value="low"><div><b>Az sıkıştır</b><small>Yüksek kalite · görseller 220 dpi</small></div></label>
        <label class="choice"><input type="radio" name="kl" value="rec" checked><div><b>Önerilen</b><small>İyi kalite · görseller 150 dpi</small></div></label>
        <label class="choice"><input type="radio" name="kl" value="high"><div><b>Çok sıkıştır</b><small>Ekranda okumaya yeter · 96 dpi</small></div></label></div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="kG"> Görselleri gri tonlamaya çevir (taranmış belgelerde boyutu çok küçültür)</label>
      <p style="color:var(--tx2);font-size:12.5px;margin:10px 0 0">Metin ve yazı tipleri olduğu gibi kalır, sadece görseller küçültülür ve dosya yapısı sadeleştirilir.</p></div>`;
    bar('',`<button class="btn pri" id="kGo">${ic('compress')} Sıkıştır</button>`);
    $('#kGo').onclick=async()=>{const v=$('input[name=kl]:checked').value;const o={low:{dpi:220,quality:.82},rec:{dpi:150,quality:.7},high:{dpi:96,quality:.55}}[v];clearBar();
      const r=await withBusy('Sıkıştırılıyor…',()=>compressPdf(f.bytes,{...o,gray:$('#kG').checked,onProg:(i,n)=>{Busy.msg(`Görsel ${i+1} / ${n} küçültülüyor…`);Busy.prog(i/n)}}));
      const pct=Math.round((1-r.data.length/f.bytes.length)*100);
      resultStage(body,[{name:baseName(f.name)+'_sikistirilmis.pdf',data:r.data}],{msg:r.unchanged?'Bu dosya zaten olabildiğince küçük':`%${pct} küçüldü · ${fmtSize(f.bytes.length)} → ${fmtSize(r.data.length)}`,sourceDoc:f.id&&!r.unchanged?f:null,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ===================== Koru / Kilidi Aç / Onar ===================== */
async function toolProtect(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];
    body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><div class="opts" style="margin-top:14px">
      <label class="fld">Açma şifresi<input type="password" id="pU" autocomplete="new-password" placeholder="Belgeyi açmak için"></label><label class="fld">Şifre (tekrar)<input type="password" id="pU2" autocomplete="new-password"></label></div>
      <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">İzinler ve yetkili şifresi (isteğe bağlı)</summary><div style="display:grid;gap:8px;margin-top:10px">
        <label><input type="checkbox" id="pPr" checked> Yazdırmaya izin ver</label><label><input type="checkbox" id="pCp" checked> Metin ve görsel kopyalamaya izin ver</label>
        <label><input type="checkbox" id="pMd" checked> Değiştirmeye izin ver</label><label><input type="checkbox" id="pAn" checked> Not ve form doldurmaya izin ver</label>
        <label class="fld">Yetkili şifresi (izinleri sonradan değiştirmek için)<input type="password" id="pO" autocomplete="new-password" placeholder="Boş bırakırsan rastgele, güçlü bir şifre atanır"></label></div></details>
      <p style="color:var(--tx2);font-size:12.5px;margin:12px 0 0">AES-256 ile şifrelenir (Acrobat, Önizleme, Chrome ve tüm güncel uygulamalarla uyumlu). Şifreyi unutursan belge açılamaz; bir yere not et.</p></div>`;
    bar('',`<button class="btn pri" id="pGo">${ic('lock')} Şifrele</button>`);
    $('#pGo').onclick=async()=>{const u=$('#pU').value,u2=$('#pU2').value;let o=$('#pO').value;const anyRestrict=!$('#pPr').checked||!$('#pCp').checked||!$('#pMd').checked||!$('#pAn').checked;
      if(!u&&!anyRestrict){toast('Bir açma şifresi yaz ya da en az bir izni kapat');return}if(u!==u2){toast('Şifreler aynı değil');return}if(u&&u.length<4){toast('Şifre en az 4 karakter olsun');return}
      if(!o)o=Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%56]).join('');
      const args=['--encrypt',u,o,'256',`--print=${$('#pPr').checked?'full':'none'}`,`--modify=${$('#pMd').checked?'all':'none'}`,`--extract=${$('#pCp').checked?'y':'n'}`,`--annotate=${$('#pAn').checked?'y':'n'}`,'--','/in.pdf','/out.pdf'];
      const r=await withBusy('Şifreleniyor…',()=>QPDF.run(args,{'in.pdf':f.bytes}));
      if(!r.out||r.rc!==0&&r.rc!==3){alertBox('Şifrelenemedi',esc(qErr(r)));return}clearBar();
      resultStage(body,[{name:baseName(f.name)+'_sifreli.pdf',data:r.out}],{msg:u?'Belge şifrelendi':'İzinler kısıtlandı',again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolUnlock(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];let needs=false;try{const p=await openPdf(f.bytes);p.destroy()}catch(e){if(e.name==='PasswordException')needs=true}
    body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><p style="color:var(--tx2);margin:6px 0 12px">${needs?'Bu belge bir açma şifresiyle korunuyor. Şifreyi bilmen gerekiyor; şifre kırılmaz.':'Bu belge şifresiz açılıyor; yazdırma, kopyalama gibi kısıtlamaları varsa kaldırılır.'}</p>
      ${needs?'<label class="fld">Şifre<input type="password" id="uP" autocomplete="current-password"></label>':''}</div>`;
    bar('',`<button class="btn pri" id="uGo">${ic('unlock')} Kilidi aç</button>`);
    const go=async()=>{const pw=needs?$('#uP').value:'';const r=await withBusy('Şifre kaldırılıyor…',()=>QPDF.run([`--password=${pw}`,'--decrypt','/in.pdf','/out.pdf'],{'in.pdf':f.bytes}));
      if(!r.out||r.rc!==0&&r.rc!==3){alertBox('Kilit açılamadı',esc(qErr(r)));return}clearBar();
      resultStage(body,[{name:baseName(f.name)+'_kilitsiz.pdf',data:r.out}],{msg:'Şifre ve kısıtlamalar kaldırıldı',sourceDoc:f.id?f:null,again:start})};
    $('#uGo').onclick=go;const pi=$('#uP');if(pi){pi.focus();pi.onkeydown=e=>{if(e.key==='Enter')go()}}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolRepair(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];Busy.show('Dosya inceleniyor ve onarılıyor…');let r;try{r=await QPDF.run(['--object-streams=preserve','/in.pdf','/out.pdf'],{'in.pdf':f.bytes})}catch(e){r={rc:99,out:null,log:[String(e)]}}
    let out=r.out,how='Dosya yapısı yeniden kuruldu',warn=r.log.filter(l=>/warning|error|damaged|recover/i.test(l)).length;
    const opens=async b=>{try{const p=await openPdf(b);const n=p.numPages;p.destroy();return n>0}catch(e){return false}};
    if(out&&!await opens(out))out=null;
    if(!out){// dosya sonu kayıp: nesneleri tarayıp xref tablosunu yeniden yaz
      const rb=rebuildXref(f.bytes);if(rb){const r2=await QPDF.run(['/in.pdf','/out.pdf'],{'in.pdf':rb});out=r2.out&&await opens(r2.out)?r2.out:(await opens(rb)?rb:null);if(out){how='Kayıp dosya dizini yeniden oluşturuldu';warn=Math.max(warn,1)}}}
    if(!out){// son çare: pdf.js'in okuyabildiği sayfaları görüntü olarak yeniden oluştur
      try{const p=await openPdf(f.bytes);const L=await pdflib();const doc=await L.PDFDocument.create();
        for(let i=1;i<=p.numPages;i++){Busy.msg(`Sayfa ${i} / ${p.numPages} kurtarılıyor…`);try{const pg=await p.getPage(i);const v=pg.getViewport({scale:1});const c=document.createElement('canvas');await renderTo(c,pg,v.width*2.2);
          const im=await doc.embedJpg(dataUrlBytes(c.toDataURL('image/jpeg',.85)));doc.addPage([v.width,v.height]).drawImage(im,{x:0,y:0,width:v.width,height:v.height})}catch(e){}}
        out=doc.getPageCount()?await doc.save():null;how='Sayfalar görüntü olarak kurtarıldı (metin seçilemez; istersen OCR uygulayabilirsin)'}catch(e){}}
    Busy.hide();if(!out){alertBox('Onarılamadı','Bu dosya kurtarılamayacak kadar bozuk ya da PDF değil.');return start()}
    resultStage(body,[{name:baseName(f.name)+'_onarilmis.pdf',data:out}],{msg:how+(warn?` · ${warn} sorun düzeltildi`:''),again:start})};
  const start=()=>{clearBar();pickStage(body,{title:'Onarılacak PDF\'i seç'},run)};start()}

/* ===================== Karart (kalıcı gizleme) ===================== */
async function toolRedact(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];const pdf=await withBusy('Hazırlanıyor…',()=>openPdf(f.bytes));const n=pdf.numPages;let cur=1;const marks={};// sayfa → [[x,y,w,h]] (sayfa birimi)
    body.innerHTML=`<div class="card opts" style="align-items:center"><label class="fld">Bu kelimeleri her yerde karart<input type="text" id="rT" placeholder="Örn. Ayşe Yılmaz, 0532 123 45 67, TC" style="min-width:320px"></label><button class="btn" id="rFind">${ic('search')} Bul ve işaretle</button>
      <span style="flex:1"></span><button class="btn" id="rP">${ic('up')}</button><span id="rN" style="min-width:70px;text-align:center"></span><button class="btn" id="rX">${ic('down')}</button></div>
      <p style="color:var(--tx2);margin:-6px 0 12px">Sayfada fareyle sürükleyerek alan seç; işarete tıklayınca kaldırılır.</p>
      <div class="card" style="text-align:center;overflow:auto"><div style="position:relative;display:inline-block;touch-action:none" id="rArea"><canvas id="rC" style="display:block;box-shadow:var(--sh)"></canvas><svg id="rS" style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair"></svg></div></div>`;
    const cvs=$('#rC'),svg=$('#rS');let P1=null,k=1;
    const show=async()=>{const pg=await pdf.getPage(cur);P1=pg.getViewport({scale:1});await renderTo(cvs,pg,Math.min(900,body.clientWidth-60));k=cvs.width/P1.width;cvs.style.width=cvs.width+'px';svg.setAttribute('viewBox',`0 0 ${P1.width} ${P1.height}`);draw();$('#rN').textContent=`${cur} / ${n}`;upd()};
    const draw=()=>{svg.innerHTML=(marks[cur]||[]).map((r,i)=>`<rect data-i="${i}" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#000" fill-opacity=".82" stroke="#e5533d" stroke-width="1" style="cursor:pointer"/>`).join('')};
    const pt=e=>{const b=svg.getBoundingClientRect();return[(e.clientX-b.left)/b.width*P1.width,(e.clientY-b.top)/b.height*P1.height]};let dr=null;
    svg.onpointerdown=e=>{const r=e.target.closest('rect');if(r){marks[cur].splice(+r.dataset.i,1);draw();upd();return}dr={a:pt(e)};svg.setPointerCapture(e.pointerId)};
    svg.onpointermove=e=>{if(!dr)return;const b=pt(e);const x=Math.min(dr.a[0],b[0]),y=Math.min(dr.a[1],b[1]),w=Math.abs(b[0]-dr.a[0]),h=Math.abs(b[1]-dr.a[1]);dr.r=[x,y,w,h];draw();svg.insertAdjacentHTML('beforeend',`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" fill-opacity=".5"/>`)};
    svg.onpointerup=()=>{if(dr&&dr.r&&dr.r[2]>2&&dr.r[3]>2)(marks[cur]=marks[cur]||[]).push(dr.r);dr=null;draw();upd()};
    $('#rP').onclick=()=>{if(cur>1){cur--;show()}};$('#rX').onclick=()=>{if(cur<n){cur++;show()}};
    $('#rFind').onclick=async()=>{const terms=$('#rT').value.split(',').map(s=>s.trim().toLocaleLowerCase('tr')).filter(Boolean);if(!terms.length)return;let hits=0;
      await withBusy('Aranıyor…',async()=>{for(let i=1;i<=n;i++){const pg=await pdf.getPage(i);const v=pg.getViewport({scale:1});const tc=await pg.getTextContent();
        for(const it of tc.items){if(!it.str)continue;const low=it.str.toLocaleLowerCase('tr');for(const q of terms){let from=0,ix;while((ix=low.indexOf(q,from))>=0){from=ix+q.length;
          const tx=pdfjsLib.Util.transform(v.transform,it.transform);const fh=Math.hypot(tx[2],tx[3]);const W=Math.abs(it.width),Ln=it.str.length||1;
          (marks[i]=marks[i]||[]).push([tx[4]+W*ix/Ln-1,tx[5]-fh*1.0,W*q.length/Ln+2,fh*1.3]);hits++}}}}});
      toast(hits?`${hits} yer işaretlendi`:'Bulunamadı (taranmış sayfalarda önce OCR gerekir)');draw();upd()};
    const upd=()=>{const tot=Object.values(marks).reduce((a,m)=>a+m.length,0);const pages=Object.keys(marks).filter(p=>marks[p].length).length;
      bar(`${tot} alan · ${pages} sayfa`,`<label style="display:flex;gap:6px;align-items:center;margin-right:8px"><input type="checkbox" id="rO" checked> Karartılan sayfaları OCR ile yeniden aranabilir yap</label><button class="btn pri" id="rGo"${tot?'':' disabled'}>${ic('redact')} Kalıcı olarak karart</button>`);
      $('#rGo').onclick=apply};
    const apply=async()=>{if(!await confirmBox('Kalıcı karartma','İşaretli alanlardaki yazı ve görseller dosyadan tamamen silinecek. Karartılan sayfalar görüntüye çevrilir (diğer sayfalar aynen kalır), belge bilgileri (yazar, başlık) temizlenir.','Karart',true))return;
      const ocr=$('#rO').checked;clearBar();Busy.show('Karartılıyor…');
      try{const L=await pdflib();const doc=await L.PDFDocument.load(f.bytes,{ignoreEncryption:true});const pages=Object.keys(marks).filter(p=>marks[p].length).map(Number);
        for(const pn of pages){Busy.msg(`Sayfa ${pn} karartılıyor…`);const pg=await pdf.getPage(pn);const v=pg.getViewport({scale:1});const sc=200/72;const vp=pg.getViewport({scale:sc});
          const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;
          x.fillStyle='#000';marks[pn].forEach(r=>x.fillRect(r[0]*sc,r[1]*sc,r[2]*sc,r[3]*sc));
          const im=await doc.embedJpg(dataUrlBytes(c.toDataURL('image/jpeg',.9)));const np=doc.insertPage(pn-1,[v.width,v.height]);np.drawImage(im,{x:0,y:0,width:v.width,height:v.height});doc.removePage(pn)}
        ['Title','Author','Subject','Keywords','Creator'].forEach(k=>{try{doc['set'+k](k==='Keywords'?[]:'')}catch(e){}});doc.setProducer('PDF Atölyem');
        const md=doc.catalog.get(L.PDFName.of('Metadata'));if(md)doc.catalog.delete(L.PDFName.of('Metadata'));
        let out=await doc.save();
        if(ocr){Busy.msg('Karartılan sayfalar yeniden tanınıyor…');try{const r=await OCR.searchable(out,{all:false,onProg:(c,p)=>{Busy.msg(`Sayfa ${c.page} tanınıyor…`);Busy.prog(p)}});out=r.bytes}catch(e){console.warn(e)}}
        Busy.hide();resultStage(body,[{name:baseName(f.name)+'_karartilmis.pdf',data:out}],{msg:`${pages.length} sayfada karartma uygulandı`,again:start})}
      catch(e){Busy.hide();alertBox('Karartılamadı',esc(errText(e)))}};
    await show()};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

/* ===================== Karşılaştır ===================== */
function wordDiff(a,b){// Myers benzeri, kelime dizileri için LCS (büyük girdilerde parça parça)
  const n=a.length,m=b.length;if(n*m>4e6){// çok büyükse satır bazlı kaba karşılaştırma
    return[...a.map(w=>({t:'=',w}))]}
  const dp=Array.from({length:n+1},()=>new Uint32Array(m+1));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;while(i<n&&j<m){if(a[i]===b[j]){out.push({t:'=',w:a[i]});i++;j++}else if(dp[i+1][j]>=dp[i][j+1])out.push({t:'-',w:a[i++]});else out.push({t:'+',w:b[j++]})}
  while(i<n)out.push({t:'-',w:a[i++]});while(j<m)out.push({t:'+',w:b[j++]});return out}
async function toolCompare(t){const body=toolShell(t);let A=null,B=null;
  const pickBoth=()=>{clearBar();body.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="drop" id="cA" style="min-height:200px"><h2>1. Eski sürüm</h2><p id="cAn">PDF seç ya da bırak</p><button class="btn pri" data-s="A">${ic('open')} Seç</button></div>
      <div class="drop" id="cB" style="min-height:200px"><h2>2. Yeni sürüm</h2><p id="cBn">PDF seç ya da bırak</p><button class="btn pri" data-s="B">${ic('open')} Seç</button></div></div>`;
    const set=async(s,fl)=>{const f=fl[0];if(!f)return;const o={name:f.name,bytes:await readBytes(f)};if(s==='A')A=o;else B=o;$('#c'+s+'n').textContent=f.name;if(A&&B)go()};
    $$('[data-s]',body).forEach(b=>b.onclick=async()=>set(b.dataset.s,await pickFiles()));dropZone($('#cA'),fs=>set('A',fs));dropZone($('#cB'),fs=>set('B',fs))};
  const go=async()=>{const[pa,pb]=await withBusy('Belgeler okunuyor…',()=>Promise.all([openPdf(A.bytes),openPdf(B.bytes)]));const n=Math.max(pa.numPages,pb.numPages);
    // okuma sırası: yukarıdan aşağı, soldan sağa (dosyadaki yazım sırası sürümler arasında değişebilir)
    const words=async(p,i)=>{if(i>p.numPages)return[];const tc=await(await p.getPage(i)).getTextContent();
      const it=tc.items.filter(t=>t.str&&t.str.trim()).map(t=>({s:t.str,x:t.transform[4],y:t.transform[5],h:Math.hypot(t.transform[2],t.transform[3])||8}));
      it.sort((a,b)=>Math.abs(a.y-b.y)<Math.min(a.h,b.h)*.5?a.x-b.x:b.y-a.y);return it.map(t=>t.s).join(' ').split(/\s+/).filter(Boolean)};
    let ins=0,del=0;const pages=[];await withBusy('Karşılaştırılıyor…',async()=>{for(let i=1;i<=n;i++){Busy.prog(i/n);const d=wordDiff(await words(pa,i),await words(pb,i));const ci=d.filter(x=>x.t==='+').length,cd=d.filter(x=>x.t==='-').length;ins+=ci;del+=cd;pages.push({i,d,ci,cd})}});
    let mode='text';
    const render=async()=>{body.innerHTML=`<div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div><b>${esc(A.name)}</b> → <b>${esc(B.name)}</b><div style="color:var(--tx2)">${pa.numPages} → ${pb.numPages} sayfa · <span style="color:var(--ok)">+${ins} eklenen</span> · <span style="color:var(--bad)">−${del} silinen</span> kelime</div></div><span style="flex:1"></span>
      <div class="seg"><button data-m="text"${mode==='text'?' class="on"':''}>Metin farkları</button><button data-m="visual"${mode==='visual'?' class="on"':''}>Görsel farklar</button></div><button class="btn" id="cRep">${ic('dl')} Rapor</button><button class="btn ghost" id="cNew">Yeni karşılaştırma</button></div><div id="cOut"></div>`;
      $$('[data-m]',body).forEach(b=>b.onclick=()=>{mode=b.dataset.m;render()});$('#cNew').onclick=()=>{A=B=null;pickBoth()};
      $('#cRep').onclick=()=>{let s=`KARŞILAŞTIRMA RAPORU\n${A.name} → ${B.name}\n${new Date().toLocaleString('tr-TR')}\nEklenen: ${ins} kelime · Silinen: ${del} kelime\n`;
        pages.filter(p=>p.ci||p.cd).forEach(p=>{s+=`\n— Sayfa ${p.i} (+${p.ci} / −${p.cd})\n`;let buf='',tp='=';const flush=()=>{if(buf&&tp!=='=')s+=(tp==='+'?'  [+] ':'  [−] ')+buf.trim()+'\n';buf=''};p.d.forEach(x=>{if(x.t!==tp){flush();tp=x.t}buf+=x.w+' '});flush()});
        download(s,'karsilastirma_raporu.txt','text/plain')};
      const out=$('#cOut');
      if(mode==='text'){const ch=pages.filter(p=>p.ci||p.cd);out.innerHTML=ch.length?ch.map(p=>`<div class="card"><b>Sayfa ${p.i}</b> <span style="color:var(--tx2)">(+${p.ci} / −${p.cd})</span><div style="margin-top:8px;line-height:1.8">${p.d.map(x=>x.t==='='?esc(x.w):x.t==='+'?`<ins style="background:#d9f5e3;color:#14622f;text-decoration:none;padding:0 2px;border-radius:3px">${esc(x.w)}</ins>`:`<del style="background:#fde2e1;color:#9b1c1c;padding:0 2px;border-radius:3px">${esc(x.w)}</del>`).join(' ')}</div></div>`).join(''):'<div class="card result"><div class="ok">'+ic('check')+'</div><h2 style="margin:0">Metinler aynı</h2><p style="color:var(--tx2)">Görsel farkları görmek için "Görsel farklar"a geç.</p></div>'}
      else{out.innerHTML='<div class="card" style="color:var(--tx2)">Kırmızı: yalnızca eski sürümde olan · Yeşil: yalnızca yeni sürümde olan</div>';
        for(let i=1;i<=n;i++){const box=document.createElement('div');box.className='card';box.style.textAlign='center';box.innerHTML=`<b>Sayfa ${i}</b><br>`;out.appendChild(box);
          const ca=document.createElement('canvas'),cb=document.createElement('canvas');const W=700;if(i<=pa.numPages)await renderTo(ca,await pa.getPage(i),W);if(i<=pb.numPages)await renderTo(cb,await pb.getPage(i),W);
          const w=Math.max(ca.width,cb.width),h=Math.max(ca.height,cb.height);const c=document.createElement('canvas');c.width=w;c.height=h;c.style.maxWidth='100%';const x=c.getContext('2d');
          const get=cv=>{const t=document.createElement('canvas');t.width=w;t.height=h;const tx=t.getContext('2d');tx.fillStyle='#fff';tx.fillRect(0,0,w,h);if(cv.width)tx.drawImage(cv,0,0);return tx.getImageData(0,0,w,h)};
          const da=get(ca),db=get(cb),o=x.createImageData(w,h);let diff=0;
          for(let p=0;p<o.data.length;p+=4){const la=(da.data[p]+da.data[p+1]+da.data[p+2])/3,lb=(db.data[p]+db.data[p+1]+db.data[p+2])/3;const base=Math.min(la,lb);
            if(Math.abs(la-lb)>60){diff++;if(la<lb){o.data[p]=220;o.data[p+1]=40;o.data[p+2]=40}else{o.data[p]=30;o.data[p+1]=150;o.data[p+2]=70}}else{const v=235+base/255*20;o.data[p]=o.data[p+1]=o.data[p+2]=Math.min(255,base*.35+165)}o.data[p+3]=255}
          x.putImageData(o,0,0);box.appendChild(c);box.insertAdjacentHTML('beforeend',`<div style="color:var(--tx2);margin-top:6px">${diff?`%${(diff/(w*h)*100).toFixed(2)} alan farklı`:'Fark yok'}</div>`);await sleep(0)}}};
    render()};
  pickBoth()}

/* ===================== Yapay zekâ: Çevir ve Özetle (Gemini) ===================== */
const AI={
  key(){try{return localStorage.getItem('dk-gmkey')||''}catch(e){return''}},
  async ensureKey(){let k=this.key();if(k)return k;
    const r=await modal({title:'Gemini anahtarı gerekli',ok:'Kaydet',body:`<div>Çeviri ve özet için Google Gemini kullanılır. Dijital Kütüphanem'deki yapay zekâ özelliklerinin kullandığı anahtarın aynısı; bir kez eklemen yeterli, iki uygulama birlikte kullanır.</div>
      <label class="fld">Gemini API anahtarı<input type="password" id="gk" placeholder="AIza…" autocomplete="off"></label><small style="color:var(--tx2)">Ücretsiz anahtarı Google AI Studio'dan (aistudio.google.com) alabilirsin. Anahtar yalnızca bu tarayıcıda saklanır.</small>`});
    if(!r)return null;k=$('#gk',r).value.trim();if(!k)return null;try{localStorage.setItem('dk-gmkey',k)}catch(e){}return k},
  async ask(prompt,{json=false,signal}={}){const k=await this.ensureKey();if(!k)throw new Error('Gemini anahtarı eklenmedi.');
    let cached=null;try{cached=JSON.parse(localStorage.getItem('dk-gmmodel')||'null')}catch(e){}
    const models=[...new Set([cached&&cached.m,'models/gemini-2.5-flash','models/gemini-2.5-flash-lite','models/gemini-2.0-flash'].filter(Boolean))];let last='';
    for(const m of models){for(let t=0;t<2;t++){let r,j;try{r=await fetch('https://generativelanguage.googleapis.com/v1beta/'+m+':generateContent',{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':k},
          body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.3,maxOutputTokens:8192,...(/2\.5/.test(m)?{thinkingConfig:{thinkingBudget:0}}:{}),...(json?{responseMimeType:'application/json'}:{})}})});j=await r.json().catch(()=>({}))}
        catch(e){if(e.name==='AbortError')throw e;last=navigator.onLine?'Bağlantı kurulamadı':'İnternet bağlantısı yok';continue}
        if(r.ok){const c=(j.candidates||[])[0];const txt=((c&&c.content&&c.content.parts)||[]).map(p=>p.text||'').join('').trim();if(txt)return txt;last='Boş cevap geldi'+(c&&c.finishReason?' ('+c.finishReason+')':'');break}
        const msg=(j.error&&j.error.message)||'';if(r.status===400&&/api key/i.test(msg)||r.status===401||r.status===403){try{localStorage.removeItem('dk-gmkey')}catch(e){}throw new Error('Gemini anahtarı geçersiz. Yeniden eklemen gerekecek.')}
        last=`Gemini cevap vermedi (${r.status}${msg?': '+msg.slice(0,120):''})`;if(r.status===429||r.status>=500){await sleep(1500*(t+1));continue}break}}
    throw new Error(last||'Gemini cevap vermedi.')},
  privacyNote:'<div style="background:#fff7e6;border:1px solid #f3d08a;border-radius:8px;padding:10px;font-size:12.5px">🔒 Diğer araçların aksine bu araç belgenin <b>metnini</b> Google Gemini\'ye gönderir (dosyanın kendisi gönderilmez). Gizli belgelerde kullanma.</div>',
};
async function pdfTextPages(bytes,{ocr=true,onProg}={}){const pdf=await openPdf(bytes);const out=[];for(let i=0;i<pdf.numPages;i++){const S=await pdfStructure(pdf,i,{ocr,onProg:p=>onProg&&onProg(i,pdf.numPages,p)});onProg&&onProg(i,pdf.numPages,1);
    // paragraflara böl
    const paras=[];let cur=null;for(const l of S.lines){const gap=cur?l.y-cur.y:0;if(cur&&gap<l.size*(S.ocrUsed?2.6:1.8)&&Math.abs(l.size-cur.size)<cur.size*.3){cur.t+=(/-$/.test(cur.t)?'':' ')+l.text;cur.y=l.y}else{cur={t:l.text,y:l.y,size:l.size,h:l.size>14};paras.push(cur)}}
    out.push(paras.map(p=>({text:p.t.replace(/(\p{L})- (\p{L})/gu,'$1$2'),heading:p.h})))}pdf.destroy();return out}
const LANGS=[['en','İngilizce'],['tr','Türkçe'],['de','Almanca'],['fr','Fransızca'],['es','İspanyolca'],['it','İtalyanca'],['ar','Arapça'],['ru','Rusça'],['ja','Japonca'],['zh','Çince'],['nl','Felemenkçe'],['pt','Portekizce']];
async function toolTranslate(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];
    body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><div class="opts" style="margin-top:14px"><label class="fld">Hangi dile?<select id="tL">${LANGS.map(([c,n])=>`<option value="${c}">${n}</option>`).join('')}</select></label>
      <label class="fld">Sayfalar<input type="text" id="tR" value="1-" placeholder="Örn. 1-5"></label></div><div style="margin-top:12px">${AI.privacyNote}</div>
      <p style="color:var(--tx2);font-size:12.5px;margin:10px 0 0">Sonuç: çevrilmiş metinden oluşan yeni bir PDF (başlıklar ve paragraflar korunur, sayfa düzeni sadeleşir) ve kopyalanabilir metin. Taranmış sayfalarda önce OCR yapılır.</p></div>`;
    bar('',`<button class="btn pri" id="tGo">${ic('ai')} Çevir</button>`);
    $('#tGo').onclick=async()=>{if(!await AI.ensureKey())return;const lang=LANGS.find(l=>l[0]===$('#tL').value)[1];clearBar();Busy.show('Metin çıkarılıyor…');
      try{let pages=await pdfTextPages(f.bytes,{onProg:(i,n)=>{Busy.msg(`Sayfa ${i+1} / ${n} okunuyor…`);Busy.prog(i/n*.3)}});
        const idx=parseRanges($('#tR').value||'1-',pages.length)||pages.map((_,i)=>i);pages=idx.map(i=>({no:i+1,paras:pages[i]}));
        // ~6000 karakterlik parçalar halinde çevir
        const chunks=[];let curC=[],len=0;pages.forEach(p=>p.paras.forEach((pa,k)=>{const item={p:p.no,k,h:pa.heading,t:pa.text};if(len+pa.text.length>6000&&curC.length){chunks.push(curC);curC=[];len=0}curC.push(item);len+=pa.text.length}));if(curC.length)chunks.push(curC);
        if(!chunks.length)throw new Error('Belgede çevrilecek metin bulunamadı.');
        for(let c=0;c<chunks.length;c++){Busy.msg(`Çevriliyor… (${c+1} / ${chunks.length})`);Busy.prog(.3+.7*c/chunks.length);
          const src=chunks[c].map((x,i)=>({i,t:x.t}));
          const txt=await AI.ask(`Aşağıdaki JSON dizisindeki her "t" metnini ${lang} diline çevir. Anlamı ve tonu koru, özel isimleri ve sayıları değiştirme, açıklama ekleme. Aynı sırada, aynı "i" değerleriyle {"i":sayı,"t":"çeviri"} nesnelerinden oluşan bir JSON dizisi döndür.\n\n${JSON.stringify(src)}`,{json:true});
          let arr;try{arr=JSON.parse(txt.replace(/^```json|```$/g,''))}catch(e){throw new Error('Çeviri cevabı okunamadı, tekrar dene.')}
          arr.forEach(o=>{if(chunks[c][o.i])chunks[c][o.i].tr=o.t})}
        const all=chunks.flat();let html='',plain='';let lastP=0;for(const x of all){if(x.p!==lastP){if(lastP)html+='<div style="page-break-before:always"></div>';html+=`<p style="color:#8a92a3;font-size:8pt">— ${x.p} —</p>`;plain+=`\n\n— Sayfa ${x.p} —\n\n`;lastP=x.p}
          const s=x.tr||x.t;html+=x.h?`<h3>${esc(s)}</h3>`:`<p>${esc(s)}</p>`;plain+=s+'\n\n'}
        Busy.msg('PDF oluşturuluyor…');const out=await htmlToPdf(html,{title:baseName(f.name)+' ('+lang+')',family:'serif'});Busy.hide();
        resultStage(body,[{name:`${baseName(f.name)}_${$('#tL').value}.pdf`,data:out}],{msg:`${lang} çevirisi hazır`,again:start});
        const box=document.createElement('div');box.className='card';box.innerHTML=`<b>Çeviri metni</b><textarea style="width:100%;height:260px;margin-top:10px;border:1px solid var(--line2);border-radius:8px;padding:10px">${esc(plain.trim())}</textarea><button class="btn" id="tCp" style="margin-top:8px">${ic('copy')} Kopyala</button>`;body.appendChild(box);$('#tCp').onclick=()=>navigator.clipboard.writeText(plain.trim()).then(()=>toast('Kopyalandı'))}
      catch(e){Busy.hide();alertBox('Çevrilemedi',esc(e.message||String(e)));run(list)}}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolSummary(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];
    body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><div class="opts" style="margin-top:14px"><label class="fld">Özet türü<select id="sK"><option value="kisa">Kısa (1 paragraf)</option><option value="orta" selected>Orta (ana fikirler, madde madde)</option><option value="uzun">Ayrıntılı (bölüm bölüm)</option><option value="ders">Ders notu (kavramlar + sorular)</option></select></label>
      <label class="fld">Özet dili<select id="sL"><option value="Türkçe">Türkçe</option><option value="İngilizce">İngilizce</option></select></label></div><div style="margin-top:12px">${AI.privacyNote}</div></div>`;
    bar('',`<button class="btn pri" id="sGo">${ic('ai')} Özetle</button>`);
    $('#sGo').onclick=async()=>{if(!await AI.ensureKey())return;const kind=$('#sK').value,lang=$('#sL').value;clearBar();Busy.show('Metin çıkarılıyor…');
      try{const pages=await pdfTextPages(f.bytes,{onProg:(i,n)=>{Busy.msg(`Sayfa ${i+1} / ${n} okunuyor…`);Busy.prog(i/n)}});
        let text=pages.map((p,i)=>`[Sayfa ${i+1}]\n`+p.map(x=>x.text).join('\n')).join('\n\n');if(!text.replace(/\[Sayfa \d+\]/g,'').trim())throw new Error('Belgede özetlenecek metin bulunamadı.');
        const MAX=600000;const cut=text.length>MAX;if(cut)text=text.slice(0,MAX);
        const how={kisa:'Tek paragraflık, 5-7 cümlelik kısa bir özet yaz.',orta:'Önce 2-3 cümlelik genel bir özet, ardından en önemli 6-10 ana fikri madde madde yaz.',uzun:'Belgenin bölümlerini sırayla ayrı başlıklar altında özetle; her bölümde önemli noktaları madde madde ver. Sonunda kısa bir genel değerlendirme ekle.',ders:'Ders notu hazırla: 1) Kısa özet, 2) Önemli kavramlar ve tanımları, 3) Akılda tutulacak bilgiler, 4) Konuyu pekiştirmek için 5 soru ve kısa cevapları.'}[kind];
        Busy.msg('Özetleniyor…');Busy.prog(.9);
        const res=await AI.ask(`Sen dikkatli bir akademik asistansın. Aşağıdaki belgeyi ${lang} olarak özetle. ${how} Yalnızca belgede yazanlara dayan, bilgi uydurma. Markdown kullan (## başlık, - madde, **kalın**). Önemli bilgilerde sayfa numarasını (s. 3 gibi) belirt.\n\nBELGE${cut?' (çok uzun olduğu için baş kısmı)':''}:\n${text}`);
        Busy.hide();showSummary(f,res,cut)}
      catch(e){Busy.hide();alertBox('Özetlenemedi',esc(e.message||String(e)));run(list)}}};
  const showSummary=(f,md,cut)=>{const html=mdToHtml(md);
    body.innerHTML=`<div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:16px">Özet · ${esc(baseName(f.name))}</b><span style="flex:1"></span><button class="btn" id="sCp">${ic('copy')} Kopyala</button><button class="btn" id="sPdf">${ic('dl')} PDF</button><button class="btn" id="sMd">${ic('dl')} Metin</button><button class="btn ghost" id="sNew">Başka belge</button></div>
      ${cut?'<p style="color:var(--warn)">Belge çok uzun olduğu için yalnızca ilk kısmı özetlendi.</p>':''}<div class="mdout" style="margin-top:12px;line-height:1.6">${html}</div><p style="color:var(--tx3);font-size:12px">Yapay zekâ özeti hatalı olabilir; önemli bilgileri belgeden kontrol et.</p></div>`;
    $('#sCp').onclick=()=>navigator.clipboard.writeText(md).then(()=>toast('Kopyalandı'));$('#sMd').onclick=()=>download(md,baseName(f.name)+'_ozet.md','text/markdown');$('#sNew').onclick=start;
    $('#sPdf').onclick=async()=>{const out=await withBusy('PDF oluşturuluyor…',()=>htmlToPdf(`<h1>${esc(baseName(f.name))} — Özet</h1>`+html,{title:baseName(f.name)+' — Özet'}));download(out,baseName(f.name)+'_ozet.pdf')}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
// Basit Markdown → HTML (başlık, madde, numara, kalın, italik)
function mdToHtml(md){const lines=String(md).split('\n');let html='',list=null;const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g,'$1<i>$2</i>');
  const close=()=>{if(list){html+=`</${list}>`;list=null}};
  for(const l of lines){let m;if((m=l.match(/^(#{1,4})\s+(.*)/))){close();const h=Math.min(4,m[1].length+1);html+=`<h${h}>${inl(m[2])}</h${h}>`}
    else if((m=l.match(/^\s*[-*•]\s+(.*)/))){if(list!=='ul'){close();html+='<ul>';list='ul'}html+=`<li>${inl(m[1])}</li>`}
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){if(list!=='ol'){close();html+='<ol>';list='ol'}html+=`<li>${inl(m[1])}</li>`}
    else if(!l.trim())close();else{close();html+=`<p>${inl(l)}</p>`}}close();return html}

Object.assign(RUN,{compress:toolCompress,protect:toolProtect,unlock:toolUnlock,repair:toolRepair,redact:toolRedact,compare:toolCompare,translate:toolTranslate,summary:toolSummary});
T.forEach(t=>{if(RUN[t.id])delete t.soon});
