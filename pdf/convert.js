// PDF Atölyem — dönüştürmeler: Word / Excel / PowerPoint / HTML → PDF, PDF → Word / Excel / PowerPoint, PDF/A
'use strict';
const CONV=LIB+'conv/';
async function libMammoth(){if(!window.mammoth)await loadScript(CONV+'mammoth.browser.min.js');return window.mammoth}
async function libXLSX(){if(!window.XLSX)await loadScript(CONV+'xlsx.full.min.js');return window.XLSX}
async function libFflate(){if(!window.fflate)await loadScript(CONV+'fflate.min.js');return window.fflate}
const SUBST={'₺':'TL','€':'EUR','₹':'Rs','→':'->','←':'<-','✓':'v','✔':'v','✗':'x','★':'*','☆':'*','\u00a0':' ','\u200b':'','\ufeff':''};
const PAGE_SIZES={a4:[595.28,841.89],letter:[612,792],a3:[841.89,1190.55]};
const xmlEsc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
function cssColor(v){if(!v)return null;v=v.trim().toLowerCase();const named={black:'#000000',white:'#ffffff',red:'#c00000',blue:'#1f4fd1',green:'#1f8a4c',gray:'#808080',grey:'#808080'};if(named[v])return named[v];
  let m=v.match(/^#([0-9a-f]{3})$/);if(m)return'#'+m[1].split('').map(c=>c+c).join('');if(/^#[0-9a-f]{6}$/.test(v))return v;
  m=v.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);if(m)return'#'+[m[1],m[2],m[3]].map(x=>(+x).toString(16).padStart(2,'0')).join('');return null}

/* =====================================================================
   HTML → PDF yerleşim motoru (pdf-lib ile gerçek, seçilebilir metin)
   Desteklenen: başlıklar, paragraflar, kalın/italik/altı çizili/üstü çizili, renk, bağlantı, kod,
   madde ve numaralı listeler (iç içe), alıntı, yatay çizgi, satır sonu, tablolar (başlık satırı tekrar eder), görseller, sayfa sonu.
   ===================================================================== */
