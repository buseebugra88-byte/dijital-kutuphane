// PDF Atölyem — var olan metni düzenleme (Acrobat'taki "Metni Düzenle" gibi)
// Sayfadaki yazı satırlarını bulur; tıklanan satır yazı tipi, boyut ve renkleriyle düzenlenir.
// Kaydedince eski yazının üstü arka plan rengiyle kapatılır, yeni yazı aynı yere yazılır.
'use strict';
const ET_CSS={sans:'PASans, "Liberation Sans", Arial, Helvetica, sans-serif',serif:'PASerif, "Liberation Serif", "Times New Roman", Times, serif',mono:'PAMono, "Liberation Mono", "Courier New", monospace'};
const etFont=(it,px)=>`${it.italic?'italic ':''}${it.bold?700:400} ${px}px ${ET_CSS[it.family]||ET_CSS.sans}`;
const etIn=(p,r,t=0)=>p[0]>=r.x-t&&p[0]<=r.x+r.w+t&&p[1]>=r.y-t&&p[1]<=r.y+r.h+t;

Object.assign(V,{
  etBind(){const m=$('#vMain');let busy=false;
    m.addEventListener('pointermove',async e=>{const s=this.st;if(!s||s.tool!=='edittext'||e.buttons||busy||$('.etbox'))return;const pe=e.target.closest('.page');if(!pe){this.etHover(null);return}
      busy=true;try{const i=+pe.dataset.n-1;const pt=this.ptIn(e,$('svg.ov',pe));const own=s.items.find(it=>it.type==='etext'&&it.page===i&&etIn(pt,it));
        const r=own||(await this.etRuns(i)).find(r=>etIn(pt,r,1));this.etHover(r?{i,r}:null)}finally{busy=false}})},
  etPrepare(){if(!this._etTip){this._etTip=1;toast('Düzenlemek istediğin yazıya tıkla. Enter ile kaydet, Esc ile vazgeç.',4000)}},
  etHover(h){$$('.ethov').forEach(x=>x.remove());if(!h)return;const svg=$(`svg.ov[data-p="${h.i}"]`);if(!svg)return;
    const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('class','ethov');
    [['x',h.r.x-1],['y',h.r.y-1],['width',h.r.w+2],['height',h.r.h+2]].forEach(([k,v])=>r.setAttribute(k,v));svg.appendChild(r)},

  // Sayfadaki yazıları satır parçalarına (run) böl
  async etRuns(i){const s=this.st;s.etr=s.etr||{};if(s.etr[i])return s.etr[i];const P=await this.getP(i);const tc=await this.textOf(i);const U=pdfjsLib.Util;const items=[];
    for(const it of tc.items){if(!('str'in it)||!it.str.trim())continue;const tx=U.transform(P.vp1.transform,it.transform);const size=Math.hypot(tx[2],tx[3]);
      if(size<1||Math.abs(tx[1])>size*.02||Math.abs(tx[2])>size*.02)continue;// yalnızca yatay yazılar
      const st=tc.styles[it.fontName]||{};let asc=st.ascent,desc=st.descent;if(!(asc>.4&&asc<1.3))asc=.85;if(!(desc<0&&desc>-.6))desc=-.22;
      let fn='',bold=false,italic=false,fb='';try{if(P.page.commonObjs.has(it.fontName)){const f=P.page.commonObjs.get(it.fontName);fn=f.name||'';fb=f.fallbackName||'';bold=!!f.bold||!!f.black;italic=!!f.italic}}catch(e){}
      const nm=fn+' '+(st.fontFamily||'')+' '+fb;bold=bold||/bold|black|heavy|semibold|demi/i.test(fn);italic=italic||/italic|oblique/i.test(fn);
      const family=/mono|courier|consol|typewriter/i.test(nm)?'mono':(/times|georgia|garamond|cambria|minion|palatino|baskerville|book|serif/i.test(nm)&&!/sans/i.test(fn+' '+fb))?'serif':'sans';
      items.push({x:tx[4],base:tx[5],size,w:Math.abs(it.width),str:it.str,asc,desc,family,bold,italic})}
    items.sort((a,b)=>a.base-b.base||a.x-b.x);const runs=[];
    for(const it of items){const l=runs[runs.length-1];
      if(l&&Math.abs(it.base-l.base)<l.size*.3&&Math.abs(it.size-l.size)<l.size*.25&&it.x>=l.x+l.w-l.size*.5&&it.x<=l.x+l.w+l.size*.9){
        const gap=it.x-(l.x+l.w);l.text+=(gap>l.size*.15&&!/\s$/.test(l.text)&&!/^\s/.test(it.str)?' ':'')+it.str;l.w=Math.max(l.w,it.x+it.w-l.x)}
      else runs.push({x:it.x,base:it.base,size:it.size,w:it.w,text:it.str,asc:it.asc,desc:it.desc,family:it.family,bold:it.bold,italic:it.italic})}
    runs.forEach(r=>{r.text=r.text.replace(/\s+$/,'');r.y=r.base-r.asc*r.size;r.h=(r.asc-r.desc)*r.size});
    return s.etr[i]=runs},

  // Arka plan ve yazı rengini çizilmiş sayfadan oku
  etSample(i,r){const s=this.st,P=s.pages[i];const c=$('canvas.c',P.el);const def={bg:'#ffffff',fg:'#000000'};if(!c||!c.width)return def;
    const k=c.width/P.w;const X=Math.max(0,Math.floor((r.x-3)*k)),Y=Math.max(0,Math.floor((r.y-3)*k));const W=Math.min(c.width-X,Math.ceil((r.w+6)*k)),H=Math.min(c.height-Y,Math.ceil((r.h+6)*k));if(W<3||H<3)return def;
    let d;try{d=c.getContext('2d',{willReadFrequently:true}).getImageData(X,Y,W,H).data}catch(e){return def}
    const cnt=new Map();const px=(x,y)=>{const o=(y*W+x)*4;return[d[o],d[o+1],d[o+2]]};
    const vote=p=>{const q=(p[0]>>3)<<10|(p[1]>>3)<<5|(p[2]>>3);const v=cnt.get(q);if(v){v.n++;v.r+=p[0];v.g+=p[1];v.b+=p[2]}else cnt.set(q,{n:1,r:p[0],g:p[1],b:p[2]})};
    for(let x=0;x<W;x++){vote(px(x,0));vote(px(x,H-1))}for(let y=0;y<H;y++){vote(px(0,y));vote(px(W-1,y))}
    let best=null;for(const v of cnt.values())if(!best||v.n>best.n)best=v;const bg=[best.r/best.n,best.g/best.n,best.b/best.n];
    const dist=p=>Math.abs(p[0]-bg[0])+Math.abs(p[1]-bg[1])+Math.abs(p[2]-bg[2]);let far=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=px(x,y);const dd=dist(p);if(dd>90)far.push([dd,p])}
    far.sort((a,b)=>b[0]-a[0]);far=far.slice(0,Math.max(1,Math.ceil(far.length*.35)));
    const fg=far.length&&far[0]?far.reduce((a,[,p])=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(v=>v/far.length):[0,0,0];
    const hex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
    // kenar yumuşatmasından gelen sapmaları düzelt: neredeyse siyah → siyah, neredeyse beyaz → beyaz
    const snap=a=>Math.max(...a)<48&&Math.max(...a)-Math.min(...a)<12?[0,0,0]:Math.min(...a)>242?[255,255,255]:a;
    return{bg:hex(snap(bg)),fg:far.length?hex(snap(fg)):'#000000'}},

  async etDown(e){const s=this.st;const pe=e.target.closest('.page');if(!pe||e.target.closest('.etbox,.ettool'))return;e.preventDefault();
    if($('.etbox')){this._etCommit&&this._etCommit();return}
    const i=+pe.dataset.n-1;const pt=this.ptIn(e,$('svg.ov',pe));
    const own=s.items.find(it=>it.type==='etext'&&it.page===i&&etIn(pt,it));if(own)return this.etEdit(own);
    const runs=await this.etRuns(i);const r=runs.find(r=>etIn(pt,r,1));
    if(!r){const tl=$('.textLayer',pe);toast(tl.classList.contains('empty')?'Bu sayfada metin yok (taranmış görünüyor). Önce "Aranabilir yap" ile OCR uygula, sonra düzenleyebilirsin.':'Burada düzenlenebilir yazı yok. Yeni yazı eklemek için Metin kutusu aracını kullan.',4500);return}
    const col=this.etSample(i,r);
    this.etEdit({type:'etext',page:i,x:r.x-.6,y:r.y-.6,cw:r.w+1.2,ch:r.h+1.2,w:r.w+1.2,h:r.h+1.2,base:r.base,size:+r.size.toFixed(2),family:r.family,bold:r.bold,italic:r.italic,color:col.fg,bg:col.bg,orig:r.text,text:r.text},true)},

  async etEdit(it,isNew){const s=this.st,P=s.pages[it.page];this.etHover(null);$$('.etbox,.ettool').forEach(x=>x.remove());const sc=()=>this.st.scale;
    const g=$(`.a[data-id="${it.id}"]`,P.el);if(g)g.style.opacity=0;
    const box=document.createElement('div');box.className='etbox';box.contentEditable='true';box.spellcheck=false;box.textContent=it.text;
    const tool=document.createElement('div');tool.className='ettool';
    tool.innerHTML=`<select data-k="family" title="Yazı tipi"><option value="sans">Sans (Arial benzeri)</option><option value="serif">Serif (Times benzeri)</option><option value="mono">Mono (Courier benzeri)</option></select>
      <input data-k="size" type="number" min="3" max="200" step="0.5" title="Boyut"><button data-k="bold" title="Kalın"><b>K</b></button><button data-k="italic" title="İtalik"><i>İ</i></button>
      <input data-k="color" type="color" title="Yazı rengi"><input data-k="bg" type="color" title="Arka plan (eski yazıyı kapatan renk)">
      <span class="sp"></span>${isNew?'':`<button data-k="revert" title="Orijinal yazıya dön">Orijinale dön</button>`}<button data-k="ok" class="pri">Tamam</button>`;
    P.el.appendChild(box);P.el.appendChild(tool);
    const st={...it};// düzenleme sırasında geçici değerler
    const layout=()=>{const k=sc();Object.assign(box.style,{left:st.x*k+'px',top:st.y*k+'px',minWidth:st.cw*k+'px',height:st.ch*k+'px',font:etFont(st,st.size*k),color:st.color,background:st.bg,
        // line-height 1 iken Liberation yazı tiplerinde taban çizgisi üstten ~0,845 em aşağıdadır
        lineHeight:'1',paddingTop:Math.max(0,(st.base-st.y-st.size*.845)*k)+'px'});
      tool.style.left=Math.max(0,Math.min(st.x*k,P.el.clientWidth-470))+'px';tool.style.top=Math.max(-46,st.y*k-46)+'px';
      $('[data-k=family]',tool).value=st.family;$('[data-k=size]',tool).value=st.size;$('[data-k=bold]',tool).classList.toggle('on',!!st.bold);$('[data-k=italic]',tool).classList.toggle('on',!!st.italic);
      $('[data-k=color]',tool).value=st.color;$('[data-k=bg]',tool).value=st.bg};
    layout();box.focus();const sel=getSelection(),rg=document.createRange();rg.selectNodeContents(box);sel.removeAllRanges();sel.addRange(rg);
    tool.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target.closest('button'))e.preventDefault()});box.addEventListener('pointerdown',e=>e.stopPropagation());
    tool.addEventListener('input',e=>{const k=e.target.dataset.k;if(k==='size')st.size=Math.max(3,+e.target.value||st.size);else if(k)st[k]=e.target.value;layout()});
    tool.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;
      if(k==='bold'||k==='italic'){st[k]=!st[k];layout();box.focus()}else if(k==='ok')commit();else if(k==='revert'){close();this.remove(it.id)}});
    let done=false;
    const close=()=>{done=true;box.remove();tool.remove();document.removeEventListener('pointerdown',outside,true);this._etCommit=null;if(g)g.style.opacity=''};
    const commit=async()=>{if(done)return;const text=box.innerText.replace(/\n+/g,' ').replace(/\s+$/,'');close();
      const changed=text!==it.text||['family','size','bold','italic','color','bg'].some(k=>st[k]!==it[k]);if(!changed)return;
      if(!text&&!isNew){this.remove(it.id);return}
      await document.fonts.load(etFont(st,st.size)).catch(()=>{});const c=this._mc||(this._mc=document.createElement('canvas').getContext('2d'));c.font=etFont(st,st.size);
      const tw=c.measureText(text).width+1;const upd={...st,text,w:Math.max(st.cw,tw),h:st.ch};
      if(isNew){if(text===it.orig&&!['family','size','bold','italic','color','bg'].some(k=>st[k]!==it[k]))return;this.add(upd)}
      else this.mutate(()=>Object.assign(it,upd))};
    const outside=e=>{if(!box.contains(e.target)&&!tool.contains(e.target))commit()};
    setTimeout(()=>document.addEventListener('pointerdown',outside,true),0);this._etCommit=commit;
    box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();commit()}if(e.key==='Escape'){e.preventDefault();close()}});
    box.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,(e.clipboardData.getData('text/plain')||'').replace(/\s*\n\s*/g,' '))})},

  etSvg(it,id){return `<g ${id}><rect x="${it.x}" y="${it.y}" width="${it.cw}" height="${it.ch}" fill="${it.bg}"/>${it.w>it.cw?`<rect x="${it.x+it.cw}" y="${it.y}" width="${it.w-it.cw}" height="${it.ch}" fill="${it.bg}"/>`:''}`+
    `<text x="${it.x+.6}" y="${it.base}" font-family='${ET_CSS[it.family]||ET_CSS.sans}' font-size="${it.size}" font-weight="${it.bold?700:400}" font-style="${it.italic?'italic':'normal'}" fill="${it.color}" xml:space="preserve">${esc(it.text)}</text>`+
    `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="transparent"/></g>`},

  async etDraw(doc,pg,it,cv,R){const L=window.PDFLib;const font=await embedFont(doc,it.bold,it.family,it.italic);
    const poly=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map((p,k)=>{const q=cv(p[0],p[1]);return(k?'L':'M')+q[0].toFixed(2)+','+(-q[1]).toFixed(2)}).join('')+'Z';
    // Eski yazı dosyadan silindiyse üstünü kapatmaya gerek yok; silinemediyse arka plan rengiyle kapat
    if(!it._stripped)pg.drawSvgPath(poly(it.x,it.y,it.w,it.ch),{x:0,y:0,color:L.rgb(...hexRgb(it.bg))});
    if(it.text){const o=cv(it.x+.6,it.base);pg.drawText(it.text,{x:o[0],y:o[1],size:it.size,font,color:L.rgb(...hexRgb(it.color)),rotate:L.degrees(R)})}},

  // Düzenlenen satırların eski yazısını sayfa içeriğinden gerçekten sil.
  // Yazı komutları (Tj, TJ, ', ") aynı genişlikte boşlukla değiştirilir: başka hiçbir şeyin yeri kaymaz,
  // eski yazı artık ne görünür ne aranır ne de kopyalanır.
  async etStrip(doc,pageIndex,items,P){const L=window.PDFLib;const pg=doc.getPage(pageIndex);const ctx=doc.context;const N=x=>L.PDFName.of(x);
    // eşleşme kutuları PDF koordinatlarında
    const boxes=items.map(it=>{const a=P.vp1.convertToPdfPoint(it.x,it.y),b=P.vp1.convertToPdfPoint(it.x+it.cw,it.y+it.ch);
      return{it,x0:Math.min(a[0],b[0])-.8,x1:Math.max(a[0],b[0])+.5,y0:Math.min(a[1],b[1])-.8,y1:Math.max(a[1],b[1])+.8,hit:0}});
    // içerik akışlarını çöz ve birleştir
    let cont=pg.node.Contents();if(!cont)return;const list=cont instanceof L.PDFArray?cont.asArray().map(r=>ctx.lookup(r)):[cont];
    const parts=[];for(const st of list){if(st instanceof L.PDFRawStream)parts.push(L.decodePDFRawStream(st).decode());else if(st&&st.getContents)parts.push(st.getContents());else return}
    let total=0;parts.forEach(p=>total+=p.length+1);const u8=new Uint8Array(total);let o=0;for(const p of parts){u8.set(p,o);o+=p.length;u8[o++]=10}
    let src='';for(let i=0;i<u8.length;i+=8192)src+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
    const ops=etParse(src);
    // yazı tipi genişlikleri
    const res=pg.node.Resources();const fontsD=res&&res.lookup(N('Font'));const fcache={};
    const num=v=>v&&v.asNumber?v.asNumber():(typeof v==='number'?v:0);
    const fontOf=name=>{if(fcache[name])return fcache[name];let f={two:false,w:()=>500};try{const fd=fontsD&&fontsD.lookup(N(name));if(fd){const sub=fd.lookup(N('Subtype'));
      if(sub&&sub.toString()==='/Type0'){const df=ctx.lookup(fd.lookup(N('DescendantFonts')).get(0));const dw=num(df.lookup(N('DW')))||1000;const W=df.lookup(N('W'));const map={};
        if(W){const a=W.asArray().map(x=>ctx.lookup(x)||x);for(let i=0;i<a.length;){const c=num(a[i]);const nx=a[i+1];if(nx instanceof L.PDFArray){nx.asArray().forEach((w,k)=>map[c+k]=num(ctx.lookup(w)||w));i+=2}else{const c2=num(nx),w=num(a[i+2]);for(let k=c;k<=c2;k++)map[k]=w;i+=3}}}
        f={two:true,w:c=>map[c]??dw}}
      else{const fc=num(fd.lookup(N('FirstChar')));const ws=fd.lookup(N('Widths'));const arr=ws?ws.asArray().map(x=>num(ctx.lookup(x)||x)):[];const desc=fd.lookup(N('FontDescriptor'));const mw=desc?num(desc.lookup(N('MissingWidth'))):0;
        f={two:false,w:c=>arr[c-fc]??(mw||500)}}}}catch(e){console.warn(e)}return fcache[name]=f};
    // grafik ve yazı durumu
    const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
    let gs={ctm:[1,0,0,1,0,0],Tfs:0,Th:1,Tc:0,Tw:0,TL:0,font:null};const stack=[];let tm=[1,0,0,1,0,0],tlm=tm;const repl=[];
    const adv=bytes=>{const f=gs.font||{two:false,w:()=>500};let t=0;if(f.two){for(let i=0;i+1<bytes.length;i+=2){t+=(f.w(bytes[i]<<8|bytes[i+1])/1000*gs.Tfs+gs.Tc)*gs.Th}}
      else for(const c of bytes)t+=(f.w(c)/1000*gs.Tfs+gs.Tc+(c===32?gs.Tw:0))*gs.Th;return t};
    const nl=()=>{tlm=mul([1,0,0,1,0,-gs.TL],tlm);tm=tlm};
    const show=(op,arr,prefix)=>{const m=mul(tm,gs.ctm);const x=m[4],y=m[5];let t=0;for(const e of arr)t+=typeof e==='number'?-e/1000*gs.Tfs*gs.Th:adv(e);
      const b=boxes.find(b=>x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1);
      if(b&&gs.Tfs&&gs.Th){b.hit++;repl.push({s:op.s,e:op.e,txt:`${prefix||''}[${(-t*1000/(gs.Tfs*gs.Th)).toFixed(3)}] TJ`})}
      tm=mul([1,0,0,1,t,0],tm)};
    for(const op of ops){const a=op.a;switch(op.op){
      case'q':stack.push({...gs});break;case'Q':if(stack.length)gs=stack.pop();break;case'cm':if(a.length===6)gs.ctm=mul(a,gs.ctm);break;
      case'BT':tm=tlm=[1,0,0,1,0,0];break;case'Tf':gs.font=fontOf(a[0]);gs.Tfs=a[1];break;case'Tc':gs.Tc=a[0];break;case'Tw':gs.Tw=a[0];break;case'Tz':gs.Th=a[0]/100;break;case'TL':gs.TL=a[0];break;
      case'Td':tlm=mul([1,0,0,1,a[0],a[1]],tlm);tm=tlm;break;case'TD':gs.TL=-a[1];tlm=mul([1,0,0,1,a[0],a[1]],tlm);tm=tlm;break;case'Tm':if(a.length===6){tm=tlm=a.slice()}break;case'T*':nl();break;
      case'Tj':show(op,[a[0]]);break;case'TJ':show(op,a[0]||[]);break;
      case"'":nl();show(op,[a[0]],'T* ');break;case'"':gs.Tw=a[0];gs.Tc=a[1];nl();show(op,[a[2]],`${a[0]} Tw ${a[1]} Tc T* `);break}}
    if(!repl.length)return;
    let out='',last=0;for(const r of repl.sort((p,q)=>p.s-q.s)){out+=src.slice(last,r.s)+r.txt;last=r.e}out+=src.slice(last);
    const bytes=new Uint8Array(out.length);for(let i=0;i<out.length;i++)bytes[i]=out.charCodeAt(i)&255;
    pg.node.set(N('Contents'),ctx.register(ctx.flateStream(bytes)));
    boxes.forEach(b=>{if(b.hit)b.it._stripped=true})},
});

