// PDF Atölyem — okuyucu ve işaretleme katmanı
'use strict';
const COLORS=['#ffd400','#7ee36d','#5ac8fa','#ff8fb1','#c39bff','#ff6b3d','#e53935','#1e63d6','#1d2330','#ffffff'];
const TOOLS=[['sel','Seç ve taşı (V)','sel'],['edittext','Metni düzenle (M)','edit'],['hl','Vurgula (H)','hl'],['ul','Altını çiz (U)','ul'],['st','Üstünü çiz (S)','st'],'|',
  ['pen','Kalem (P)','pen'],['rect','Dikdörtgen (R)','rect'],['ell','Elips (O)','ell'],['line','Çizgi (L)','line'],['arrow','Ok (A)','arrow'],'|',
  ['text','Metin kutusu (T)','text'],['note','Yapışkan not (N)','note'],['sign','İmza ekle','sign'],['image','Görsel ekle','img'],['stamp','Damga','stamp'],'|',['erase','Silgi (E)','erase']];
const KEYS={m:'edittext',v:'sel',h:'hl',u:'ul',s:'st',p:'pen',r:'rect',o:'ell',l:'line',a:'arrow',t:'text',n:'note',e:'erase'};
const TYPE_TR={etext:'Düzenlenen metin',highlight:'Vurgu',underline:'Altı çizili',strike:'Üstü çizili',ink:'Kalem',rect:'Dikdörtgen',ell:'Elips',line:'Çizgi',arrow:'Ok',text:'Metin',note:'Not',img:'Görsel'};
const hexRgb=h=>{const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};