class Layout{
  constructor(doc,{size='a4',landscape=false,margin=56,base=11,family='sans'}={}){let[w,h]=PAGE_SIZES[size]||PAGE_SIZES.a4;if(landscape)[w,h]=[h,w];
    Object.assign(this,{doc,W:w,H:h,M:margin,base,family,page:null,y:0,fonts:{},imgs:{}});this.CW=w-2*margin}
  async font(r){const fam=r.mono?'mono':(r.family||this.family);const k=fam+(r.bold?'b':'')+(r.italic?'i':'');return this.fonts[k]||(this.fonts[k]=await embedFont(this.doc,!!r.bold,fam,!!r.italic))}
  newPage(){this.page=this.doc.addPage([this.W,this.H]);this.y=this.M;return this.page}
  ensure(h){if(!this.page)this.newPage();if(this.y+h>this.H-this.M&&this.y>this.M+1)this.newPage()}
  col(c){return PDFLib.rgb(...hexRgb(c||'#1d2330'))}
  // Satırlara böl: runs → [{items:[{text,run,w,font,size}],w,h,asc}]
  safe(f,t){const cs=f.__cs||(f.__cs=new Set(f.getCharacterSet?f.getCharacterSet():[]));if(!cs.size)return t;let o='';for(const ch of t){const c=ch.codePointAt(0);if(cs.has(c)||c<32)o+=ch;else o+=SUBST[ch]??(/\p{Extended_Pictographic}/u.test(ch)?'':'?')}return o}
  async lines(runs,width,baseSize){const L=[];let cur={items:[],w:0,h:0};const push=()=>{L.push(cur);cur={items:[],w:0,h:0}};
    for(const r of runs){const size=r.size||baseSize;const f=await this.font(r);
      if(r.br){cur.h=Math.max(cur.h,size*1.3);push();continue}
      const parts=this.safe(f,String(r.text)).replace(/\s+/g,' ').split(/(\s)/).filter(x=>x!=='');
      for(let p of parts){if(p===' '&&!cur.items.length)continue;let w=f.widthOfTextAtSize(p,size);
        if(cur.w+w>width&&p!==' '&&cur.items.length){while(cur.items.length&&cur.items[cur.items.length-1].text===' '){cur.w-=cur.items.pop().w}push()}
        if(p===' '&&!cur.items.length)continue;
        while(w>width&&p.length>1){// çok uzun kelimeyi böl
          let k=p.length;while(k>1&&f.widthOfTextAtSize(p.slice(0,k),size)>width-cur.w)k--;const a=p.slice(0,k);cur.items.push({text:a,run:r,font:f,size,w:f.widthOfTextAtSize(a,size)});cur.w+=cur.items[cur.items.length-1].w;cur.h=Math.max(cur.h,size*1.3);push();p=p.slice(k);w=f.widthOfTextAtSize(p,size)}
        cur.items.push({text:p,run:r,font:f,size,w});cur.w+=w;cur.h=Math.max(cur.h,size*1.32)}}
    if(cur.items.length||!L.length)push();L.forEach(l=>{if(!l.h)l.h=baseSize*1.32});return L}
  drawLine(l,x,y,width,align){const pg=this.page;let dx=align==='center'?(width-l.w)/2:align==='right'?width-l.w:0;let cx=x+dx;const base=y+l.h*.78;
    for(const it of l.items){const r=it.run;if(it.text!==' '){pg.drawText(it.text,{x:cx,y:this.H-base,size:it.size,font:it.font,color:this.col(r.color||(r.link?'#1f4fd1':null))});}
      if(r.underline||r.link)pg.drawLine({start:{x:cx,y:this.H-base-it.size*.12},end:{x:cx+it.w,y:this.H-base-it.size*.12},thickness:Math.max(.5,it.size*.06),color:this.col(r.color||(r.link?'#1f4fd1':null))});
      if(r.strike)pg.drawLine({start:{x:cx,y:this.H-base+it.size*.28},end:{x:cx+it.w,y:this.H-base+it.size*.28},thickness:Math.max(.5,it.size*.06),color:this.col(r.color)});
      if(r.bg)pg.drawRectangle({x:cx,y:this.H-y-l.h,width:it.w,height:l.h,color:this.col(r.bg),opacity:.35});
      cx+=it.w}}
  async para(runs,{size,indent=0,align='left',before=0,after=6,marker=null,bg=null,border=null}){size=size||this.base;const x=this.M+indent,w=this.CW-indent;if(!runs.some(r=>r.br||String(r.text).trim()))return;
    const lines=await this.lines(runs,w,size);this.ensure(before+lines[0].h);this.y+=before;
    const startY=this.y,startPage=this.page;
    lines.forEach((l,i)=>{this.ensure(l.h);if(i===0&&marker){const f=l.items[0]?.font;if(f)this.page.drawText(marker,{x:x-(f.widthOfTextAtSize(marker,size)+5),y:this.H-(this.y+l.h*.78),size,font:f,color:this.col('#1d2330')})}
      if(border&&this.page===startPage)this.page.drawRectangle({x:x-10,y:this.H-this.y-l.h,width:2.5,height:l.h,color:this.col(border)});
      this.drawLine(l,x,this.y,w,align);this.y+=l.h});this.y+=after}
  hr(){this.ensure(12);this.y+=6;this.page.drawLine({start:{x:this.M,y:this.H-this.y},end:{x:this.W-this.M,y:this.H-this.y},thickness:.8,color:this.col('#b8bcc6')});this.y+=8}
  async image(src,maxW){try{let im=this.imgs[src];if(!im){let data=src;if(!/^data:image\/(png|jpe?g)/i.test(data))data=await toPng(src);const bytes=dataUrlBytes(data);im=this.imgs[src]=/^data:image\/png/i.test(data)?await this.doc.embedPng(bytes):await this.doc.embedJpg(bytes)}
      let w=Math.min(maxW||im.width*.75,this.CW),h=im.height*w/im.width;const maxH=this.H-2*this.M;if(h>maxH){w*=maxH/h;h=maxH}
      this.ensure(h+6);this.page.drawImage(im,{x:this.M,y:this.H-this.y-h,width:w,height:h});this.y+=h+8}catch(e){console.warn('görsel atlandı',e)}}
  // Tablo: rows = [{cells:[runs[]], header:bool}]
  async table(rows,{size,zebra=true,fit=true}={}){size=size||this.base*.92;if(!rows.length)return;const ncol=Math.max(...rows.map(r=>r.cells.length));if(!ncol)return;const pad=4;
    // doğal genişlikler
    const nat=new Array(ncol).fill(20);
    for(const r of rows)for(let c=0;c<r.cells.length;c++){let w=0;for(const run of r.cells[c]){if(run.br)continue;const f=await this.font({...run,bold:run.bold||r.header});w+=f.widthOfTextAtSize(String(run.text).replace(/\s+/g,' '),size)}nat[c]=Math.max(nat[c],Math.min(w+2*pad,this.CW*.6))}
    let tot=nat.reduce((a,b)=>a+b,0);let k=1;
    if(fit&&tot>this.CW){// sığmıyorsa önce yazıyı küçült, sonra sütunları daralt
      const shrink=Math.max(.6,this.CW/tot);if(shrink<1){size*=shrink;for(let c=0;c<ncol;c++)nat[c]*=shrink;tot=nat.reduce((a,b)=>a+b,0)}}
    k=tot>this.CW||tot<this.CW*.6?this.CW/tot:1;const cw=nat.map(w=>w*k);
    const layoutRow=async r=>{const cells=[];let h=0;for(let c=0;c<ncol;c++){const runs=(r.cells[c]||[]).map(x=>({...x,bold:x.bold||r.header}));const ls=await this.lines(runs.length?runs:[{text:''}],cw[c]-2*pad,size);const ch=ls.reduce((a,l)=>a+l.h,0)+2*pad;cells.push({ls,align:r.align?.[c]});h=Math.max(h,ch)}return{cells,h,header:r.header}};
    const header=rows[0].header?await layoutRow(rows[0]):null;
    const drawRow=(R,zi)=>{let x=this.M;const top=this.y;const pg=this.page;
      if(R.header)pg.drawRectangle({x:this.M,y:this.H-top-R.h,width:cw.reduce((a,b)=>a+b,0),height:R.h,color:this.col('#e8ecf6')});
      else if(zebra&&zi%2)pg.drawRectangle({x:this.M,y:this.H-top-R.h,width:cw.reduce((a,b)=>a+b,0),height:R.h,color:this.col('#f6f7fa')});
      R.cells.forEach((c,i)=>{let yy=top+pad;for(const l of c.ls){this.drawLine(l,x+pad,yy,cw[i]-2*pad,c.align);yy+=l.h}
        pg.drawRectangle({x,y:this.H-top-R.h,width:cw[i],height:R.h,borderColor:this.col('#c3c8d2'),borderWidth:.5});x+=cw[i]});this.y+=R.h};
    let zi=0;for(let i=0;i<rows.length;i++){const R=i===0&&header?header:await layoutRow(rows[i]);
      if(!this.page)this.newPage();if(this.y+R.h>this.H-this.M&&this.y>this.M+1){this.newPage();if(header&&i>0)drawRow(header,0)}drawRow(R,zi++)}
    this.y+=8}
}
// HTML öğelerini yerleşim motoruna aktar
async function htmlToPdf(html,opt={}){const L=await pdflib();const doc=await L.PDFDocument.create();const lay=new Layout(doc,opt);lay.newPage();
  const dom=new DOMParser().parseFromString(html,'text/html');const B=lay.base;
  const HS={h1:2,h2:1.6,h3:1.35,h4:1.15,h5:1,h6:.95};
  const styleOf=(el,r)=>{const s=el.getAttribute&&el.getAttribute('style')||'';const o={...r};
    const t=el.tagName&&el.tagName.toLowerCase();if(t==='b'||t==='strong'||t==='th')o.bold=true;if(t==='i'||t==='em'||t==='cite')o.italic=true;if(t==='u'||t==='ins')o.underline=true;if(t==='s'||t==='strike'||t==='del')o.strike=true;
    if(t==='code'||t==='kbd'||t==='samp'||t==='tt')o.mono=true;if(t==='a'&&el.getAttribute('href'))o.link=el.getAttribute('href');if(t==='mark')o.bg='#ffd400';if(t==='small')o.size=(o.size||B)*.85;
    let m;if((m=s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i))){const c=cssColor(m[1]);if(c)o.color=c}
    if((m=s.match(/background(?:-color)?\s*:\s*([^;]+)/i))){const c=cssColor(m[1]);if(c&&c!=='#ffffff')o.bg=c}
    if(/font-weight\s*:\s*(bold|[6-9]00)/i.test(s))o.bold=true;if(/font-style\s*:\s*italic/i.test(s))o.italic=true;if(/text-decoration[^;]*underline/i.test(s))o.underline=true;if(/text-decoration[^;]*line-through/i.test(s))o.strike=true;
    if((m=s.match(/font-size\s*:\s*([\d.]+)\s*(pt|px)/i)))o.size=+m[1]*(m[2].toLowerCase()==='px'?.75:1);
    if(/font-family\s*:[^;]*(courier|mono|consolas)/i.test(s))o.mono=true;else if(/font-family\s*:[^;]*(times|georgia|serif)(?![-\w]*sans)/i.test(s))o.family='serif';else if(/font-family\s*:[^;]*(arial|helvetica|calibri|sans)/i.test(s))o.family='sans';
    return o};
  const alignOf=el=>{const s=(el.getAttribute&&el.getAttribute('style'))||'';const a=(el.getAttribute&&el.getAttribute('align'))||'';const m=s.match(/text-align\s*:\s*(\w+)/i);const v=(m?m[1]:a).toLowerCase();return['center','right'].includes(v)?v:'left'};
  const inline=(node,r,out)=>{for(const n of node.childNodes){if(n.nodeType===3){if(n.nodeValue)out.push({...r,text:n.nodeValue})}else if(n.nodeType===1){const t=n.tagName.toLowerCase();
        if(t==='br'){out.push({br:true,size:r.size});continue}if(t==='img'){out.push({img:n.getAttribute('src')});continue}if(['script','style','head'].includes(t))continue;inline(n,styleOf(n,r),out)}}return out};
  const BLOCK=new Set(['p','div','h1','h2','h3','h4','h5','h6','ul','ol','li','table','blockquote','pre','hr','section','article','header','footer','main','figure','figcaption','dl','dt','dd','nav','aside','address','center','body','tbody','thead','tr']);
  const hasBlock=el=>[...el.children].some(c=>BLOCK.has(c.tagName.toLowerCase())||c.tagName.toLowerCase()==='img');
  // görsellerle karışık satır içi içeriği sırayla çiz
  const flow=async(runs,o)=>{let buf=[];const flush=async()=>{if(buf.length){await lay.para(buf,o);buf=[]}};for(const r of runs){if(r.img){await flush();await lay.image(r.img)}else buf.push(r)}await flush()};
  const walk=async(el,ctx)=>{for(const n of el.childNodes){
      if(n.nodeType===3){if(n.nodeValue.trim())await flow([{...ctx.run,text:n.nodeValue}],{indent:ctx.indent});continue}
      if(n.nodeType!==1)continue;const t=n.tagName.toLowerCase();if(['script','style','head','title','meta','link','noscript','template'].includes(t))continue;
      const run=styleOf(n,ctx.run);const s=(n.getAttribute('style')||'');
      if(/page-break-before\s*:\s*always|break-before\s*:\s*page/i.test(s)&&lay.y>lay.M+1)lay.newPage();
      if(HS[t]){const size=B*HS[t];await flow(inline(n,{...run,bold:true,size},[]),{size,before:size*.6,after:size*.35,align:alignOf(n),indent:ctx.indent});continue}
      if(t==='hr'){lay.hr();continue}
      if(t==='img'){await lay.image(n.getAttribute('src'));continue}
      if(t==='br'){lay.y+=B*.6;continue}
      if(t==='ul'||t==='ol'){let i=+(n.getAttribute('start')||1);for(const li of n.children){if(li.tagName.toLowerCase()!=='li')continue;const marker=t==='ol'?`${i++}.`:['•','◦','▪'][ctx.level%3];
          const sub=[...li.childNodes];const nested=sub.filter(c=>c.nodeType===1&&['ul','ol'].includes(c.tagName.toLowerCase()));
          const tmp=li.cloneNode(true);[...tmp.children].forEach(c=>{if(['ul','ol'].includes(c.tagName.toLowerCase()))c.remove()});
          await flow(inline(tmp,styleOf(li,run),[]),{indent:ctx.indent+18,marker,after:3});
          for(const ns of nested)await walk({childNodes:[ns]},{...ctx,indent:ctx.indent+18,level:ctx.level+1})}lay.y+=4;continue}
      if(t==='table'){const rows=[];for(const tr of n.querySelectorAll('tr')){if(tr.closest('table')!==n)continue;const cells=[...tr.children].filter(c=>/^t[dh]$/i.test(c.tagName));
          rows.push({cells:cells.map(c=>inline(c,styleOf(c,{}),[]).filter(r=>!r.img)),align:cells.map(alignOf),header:!!tr.closest('thead')||cells.length>0&&cells.every(c=>c.tagName.toLowerCase()==='th')})}
        await lay.table(rows,{fit:opt.fitTables!==false});continue}
      if(t==='pre'){await lay.para([{...run,mono:true,text:''}].concat(n.textContent.split('\n').flatMap((ln,i)=>i?[{br:true},{...run,mono:true,text:ln.replace(/ /g,' ')||' '}]:[{...run,mono:true,text:ln.replace(/ /g,' ')}])),{size:B*.9,indent:ctx.indent+6,before:4,after:8});continue}
      if(t==='blockquote'){await walk(n,{...ctx,indent:ctx.indent+22,run:{...run,italic:true,color:run.color||'#4a5162'}});continue}
      if(BLOCK.has(t)||t==='li'){if(hasBlock(n))await walk(n,{...ctx,run});else await flow(inline(n,run,[]),{indent:ctx.indent,align:alignOf(n),after:t==='td'?0:B*.55});continue}
      // satır içi öğe blok dışında
      await flow(inline({childNodes:[n]},ctx.run,[]),{indent:ctx.indent})}};
  await walk(dom.body,{run:{},indent:0,level:0});
  if(opt.title)doc.setTitle(opt.title);doc.setProducer('PDF Atölyem');doc.setCreator('PDF Atölyem');
  return doc.save()}