// PDF içerik akışı ayrıştırıcı: her operatör için {op, a:argümanlar, s:başlangıç, e:bitiş} (bayt konumu)
function etParse(s){const n=s.length;const ops=[];let args=[],aStart=-1,i=0;const stack=[];
  const WS=c=>c===32||c===10||c===13||c===9||c===12||c===0;const DL=c=>WS(c)||'()<>[]{}/%'.includes(String.fromCharCode(c));
  const push=(v,st)=>{if(stack.length)stack[stack.length-1].push(v);else{if(aStart<0)aStart=st;args.push(v)}};
  while(i<n){const c=s.charCodeAt(i);const st=i;
    if(WS(c)){i++;continue}
    if(c===37){while(i<n&&s[i]!=='\n'&&s[i]!=='\r')i++;continue}
    if(c===40){// (literal)
      i++;let d=1;const b=[];while(i<n&&d>0){let ch=s.charCodeAt(i);if(ch===92){i++;ch=s.charCodeAt(i);const m={110:10,114:13,116:9,98:8,102:12};
          if(m[ch]!=null){b.push(m[ch]);i++}else if(ch>=48&&ch<=55){let v=0,k=0;while(k<3&&s.charCodeAt(i)>=48&&s.charCodeAt(i)<=55){v=v*8+s.charCodeAt(i)-48;i++;k++}b.push(v&255)}
          else if(ch===13||ch===10){i++;if(ch===13&&s.charCodeAt(i)===10)i++}else{b.push(ch);i++}continue}
        if(ch===40)d++;else if(ch===41){d--;if(!d){i++;break}}b.push(ch);i++}push(b,st);continue}
    if(c===60&&s.charCodeAt(i+1)===60){i+=2;stack.push([]);if(stack.length===1&&aStart<0)aStart=st;continue}
    if(c===62&&s.charCodeAt(i+1)===62){i+=2;const d=stack.pop()||[];push({dict:d},st);continue}
    if(c===60){i++;let h='';while(i<n&&s[i]!=='>'){h+=s[i];i++}i++;h=h.replace(/\s+/g,'');if(h.length%2)h+='0';const b=[];for(let k=0;k<h.length;k+=2)b.push(parseInt(h.substr(k,2),16));push(b,st);continue}
    if(c===91){i++;stack.push([]);if(stack.length===1&&aStart<0)aStart=st;continue}
    if(c===93){i++;const a=stack.pop()||[];push(a,st);continue}
    if(c===123||c===125){i++;continue}
    if(c===47){i++;let nm='';while(i<n&&!DL(s.charCodeAt(i))){nm+=s[i];i++}push(nm.replace(/#([0-9a-fA-F]{2})/g,(m,h)=>String.fromCharCode(parseInt(h,16))),st);continue}
    let w='';while(i<n&&!DL(s.charCodeAt(i))){w+=s[i];i++}if(!w){i++;continue}
    if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)){push(parseFloat(w),st);continue}
    if(w==='true'||w==='false'||w==='null'){push(w,st);continue}
    if(stack.length){stack[stack.length-1].push(w);continue}
    ops.push({op:w,a:args,s:aStart<0?st:aStart,e:i});args=[];aStart=-1;
    if(w==='BI'){// satır içi görsel: EI'ye kadar atla
      const k=s.indexOf('ID',i);let j=k+3;while(j<n){const e=s.indexOf('EI',j);if(e<0){j=n;break}if(WS(s.charCodeAt(e-1))&&(e+2>=n||DL(s.charCodeAt(e+2)))){j=e+2;break}j=e+2}i=j}}
  return ops}