const V={
  st:null,
  async open(id){
    const rec=await Docs.get(id);if(!rec){toast('Belge bulunamadı');location.hash='#/';return}
    let bytes=await Docs.bytes(id),pdf;
    try{pdf=await openPdf(bytes)}catch(e){
      if(e.name==='PasswordException'){const pw=await promptPw();if(pw==null){location.hash='#/';return}try{pdf=await openPdf(bytes,pw)}catch(e2){alertBox('Açılamadı','Şifre yanlış.');location.hash='#/';return}}
      else{alertBox('Açılamadı',esc(errText(e)));location.hash='#/';return}}
    const prefs=(await DB.get('kv','viewer'))||{};
    const items=(await DB.get('ann',id))||[];
    rec.opened=Date.now();Docs.update(rec);
    this.st={id,rec,bytes,pdf,pages:[],scale:1,fit:prefs.fit||'w',two:!!prefs.two,theme:prefs.theme||'',tool:'sel',color:COLORS[0],tc:prefs.tc||{},width:prefs.width||2,font:prefs.font||14,
      items,hist:[],fut:[],picked:null,cur:Math.min(rec.lastPage||1,pdf.numPages),text:{},sideTab:'thumbs',side:prefs.side!==false,search:null};
    this.build();await this.layout();this.applyFit();this.sideTab('thumbs');
    requestAnimationFrame(()=>this.goto(this.st.cur,false));
  },
  close(){const s=this.st;if(!s)return;clearTimeout(this._sv);this.saveNow();this.io&&this.io.disconnect();this.tio&&this.tio.disconnect();s.pdf.destroy();this.st=null;document.removeEventListener('keydown',this._kd);document.removeEventListener('selectionchange',this._sc);window.removeEventListener('resize',this._rs);clearTimeout(this._zt);clearTimeout(this._lp)},

  /* ---------- arayüz ---------- */
  build(){const s=this.st;const app=$('#app');
    app.innerHTML=`
    <header class="top">
      <a class="ib" href="#/" data-tip="Belgelerim">${ic('back')}</a>
      <div class="title" title="${esc(s.rec.name)}">${esc(baseName(s.rec.name))}</div>
      <div class="sep"></div>
      <button class="ib${s.side?' on':''}" id="vSide" data-tip="Kenar çubuğu">${ic('side')}</button>
      <div class="pg"><button class="ib" id="vPrev" data-tip="Önceki sayfa">${ic('up')}</button><input id="vPg" value="1"><span>/ ${s.pdf.numPages}</span><button class="ib" id="vNext" data-tip="Sonraki sayfa">${ic('down')}</button></div>
      <div class="sep hide-s"></div>
      <button class="ib" id="vZo" data-tip="Uzaklaştır">${ic('minus')}</button>
      <select class="zoomsel" id="vZs"><option value="w">Genişliğe sığdır</option><option value="p">Sayfaya sığdır</option>${[50,75,100,125,150,200,300,400].map(z=>`<option value="${z}">%${z}</option>`).join('')}<option value="c" hidden>%</option></select>
      <button class="ib" id="vZi" data-tip="Yakınlaştır">${ic('plus')}</button>
      <button class="ib hide-s${s.two?' on':''}" id="vTwo" data-tip="İki sayfa">${ic('two')}</button>
      <button class="ib hide-s" id="vTheme" data-tip="Okuma modu (gece / sepya)">${ic('moon')}</button>
      <button class="ib" id="vFind" data-tip="Ara (Ctrl+F)">${ic('search')}</button>
      <button class="ib hide-s" id="vFull" data-tip="Tam ekran">${ic('full')}</button>
      <div class="sp"></div>
      <button class="btn ghost hide-s" id="vOcr" title="Taranmış sayfaları aranabilir yap">${ic('ocr')}<span>Aranabilir yap</span></button>
      <button class="btn ghost" id="vMore">${ic('dots')}</button>
      <button class="btn pri" id="vExp">${ic('dl')}<span class="hide-s">Dışa aktar</span></button>
    </header>
    <div class="tbar2" id="vBar">
      ${TOOLS.map(t=>t==='|'?'<div class="sep"></div>':`<button class="ib" data-tool="${t[0]}" data-tip="${t[1]}">${ic(t[2])}</button>`).join('')}
      <div class="sep"></div>
      <div style="display:flex;gap:5px" id="vCols">${COLORS.map(c=>`<span class="sw" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
      <div class="sep"></div>
      <label>Kalınlık <input type="range" id="vW" min="0.5" max="12" step="0.5" value="${s.width}"></label>
      <label>Yazı <select id="vF" class="zoomsel">${[8,10,12,14,16,18,20,24,28,36,48].map(f=>`<option${f==s.font?' selected':''}>${f}</option>`).join('')}</select></label>
      <div class="sep"></div>
      <button class="ib" id="vUndo" data-tip="Geri al (Ctrl+Z)">${ic('undo')}</button>
      <button class="ib" id="vRedo" data-tip="Yinele (Ctrl+Y)">${ic('redo')}</button>
      <button class="ib" id="vDel" data-tip="Seçileni sil (Del)" disabled>${ic('trash')}</button>
    </div>
    <div class="viewer withbar">
      <aside class="side${s.side?'':' closed'}" id="vSideP">
        <div class="tabs"><button data-t="thumbs">Sayfalar</button><button data-t="outline">İçindekiler</button><button data-t="anns">Notlar</button></div>
        <div class="sidebody" id="vSB"></div>
      </aside>
      <main class="main ${s.theme}" id="vMain"><div class="pages${s.two?' two':''}" id="vPages"></div></main>
    </div>`;
    const m=$('#vMain');
    $('#vSide').onclick=()=>{s.side=!s.side;$('#vSideP').classList.toggle('closed',!s.side);$('#vSide').classList.toggle('on',s.side);this.prefs();this.applyFit()};
    $('#vPrev').onclick=()=>this.goto(s.cur-1);$('#vNext').onclick=()=>this.goto(s.cur+1);
    $('#vPg').onchange=e=>this.goto(parseInt(e.target.value)||1);$('#vPg').onfocus=e=>e.target.select();
    $('#vZo').onclick=()=>this.zoom(s.scale/1.2);$('#vZi').onclick=()=>this.zoom(s.scale*1.2);
    $('#vZs').onchange=e=>{const v=e.target.value;if(v==='w'||v==='p'){s.fit=v;this.applyFit()}else this.zoom(v/100)};
    $('#vTwo').onclick=()=>{s.two=!s.two;$('#vPages').classList.toggle('two',s.two);$('#vTwo').classList.toggle('on',s.two);this.prefs();this.applyFit()};
    $('#vTheme').onclick=()=>{const order=['','sepia','dark'];s.theme=order[(order.indexOf(s.theme)+1)%3];m.className='main '+s.theme;this.setTool(s.tool);this.prefs();toast(s.theme==='dark'?'Gece modu':s.theme==='sepia'?'Sepya modu':'Normal görünüm')};
    $('#vFind').onclick=()=>this.openSearch();
    $('#vFull').onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()};
    $('#vExp').onclick=()=>this.exportDlg();
    $('#vOcr').onclick=()=>{this.saveNow();location.hash='#/arac/ocr?doc='+s.id};
    $('#vMore').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();popMenu(r.left,r.bottom+4,[
      {icon:'save',label:'Notları metin olarak dışa aktar',fn:()=>this.exportNotes()},
      {icon:'org',label:'Sayfaları düzenle',fn:()=>{this.saveNow();location.hash='#/arac/organize?doc='+s.id}},
      {icon:'ocr',label:'Aranabilir yap (OCR)',fn:()=>$('#vOcr').click()},
      '-',{icon:'edit',label:'Yeniden adlandır',fn:async()=>{const n=await promptBox('Yeniden adlandır','Belge adı',baseName(s.rec.name));if(n){s.rec.name=n.trim()+'.pdf';Docs.update(s.rec);$('.top .title').textContent=n}}},
      {icon:'info',label:'Belge bilgisi',fn:()=>this.info()},
      {icon:'info',label:'Kısayollar',fn:()=>alertBox('Klavye kısayolları','<div style="line-height:2"><kbd>V</kbd> seç · <kbd>H</kbd> vurgula · <kbd>U</kbd> altını çiz · <kbd>S</kbd> üstünü çiz · <kbd>P</kbd> kalem · <kbd>R</kbd> dikdörtgen · <kbd>O</kbd> elips · <kbd>L</kbd> çizgi · <kbd>A</kbd> ok · <kbd>T</kbd> metin · <kbd>N</kbd> not · <kbd>E</kbd> silgi<br><kbd>Ctrl</kbd>+<kbd>Z</kbd> geri al · <kbd>Ctrl</kbd>+<kbd>Y</kbd> yinele · <kbd>Del</kbd> sil · <kbd>Ctrl</kbd>+<kbd>F</kbd> ara · <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> yakınlaştır · <kbd>←</kbd>/<kbd>→</kbd> sayfa</div>')},
    ])};
    $$('#vBar [data-tool]').forEach(b=>b.onclick=()=>this.setTool(b.dataset.tool));
    $$('#vCols .sw').forEach(w=>w.onclick=()=>{s.color=w.dataset.c;if(!s.picked)s.tc[s.tool]=s.color;this.markColor();if(s.picked)this.mutate(()=>{const it=this.item(s.picked);if(it)it.color=s.color});this.prefs()});
    $('#vW').oninput=e=>{s.width=+e.target.value;const it=s.picked&&this.item(s.picked);if(it&&'width'in it){this.mutate(()=>{it.width=s.width},true)}this.prefs()};
    $('#vF').onchange=e=>{s.font=+e.target.value;const it=s.picked&&this.item(s.picked);if(it&&it.type==='text'){this.mutate(()=>{it.size=s.font;this.measureText(it)})}this.prefs()};
    $('#vUndo').onclick=()=>this.undo();$('#vRedo').onclick=()=>this.redo();$('#vDel').onclick=()=>this.delPicked();
    $$('.tabs button').forEach(b=>b.onclick=()=>this.sideTab(b.dataset.t));
    m.addEventListener('scroll',()=>this.onScroll(),{passive:true});
    m.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.zoom(s.scale*(e.deltaY<0?1.1:1/1.1),e)}},{passive:false});
    this._kd=e=>this.key(e);document.addEventListener('keydown',this._kd);
    this._rs=()=>{if(s.fit)this.applyFit()};window.addEventListener('resize',this._rs);
    this.bindPointer();this.etBind();this.setTool('sel');this.markColor();this.histBtns();
  },
  prefs(){const s=this.st;DB.put('kv',{fit:s.fit,two:s.two,theme:s.theme,tc:s.tc,width:s.width,font:s.font,side:s.side},'viewer')},
  markColor(){$$('#vCols .sw').forEach(w=>w.classList.toggle('on',w.dataset.c===this.st.color))},
  setTool(t){const s=this.st;
    if(t==='sign')return this.signDlg();if(t==='image')return this.imageDlg();if(t==='stamp')return this.stampDlg();
    s.tool=t;this.pick(null);$$('#vBar [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
    const m=$('#vMain');m.classList.remove('draw','sel','erase');
    if(['pen','rect','ell','line','arrow','text','note','place'].includes(t))m.classList.add('draw');else if(t==='erase')m.classList.add('erase');else if(t==='edittext'){m.classList.add('etext');this.etPrepare()}else if(t==='sel')m.classList.add('sel');
    // Her araç kendi rengini hatırlar
    const def={hl:'#ffd400',ul:'#1e63d6',st:'#e53935',pen:'#e53935',rect:'#e53935',ell:'#e53935',line:'#e53935',arrow:'#e53935',text:'#1d2330',note:'#ffd400'}[t];
    if(def){s.color=s.tc[t]||def;this.markColor()}
  },

  /* ---------- sayfa düzeni ve çizim ---------- */
  async layout(){const s=this.st,box=$('#vPages');box.innerHTML='';s.pages=[];
    const p1=await s.pdf.getPage(1);const def=p1.getViewport({scale:1});
    for(let i=1;i<=s.pdf.numPages;i++){const d=document.createElement('div');d.className='page';d.dataset.n=i;
      d.innerHTML=`<canvas class="c"></canvas><div class="textLayer"></div><svg class="ov" data-p="${i-1}" preserveAspectRatio="none"></svg><div class="num">${i}</div>`;
      box.appendChild(d);s.pages.push({el:d,w:def.width,h:def.height,vp1:null,page:null,rs:0,tl:false})}
    // Gerçek sayfa boyutlarını arka planda öğren (farklı boyutlu sayfalar için)
    (async()=>{for(let i=0;i<s.pages.length;i++){if(!this.st||this.st!==s)return;const pg=await s.pdf.getPage(i+1);const v=pg.getViewport({scale:1});const P=s.pages[i];P.page=pg;P.vp1=v;
      if(Math.abs(v.width-P.w)>.5||Math.abs(v.height-P.h)>.5){P.w=v.width;P.h=v.height;this.sizePage(i)}if(i%20===19)await sleep(0)}if(s.fit)this.applyFit()})();
    this.io=new IntersectionObserver(es=>{for(const e of es){const i=+e.target.dataset.n-1;s.pages[i].vis=e.isIntersecting;if(e.isIntersecting)this.renderPage(i)}},{root:$('#vMain'),rootMargin:'600px 0px'});
    s.pages.forEach(P=>this.io.observe(P.el));
  },
  sizePage(i){const s=this.st,P=s.pages[i];P.el.style.width=P.w*s.scale+'px';P.el.style.height=P.h*s.scale+'px';const o=$('svg.ov',P.el);o.setAttribute('viewBox',`0 0 ${P.w} ${P.h}`);P.el.querySelector('.textLayer').style.setProperty('--scale-factor',s.scale)},
  async getP(i){const P=this.st.pages[i];if(!P.page){P.page=await this.st.pdf.getPage(i+1);P.vp1=P.page.getViewport({scale:1})}return P},
  async renderPage(i){const s=this.st,P=await this.getP(i);if(!this.st)return;const want=s.scale;if(P.rs===want||P.busy)return;P.busy=true;
    try{const dpr=Math.min(window.devicePixelRatio||1,2);const vp=P.page.getViewport({scale:want*dpr});const c=document.createElement('canvas');c.className='c';
      c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
      P.task&&P.task.cancel();P.task=P.page.render({canvasContext:c.getContext('2d'),viewport:vp});await P.task.promise;
      const old=$('canvas.c',P.el);old.replaceWith(c);P.rs=want;
      if(!P.tl){P.tl=true;const tl=$('.textLayer',P.el);const tc=await P.page.getTextContent();s.text[i]=tc;
        const L=window.pdfjsLib;tl.style.setProperty('--scale-factor',s.scale);
        await L.renderTextLayer({textContentSource:tc,container:tl,viewport:P.page.getViewport({scale:s.scale})}).promise;
        tl.classList.toggle('empty',!tc.items.some(t=>t.str.trim()));
        const eoc=document.createElement('div');eoc.className='endOfContent';tl.appendChild(eoc)}
      this.drawAnn(i);
    }catch(e){if(e.name!=='RenderingCancelledException')console.warn(e)}finally{P.busy=false;if(s.scale!==P.rs&&P.vis)this.renderPage(i)}},
  applyFit(){const s=this.st;if(!s)return;const m=$('#vMain');const W=m.clientWidth-48,H=m.clientHeight-40;const pw=Math.max(...s.pages.map(p=>p.w)),ph=Math.max(...s.pages.map(p=>p.h));
    const per=s.two?2:1;const sw=(W-(per-1)*16)/(pw*per);let sc=s.fit==='p'?Math.min(sw,H/ph):sw;if(!s.fit)return;this.setScale(Math.max(.1,Math.min(sc,6)),null,true)},
  zoom(sc,ev){this.st.fit=null;this.setScale(Math.max(.1,Math.min(sc,8)),ev)},
  setScale(sc,ev,keepFit){const s=this.st,m=$('#vMain');const before=s.scale;
    const ax=ev?ev.clientX-m.getBoundingClientRect().left:m.clientWidth/2,ay=ev?ev.clientY-m.getBoundingClientRect().top:0;
    const fx=(m.scrollLeft+ax)/before,fy=(m.scrollTop+ay)/before;s.scale=sc;
    s.pages.forEach((P,i)=>this.sizePage(i));
    m.scrollLeft=fx*sc-ax;m.scrollTop=fy*sc-ay;
    const zs=$('#vZs');if(s.fit)zs.value=s.fit;else{const o=zs.querySelector('option[value=c]');o.textContent='%'+Math.round(sc*100);o.hidden=false;zs.value='c'}
    if(!keepFit)this.prefs();
    clearTimeout(this._zt);this._zt=setTimeout(()=>s.pages.forEach((P,i)=>{if(P.vis)this.renderPage(i)}),120)},
  onScroll(){const s=this.st,m=$('#vMain');if(!s||!m)return;const mid=m.getBoundingClientRect().top+m.clientHeight*.35;let best=1;
    for(let i=0;i<s.pages.length;i++){const r=s.pages[i].el.getBoundingClientRect();if(r.top<=mid)best=i+1;else break}
    if(best!==s.cur){s.cur=best;this.pgUI();clearTimeout(this._lp);this._lp=setTimeout(()=>{if(this.st){s.rec.lastPage=s.cur;Docs.update(s.rec)}},700)}},
  pgUI(){const s=this.st;if(!s||!$('#vPg'))return;$('#vPg').value=s.cur;$$('.thumb').forEach(t=>t.classList.toggle('on',+t.dataset.n===s.cur));const t=$(`.thumb[data-n="${s.cur}"]`);if(t&&s.sideTab==='thumbs'){const sb=$('#vSB'),r=t.getBoundingClientRect(),q=sb.getBoundingClientRect();if(r.top<q.top||r.bottom>q.bottom)t.scrollIntoView({block:'nearest'})}},
  goto(n,smooth=true){const s=this.st;n=Math.max(1,Math.min(s.pages.length,n));const P=s.pages[n-1];const m=$('#vMain');m.scrollTo({top:P.el.offsetTop-12,behavior:smooth?'smooth':'auto'});s.cur=n;this.pgUI()},
  scrollToRect(i,y){const s=this.st,P=s.pages[i],m=$('#vMain');m.scrollTo({top:P.el.offsetTop+y*s.scale-m.clientHeight/3,behavior:'smooth'})},

  /* ---------- kenar çubuğu ---------- */
  async sideTab(t){const s=this.st;s.sideTab=t;$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));const sb=$('#vSB');this.tio&&this.tio.disconnect();
    if(t==='thumbs'){sb.innerHTML='<div class="thumbs">'+s.pages.map((P,i)=>`<div class="thumb${i+1===s.cur?' on':''}" data-n="${i+1}"><div class="ph" style="aspect-ratio:${P.w}/${P.h};height:auto"></div>${i+1}</div>`).join('')+'</div>';
      this.tio=new IntersectionObserver(es=>es.forEach(async e=>{if(!e.isIntersecting||!this.st)return;const el=e.target;this.tio.unobserve(el);const i=+el.dataset.n-1;const P=await this.getP(i);const c=document.createElement('canvas');await renderTo(c,P.page,240);c.style.width='120px';el.querySelector('.ph').replaceWith(c)}),{root:sb,rootMargin:'300px'});
      $$('.thumb',sb).forEach(el=>{this.tio.observe(el);el.onclick=()=>this.goto(+el.dataset.n)})}
    else if(t==='outline'){sb.innerHTML='<div class="outline">Yükleniyor…</div>';const ol=await s.pdf.getOutline();
      if(!ol||!ol.length){sb.innerHTML='<div class="empty">Bu belgede içindekiler bilgisi yok.</div>';return}
      const flat=[];const walk=(arr,d)=>arr.forEach(o=>{flat.push([o,d]);o.items&&walk(o.items,d+1)});walk(ol,0);
      sb.innerHTML='<div class="outline">'+flat.map(([o,d],k)=>`<div data-k="${k}" style="padding-left:${6+d*14}px">${esc(o.title)}</div>`).join('')+'</div>';
      $$('.outline div',sb).forEach(el=>el.onclick=async()=>{const o=flat[+el.dataset.k][0];let dest=o.dest;if(typeof dest==='string')dest=await s.pdf.getDestination(dest);if(!dest)return;const idx=await s.pdf.getPageIndex(dest[0]);this.goto(idx+1)})}
    else this.annList()},
  annList(){const s=this.st;if(s.sideTab!=='anns')return;const sb=$('#vSB');const f=this._af||{type:'',color:''};
    const list=s.items.filter(it=>(!f.type||it.type===f.type)&&(!f.color||it.color===f.color)).sort((a,b)=>a.page-b.page||this.bbox(a).y-this.bbox(b).y);
    const types=[...new Set(s.items.map(i=>i.type))],cols=[...new Set(s.items.map(i=>i.color).filter(Boolean))];
    sb.innerHTML=`<div class="annlist"><div class="flt"><select id="afT"><option value="">Tüm türler</option>${types.map(t=>`<option value="${t}"${f.type===t?' selected':''}>${TYPE_TR[t]||t}</option>`).join('')}</select>
      <select id="afC"><option value="">Tüm renkler</option>${cols.map(c=>`<option value="${c}"${f.color===c?' selected':''} style="background:${c}">${c}</option>`).join('')}</select></div>
      ${list.length?list.map(it=>`<div class="it" data-id="${it.id}"><div class="h"><i style="background:${it.color||'#ccc'}"></i>${TYPE_TR[it.type]||it.type} · s. ${it.page+1}</div><div class="q">${esc(it.text||it.comment||'')||'<span style="color:var(--tx3)">—</span>'}</div>${it.comment&&it.text?`<div style="margin-top:4px;color:var(--tx2)">💬 ${esc(it.comment)}</div>`:''}</div>`).join(''):'<div class="empty">Henüz not ya da vurgu yok.<br>Üstteki araçlarla ekleyebilirsin.</div>'}</div>`;
    $('#afT').onchange=e=>{this._af={...f,type:e.target.value};this.annList()};$('#afC').onchange=e=>{this._af={...f,color:e.target.value};this.annList()};
    $$('.it',sb).forEach(el=>el.onclick=()=>{const it=this.item(el.dataset.id);if(!it)return;const bb=this.bbox(it);this.scrollToRect(it.page,bb.y);this.setTool('sel');setTimeout(()=>this.pick(it.id),300)})},

  /* ---------- işaretlemeler ---------- */
  item(id){return this.st.items.find(i=>i.id===id)},
  drawAnn(i){const s=this.st;const P=s.pages[i];if(!P)return;const svg=$('svg.ov',P.el);
    svg.innerHTML=s.items.filter(it=>it.page===i).map(it=>this.annSvg(it)).join('')+(s.picked&&this.item(s.picked)?.page===i?this.selSvg(this.item(s.picked)):'')+this.searchSvg(i)},
  redraw(page){if(page==null)this.st.pages.forEach((P,i)=>this.drawAnn(i));else this.drawAnn(page)},
  annSvg(it){const c=it.color||'#000',id=`class="a" data-id="${it.id}"`;const op=it.opacity??1;
    switch(it.type){
      case'highlight':return `<g ${id} style="mix-blend-mode:multiply">${it.rects.map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${c}" fill-opacity="${it.opacity??.4}"/>`).join('')}</g>`;
      case'underline':case'strike':return `<g ${id}>${it.rects.map(r=>{const y=it.type==='underline'?r[1]+r[3]*.94:r[1]+r[3]*.55;return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="transparent"/><line x1="${r[0]}" x2="${r[0]+r[2]}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="${Math.max(.8,r[3]*.08)}"/>`}).join('')}</g>`;
      case'ink':{const d=this.pathD(it.pts);return `<g ${id}><path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(10,it.width+8)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${it.width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"/></g>`}
      case'rect':return `<g ${id}><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="${it.fill||'none'}" stroke="transparent" stroke-width="${it.width+8}"/><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="${it.fill||'none'}" stroke="${c}" stroke-width="${it.width}" stroke-opacity="${op}"/></g>`;
      case'ell':return `<g ${id}><ellipse cx="${it.x+it.w/2}" cy="${it.y+it.h/2}" rx="${it.w/2}" ry="${it.h/2}" fill="${it.fill||'none'}" stroke="transparent" stroke-width="${it.width+8}"/><ellipse cx="${it.x+it.w/2}" cy="${it.y+it.h/2}" rx="${it.w/2}" ry="${it.h/2}" fill="${it.fill||'none'}" stroke="${c}" stroke-width="${it.width}" stroke-opacity="${op}"/></g>`;
      case'line':case'arrow':{let h='';if(it.type==='arrow'){const[a,b]=this.arrowHead(it);h=`<path d="M${a[0]},${a[1]}L${it.x2},${it.y2}L${b[0]},${b[1]}" fill="none" stroke="${c}" stroke-width="${it.width}" stroke-linecap="round" stroke-linejoin="round"/>`}
        return `<g ${id}><line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="transparent" stroke-width="${it.width+10}"/><line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="${c}" stroke-width="${it.width}" stroke-linecap="round" stroke-opacity="${op}"/>${h}</g>`}
      case'text':{const lines=String(it.text).split('\n');return `<g ${id}><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="${it.bg||'transparent'}"/><text x="${it.x}" y="${it.y}" font-family="Liberation Sans, Arial, Helvetica, sans-serif" font-size="${it.size}" fill="${c}">${lines.map((l,k)=>`<tspan x="${it.x+2}" y="${it.y+2+it.size*(.88+k*1.2)}">${esc(l)||' '}</tspan>`).join('')}</text></g>`}
      case'note':return `<g ${id}><path d="M${it.x},${it.y}h18v13l-5,5h-13z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><path d="M${it.x+13},${it.y+18}v-5h5" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><path d="M${it.x+4},${it.y+6}h10M${it.x+4},${it.y+10}h10M${it.x+4},${it.y+14}h6" stroke="rgba(0,0,0,.45)" stroke-width="1"/></g>`;
      case'etext':return this.etSvg(it,id);
      case'img':return `<g ${id}><image href="${it.src}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="transparent"/></g>`;
    }return''},
  pathD(p){if(!p.length)return'';if(p.length<3)return'M'+p.map(q=>q.join(',')).join('L')+(p.length===1?'l.1,0':'');let d=`M${p[0][0]},${p[0][1]}`;
    for(let i=1;i<p.length-1;i++){const mx=(p[i][0]+p[i+1][0])/2,my=(p[i][1]+p[i+1][1])/2;d+=`Q${p[i][0]},${p[i][1]} ${mx.toFixed(2)},${my.toFixed(2)}`}const l=p[p.length-1];return d+`L${l[0]},${l[1]}`},
  arrowHead(it){const ang=Math.atan2(it.y2-it.y1,it.x2-it.x1),L=Math.max(8,it.width*4),a=Math.PI/7;return[[it.x2-L*Math.cos(ang-a),it.y2-L*Math.sin(ang-a)],[it.x2-L*Math.cos(ang+a),it.y2-L*Math.sin(ang+a)]]},
  bbox(it){switch(it.type){case'highlight':case'underline':case'strike':{const xs=it.rects.flatMap(r=>[r[0],r[0]+r[2]]),ys=it.rects.flatMap(r=>[r[1],r[1]+r[3]]);return box(xs,ys)}
    case'ink':return box(it.pts.map(p=>p[0]),it.pts.map(p=>p[1]),it.width/2);case'line':case'arrow':return box([it.x1,it.x2],[it.y1,it.y2],it.width);
    case'note':return{x:it.x,y:it.y,w:18,h:18};default:return{x:it.x,y:it.y,w:it.w,h:it.h}}
    function box(xs,ys,p=0){const x=Math.min(...xs)-p,y=Math.min(...ys)-p;return{x,y,w:Math.max(...xs)+p-x,h:Math.max(...ys)+p-y}}},
  selSvg(it){const b=this.bbox(it);const z=1/this.st.scale;const rs=['rect','ell','img','text'].includes(it.type)?`<rect class="rsz" data-id="${it.id}" x="${b.x+b.w-5*z}" y="${b.y+b.h-5*z}" width="${10*z}" height="${10*z}" fill="#fff" stroke="#3352d6" stroke-width="${1.5*z}" style="pointer-events:all;cursor:nwse-resize"/>`:'';
    return `<rect class="selbox" x="${b.x-3}" y="${b.y-3}" width="${b.w+6}" height="${b.h+6}"/>${rs}`},
  pick(id){const s=this.st;const prev=s.picked&&this.item(s.picked);s.picked=id;if(prev)this.drawAnn(prev.page);const it=id&&this.item(id);if(it){this.drawAnn(it.page);if(it.width)$('#vW').value=it.width}$('#vDel').disabled=!it},
  mutate(fn,merge){const s=this.st;const snap=JSON.stringify(s.items);if(!(merge&&this._lastMerge&&Date.now()-this._lastMerge<800))s.hist.push(snap);if(s.hist.length>200)s.hist.shift();this._lastMerge=merge?Date.now():0;s.fut=[];fn();this.redraw();this.dirty()},
  add(it){it.id=it.id||uid();it.created=Date.now();this.mutate(()=>this.st.items.push(it));return it},
  remove(id){this.mutate(()=>{this.st.items=this.st.items.filter(i=>i.id!==id)});if(this.st.picked===id)this.pick(null)},
  delPicked(){const s=this.st;if(s.picked)this.remove(s.picked)},
  undo(){const s=this.st;if(!s.hist.length)return;s.fut.push(JSON.stringify(s.items));s.items=JSON.parse(s.hist.pop());s.picked=null;this.redraw();this.dirty()},
  redo(){const s=this.st;if(!s.fut.length)return;s.hist.push(JSON.stringify(s.items));s.items=JSON.parse(s.fut.pop());s.picked=null;this.redraw();this.dirty()},
  histBtns(){const s=this.st;if(!s)return;$('#vUndo').disabled=!s.hist.length;$('#vRedo').disabled=!s.fut.length},
  dirty(){this.histBtns();this.annList();clearTimeout(this._sv);this._sv=setTimeout(()=>this.saveNow(),500)},
  saveNow(){const s=this.st;if(!s)return;DB.put('ann',s.items,s.id);s.rec.annCount=s.items.length;Docs.update(s.rec)},
  move(it,dx,dy){switch(it.type){case'highlight':case'underline':case'strike':it.rects.forEach(r=>{r[0]+=dx;r[1]+=dy});break;case'ink':it.pts.forEach(p=>{p[0]+=dx;p[1]+=dy});break;
    case'line':case'arrow':it.x1+=dx;it.x2+=dx;it.y1+=dy;it.y2+=dy;break;default:it.x+=dx;it.y+=dy;if(it.base!=null)it.base+=dy}},
  measureText(it){const c=this._mc||(this._mc=document.createElement('canvas').getContext('2d'));c.font=`${it.size}px "Liberation Sans", Arial, Helvetica, sans-serif`;
    const lines=String(it.text).split('\n');it.w=Math.max(20,...lines.map(l=>c.measureText(l).width))+6;it.h=it.size*(lines.length*1.2)+4},

  /* ---------- fare / kalem ---------- */
  ptIn(e,svg){const r=svg.getBoundingClientRect(),s=this.st;return[(e.clientX-r.left)/s.scale,(e.clientY-r.top)/s.scale]},
  bindPointer(){const m=$('#vMain'),s=this.st;let drag=null;
    m.addEventListener('pointerdown',e=>{if(e.button!==0)return;const t=s.tool;const svg=e.target.closest('svg.ov');const pageEl=e.target.closest('.page');
      $$('.notepop').forEach(n=>n.dataset.keep||n.remove());
      if(t==='sel'){const rs=e.target.closest('.rsz');const a=e.target.closest('.a');
        if(rs){const it=this.item(rs.dataset.id);const sv=rs.closest('svg');drag={k:'resize',it,svg:sv,start:this.ptIn(e,sv),orig:{w:it.w,h:it.h,size:it.size},snap:JSON.stringify(s.items)};e.preventDefault();return}
        if(a){const it=this.item(a.dataset.id);const sv=a.closest('svg');this.pick(it.id);drag={k:'move',it,svg:sv,last:this.ptIn(e,sv),moved:false,snap:JSON.stringify(s.items)};e.preventDefault();m.setPointerCapture(e.pointerId);return}
        if(s.picked)this.pick(null);return}
      if(t==='edittext'){this.etDown(e);return}
      if(t==='erase'){const a=e.target.closest('.a');if(a)this.remove(a.dataset.id);drag={k:'erase'};return}
      if(['hl','ul','st'].includes(t)&&pageEl){const tl=$('.textLayer',pageEl);if(tl.classList.contains('empty')||!tl.children.length){const sv=$('svg.ov',pageEl);drag={k:'area',svg:sv,p:+sv.dataset.p,a:this.ptIn(e,sv)};e.preventDefault()}return}
      if(!svg)return;const p=+svg.dataset.p;const pt=this.ptIn(e,svg);
      if(t==='text'){e.preventDefault();const open=$('.textedit');if(open){open.blur();return}this.editText(null,p,pt);return}
      if(t==='note'){e.preventDefault();const it=this.add({type:'note',page:p,x:pt[0]-9,y:pt[1]-9,color:s.color==='#ffffff'?'#ffd400':s.color,text:''});this.notePop(it);this.setTool('sel');return}
      if(t==='place'){e.preventDefault();const pl=this._place;const it=this.add({type:'img',page:p,x:pt[0]-pl.w/2,y:pt[1]-pl.h/2,w:pl.w,h:pl.h,src:pl.src});this.setTool('sel');this.pick(it.id);return}
      e.preventDefault();svg.setPointerCapture(e.pointerId);
      drag={k:t,svg,p,a:pt,pts:[pt]};
    });
    m.addEventListener('pointermove',e=>{if(!drag)return;
      if(drag.k==='erase'){if(e.buttons&1){const el=document.elementFromPoint(e.clientX,e.clientY);const a=el&&el.closest('.a');if(a)this.remove(a.dataset.id)}return}
      const pt=this.ptIn(e,drag.svg);
      if(drag.k==='move'){const dx=pt[0]-drag.last[0],dy=pt[1]-drag.last[1];if(!drag.moved&&Math.hypot(dx,dy)<1)return;drag.moved=true;this.move(drag.it,dx,dy);drag.last=pt;this.drawAnn(drag.it.page);return}
      if(drag.k==='resize'){const it=drag.it;const dx=pt[0]-drag.start[0],dy=pt[1]-drag.start[1];
        if(it.type==='text'){const k=Math.max(.3,(drag.orig.w+dx)/drag.orig.w);it.size=Math.max(4,Math.round(drag.orig.size*k*2)/2);this.measureText(it)}
        else if(it.type==='img'&&!e.shiftKey){const k=Math.max(.05,(drag.orig.w+dx)/drag.orig.w);it.w=drag.orig.w*k;it.h=drag.orig.h*k}
        else{it.w=Math.max(4,drag.orig.w+dx);it.h=Math.max(4,drag.orig.h+dy)}this.drawAnn(it.page);return}
      drag.b=pt;if(drag.k==='pen'){const l=drag.pts[drag.pts.length-1];if(Math.hypot(pt[0]-l[0],pt[1]-l[1])>.6/s.scale*2)drag.pts.push(pt)}
      this.preview(drag)});
    const up=e=>{if(!drag)return;const d=drag;drag=null;
      if(d.k==='move'||d.k==='resize'){if(d.moved||d.k==='resize'){s.hist.push(d.snap);s.fut=[];this.dirty();this.drawAnn(d.it.page)}return}
      if(d.k==='erase')return;$$('.preview',d.svg).forEach(x=>x.remove());const b=d.b||d.a,a=d.a;
      const R=()=>({x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),w:Math.abs(b[0]-a[0]),h:Math.abs(b[1]-a[1])});
      const base={page:d.p,color:s.color,width:s.width};
      if(d.k==='area'){const r=R();if(r.w>3&&r.h>3)this.add({type:s.tool==='hl'?'highlight':s.tool==='ul'?'underline':'strike',page:d.p,color:s.color,rects:[[r.x,r.y,r.w,r.h]],text:''});return}
      if(d.k==='pen'){if(d.pts.length===1)d.pts.push([d.pts[0][0]+.2,d.pts[0][1]]);this.add({...base,type:'ink',pts:d.pts.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)])});return}
      if(d.k==='rect'||d.k==='ell'){const r=R();if(r.w<3&&r.h<3)return;this.add({...base,type:d.k,...r});return}
      if(d.k==='line'||d.k==='arrow'){if(Math.hypot(b[0]-a[0],b[1]-a[1])<3)return;this.add({...base,type:d.k,x1:a[0],y1:a[1],x2:b[0],y2:b[1]})}};
    m.addEventListener('pointerup',up);m.addEventListener('pointercancel',up);
    m.addEventListener('dblclick',e=>{const a=e.target.closest('.a');if(!a||s.tool!=='sel')return;const it=this.item(a.dataset.id);
      if(it.type==='text')this.editText(it);else if(it.type==='etext')this.etEdit(it);else this.notePop(it)});
    // Metin seçimiyle vurgulama
    document.addEventListener('selectionchange',this._sc=()=>{$$('.textLayer.selecting').forEach(t=>t.classList.remove('selecting'));const sel=getSelection();if(sel.rangeCount){const n=sel.anchorNode;const tl=n&&(n.nodeType===1?n:n.parentElement)?.closest?.('.textLayer');tl&&tl.classList.add('selecting')}});
    m.addEventListener('pointerup',()=>{if(['hl','ul','st'].includes(s.tool))setTimeout(()=>this.fromSelection(),0)});
    m.addEventListener('contextmenu',e=>{const a=e.target.closest('.a');if(!a)return;e.preventDefault();const it=this.item(a.dataset.id);this.pick(it.id);
      popMenu(e.clientX,e.clientY,[{icon:'note',label:it.type==='note'?'Notu düzenle':'Yorum ekle / düzenle',fn:()=>this.notePop(it)},
        ...(it.type==='text'?[{icon:'edit',label:'Metni düzenle',fn:()=>this.editText(it)}]:[]),
        ...(['rect','ell','text'].includes(it.type)?[{icon:'rect',label:(it.type==='text'?(it.bg?'Arka planı kaldır':'Beyaz arka plan (alttakini kapat)'):(it.fill?'Dolguyu kaldır':'İçini doldur')),fn:()=>this.mutate(()=>{if(it.type==='text')it.bg=it.bg?null:'#ffffff';else it.fill=it.fill?null:s.color})}]:[]),
        {icon:'copy',label:'Kopyala',fn:()=>{const c=JSON.parse(JSON.stringify(it));c.id=uid();this.move(c,10,10);this.add(c);this.pick(c.id)}},
        ...(it.text&&it.type!=='text'?[{icon:'copy',label:'Metni panoya kopyala',fn:()=>navigator.clipboard.writeText(it.text).then(()=>toast('Kopyalandı'))}]:[]),
        '-',{icon:'trash',label:'Sil',danger:true,fn:()=>this.remove(it.id)}])});
  },
  preview(d){const s=this.st;let el=$('.preview',d.svg);if(!el){el=document.createElementNS('http://www.w3.org/2000/svg','g');el.setAttribute('class','preview');d.svg.appendChild(el)}
    const a=d.a,b=d.b,c=s.color,w=s.width;const r={x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),w:Math.abs(b[0]-a[0]),h:Math.abs(b[1]-a[1])};
    if(d.k==='pen')el.innerHTML=`<path d="${this.pathD(d.pts)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(d.k==='rect')el.innerHTML=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    else if(d.k==='ell')el.innerHTML=`<ellipse cx="${r.x+r.w/2}" cy="${r.y+r.h/2}" rx="${r.w/2}" ry="${r.h/2}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    else if(d.k==='area')el.innerHTML=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${c}" fill-opacity=".35"/>`;
    else{const it={x1:a[0],y1:a[1],x2:b[0],y2:b[1],width:w};let h='';if(d.k==='arrow'){const[p,q]=this.arrowHead(it);h=`<path d="M${p}L${b}L${q}" fill="none" stroke="${c}" stroke-width="${w}"/>`}el.innerHTML=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`+h}},
  fromSelection(){const s=this.st;const sel=getSelection();if(!sel.rangeCount||sel.isCollapsed)return;const txt=sel.toString().trim();if(!txt)return;
    const byPage={};for(let k=0;k<sel.rangeCount;k++){for(const r of sel.getRangeAt(k).getClientRects()){if(r.width<1||r.height<1)continue;const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const P=s.pages.findIndex(P=>{const q=P.el.getBoundingClientRect();return cx>=q.left&&cx<=q.right&&cy>=q.top&&cy<=q.bottom});if(P<0)continue;const q=s.pages[P].el.getBoundingClientRect();
      (byPage[P]=byPage[P]||[]).push([(r.left-q.left)/s.scale,(r.top-q.top)/s.scale,r.width/s.scale,r.height/s.scale])}}
    const type=s.tool==='hl'?'highlight':s.tool==='ul'?'underline':'strike';
    const entries=Object.entries(byPage);if(!entries.length)return;
    const snap=JSON.stringify(s.items);
    for(const[p,rects]of entries){this.st.items.push({id:uid(),created:Date.now(),type,page:+p,color:s.color,rects:mergeRects(rects),text:txt})}
    s.hist.push(snap);s.fut=[];sel.removeAllRanges();this.redraw();this.dirty();
    function mergeRects(rs){rs.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);const out=[];for(const r of rs){const l=out.find(o=>Math.abs(o[1]-r[1])<r[3]*.5&&Math.abs(o[3]-r[3])<r[3]*.6&&r[0]<=o[0]+o[2]+r[3]);
      if(l){const x2=Math.max(l[0]+l[2],r[0]+r[2]),y2=Math.max(l[1]+l[3],r[1]+r[3]);l[0]=Math.min(l[0],r[0]);l[1]=Math.min(l[1],r[1]);l[2]=x2-l[0];l[3]=y2-l[1]}else out.push([...r])}
      return out.filter(r=>r[2]>.5).map(r=>r.map(v=>+v.toFixed(2)))}},
  editText(it,page,pt){const s=this.st;const isNew=!it;page=it?it.page:page;const P=s.pages[page];
    const ta=document.createElement('textarea');ta.className='textedit';const size=it?it.size:s.font;const x=it?it.x:pt[0],y=it?it.y:pt[1]-size*.7;
    Object.assign(ta.style,{left:x*s.scale+'px',top:y*s.scale+'px',fontSize:size*s.scale+'px',color:it?it.color:s.color,minWidth:'80px',width:(it?it.w+10:160)*s.scale+'px',height:(it?it.h+6:size*1.6)*s.scale+'px'});
    ta.value=it?it.text:'';P.el.appendChild(ta);ta.focus();setTimeout(()=>ta.focus(),0);
    if(it){it._hidden=true;const g=$(`.a[data-id="${it.id}"]`,P.el);g&&(g.style.opacity=0)}
    const fit=()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'};ta.oninput=fit;
    let done=false;const commit=()=>{if(done)return;done=true;const v=ta.value.replace(/\s+$/,'');ta.remove();
      if(isNew){if(v){const n={type:'text',page,x,y,text:v,size,color:s.color==='#ffffff'?'#1d2330':s.color};this.measureText(n);this.add(n)}}
      else{delete it._hidden;if(!v)this.remove(it.id);else this.mutate(()=>{it.text=v;this.measureText(it)})}};
    ta.addEventListener('blur',commit);ta.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){ta.blur()}if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))ta.blur()});
    ta.addEventListener('pointerdown',e=>e.stopPropagation())},
  notePop(it){$$('.notepop').forEach(n=>n.remove());const s=this.st,P=s.pages[it.page];const bb=this.bbox(it);const d=document.createElement('div');d.className='notepop';
    const isNote=it.type==='note';const key=isNote?'text':'comment';
    d.innerHTML=`<textarea placeholder="${isNote?'Notunu yaz…':'Bu işarete yorum ekle…'}">${esc(it[key]||'')}</textarea><div class="r"><button class="btn ghost dan" style="height:28px">${ic('trash')}</button><button class="btn pri" style="height:28px">Kaydet</button></div>`;
    d.style.left=Math.min((bb.x+bb.w+6)*s.scale,P.el.clientWidth-250)+'px';d.style.top=bb.y*s.scale+'px';P.el.appendChild(d);d.addEventListener('pointerdown',e=>e.stopPropagation());
    const ta=$('textarea',d);setTimeout(()=>ta.focus(),0);ta.addEventListener('keydown',e=>e.stopPropagation());
    const save=()=>{const v=ta.value.trim();if(v!==(it[key]||''))this.mutate(()=>{it[key]=v});d.remove()};
    $('.pri',d).onclick=save;$('.dan',d).onclick=()=>{d.remove();if(isNote)this.remove(it.id);else this.mutate(()=>{delete it.comment})}},

  /* ---------- imza, görsel, damga ---------- */
  async signDlg(){const saved=(await DB.get('kv','signs'))||[];
    const r=await modal({title:'İmza ekle',wide:true,ok:'Yerleştir',body:`
      <div class="seg" id="sgTab"><button data-t="draw" class="on">Çiz</button><button data-t="type">Yaz</button><button data-t="up">Görsel yükle</button>${saved.length?'<button data-t="saved">Kayıtlı</button>':''}</div>
      <div data-p="draw"><canvas id="sgC" width="1200" height="360" style="width:100%;height:180px;border:1px solid var(--line2);border-radius:10px;background:#fff;touch-action:none"></canvas>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><span class="sw on" data-c="#1d2330" style="background:#1d2330"></span><span class="sw" data-c="#1e3fa8" style="background:#1e3fa8"></span><span class="sw" data-c="#c53030" style="background:#c53030"></span><span style="flex:1"></span><button class="btn ghost" id="sgClr">Temizle</button></div></div>
      <div data-p="type" class="hide"><input type="text" id="sgT" placeholder="Adını yaz" style="width:100%;height:46px;border:1px solid var(--line2);border-radius:10px;padding:0 14px;font-size:20px">
        <div id="sgFonts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"></div></div>
      <div data-p="up" class="hide"><button class="btn" id="sgUp">${ic('img')} Görsel seç (PNG/JPG)</button><div id="sgUpP" style="margin-top:10px"></div><small style="color:var(--tx2)">Beyaz arka plan otomatik olarak saydam yapılır.</small></div>
      <div data-p="saved" class="hide"><div id="sgSaved" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sgKeep" checked> İmzayı sonraki kullanımlar için kaydet</label>`,
      onOpen:mb=>{let tab='draw',col='#1d2330',font=0,upData=null,savedPick=null;const c=$('#sgC',mb),x=c.getContext('2d');let drawing=false,last=null,has=false;
        const fonts=['italic 64px "Brush Script MT","Segoe Script",cursive','italic 60px "Snell Roundhand","Lucida Handwriting",cursive','italic 600 56px Georgia,serif','56px "Bradley Hand","Comic Sans MS",cursive'];
        const pos=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
        c.onpointerdown=e=>{drawing=true;last=pos(e);c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!drawing)return;const p=pos(e);const pr=e.pressure&&e.pointerType==='pen'?e.pressure:0.5;
          x.strokeStyle=col;x.lineWidth=3+pr*7;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(...last);x.lineTo(...p);x.stroke();last=p;has=true};c.onpointerup=()=>drawing=false;
        $('#sgClr',mb).onclick=()=>{x.clearRect(0,0,c.width,c.height);has=false};
        $$('[data-p=draw] .sw',mb).forEach(w=>w.onclick=()=>{col=w.dataset.c;$$('[data-p=draw] .sw',mb).forEach(q=>q.classList.toggle('on',q===w))});
        const renderFonts=()=>{const t=$('#sgT',mb).value||'İmza';$('#sgFonts',mb).innerHTML=fonts.map((f,k)=>`<div data-k="${k}" class="choice" style="justify-content:center;font:${f.replace(/\d+px/,'28px')};color:${col}${k===font?';border-color:var(--ac);background:var(--acbg)':''}">${esc(t)}</div>`).join('');
          $$('#sgFonts>div',mb).forEach(d=>d.onclick=()=>{font=+d.dataset.k;renderFonts()})};$('#sgT',mb).oninput=renderFonts;renderFonts();
        $('#sgUp',mb).onclick=async()=>{const[f]=await pickFiles({accept:'image/*'});if(!f)return;upData=await transparentize(await fileToDataURL(f));$('#sgUpP',mb).innerHTML=`<img src="${upData}" style="max-height:120px;border:1px solid var(--line);border-radius:8px">`};
        $('#sgSaved',mb)&&($('#sgSaved',mb).innerHTML=saved.map((sg,k)=>`<div class="choice" data-k="${k}" style="justify-content:center;position:relative"><img src="${sg}" style="max-width:100%;max-height:70px"><button class="ib" data-del="${k}" style="position:absolute;top:2px;right:2px;width:24px;height:24px">${ic('x')}</button></div>`).join(''));
        $$('#sgSaved .choice',mb).forEach(d=>d.onclick=async e=>{if(e.target.closest('[data-del]')){saved.splice(+d.dataset.k,1);await DB.put('kv',saved,'signs');d.remove();return}savedPick=saved[+d.dataset.k];$$('#sgSaved .choice',mb).forEach(q=>q.style.borderColor=q===d?'var(--ac)':'')});
        $$('#sgTab button',mb).forEach(b=>b.onclick=()=>{tab=b.dataset.t;$$('#sgTab button',mb).forEach(q=>q.classList.toggle('on',q===b));$$('[data-p]',mb).forEach(p=>p.classList.toggle('hide',p.dataset.p!==tab))});
        mb.getData=()=>{if(tab==='draw')return has?trimCanvas(c):null;if(tab==='up')return upData;if(tab==='saved')return savedPick;
          const t=$('#sgT',mb).value.trim();if(!t)return null;const cv=document.createElement('canvas');const cx=cv.getContext('2d');cx.font=fonts[font];const w=cx.measureText(t).width;cv.width=w+40;cv.height=110;cx.font=fonts[font];cx.fillStyle=col;cx.textBaseline='middle';cx.fillText(t,20,58);return trimCanvas(cv)};
        mb.isNew=()=>tab!=='saved'}});
    if(!r)return this.setTool('sel');const data=r.getData();if(!data){toast('İmza boş');return this.setTool('sel')}
    if($('#sgKeep',r).checked&&r.isNew()&&!saved.includes(data)){saved.unshift(data);DB.put('kv',saved.slice(0,9),'signs')}
    this.placeImage(data,150)},
  async imageDlg(){const[f]=await pickFiles({accept:'image/png,image/jpeg,image/webp,image/gif'});if(!f)return this.setTool('sel');let d=await fileToDataURL(f);if(!/^data:image\/(png|jpeg)/.test(d))d=await toPng(d);this.placeImage(d,220)},
  async stampDlg(){const list=['ONAYLANDI','TASLAK','GİZLİ','İNCELENDİ','REDDEDİLDİ','ÖNEMLİ','KOPYA','SON HALİ'];
    const r=await modal({title:'Damga',ok:'Yerleştir',body:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="stL">${list.map((t,k)=>`<label class="choice" style="justify-content:center"><input type="radio" name="st" value="${t}"${k?'':' checked'} hidden><b style="color:${k===4?'#c53030':k===1||k===6?'#5b6475':'#1f8a4c'};letter-spacing:1px">${t}</b></label>`).join('')}</div>
      <label class="fld">Ya da kendi damganı yaz<input type="text" id="stC" placeholder="Örn. Buse'nin onayı"></label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="stD" checked> Tarihi ekle</label>`});
    if(!r)return this.setTool('sel');const t=($('#stC',r).value.trim()||$('input[name=st]:checked',r).value).toLocaleUpperCase('tr');const col=/RED|GİZLİ/.test(t)?'#c53030':/TASLAK|KOPYA/.test(t)?'#5b6475':'#1f8a4c';
    const date=$('#stD',r).checked?new Date().toLocaleDateString('tr-TR'):'';const cv=document.createElement('canvas'),x=cv.getContext('2d');x.font='bold 64px Arial';const w=Math.max(x.measureText(t).width,date?x.measureText(date).width*.5:0)+80;
    cv.width=w;cv.height=date?180:120;x.strokeStyle=col;x.fillStyle=col;x.lineWidth=8;roundRect(x,6,6,w-12,cv.height-12,18);x.stroke();x.font='bold 64px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(t,w/2,date?66:60);
    if(date){x.font='600 30px Arial';x.fillText(date,w/2,136)}this.placeImage(cv.toDataURL('image/png'),170)},
  placeImage(src,maxW){const img=new Image();img.onload=()=>{const k=Math.min(1,maxW/img.width);this._place={src,w:img.width*k,h:img.height*k};
    if(maxW<=170)this._place={src,w:maxW,h:img.height*maxW/img.width};this.setTool('place');$$('#vBar [data-tool]').forEach(b=>b.classList.remove('on'));toast('Yerleştirmek istediğin yere tıkla')};img.src=src},

  /* ---------- arama ---------- */
  async openSearch(){const s=this.st;let b=$('.searchbox');if(b){$('input',b).focus();$('input',b).select();return}
    b=document.createElement('div');b.className='searchbox';b.innerHTML=`<input placeholder="Belgede ara…"><span class="cnt"></span><button class="ib" data-d="-1">${ic('up')}</button><button class="ib" data-d="1">${ic('down')}</button><button class="ib" data-x>${ic('x')}</button>`;
    $('.viewer').appendChild(b);const inp=$('input',b);inp.focus();let t;
    inp.oninput=()=>{clearTimeout(t);t=setTimeout(()=>this.runSearch(inp.value),250)};
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')this.stepSearch(e.shiftKey?-1:1);if(e.key==='Escape')close()};
    $$('[data-d]',b).forEach(x=>x.onclick=()=>this.stepSearch(+x.dataset.d));const close=()=>{b.remove();s.search=null;this.redraw()};$('[data-x]',b).onclick=close},
  async textOf(i){const s=this.st;if(s.text[i])return s.text[i];const P=await this.getP(i);s.text[i]=await P.page.getTextContent();return s.text[i]},
  async runSearch(q){const s=this.st;q=q.trim();const cnt=$('.searchbox .cnt');if(!q){s.search=null;cnt.textContent='';this.redraw();return}
    const ql=q.toLocaleLowerCase('tr');const res=[];cnt.textContent='…';
    for(let i=0;i<s.pages.length;i++){const tc=await this.textOf(i);const P=await this.getP(i);if(!this.st||$('.searchbox input')?.value.trim()!==q)return;
      let str='',map=[];tc.items.forEach((it,k)=>{if(!('str'in it))return;map.push([str.length,k]);str+=it.str+(it.hasEOL?' ':'')});
      const low=str.toLocaleLowerCase('tr');let from=0,ix;
      while((ix=low.indexOf(ql,from))>=0){from=ix+ql.length;const rects=[];
        for(let mi=0;mi<map.length;mi++){const[st,k]=map[mi];const it=tc.items[k];const en=st+it.str.length;if(en<=ix||st>=ix+ql.length)continue;
          const a=Math.max(ix,st)-st,b=Math.min(ix+ql.length,en)-st;const tx=pdfjsLib.Util.transform(P.vp1.transform,it.transform);const fh=Math.hypot(tx[2],tx[3]);
          const W=it.width*P.vp1.scale,L=it.str.length||1;rects.push([tx[4]+W*a/L,tx[5]-fh,W*(b-a)/L,fh*1.2])}
        if(rects.length)res.push({page:i,rects})}
      if(i%10===9){s.search={q,res,cur:res.length?0:-1};cnt.textContent=res.length+' sonuç…';await sleep(0)}}
    s.search={q,res,cur:res.length?0:-1};cnt.textContent=res.length?`1 / ${res.length}`:'Bulunamadı';this.redraw();if(res.length)this.showHit()},
  stepSearch(d){const s=this.st;if(!s.search||!s.search.res.length)return;const n=s.search.res.length;s.search.cur=(s.search.cur+d+n)%n;$('.searchbox .cnt').textContent=`${s.search.cur+1} / ${n}`;this.redraw();this.showHit()},
  showHit(){const s=this.st;const h=s.search.res[s.search.cur];this.scrollToRect(h.page,h.rects[0][1])},
  searchSvg(i){const s=this.st;if(!s.search)return'';return s.search.res.map((h,k)=>h.page!==i?'':h.rects.map(r=>`<rect class="srch${k===s.search.cur?' cur':''}" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`).join('')).join('')},

  /* ---------- klavye ---------- */
  key(e){const s=this.st;if(!s)return;const tag=(e.target.tagName||'');if(/INPUT|TEXTAREA|SELECT/.test(tag)||$('.modalbg'))return;const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if(mod&&k==='f'){e.preventDefault();this.openSearch();return}
    if(mod&&k==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return}
    if(mod&&k==='y'){e.preventDefault();this.redo();return}
    if(mod&&k==='s'){e.preventDefault();this.exportDlg();return}
    if(mod&&(k==='+'||k==='=')){e.preventDefault();this.zoom(s.scale*1.2);return}
    if(mod&&k==='-'){e.preventDefault();this.zoom(s.scale/1.2);return}
    if(mod&&k==='0'){e.preventDefault();s.fit='w';this.applyFit();return}
    if(mod)return;
    if((k==='delete'||k==='backspace')&&s.picked){e.preventDefault();this.delPicked();return}
    if(k==='escape'){this.pick(null);this.setTool('sel');return}
    if(s.picked&&k.startsWith('arrow')){e.preventDefault();const it=this.item(s.picked);const st=e.shiftKey?10:1;this.mutate(()=>this.move(it,k==='arrowleft'?-st:k==='arrowright'?st:0,k==='arrowup'?-st:k==='arrowdown'?st:0),true);return}
    if(k==='arrowright'||k==='pagedown'){if(k==='arrowright'||e.target===document.body){e.preventDefault();this.goto(s.cur+(s.two?2:1))}return}
    if(k==='arrowleft'||k==='pageup'){e.preventDefault();this.goto(s.cur-(s.two?2:1));return}
    if(k==='home'){this.goto(1);return}if(k==='end'){this.goto(s.pages.length);return}
    if(KEYS[k])this.setTool(KEYS[k])},

  /* ---------- bilgi ---------- */
  async info(){const s=this.st;const m=await s.pdf.getMetadata().catch(()=>({info:{}}));const i=m.info||{};const P=await this.getP(0);
    const mm=v=>(v/72*25.4).toFixed(0);let textPages=0;for(let k=0;k<Math.min(s.pages.length,15);k++){const tc=await this.textOf(k);if(tc.items.some(t=>t.str.trim()))textPages++}
    alertBox('Belge bilgisi',`<table style="width:100%;border-collapse:collapse;line-height:1.9">${[['Ad',s.rec.name],['Boyut',fmtSize(s.rec.size)],['Sayfa',s.pages.length],['Sayfa boyutu',mm(P.w)+' × '+mm(P.h)+' mm'],['Başlık',i.Title],['Yazar',i.Author],['Oluşturan',i.Creator],['PDF sürümü',i.PDFFormatVersion],['Eklenme',fmtDate(s.rec.added)],['Not / vurgu',s.items.length],['Metin katmanı',textPages?'Var (aranabilir)':'Yok — taranmış görünüyor, "Aranabilir yap" ile OCR uygulayabilirsin']].filter(r=>r[1]!=null&&r[1]!=='').map(r=>`<tr><td style="color:var(--tx2);padding-right:14px;vertical-align:top">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`)},

  /* ---------- dışa aktarma ---------- */
  async exportDlg(){const s=this.st;this.saveNow();const n=s.items.length;
    const r=await modal({title:'Dışa aktar',ok:'İndir',body:`
      <div style="color:var(--tx2)">${n?`Bu belgede <b>${n}</b> not / işaret var.`:'Bu belgede henüz not yok; dosya olduğu gibi indirilecek.'}</div>
      ${n?`<label class="choice"><input type="radio" name="em" value="edit" checked><div><b>Düzenlenebilir notlar</b><small>Notlar PDF'in içine gerçek açıklama olarak yazılır. Acrobat, Önizleme, Edge gibi uygulamalarda seçilip düzenlenebilir ya da silinebilir. İmza, görsel ve damgalar sayfaya işlenir.</small></div></label>
      <label class="choice"><input type="radio" name="em" value="flat"><div><b>Kalıcı (sayfaya işlenmiş)</b><small>Her şey sayfanın parçası olur, her uygulamada aynı görünür ve değiştirilemez. Resmi belge gönderirken önerilir.</small></div></label>`:''}
      <label class="fld">Dosya adı<input type="text" id="exN" value="${esc(baseName(s.rec.name))}${n?'_notlu':''}"></label>`,
      onOpen:mb=>{const f=document.createElement('div');f.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
        f.innerHTML=`<button class="btn" data-a="share">${ic('share')} Paylaş</button><button class="btn" data-a="copy">${ic('copy')} Belgelerime kopya olarak kaydet</button><button class="btn" data-a="lib">${ic('file')} ${s.rec.libId?'Kütüphanemdeki kitabı güncelle':'Kütüphaneme ekle'}</button>${n?`<button class="btn" data-a="bake">${ic('save')} Bu belgenin içine işle</button>`:''}`;mb.appendChild(f);
        $$('[data-a]',f).forEach(b=>b.onclick=()=>{mb.action=b.dataset.a;mb.closest('.modal').querySelector('.o').click()})}});
    if(!r)return;const mode=n?$('input[name=em]:checked',r).value:'none';const name=($('#exN',r).value.trim()||'belge')+'.pdf';
    if(r.action==='bake'&&!await confirmBox('Belgenin içine işle',mode==='flat'?'Notlar bu belgenin kendisine kalıcı olarak işlenecek ve not katmanı temizlenecek. Bu işlem geri alınamaz.':'Notlar bu belgenin içine PDF açıklaması olarak yazılacak ve uygulamadaki not katmanı temizlenecek. Sonrasında bu notları burada taşıyamazsın (başka PDF uygulamalarında düzenlenebilirler).','İşle'))return;
    const out=await withBusy('PDF hazırlanıyor…',()=>this.build_pdf(mode));
    if(r.action==='share')shareFile(out,name);
    else if(r.action==='lib'){this.saveNow();await Lib.send(out,name,s.rec.libId||null)}
    else if(r.action==='copy'){await Docs.add(name,out);toast('Belgelerine kaydedildi')}
    else if(r.action==='bake'){await Docs.replaceBytes(s.id,out);s.items=[];this.saveNow();toast('Belgeye işlendi');const id=s.id;this.close();this.open(id)}
    else download(out,name)},
  async build_pdf(mode){const s=this.st;const L=await pdflib();const{rgb,degrees,PDFName,PDFString,PDFHexString,PDFNumber}=L;
    const doc=await L.PDFDocument.load(s.bytes,{ignoreEncryption:true});if(mode==='none'||!s.items.length)return doc.save();
    let font=null;const needFont=s.items.some(i=>i.type==='text');if(needFont)font=await embedFont(doc);
    const pages=doc.getPages();const imgCache={};const ctx=doc.context;
    // Düzenlenen yazılar: önce eskilerini sayfa içeriğinden sil (çizimlerden önce yapılmalı)
    const etPages={};s.items.forEach(i=>{delete i._stripped;if(i.type==='etext')(etPages[i.page]=etPages[i.page]||[]).push(i)});
    for(const p in etPages){try{await this.etStrip(doc,+p,etPages[p],await this.getP(+p))}catch(e){console.warn('Eski yazı silinemedi, üstü kapatılacak',e)}}
    for(const it of s.items){const P=await this.getP(it.page);const pg=pages[it.page];if(!pg)continue;const vp=P.vp1;const R=(pg.getRotation().angle%360+360)%360;
      const cv=(x,y)=>vp.convertToPdfPoint(x,y);const col=rgb(...hexRgb(it.color||'#000000'));
      const svgPath=(pts,closed)=>pts.map((p,k)=>{const q=cv(p[0],p[1]);return(k?'L':'M')+q[0].toFixed(2)+','+(-q[1]).toFixed(2)}).join('')+(closed?'Z':'');
      const draw=(pts,o)=>pg.drawSvgPath(svgPath(pts,o.closed),{x:0,y:0,...o.fill?{color:o.fill,opacity:o.opacity??1}:{},...o.stroke?{borderColor:o.stroke,borderWidth:o.width,borderOpacity:o.sOpacity??1,borderLineCap:L.LineCapStyle?L.LineCapStyle.Round:undefined}:{},...(o.blend&&L.BlendMode?{blendMode:L.BlendMode.Multiply}:{})});
      const rectPts=r=>[[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]];
      const ellPts=it=>Array.from({length:72},(_,k)=>{const a=k/72*Math.PI*2;return[it.x+it.w/2+Math.cos(a)*it.w/2,it.y+it.h/2+Math.sin(a)*it.h/2]});
      const pdfRect=b=>{const a=cv(b.x,b.y),c=cv(b.x+b.w,b.y+b.h);return[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])]};
      const str=t=>PDFHexString.fromText(t||'');
      const annot=d=>{const base={Type:'Annot',Rect:pdfRect(this.bbox(it)),C:hexRgb(it.color||'#000000'),T:str('PDF Atölyem'),M:PDFString.fromDate(new Date(it.created||Date.now())),F:4,NM:str(it.id)};
        if(it.comment||it.text)base.Contents=str(it.comment?(it.text?it.text+'\n\n'+it.comment:it.comment):it.text);const ref=ctx.register(ctx.obj({...base,...d}));pg.node.addAnnot(ref);return ref};
      // Notlar her iki modda da gerçek "yapışkan not" olarak kalır (içerikleri kaybolmasın)
      if(it.type==='note'){const q=cv(it.x,it.y);annot({Subtype:'Text',Rect:[q[0],q[1]-20,q[0]+20,q[1]],Name:'Comment',Open:false,Contents:str(it.text||'')});continue}
      // Düzenlenen metin her iki modda da sayfaya yazılır
      if(it.type==='etext'){await this.etDraw(doc,pg,it,cv,R);continue}
      if(it.type==='img'){const key=it.src.slice(0,64)+it.src.length;let im=imgCache[key];if(!im){const bytes=dataUrlBytes(it.src);im=imgCache[key]=/^data:image\/png/.test(it.src)?await doc.embedPng(bytes):await doc.embedJpg(bytes)}
        const o=cv(it.x,it.y+it.h);pg.drawImage(im,{x:o[0],y:o[1],width:it.w,height:it.h,rotate:degrees(R)});continue}
      if(mode==='edit'){
        if(['highlight','underline','strike'].includes(it.type)){const qp=[];it.rects.forEach(r=>{const a=cv(r[0],r[1]),b=cv(r[0]+r[2],r[1]),c=cv(r[0],r[1]+r[3]),d=cv(r[0]+r[2],r[1]+r[3]);qp.push(...a,...b,...c,...d)});
          annot({Subtype:it.type==='highlight'?'Highlight':it.type==='underline'?'Underline':'StrikeOut',QuadPoints:qp,CA:it.type==='highlight'?(it.opacity??.4)+.2:1});continue}
        if(it.type==='ink'){annot({Subtype:'Ink',InkList:[it.pts.flatMap(p=>cv(p[0],p[1]))],BS:{W:it.width,S:'S'},CA:it.opacity??1});continue}
        if(it.type==='line'||it.type==='arrow'){const ink=[[[it.x1,it.y1],[it.x2,it.y2]]];if(it.type==='arrow'){const[a,b]=this.arrowHead(it);ink.push([a,[it.x2,it.y2],b])}
          annot({Subtype:'Ink',InkList:ink.map(l=>l.flatMap(p=>cv(p[0],p[1]))),BS:{W:it.width,S:'S'}});continue}
        if(it.type==='rect'||it.type==='ell'){const d={Subtype:it.type==='rect'?'Square':'Circle',BS:{W:it.width,S:'S'},CA:it.opacity??1};if(it.fill)d.IC=hexRgb(it.fill);
          const b=this.bbox(it);annot({...d,Rect:pdfRect({x:b.x-it.width/2,y:b.y-it.width/2,w:b.w+it.width,h:b.h+it.width}),RD:[it.width/2,it.width/2,it.width/2,it.width/2]});continue}
        if(it.type==='text'){const[r,g,b]=hexRgb(it.color);
          annot({Subtype:'FreeText',DA:str(`/Helv ${it.size} Tf ${r} ${g} ${b} rg`),Contents:str(it.text),DS:str(`font: Helvetica ${it.size}pt; color:${it.color}`),Rect:pdfRect(it)});}
      }
      if(mode==='edit'){if(it.type==='text')await this.freeTextAP(doc,pg,it,font,cv,R);continue}
      // Kalıcı mod: her şey sayfaya çizilir
      switch(it.type){
        case'highlight':it.rects.forEach(r=>draw(rectPts(r),{closed:true,fill:col,opacity:it.opacity??.4,blend:true}));break;
        case'underline':case'strike':it.rects.forEach(r=>{const y=it.type==='underline'?r[1]+r[3]*.94:r[1]+r[3]*.55;draw([[r[0],y],[r[0]+r[2],y]],{stroke:col,width:Math.max(.8,r[3]*.08)})});break;
        case'ink':draw(it.pts.length>1?it.pts:[it.pts[0],it.pts[0]],{stroke:col,width:it.width,sOpacity:it.opacity});break;
        case'rect':draw(rectPts([it.x,it.y,it.w,it.h]),{closed:true,stroke:col,width:it.width,fill:it.fill?rgb(...hexRgb(it.fill)):null});break;
        case'ell':draw(ellPts(it),{closed:true,stroke:col,width:it.width,fill:it.fill?rgb(...hexRgb(it.fill)):null});break;
        case'line':draw([[it.x1,it.y1],[it.x2,it.y2]],{stroke:col,width:it.width});break;
        case'arrow':{draw([[it.x1,it.y1],[it.x2,it.y2]],{stroke:col,width:it.width});const[a,b]=this.arrowHead(it);draw([a,[it.x2,it.y2],b],{stroke:col,width:it.width});break}
        case'text':{if(it.bg)draw(rectPts([it.x,it.y,it.w,it.h]),{closed:true,fill:rgb(1,1,1)});String(it.text).split('\n').forEach((ln,k)=>{const o=cv(it.x+2,it.y+2+it.size*(.88+k*1.2));pg.drawText(ln,{x:o[0],y:o[1],size:it.size,font,color:col,rotate:degrees(R)})});break}
      }}
    const out=await doc.save();s.items.forEach(i=>delete i._stripped);return out},
  async freeTextAP(doc,pg,it,font,cv,R){// FreeText açıklamasına görünüm akışı ekle (her uygulamada metin görünsün)
    const L=window.PDFLib,ctx=doc.context;const[r,g,b]=hexRgb(it.color);const lines=String(it.text).split('\n');
    let ops='/Tx BMC q '+(it.bg?`1 1 1 rg 0 0 ${it.w.toFixed(2)} ${it.h.toFixed(2)} re f `:'')+`BT /F0 ${it.size} Tf ${r} ${g} ${b} rg `;
    lines.forEach((l,k)=>{ops+=`1 0 0 1 2 ${(it.h-2-it.size*(.88+k*1.2)).toFixed(2)} Tm ${font.encodeText(l).toString()} Tj `});ops+='ET Q EMC';
    const a=R*Math.PI/180;const ap=ctx.register(ctx.stream(ops,{Type:'XObject',Subtype:'Form',BBox:[0,0,it.w,it.h],Matrix:[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0],Resources:{Font:{F0:font.ref}}}));
    const annots=pg.node.Annots();const ad=ctx.lookup(annots.get(annots.size()-1));ad.set(L.PDFName.of('AP'),ctx.obj({N:ap}))},
  exportNotes(){const s=this.st;if(!s.items.length){toast('Henüz not yok');return}
    const list=[...s.items].sort((a,b)=>a.page-b.page||(this.bbox(a).y-this.bbox(b).y));let md=`# ${baseName(s.rec.name)} — Notlar\n\n_${new Date().toLocaleDateString('tr-TR')} · ${list.length} kayıt_\n`;let pg=-1;
    for(const it of list){if(it.page!==pg){pg=it.page;md+=`\n## Sayfa ${pg+1}\n\n`}const t=TYPE_TR[it.type]||it.type;
      if(it.text&&it.type!=='text'&&it.type!=='note')md+=`- **${t}:** “${it.text.replace(/\s+/g,' ')}”${it.comment?`\n  - 💬 ${it.comment}`:''}\n`;
      else if(it.type==='note'||it.type==='text')md+=`- **${t}:** ${String(it.text||'').replace(/\n/g,' ')}\n`;else if(it.comment)md+=`- **${t}:** ${it.comment}\n`}
    modal({title:'Notları dışa aktar',ok:'Markdown indir',body:`<textarea style="width:100%;height:300px;border:1px solid var(--line2);border-radius:8px;padding:10px;font:12.5px/1.5 ui-monospace,Menlo,monospace">${esc(md)}</textarea>
      <div style="display:flex;gap:8px"><button class="btn" id="cpN">${ic('copy')} Panoya kopyala</button><button class="btn" id="txN">${ic('dl')} Düz metin (.txt)</button></div>`,
      onOpen:mb=>{$('#cpN',mb).onclick=()=>navigator.clipboard.writeText(md).then(()=>toast('Kopyalandı'));$('#txN',mb).onclick=()=>download(md.replace(/[#*_]/g,''),baseName(s.rec.name)+'_notlar.txt','text/plain')}})
      .then(r=>{if(r)download(md,baseName(s.rec.name)+'_notlar.md','text/markdown')})},
};

/* ---------- küçük yardımcılar ---------- */
function promptPw(){return modal({title:'Şifreli PDF',body:'<label class="fld">Bu belgeyi açmak için şifre gerekiyor<input type="password" id="pw"></label>',ok:'Aç'}).then(r=>r?$('#pw',r).value:null)}
function fileToDataURL(f){return new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)})}
function dataUrlBytes(d){const b=atob(d.split(',')[1]);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function toPng(src){return new Promise(ok=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);ok(c.toDataURL('image/png'))};i.src=src})}
function trimCanvas(c){const x=c.getContext('2d');const{width:w,height:h}=c;const d=x.getImageData(0,0,w,h).data;let t=h,l=w,r=0,b=0;
  for(let y=0;y<h;y++)for(let X=0;X<w;X++)if(d[(y*w+X)*4+3]>10){if(y<t)t=y;if(y>b)b=y;if(X<l)l=X;if(X>r)r=X}
  if(r<l)return null;const o=document.createElement('canvas');o.width=r-l+16;o.height=b-t+16;o.getContext('2d').drawImage(c,l-8,t-8,o.width,o.height,0,0,o.width,o.height);return o.toDataURL('image/png')}
function transparentize(src){return new Promise(ok=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);
  const im=x.getImageData(0,0,c.width,c.height),d=im.data;for(let k=0;k<d.length;k+=4){const m=Math.min(d[k],d[k+1],d[k+2]);if(m>235)d[k+3]=0;else if(m>200)d[k+3]=Math.round(d[k+3]*(235-m)/35)}x.putImageData(im,0,0);ok(trimCanvas(c)||c.toDataURL('image/png'))};i.src=src})}
function roundRect(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