/* ===================== Word → PDF ===================== */
async function wordToPdf(bytes,opt){const m=await libMammoth();
  const r=await m.convertToHtml({arrayBuffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},{styleMap:["p[style-name='Title'] => h1:fresh","p[style-name='Subtitle'] => h2:fresh","r[style-name='Strong'] => strong","p[style-name='Quote'] => blockquote:fresh"]});
  return{pdf:await htmlToPdf(r.value,{family:'serif',...opt}),warnings:r.messages.filter(x=>x.type==='warning').length}}

/* ===================== Excel / CSV → PDF ===================== */
async function excelToPdf(bytes,{sheets='all',landscape=true,grid=true,size='a4'}={}){const X=await libXLSX();const wb=X.read(bytes,{type:'array',cellDates:true});
  const names=sheets==='all'?wb.SheetNames:[sheets];let html='';
  for(const nm of names){const ws=wb.Sheets[nm];if(!ws||!ws['!ref'])continue;const rows=X.utils.sheet_to_json(ws,{header:1,raw:false,blankrows:false,defval:''});
    // tamamen boş sütunları at
    const nc=Math.max(0,...rows.map(r=>r.length));const used=[];for(let c=0;c<nc;c++)if(rows.some(r=>String(r[c]??'').trim()))used.push(c);if(!used.length)continue;
    if(names.length>1)html+=`<h2>${esc(nm)}</h2>`;
    html+='<table>'+rows.map((r,i)=>'<tr>'+used.map(c=>{const v=String(r[c]??'');const num=/^[-+]?[\d.,\s%₺$€]+$/.test(v.trim())&&/\d/.test(v);return i===0?`<th>${esc(v)}</th>`:`<td${num?' align="right"':''}>${esc(v)}</td>`}).join('')+'</tr>').join('')+'</table>';
    if(names.length>1)html+='<div style="page-break-before:always"></div>'}
  if(!html)throw new Error('Tabloda veri bulunamadı.');
  return htmlToPdf(html.replace(/<div style="page-break-before:always"><\/div>$/,''),{landscape,size,base:10,margin:36})}

/* ===================== PowerPoint → PDF ===================== */
async function pptToPdf(bytes){const F=await libFflate();const files=F.unzipSync(bytes);const td=new TextDecoder();
  const txt=p=>files[p]?td.decode(files[p]):null;const xml=p=>{const t=txt(p);return t?new DOMParser().parseFromString(t,'application/xml'):null};
  const pres=xml('ppt/presentation.xml');if(!pres)throw new Error('Geçerli bir PowerPoint (.pptx) dosyası değil. Eski .ppt biçimi desteklenmiyor; PowerPoint\'te .pptx olarak kaydedip dene.');
  const E=12700;const q=(el,name)=>el?[...el.getElementsByTagName('*')].filter(e=>e.localName===name):[];const q1=(el,name)=>q(el,name)[0]||null;
  const kids=(el,name)=>el?[...el.children].filter(e=>e.localName===name):[];const kid=(el,name)=>kids(el,name)[0]||null;
  const sz=q1(pres,'sldSz');const SW=+sz.getAttribute('cx')/E,SH=+sz.getAttribute('cy')/E;
  const rels=p=>{const d=p.replace(/([^/]+)$/,'_rels/$1.rels');const x=xml(d);const o={};q(x,'Relationship').forEach(r=>{let t=r.getAttribute('Target');if(!/^\//.test(t)){const base=p.replace(/[^/]+$/,'');t=normPath(base+t)}else t=t.slice(1);o[r.getAttribute('Id')]=t});return o};
  const normPath=p=>{const out=[];p.split('/').forEach(s=>{if(s==='..')out.pop();else if(s!=='.')out.push(s)});return out.join('/')};
  const prel=rels('ppt/presentation.xml');const order=q(pres,'sldId').map(s=>prel[s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')]).filter(Boolean);
  // tema renkleri
  const theme={};const th=Object.keys(files).find(f=>/^ppt\/theme\/theme\d+\.xml$/.test(f));if(th){const cs=q1(xml(th),'clrScheme');if(cs)[...cs.children].forEach(c=>{const v=q1(c,'srgbClr')||q1(c,'sysClr');if(v)theme[c.localName]='#'+(v.getAttribute('val')||v.getAttribute('lastClr')||'000000')})}
  const mapClr={tx1:'dk1',bg1:'lt1',tx2:'dk2',bg2:'lt2'};
  const colorOf=el=>{if(!el)return null;const s=q1(el,'srgbClr');if(s)return'#'+s.getAttribute('val');const sc=q1(el,'schemeClr');if(sc){const k=sc.getAttribute('val');return theme[mapClr[k]||k]||null}return null};
  const L=await pdflib();const doc=await L.PDFDocument.create();const lay=new Layout(doc,{margin:0});lay.W=SW;lay.H=SH;
  const phKey=sp=>{const ph=q1(sp,'ph');return ph?(ph.getAttribute('type')||'body')+'|'+(ph.getAttribute('idx')||''):null};
  const xfrmOf=sp=>{const x=q1(kid(sp,'spPr')||kid(sp,'grpSpPr')||sp,'xfrm');if(!x)return null;const o=kid(x,'off'),e=kid(x,'ext');if(!o||!e)return null;return{x:+o.getAttribute('x')/E,y:+o.getAttribute('y')/E,w:+e.getAttribute('cx')/E,h:+e.getAttribute('cy')/E}};
  const phMap=x=>{const m={};if(!x)return m;q(x,'sp').forEach(sp=>{const k=phKey(sp);if(k){const f=xfrmOf(sp);const t=k.split('|')[0];m[k]=m[k]||{sp,f};m[t]=m[t]||{sp,f}}});return m};
  for(let si=0;si<order.length;si++){const sp=order[si];const sx=xml(sp);if(!sx)continue;const sr=rels(sp);
    const layoutP=Object.values(sr).find(t=>/slideLayout/.test(t));const lx=layoutP?xml(layoutP):null;const masterP=layoutP?Object.values(rels(layoutP)).find(t=>/slideMaster/.test(t)):null;const mx=masterP?xml(masterP):null;
    const lph=phMap(lx),mph=phMap(mx);
    const pg=doc.addPage([SW,SH]);lay.page=pg;
    const bgClr=[sx,lx,mx].map(x=>{const bg=q1(x,'bg');return bg?colorOf(q1(bg,'solidFill')):null}).find(Boolean);
    if(bgClr)pg.drawRectangle({x:0,y:0,width:SW,height:SH,color:lay.col(bgClr)});
    // önce düzen ve ana slaytın sabit görselleri (logo vb.)
    for(const[x,xp]of[[mx,masterP],[lx,layoutP]]){if(!x)continue;const rr=rels(xp);for(const pic of q(q1(x,'spTree'),'pic')){await drawPic(pic,rr,null)}}
    const tree=q1(sx,'spTree');await drawTree(tree,sr,{ox:0,oy:0,sx:1,sy:1});
    async function drawTree(tree,rr,T){for(const el of tree.children){const n=el.localName;
        if(n==='sp')await drawSp(el,T);else if(n==='pic')await drawPic(el,rr,T);
        else if(n==='grpSp'){const gx=q1(kid(el,'grpSpPr'),'xfrm');let T2=T;if(gx){const o=kid(gx,'off'),e=kid(gx,'ext'),co=kid(gx,'chOff'),ce=kid(gx,'chExt');
            if(o&&e&&co&&ce){const ex=+e.getAttribute('cx')||1,ey=+e.getAttribute('cy')||1,cx=+ce.getAttribute('cx')||ex,cy=+ce.getAttribute('cy')||ey;
              T2={sx:T.sx*ex/cx,sy:T.sy*ey/cy,ox:T.ox+T.sx*(+o.getAttribute('x')/E)-T.sx*ex/cx*(+co.getAttribute('x')/E),oy:T.oy+T.sy*(+o.getAttribute('y')/E)-T.sy*ey/cy*(+co.getAttribute('y')/E)}}}
          await drawTree(el,rr,T2)}
        else if(n==='graphicFrame'){const tbl=q1(el,'tbl');const f=q1(el,'xfrm');if(tbl&&f){const o=kid(f,'off');const b={x:T.ox+T.sx*+o.getAttribute('x')/E,y:T.oy+T.sy*+o.getAttribute('y')/E};
            const rows=q(tbl,'tr').map((tr,i)=>({cells:q(tr,'tc').map(tc=>q(tc,'r').map(r=>({text:(q1(r,'t')||{}).textContent||'',bold:i===0||q1(r,'rPr')?.getAttribute('b')==='1'}))),header:i===0}));
            const save={M:lay.M,CW:lay.CW,y:lay.y};lay.M=b.x;lay.y=b.y;lay.CW=Math.min(SW-b.x-10,(+kid(f,'ext').getAttribute('cx')/E)*T.sx);await lay.table(rows,{size:12,fit:true});Object.assign(lay,save);lay.page=pg}}}}
    async function drawPic(pic,rr,T){const bl=q1(pic,'blip');if(!bl)return;const id=bl.getAttribute('r:embed')||bl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');const path=rr[id];if(!path||!files[path])return;
      let f=xfrmOf(pic);if(!f)return;if(T)f={x:T.ox+T.sx*f.x,y:T.oy+T.sy*f.y,w:T.sx*f.w,h:T.sy*f.h};
      try{let im;const d=files[path];if(/\.png$/i.test(path))im=await doc.embedPng(d);else if(/\.jpe?g$/i.test(path))im=await doc.embedJpg(d);
        else{const mime=/\.gif$/i.test(path)?'image/gif':/\.bmp$/i.test(path)?'image/bmp':/\.svg$/i.test(path)?'image/svg+xml':/\.webp$/i.test(path)?'image/webp':null;if(!mime)return;
          const url=URL.createObjectURL(new Blob([d],{type:mime}));const png=await toPng(url);URL.revokeObjectURL(url);im=await doc.embedPng(dataUrlBytes(png))}
        pg.drawImage(im,{x:f.x,y:SH-f.y-f.h,width:f.w,height:f.h})}catch(e){console.warn('slayt görseli atlandı',path,e)}}
    async function drawSp(sp,T){const k=phKey(sp);const t0=k&&k.split('|')[0];const inh=k?[lph[k],lph[t0],mph[k],mph[t0],t0==='ctrTitle'?mph.title:null,t0==='subTitle'?mph.body:null].find(x=>x&&x.f):null;let f=xfrmOf(sp)||inh?.f;if(!f)return;
      if(T)f={x:T.ox+T.sx*f.x,y:T.oy+T.sy*f.y,w:T.sx*f.w,h:T.sy*f.h};
      const spPr=kid(sp,'spPr');const fill=spPr&&kid(spPr,'solidFill');const fc=colorOf(fill);const ln=spPr&&kid(spPr,'ln');const lc=ln&&!kid(ln,'noFill')?colorOf(kid(ln,'solidFill')):null;
      const geom=spPr&&q1(spPr,'prstGeom');const shape=geom?geom.getAttribute('prst'):'rect';
      if(fc||lc){const o={x:f.x,y:SH-f.y-f.h,width:f.w,height:f.h,...fc?{color:lay.col(fc)}:{},...lc?{borderColor:lay.col(lc),borderWidth:Math.max(.75,(+ln.getAttribute('w')||9525)/E)}:{}};
        if(shape==='ellipse')pg.drawEllipse({x:f.x+f.w/2,y:SH-f.y-f.h/2,xScale:f.w/2,yScale:f.h/2,...fc?{color:lay.col(fc)}:{},...lc?{borderColor:lay.col(lc),borderWidth:o.borderWidth}:{}});else pg.drawRectangle(o)}
      const body=kid(sp,'txBody');if(!body)return;const type=k?k.split('|')[0]:'';const isTitle=/title|ctrTitle/i.test(type);
      const defSize=isTitle?(type==='ctrTitle'?40:32):type==='subTitle'?22:(k?20:16);
      const bp=kid(body,'bodyPr');const ins=a=>(bp&&bp.getAttribute(a)!=null?+bp.getAttribute(a):91440)/E;const anchor=(bp&&bp.getAttribute('anchor'))||(isTitle?'ctr':'t');
      const fs=q1(bp,'normAutofit');const scale=fs&&fs.getAttribute('fontScale')?+fs.getAttribute('fontScale')/100000:1;
      const bx=f.x+ins('lIns'),bw=Math.max(10,f.w-ins('lIns')-ins('rIns'));const paras=[];
      for(const p of kids(body,'p')){const pPr=kid(p,'pPr');const lvl=+(pPr?.getAttribute('lvl')||0);const algn=pPr?.getAttribute('algn');const runs=[];
        for(const r of p.children){if(r.localName==='br'){runs.push({br:true});continue}if(r.localName!=='r'&&r.localName!=='fld')continue;const rp=kid(r,'rPr');const t=(kid(r,'t')||{}).textContent||'';
          const size=(rp&&rp.getAttribute('sz')?+rp.getAttribute('sz')/100:defSize)*scale;runs.push({text:t,size,bold:rp?.getAttribute('b')==='1'||(isTitle&&rp?.getAttribute('b')!=='0'&&false),italic:rp?.getAttribute('i')==='1',underline:rp&&rp.getAttribute('u')&&rp.getAttribute('u')!=='none',color:colorOf(rp&&kid(rp,'solidFill'))||(fc&&isDark(fc)?'#ffffff':null),family:'sans'})}
        const bullet=!isTitle&&type&&type!=='subTitle'&&type!=='ctrTitle'&&!(pPr&&kid(pPr,'buNone'))&&runs.some(r=>r.text&&r.text.trim())||(pPr&&kid(pPr,'buChar'));
        paras.push({runs,lvl,align:algn==='ctr'?'center':algn==='r'?'right':(isTitle&&type==='ctrTitle'?'center':'left'),bullet:bullet?(pPr&&kid(pPr,'buChar')?.getAttribute('char'))||'•':null,size:runs.find(r=>r.size)?.size||defSize*scale})}
      const laid=[];let total=0;for(const p of paras){const ind=p.lvl*22+(p.bullet?18:0);const ls=p.runs.some(r=>r.br||r.text)?await lay.lines(p.runs,bw-ind,p.size):[{items:[],w:0,h:p.size*1.2}];laid.push({p,ls,ind});total+=ls.reduce((a,l)=>a+l.h,0)+p.size*.25}
      let y=f.y+ins('tIns');const avail=f.h-ins('tIns')-ins('bIns');if(anchor==='ctr')y+=Math.max(0,(avail-total)/2);else if(anchor==='b')y+=Math.max(0,avail-total);
      for(const{p,ls,ind}of laid){ls.forEach((l,i)=>{if(i===0&&p.bullet&&l.items[0]){const it=l.items[0];pg.drawText(p.bullet,{x:bx+ind-14,y:SH-(y+l.h*.78),size:it.size,font:it.font,color:lay.col(it.run.color)})}lay.drawLine(l,bx+ind,y,bw-ind,p.align);y+=l.h});y+=p.size*.25}}
  }
  function isDark(h){const[r,g,b]=hexRgb(h);return r*.299+g*.587+b*.114<.45}
  if(!doc.getPageCount())throw new Error('Sunumda slayt bulunamadı.');return doc.save()}

/* ===================== PDF metnini yapıya dönüştürme (Word / Excel için) ===================== */
async function pdfStructure(pdf,i,{ocr=true,onProg}={}){const pg=await pdf.getPage(i+1);const v=pg.getViewport({scale:1});await pg.getOperatorList();// yazı tipleri yüklensin
  const tc=await pg.getTextContent();const U=pdfjsLib.Util;const items=[];
  for(const it of tc.items){if(!it.str||!it.str.trim())continue;const tx=U.transform(v.transform,it.transform);const size=Math.hypot(tx[2],tx[3]);if(size<1)continue;
    let bold=false,italic=false,fam='sans';try{if(pg.commonObjs.has(it.fontName)){const f=pg.commonObjs.get(it.fontName);const n=(f.name||'')+' '+(f.fallbackName||'');bold=!!f.bold||/bold|black|heavy|semibold/i.test(n);italic=!!f.italic||/italic|oblique/i.test(n);fam=/mono|courier/i.test(n)?'mono':/times|georgia|garamond|cambria|serif/i.test(n)&&!/sans/i.test(n)?'serif':'sans'}}catch(e){}
    items.push({x:tx[4],y:tx[5],size,w:Math.abs(it.width),str:it.str,bold,italic,fam})}
  let ocrUsed=false;
  if(items.reduce((a,t)=>a+t.str.trim().length,0)<30&&ocr){// taranmış sayfa: OCR ile metin çıkar
    ocrUsed=true;const w=await OCR.get(['tur','eng'],m=>{if(m.status==='recognizing text'&&onProg)onProg(m.progress)});const sc=2.5;const vp=pg.getViewport({scale:sc});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:x,viewport:vp}).promise;const{data}=await w.recognize(c,{},{blocks:true});
    (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(wd=>{if(!wd.text.trim())return;const h=(l.bbox.y1-l.bbox.y0)/sc;
      items.push({x:wd.bbox.x0/sc,y:(l.baseline&&l.baseline.y0>0?l.baseline.y0:wd.bbox.y1)/sc,size:h*.8,w:(wd.bbox.x1-wd.bbox.x0)/sc,str:wd.text,bold:false,italic:false,fam:'sans'})}))))}
  // satırlar
  items.sort((a,b)=>a.y-b.y||a.x-b.x);const lines=[];
  for(const it of items){const l=lines.find(l=>Math.abs(l.y-it.y)<Math.min(l.size,it.size)*.45);if(l){l.items.push(it);l.size=Math.max(l.size,it.size)}else lines.push({y:it.y,size:it.size,items:[it]})}
  lines.forEach(l=>{l.items.sort((a,b)=>a.x-b.x);l.x=l.items[0].x;l.x2=Math.max(...l.items.map(i=>i.x+i.w));
    // kelime boşluklarını koru, büyük boşlukları hücre ayırıcı say
    l.segs=[];let cur=null;for(const it of l.items){if(cur&&it.x-(cur.x2)<it.size*1.2){const gap=it.x-cur.x2;cur.text+=(gap>it.size*.12&&!/\s$/.test(cur.text)&&!/^\s/.test(it.str)?' ':'')+it.str;cur.x2=Math.max(cur.x2,it.x+it.w);cur.runs.push(it)}
      else{cur={x:it.x,x2:it.x+it.w,text:it.str,runs:[it]};l.segs.push(cur)}}
    l.text=l.segs.map(s=>s.text).join('  ');l.bold=l.items.every(i=>i.bold);l.italic=l.items.every(i=>i.italic);l.fam=l.items[0].fam});
  lines.sort((a,b)=>a.y-b.y);return{w:v.width,h:v.height,lines,ocrUsed}}

/* ===================== PDF → Word (.docx) ===================== */
async function pdfToWord(bytes,{ocr=true,onProg}={}){const pdf=await openPdf(bytes);const n=pdf.numPages;const body=[];let sect=null,ocrPages=0;
  for(let i=0;i<n;i++){onProg&&onProg(i,n,0);const S=await pdfStructure(pdf,i,{ocr,onProg:p=>onProg&&onProg(i,n,p)});if(S.ocrUsed)ocrPages++;if(!sect)sect=S;
    const sizes=S.lines.map(l=>l.size).sort((a,b)=>a-b);const bodySize=sizes[Math.floor(sizes.length/2)]||11;const left=Math.min(...S.lines.map(l=>l.x),S.w);
    // satırları paragraflara birleştir
    const paras=[];let cur=null;
    for(const l of S.lines){const gap=cur?l.y-cur.lastY:0;const big=l.size>bodySize*1.18;const ind=l.x-left;const center=Math.abs((l.x+l.x2)/2-S.w/2)<S.w*.04&&l.x-left>S.w*.12;
      const joinable=cur&&!big&&!cur.big&&gap<l.size*(S.ocrUsed?2.6:1.75)&&Math.abs(l.size-cur.size)<Math.max(1,cur.size*(S.ocrUsed?.42:.08))&&!cur.center&&!center&&l.bold===cur.bold&&!/^[•\-–·▪◦]\s|^\d+[.)]\s/.test(l.text);
      if(joinable){cur.text+=(/-$/.test(cur.text)?'':' ')+l.text;cur.text=cur.text.replace(/(\w)- (\w)/g,'$1$2');cur.lastY=l.y}
      else{cur={text:l.text,size:l.size,bold:l.bold||big&&l.size>bodySize*1.4,italic:l.italic,fam:l.fam,big,center,ind:Math.max(0,ind),lastY:l.y,before:cur?Math.max(0,gap-l.size*1.3):0};paras.push(cur)}}
    for(const p of paras){const sz=Math.round(Math.min(72,Math.max(6,p.size))*2);const font=p.fam==='serif'?'Times New Roman':p.fam==='mono'?'Courier New':'Arial';
      const pPr=`<w:pPr>${p.big?`<w:keepNext/>`:''}<w:spacing w:before="${Math.round(Math.min(p.before,30)*20)}" w:after="${p.big?120:80}"/>${p.center?'<w:jc w:val="center"/>':''}${!p.center&&p.ind>8?`<w:ind w:left="${Math.round(p.ind*20)}"/>`:''}</w:pPr>`;
      body.push(`<w:p>${pPr}<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${p.bold?'<w:b/>':''}${p.italic?'<w:i/>':''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.text)}</w:t></w:r></w:p>`)}
    if(i<n-1)body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');pdf.getPage(i+1).then(p=>p.cleanup())}
  const W=Math.round((sect?sect.w:595)*20),H=Math.round((sect?sect.h:842)*20);
  const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"${W>H?' w:orient="landscape"':''}/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const enc=new TextEncoder();
  const files=[{name:'[Content_Types].xml',data:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`)},
    {name:'_rels/.rels',data:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`)},
    {name:'word/_rels/document.xml.rels',data:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)},
    {name:'word/styles.xml',data:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`)},
    {name:'docProps/core.xml',data:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>PDF Atölyem</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`)},
    {name:'word/document.xml',data:enc.encode(docXml)}];
  pdf.destroy();return{data:new Uint8Array(await makeZip(files).arrayBuffer()),ocrPages}}

/* ===================== PDF → Excel (.xlsx) ===================== */
async function pdfToExcel(bytes,{mode='sheets',ocr=true,onProg}={}){const X=await libXLSX();const pdf=await openPdf(bytes);const n=pdf.numPages;const wb=X.utils.book_new();let all=[];let rowsTotal=0;
  const toNum=s=>{const t=s.trim().replace(/[₺$€%\s]/g,'');if(!/^[-+(]?\d[\d.,]*\)?$/.test(t))return s.trim();let v=t.replace(/[()]/g,'');
    if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)||/^\d+,\d+$/.test(v))v=v.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v))v=v.replace(/,/g,'');
    const num=parseFloat(v);if(isNaN(num))return s.trim();return/^\(.*\)$/.test(t)||/^-/.test(t)?-Math.abs(num):num};
  for(let i=0;i<n;i++){onProg&&onProg(i,n,0);const S=await pdfStructure(pdf,i,{ocr,onProg:p=>onProg&&onProg(i,n,p)});
    // sütun konumlarını kümele
    const xs=S.lines.flatMap(l=>l.segs.map(s=>s.x)).sort((a,b)=>a-b);const anchors=[];for(const x of xs){const a=anchors[anchors.length-1];if(a&&x-a.max<10){a.max=x;a.n++;a.sum+=x}else anchors.push({min:x,max:x,n:1,sum:x})}
    const cols=anchors.filter(a=>a.n>=Math.max(2,S.lines.length*.08)).map(a=>a.min);if(!cols.length&&anchors.length)cols.push(anchors[0].min);
    const colOf=x=>{let k=0;for(let c=0;c<cols.length;c++)if(x>=cols[c]-6)k=c;return k};
    const rows=S.lines.map(l=>{const r=[];l.segs.forEach(s=>{let c=colOf(s.x);while(r[c]!=null&&r[c]!=='')c++;r[c]=toNum(s.text)});for(let c=0;c<r.length;c++)if(r[c]==null)r[c]='';return r});
    rowsTotal+=rows.length;
    if(mode==='sheets'){const ws=X.utils.aoa_to_sheet(rows.length?rows:[['(bu sayfada metin yok)']]);ws['!cols']=Array.from({length:Math.max(1,...rows.map(r=>r.length))},(_,c)=>({wch:Math.min(60,Math.max(8,...rows.map(r=>String(r[c]??'').length+2)))}));X.utils.book_append_sheet(wb,ws,'Sayfa '+(i+1))}
    else{all=all.concat(rows);if(i<n-1)all.push([])}}
  if(mode!=='sheets'){const ws=X.utils.aoa_to_sheet(all.length?all:[['(metin yok)']]);ws['!cols']=Array.from({length:Math.max(1,...all.map(r=>r.length))},(_,c)=>({wch:Math.min(60,Math.max(8,...all.map(r=>String(r[c]??'').length+2)))}));X.utils.book_append_sheet(wb,ws,'Tablo')}
  pdf.destroy();return{data:new Uint8Array(X.write(wb,{type:'array',bookType:'xlsx'})),rows:rowsTotal}}

/* ===================== PDF → PowerPoint (.pptx) ===================== */
async function pdfToPpt(bytes,{dpi=150,onProg}={}){const pdf=await openPdf(bytes);const n=pdf.numPages;const enc=new TextEncoder();const files=[];const E=12700;
  const p1=(await pdf.getPage(1)).getViewport({scale:1});const CX=Math.round(p1.width*E),CY=Math.round(p1.height*E);
  const NS='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const add=(name,s)=>files.push({name,data:typeof s==='string'?enc.encode(s):s});
  const slides=[];
  for(let i=0;i<n;i++){onProg&&onProg(i,n);const pg=await pdf.getPage(i+1);const v=pg.getViewport({scale:1});const vp=pg.getViewport({scale:dpi/72});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;
    const jpg=new Uint8Array(await (await new Promise(ok=>c.toBlob(ok,'image/jpeg',.88))).arrayBuffer());add(`ppt/media/image${i+1}.jpg`,jpg);
    const tc=await pg.getTextContent();const notes=tc.items.map(t=>t.str+(t.hasEOL?'\n':'')).join('').trim();
    // sayfa oranı slayttan farklıysa ortala
    const k=Math.min(CX/(v.width*E),CY/(v.height*E));const w=Math.round(v.width*E*k),h=Math.round(v.height*E*k);
    slides.push({w,h,ox:Math.round((CX-w)/2),oy:Math.round((CY-h)/2),notes});pg.cleanup()}
  const sldIds=slides.map((s,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('');
  add('[Content_Types].xml',`${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((s,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`);
  add('_rels/.rels',`${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  add('ppt/presentation.xml',`${X}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="${CX}" cy="${CY}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  add('ppt/_rels/presentation.xml.rels',`${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((s,i)=>`<Relationship Id="rId${i+2}" Type="${REL}/slide" Target="slides/slide${i+1}.xml"/>`).join('')}<Relationship Id="rId${slides.length+2}" Type="${REL}/theme" Target="theme/theme1.xml"/></Relationships>`);
  const emptyTree='<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>';
  add('ppt/slideMasters/slideMaster1.xml',`${X}<p:sldMaster ${NS}>${emptyTree}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels',`${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  add('ppt/slideLayouts/slideLayout1.xml',`${X}<p:sldLayout ${NS} type="blank" preserve="1">${emptyTree.replace('<p:cSld>','<p:cSld name="Boş">')}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels',`${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  const clr=(n,v)=>`<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;const font='<a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/>';
  const fillL='<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';const lnL='<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
  add('ppt/theme/theme1.xml',`${X}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PDF Atölyem"><a:themeElements><a:clrScheme name="PDF Atölyem"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>${clr('dk2','1D2330')}${clr('lt2','EEF0F4')}${clr('accent1','3352D6')}${clr('accent2','E5533D')}${clr('accent3','2E9D5B')}${clr('accent4','E3A008')}${clr('accent5','8B5CF6')}${clr('accent6','0EA5A4')}${clr('hlink','3352D6')}${clr('folHlink','8B5CF6')}</a:clrScheme><a:fontScheme name="PDF Atölyem"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme><a:fmtScheme name="PDF Atölyem"><a:fillStyleLst>${fillL}${fillL}${fillL}</a:fillStyleLst><a:lnStyleLst>${lnL}${lnL}${lnL}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fillL}${fillL}${fillL}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  slides.forEach((s,i)=>{add(`ppt/slides/slide${i+1}.xml`,`${X}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Sayfa ${i+1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${s.ox}" y="${s.oy}"/><a:ext cx="${s.w}" cy="${s.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    add(`ppt/slides/_rels/slide${i+1}.xml.rels`,`${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/image" Target="../media/image${i+1}.jpg"/></Relationships>`)});
  pdf.destroy();return new Uint8Array(await makeZip(files).arrayBuffer())}

/* ===================== PDF → PDF/A-2b ===================== */
async function pdfToPdfA(bytes,{title}={}){const L=await pdflib();const{PDFString,PDFHexString,PDFDict}=L;const N=x=>L.PDFName.of(x);
  const doc=await L.PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false});const ctx=doc.context;const cat=doc.catalog;const report=[];
  if(doc.isEncrypted)throw new Error('Şifreli PDF, PDF/A yapılamaz. Önce şifresini kaldır.');
  // yasak öğeler: JavaScript, otomatik eylemler, gömülü dosyalar
  const names=cat.lookup(N('Names'));if(names instanceof PDFDict){if(names.has(N('JavaScript'))){names.delete(N('JavaScript'));report.push('JavaScript kaldırıldı')}if(names.has(N('EmbeddedFiles'))){names.delete(N('EmbeddedFiles'));report.push('Gömülü dosyalar kaldırıldı (PDF/A-2 izin vermez)')}}
  if(cat.has(N('OpenAction'))){const oa=cat.lookup(N('OpenAction'));if(oa instanceof PDFDict&&String(oa.get(N('S')))==='/JavaScript'){cat.delete(N('OpenAction'));report.push('Açılış betiği kaldırıldı')}}
  if(cat.has(N('AA'))){cat.delete(N('AA'));report.push('Otomatik eylemler kaldırıldı')}
  const af=cat.lookup(N('AcroForm'));if(af instanceof PDFDict&&af.has(N('NeedAppearances')))af.delete(N('NeedAppearances'));
  // gömülü olmayan yazı tiplerini bul
  const unembedded=new Set();const seen=new Set();
  const checkRes=res=>{if(!(res instanceof PDFDict))return;const fonts=res.lookup(N('Font'));if(fonts instanceof PDFDict)for(const[k,v]of fonts.entries()){const fd=ctx.lookup(v);if(!(fd instanceof PDFDict)||seen.has(fd))continue;seen.add(fd);
      const sub=String(fd.get(N('Subtype')));let desc=fd.lookup(N('FontDescriptor'));if(sub==='/Type0'){const df=ctx.lookup(fd.lookup(N('DescendantFonts')).get(0));desc=df.lookup(N('FontDescriptor'))}
      if(sub==='/Type3')continue;const ok=desc instanceof PDFDict&&(desc.has(N('FontFile'))||desc.has(N('FontFile2'))||desc.has(N('FontFile3')));if(!ok)unembedded.add(String(fd.get(N('BaseFont'))||k).replace(/^\//,''))}
    const xo=res.lookup(N('XObject'));if(xo instanceof PDFDict)for(const[,v]of xo.entries()){const s=ctx.lookup(v);if(s&&s.dict&&String(s.dict.get(N('Subtype')))==='/Form'&&!seen.has(s)){seen.add(s);checkRes(s.dict.lookup(N('Resources')))}}};
  doc.getPages().forEach(p=>checkRes(p.node.Resources()));
  // renk profili (OutputIntent)
  const icc=new Uint8Array(await (await fetch(CONV+'sRGB.icc')).arrayBuffer());const iccRef=ctx.register(ctx.flateStream(icc,{N:3}));
  cat.set(N('OutputIntents'),ctx.obj([ctx.obj({Type:'OutputIntent',S:'GTS_PDFA1',OutputConditionIdentifier:PDFString.of('sRGB IEC61966-2.1'),Info:PDFString.of('sRGB IEC61966-2.1'),DestOutputProfile:iccRef})]));
  // XMP üst verisi
  const now=new Date();const iso=now.toISOString().replace(/\.\d+Z$/,'Z');const t=title||doc.getTitle()||'Belge';
  doc.setTitle(t);doc.setProducer('PDF Atölyem');doc.setCreator('PDF Atölyem');doc.setModificationDate(now);if(!doc.getCreationDate())doc.setCreationDate(now);
  const cd=(doc.getCreationDate()||now).toISOString().replace(/\.\d+Z$/,'Z');
  const xmp=`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(t)}</rdf:li></rdf:Alt></dc:title><xmp:CreatorTool>PDF Atölyem</xmp:CreatorTool><xmp:CreateDate>${cd}</xmp:CreateDate><xmp:ModifyDate>${iso}</xmp:ModifyDate><xmp:MetadataDate>${iso}</xmp:MetadataDate><pdf:Producer>PDF Atölyem</pdf:Producer></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const meta=ctx.stream(new TextEncoder().encode(xmp),{Type:'Metadata',Subtype:'XML'});cat.set(N('Metadata'),ctx.register(meta));
  // dosya kimliği
  const rnd=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');const id=PDFHexString.of(rnd());ctx.trailerInfo.ID=ctx.obj([id,id]);
  // açıklamalar yazdırılabilir olmalı
  doc.getPages().forEach(p=>{const an=p.node.Annots();if(an)an.asArray().forEach(r=>{const a=ctx.lookup(r);if(a instanceof PDFDict){const f=a.get(N('F'));const v=f?f.asNumber():0;a.set(N('F'),ctx.obj((v|4)&~(1|2|32)))}})});
  const out=await doc.save({useObjectStreams:false});return{data:out,report,unembedded:[...unembedded]}}

/* ===================== Araç ekranları ===================== */
// Office/HTML dosyası seçme aşaması
function officeStage(body,{accept,exts,title,hint,paste},cb){
  body.innerHTML=`<div class="drop" id="cDrop" style="min-height:240px">${ic('file','i" style="width:40px;height:40px;color:var(--ac)')}<h2>${title}</h2><p>${hint}</p>
    <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center"><button class="btn pri" id="cDev">${ic('open')} Dosya seç</button>${paste?`<button class="btn" id="cPaste">${ic('html')} HTML yapıştır</button>`:''}</div></div>`;
  const ok=f=>exts.test(f.name);
  const go=async fs=>{fs=fs.filter(ok);if(!fs.length){toast('Bu araç için uygun dosya seç ('+accept.replace(/[^.,a-z]/gi,'').replace(/,/g,', ')+')');return}const f=fs[0];cb({name:f.name,bytes:await readBytes(f)})};
  $('#cDev',body).onclick=async()=>go(await pickFiles({accept}));dropZone($('#cDrop',body),go);
  const p=$('#cPaste',body);if(p)p.onclick=async()=>{const r=await modal({title:'HTML yapıştır',wide:true,ok:'PDF yap',body:'<textarea id="hIn" style="width:100%;height:300px;border:1px solid var(--line2);border-radius:8px;padding:10px;font:12.5px/1.5 ui-monospace,Menlo,monospace" placeholder="<h1>Başlık</h1><p>Metin…</p>"></textarea><small style="color:var(--tx2)">Web sayfasının adresini değil, HTML kodunu yapıştır. Tarayıcı güvenliği yüzünden başka sitelerin sayfaları buradan indirilemez; sayfayı "Farklı kaydet" ile .html olarak kaydedip dosya olarak da seçebilirsin.</small>'});
    if(r){const v=$('#hIn',r).value;if(v.trim())cb({name:'sayfa.html',bytes:new TextEncoder().encode(v)})}}}
const progMsg=(i,n,p)=>{Busy.msg(`Sayfa ${i+1} / ${n} işleniyor…`);Busy.prog((i+(p||0))/n)};

async function toolWord2pdf(t){const body=toolShell(t);const start=()=>{clearBar();officeStage(body,{accept:'.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',exts:/\.docx$/i,title:'Word belgesini seç',hint:'.docx dosyalarını destekler. Eski .doc biçimini Word\'de .docx olarak kaydedip dene.'},async f=>{
    const r=await withBusy('Word belgesi PDF\'e çevriliyor…',()=>wordToPdf(f.bytes,{title:baseName(f.name.replace(/\.docx$/i,''))}));
    resultStage(body,[{name:f.name.replace(/\.docx$/i,'')+'.pdf',data:r.pdf}],{msg:'Word belgesi PDF oldu'+(r.warnings?' (bazı biçimler sadeleştirildi)':''),again:start})})};start()}
async function toolXls2pdf(t){const body=toolShell(t);const start=()=>{clearBar();officeStage(body,{accept:'.xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv',exts:/\.(xlsx|xlsm|xls|ods|csv)$/i,title:'Excel dosyasını seç',hint:'.xlsx, .xls, .ods ve .csv dosyalarını destekler.'},async f=>{
    const X=await withBusy('Dosya okunuyor…',libXLSX);const wb=X.read(f.bytes,{type:'array',bookSheets:true});
    body.innerHTML=`<div class="card opts"><label class="fld">Sayfalar<select id="xS"><option value="all">Tüm sayfalar (${wb.SheetNames.length})</option>${wb.SheetNames.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label>
      <label class="fld">Yön<select id="xO"><option value="1">Yatay</option><option value="0">Dikey</option></select></label><label class="fld">Kâğıt<select id="xP"><option value="a4">A4</option><option value="a3">A3</option><option value="letter">Letter</option></select></label></div>
      <p style="color:var(--tx2)">${esc(f.name)} · Geniş tablolar sayfaya sığacak şekilde küçültülür; uzun tablolarda başlık satırı her sayfada tekrar eder.</p>`;
    bar('',`<button class="btn pri" id="xGo">${ic('file')} PDF'e çevir</button>`);
    $('#xGo').onclick=async()=>{const out=await withBusy('PDF oluşturuluyor…',()=>excelToPdf(f.bytes,{sheets:$('#xS').value,landscape:$('#xO').value==='1',size:$('#xP').value}));clearBar();
      resultStage(body,[{name:f.name.replace(/\.\w+$/,'')+'.pdf',data:out}],{msg:'Tablo PDF oldu',again:start})}})};start()}
async function toolPpt2pdf(t){const body=toolShell(t);const start=()=>{clearBar();officeStage(body,{accept:'.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation',exts:/\.pptx$/i,title:'PowerPoint sunumunu seç',hint:'.pptx dosyalarını destekler. Metinler, görseller, şekiller ve tablolar aktarılır; animasyonlar ve bazı özel efektler aktarılamaz.'},async f=>{
    const out=await withBusy('Sunum PDF\'e çevriliyor…',()=>pptToPdf(f.bytes));
    resultStage(body,[{name:f.name.replace(/\.pptx$/i,'')+'.pdf',data:out}],{msg:'Sunum PDF oldu',again:start})})};start()}
async function toolHtml2pdf(t){const body=toolShell(t);const start=()=>{clearBar();officeStage(body,{accept:'.html,.htm,text/html',exts:/\.html?$/i,title:'HTML dosyası seç ya da kod yapıştır',hint:'Kaydedilmiş web sayfaları (.html) ya da yapıştırılan HTML kodu.',paste:true},async f=>{
    let html=new TextDecoder().decode(f.bytes);const title=(html.match(/<title[^>]*>([^<]*)/i)||[])[1];
    const out=await withBusy('PDF oluşturuluyor…',()=>htmlToPdf(html,{title}));
    resultStage(body,[{name:(title||f.name.replace(/\.html?$/i,'')||'sayfa').trim().slice(0,80)+'.pdf',data:out}],{msg:'HTML, PDF oldu',again:start})})};start()}
async function toolPdf2word(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><p style="color:var(--tx2);margin:6px 0 12px">Metin, paragraflar, başlıklar, kalın/italik ve yazı boyutları düzenlenebilir Word belgesine aktarılır. Karmaşık sayfa düzenleri (çok sütun, metin kutuları) sadeleşir; görseller aktarılmaz.</p>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="wO" checked> Taranmış sayfalarda OCR ile metni tanı (Türkçe + İngilizce)</label></div>`;
    bar('',`<button class="btn pri" id="wGo">${ic('word')} Word'e çevir</button>`);
    $('#wGo').onclick=async()=>{clearBar();Busy.show('Hazırlanıyor…');let r;try{r=await pdfToWord(f.bytes,{ocr:$('#wO').checked,onProg:progMsg})}catch(e){Busy.hide();alertBox('Çevrilemedi',esc(errText(e)));return run(list)}Busy.hide();
      resultStage(body,[{name:baseName(f.name)+'.docx',data:r.data}],{msg:'Word belgesi hazır'+(r.ocrPages?` · ${r.ocrPages} sayfada OCR kullanıldı`:''),again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolPdf2xls(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><p style="color:var(--tx2);margin:6px 0 12px">Sayfadaki satır ve sütunlar bulunup Excel'e aktarılır. Sayılar (1.234,56 gibi Türkçe biçim dahil) gerçek sayı olarak gelir. Düzgün hizalı tablolarda en iyi sonucu verir.</p>
      <div class="opts"><label class="fld">Düzen<select id="eM"><option value="sheets">Her sayfa ayrı çalışma sayfası</option><option value="one">Hepsi tek çalışma sayfasında</option></select></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="eO" checked> Taranmış sayfalarda OCR</label></div></div>`;
    bar('',`<button class="btn pri" id="eGo">${ic('xls')} Excel'e çevir</button>`);
    $('#eGo').onclick=async()=>{clearBar();Busy.show('Hazırlanıyor…');let r;try{r=await pdfToExcel(f.bytes,{mode:$('#eM').value,ocr:$('#eO').checked,onProg:progMsg})}catch(e){Busy.hide();alertBox('Çevrilemedi',esc(errText(e)));return run(list)}Busy.hide();
      resultStage(body,[{name:baseName(f.name)+'.xlsx',data:r.data}],{msg:`Excel dosyası hazır · ${r.rows} satır`,again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolPdf2ppt(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];body.innerHTML=`<div class="card"><b>${esc(f.name)}</b><p style="color:var(--tx2);margin:6px 0 12px">Her sayfa yüksek çözünürlüklü bir slayt olur; sayfanın metni slayt notlarına değil, görselin içinde kalır. Sunumda sayfaların üstüne yazı ve şekil ekleyebilirsin.</p>
      <div class="opts"><label class="fld">Kalite<select id="pQ"><option value="110">Hafif dosya</option><option value="150" selected>Önerilen</option><option value="220">Yüksek (büyük dosya)</option></select></label></div></div>`;
    bar('',`<button class="btn pri" id="pGo">${ic('ppt')} PowerPoint'e çevir</button>`);
    $('#pGo').onclick=async()=>{clearBar();Busy.show('Hazırlanıyor…');let out;try{out=await pdfToPpt(f.bytes,{dpi:+$('#pQ').value,onProg:(i,n)=>progMsg(i,n)})}catch(e){Busy.hide();alertBox('Çevrilemedi',esc(errText(e)));return run(list)}Busy.hide();
      resultStage(body,[{name:baseName(f.name)+'.pptx',data:out}],{msg:'Sunum hazır',again:start})}};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}
async function toolPdfa(t){const body=toolShell(t);
  const run=async list=>{const f=list[0];
    const r=await withBusy('PDF/A\'ya dönüştürülüyor…',()=>pdfToPdfA(f.bytes,{title:baseName(f.name)}));
    resultStage(body,[{name:baseName(f.name)+'_PDFA.pdf',data:r.data}],{msg:'PDF/A-2b dosyası hazır',sourceDoc:f.id?f:null,again:start});
    const info=document.createElement('div');info.className='card';
    info.innerHTML=`<b>Yapılanlar</b><ul style="margin:8px 0;color:var(--tx2)"><li>PDF/A-2b kimliği ve XMP üst verisi eklendi</li><li>sRGB renk profili (OutputIntent) eklendi</li><li>Dosya kimliği eklendi, açıklamalar yazdırılabilir yapıldı</li>${r.report.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      ${r.unembedded.length?`<div style="background:#fff7e6;border:1px solid #f3d08a;border-radius:8px;padding:10px;margin-top:8px"><b>⚠️ Dikkat:</b> Şu yazı tipleri dosyaya gömülü değil: <i>${esc(r.unembedded.slice(0,8).join(', '))}${r.unembedded.length>8?'…':''}</i>. PDF/A doğrulayıcıları (ör. veraPDF) bu yüzden dosyayı reddedebilir. Resmî bir yere gönderilecekse belgeyi yazı tiplerini gömerek yeniden oluşturmak gerekir (Word'de "PDF/A uyumlu" seçeneğiyle kaydetmek gibi).</div>`:`<div style="color:var(--ok);margin-top:6px">✓ Tüm yazı tipleri gömülü.</div>`}
      <p style="color:var(--tx3);font-size:12.5px;margin:8px 0 0">Not: Bu araç belgeyi PDF/A kurallarına göre hazırlar, resmî bir doğrulama sertifikası vermez.</p>`;body.appendChild(info)};
  const start=()=>{clearBar();pickStage(body,{},run)};const q=await fromQueryDoc();q?run([q]):start()}

Object.assign(RUN,{word2pdf:toolWord2pdf,xls2pdf:toolXls2pdf,ppt2pdf:toolPpt2pdf,html2pdf:toolHtml2pdf,pdf2word:toolPdf2word,pdf2xls:toolPdf2xls,pdf2ppt:toolPdf2ppt,pdfa:toolPdfa});
T.forEach(t=>{if(RUN[t.id])delete t.soon});
