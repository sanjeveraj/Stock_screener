let allStocks=[],filtered=[],currentPage=1,pageSize=100,sortKey='sym',sortDir=1,activeSer='ALL',searchQuery='';
const PAL=[['#00f5c4','#002a23'],['#5b9aff','#001133'],['#ffe04b','#2a2000'],['#ff5fd2','#2a0024'],['#ff7043','#2a0f00'],['#a29bfe','#100a2a'],['#00cec9','#002827'],['#fd79a8','#2a0015']];
function iconSt(s){const[fg,bg]=PAL[s.charCodeAt(0)%PAL.length];return`background:${bg};color:${fg};border:1px solid ${fg}33;`;}
function serCls(s){if(s==='EQ')return 'ser-EQ';if(s==='BE')return 'ser-BE';if(s==='BL')return 'ser-BL';if(['SM','SME'].includes(s))return 'ser-SM';return 'ser-def';}
function fmtDate(d){if(!d)return '—';const m={jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',jul:'Jul',aug:'Aug',sep:'Sep',oct:'Oct',nov:'Nov',dec:'Dec'};const p=d.trim().split('-');return p.length===3&&m[p[1]?.toLowerCase()]?`${p[0]} ${m[p[1].toLowerCase()]} ${p[2]}`:d;}
function fmtCr(v){if(!v||isNaN(v))return '—';v=parseFloat(v);if(v>=1e7)return(v/1e7).toFixed(1)+'Cr';if(v>=1e5)return(v/1e5).toFixed(1)+'L';return v.toLocaleString('en-IN');}
function fmtCr2(v){if(v>=1e12)return(v/1e12).toFixed(2)+'L Cr';if(v>=1e7)return(v/1e7).toFixed(2)+' Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';return v.toLocaleString('en-IN');}
function fmtVol(v){if(!v)return '—';if(v>=1e7)return(v/1e7).toFixed(2)+'Cr';if(v>=1e5)return(v/1e5).toFixed(2)+'L';if(v>=1e3)return(v/1e3).toFixed(0)+'K';return v;}
function fmtMC(v){if(v>=1e5)return(v/1e5).toFixed(1)+'L';if(v>=1e3)return(v/1e3).toFixed(1)+'K';return v;}

async function apiCall(params){
  try{const r=await fetch('/api/yahoo?'+new URLSearchParams(params));if(!r.ok)return null;const ct=r.headers.get('content-type')||'';return ct.includes('json')?r.json():r.text();}catch(e){return null;}
}

async function loadData(){
  setRail(10);setStatus('loading','Fetching NSE stocks…');
  document.getElementById('table-container').innerHTML='<div class="state-box"><div class="spinner-ring"></div><div class="state-title">Loading NSE Stocks…</div><div class="state-sub">Connecting to server…</div></div>';
  document.getElementById('refresh-btn').classList.add('spin');
  const csv=await apiCall({type:'equitylist',symbol:'_'});
  setRail(70);
  if(csv&&typeof csv==='string'&&csv.length>500){
    allStocks=parseCSV(csv);
    setStatus('live',allStocks.length.toLocaleString('en-IN')+' stocks loaded');
    showToast('✅ '+allStocks.length.toLocaleString('en-IN')+' NSE stocks loaded');
  }else{
    allStocks=BUNDLED;
    setStatus('error','API offline — '+BUNDLED.length+' bundled stocks');
    showToast('⚠️ Using offline data');
  }
  setRail(100);
  document.getElementById('refresh-btn').classList.remove('spin');
  updateOv();applyFilters();
}

function parseCSV(text){
  const lines=text.trim().split('\n');
  const h=lines[0].split(',').map(x=>x.trim().replace(/"/g,'').toUpperCase());
  const gi=(k)=>h.findIndex(x=>x.includes(k));
  const iS=gi('SYMBOL'),iN=gi('NAME'),iSe=gi('SERIES'),iD=gi('DATE'),iF=gi('FACE'),iI=gi('ISIN'),iP=gi('PAID'),iL=gi('LOT');
  const out=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const cols=[];let cur='',inQ=false;
    for(const ch of lines[i]){if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cols.push(cur.trim());cur='';}else cur+=ch;}
    cols.push(cur.trim());
    const sym=(cols[iS]||'').replace(/"/g,'').trim();if(!sym)continue;
    out.push({sym,name:(cols[iN]||sym).replace(/"/g,'').trim(),series:(cols[iSe]||'').replace(/"/g,'').trim().toUpperCase()||'—',
      date:(cols[iD]||'').replace(/"/g,'').trim(),fv:iF>=0?parseFloat(cols[iF])||0:0,
      isin:(cols[iI]||'').replace(/"/g,'').trim(),paid:iP>=0?parseFloat(cols[iP])||0:0,lot:iL>=0?parseInt(cols[iL])||1:1});
  }
  return out;
}

function applyFilters(){
  const q=searchQuery.toLowerCase();
  filtered=allStocks.filter(s=>{
    if(activeSer!=='ALL'&&s.series!==activeSer)return false;
    if(q)return s.sym.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)||(s.isin&&s.isin.toLowerCase().includes(q));
    return true;
  });
  filtered.sort((a,b)=>{
    if(sortKey==='fv')return(a.fv-b.fv)*sortDir;
    const av=sortKey==='name'?a.name:sortKey==='date'?(a.date||''):a.sym;
    const bv=sortKey==='name'?b.name:sortKey==='date'?(b.date||''):b.sym;
    return av.localeCompare(bv)*sortDir;
  });
  currentPage=1;
  document.getElementById('pill-total').textContent=allStocks.length.toLocaleString('en-IN');
  document.getElementById('pill-filtered').textContent=filtered.length.toLocaleString('en-IN');
  renderTable();
}

function hl(t,q){if(!q)return t;const i=t.toLowerCase().indexOf(q);if(i<0)return t;return t.slice(0,i)+'<mark>'+t.slice(i,i+q.length)+'</mark>'+t.slice(i+q.length);}

function renderTable(){
  const start=(currentPage-1)*pageSize,page=filtered.slice(start,start+pageSize),q=searchQuery.toLowerCase(),total=filtered.length;
  if(!total){document.getElementById('table-container').innerHTML=`<div class="state-box"><span class="state-icon">🔍</span><div class="state-title">No results</div><div class="state-sub">No stocks match "<strong>${searchQuery}</strong>"</div></div>`;return;}
  let rows='';
  page.forEach((s,i)=>{
    const rn=start+i+1,sc=serCls(s.series),ic=iconSt(s.sym);
    rows+=`<tr onclick="rowClick('${s.sym}','${s.name.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">
      <td class="row-num">${rn}</td>
      <td><div class="sym-cell"><div class="sym-icon" style="${ic}">${s.sym.slice(0,3)}</div>
        <div><div class="sym-text">${hl(s.sym,q)}</div><div class="sym-isin">${s.isin||'—'}</div></div></div></td>
      <td><div class="name-main">${hl(s.name,q)}</div></td>
      <td><span class="ser-badge ${sc}">${s.series}</span></td>
      <td class="date-cell">${fmtDate(s.date)}</td>
      <td class="fv-cell">₹${s.fv||'—'}</td>
      <td class="lot-cell">${s.lot>1?s.lot.toLocaleString('en-IN'):'1'}</td>
      <td class="cap-cell">${fmtCr(s.paid)}</td>
    </tr>`;
  });
  document.getElementById('table-container').innerHTML=`
    <table class="data-table"><thead><tr>
      <th class="row-num" style="cursor:default">#</th>
      <th class="${sortKey==='sym'?'sorted':''}" onclick="doSort('sym')">Symbol ${sa('sym')}</th>
      <th class="${sortKey==='name'?'sorted':''}" onclick="doSort('name')">Company ${sa('name')}</th>
      <th>Series</th>
      <th class="${sortKey==='date'?'sorted':''}" onclick="doSort('date')">Listed ${sa('date')}</th>
      <th class="${sortKey==='fv'?'sorted':''}" onclick="doSort('fv')">Face Val ${sa('fv')}</th>
      <th>Mkt Lot</th><th>Paid-up Cap</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="pag-bar">
      <div class="pag-info">Showing <strong>${(start+1).toLocaleString('en-IN')}–${Math.min(start+pageSize,total).toLocaleString('en-IN')}</strong> of <strong>${total.toLocaleString('en-IN')}</strong></div>
      ${renderPag(total)}
    </div>`;
}
function sa(k){return`<span>${sortKey===k?(sortDir>0?'▲':'▼'):'⇅'}</span>`;}
function renderPag(total){
  const pages=Math.ceil(total/pageSize);if(pages<=1)return '';
  let nums=[];
  if(pages<=7){for(let i=1;i<=pages;i++)nums.push(i);}
  else{nums=[1];if(currentPage>3)nums.push('…');for(let i=Math.max(2,currentPage-1);i<=Math.min(pages-1,currentPage+1);i++)nums.push(i);if(currentPage<pages-2)nums.push('…');nums.push(pages);}
  const btns=nums.map(n=>n==='…'?`<span class="pg-gap">…</span>`:`<button class="pg${n===currentPage?' active':''}" onclick="goPage(${n})">${n}</button>`).join('');
  return`<div class="pag-btns"><button class="pg" onclick="goPage(${currentPage-1})"${currentPage===1?' disabled':''}>‹</button>${btns}<button class="pg" onclick="goPage(${currentPage+1})"${currentPage===pages?' disabled':''}>›</button></div>`;
}
function goPage(p){const pages=Math.ceil(filtered.length/pageSize);if(p<1||p>pages)return;currentPage=p;renderTable();window.scrollTo({top:0,behavior:'smooth'});}
function doSort(k){if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;}applyFilters();}
function updateOv(){
  document.getElementById('ov-total').textContent=allStocks.length.toLocaleString('en-IN');
  document.getElementById('ov-eq').textContent=allStocks.filter(s=>s.series==='EQ').length.toLocaleString('en-IN');
  document.getElementById('ov-be').textContent=allStocks.filter(s=>s.series==='BE').length.toLocaleString('en-IN');
  document.getElementById('ov-sme').textContent=allStocks.filter(s=>['SM','ST','SME'].includes(s.series)).length.toLocaleString('en-IN');
  document.getElementById('ov-other').textContent=allStocks.filter(s=>!['EQ','BE','SM','ST','SME'].includes(s.series)).length.toLocaleString('en-IN');
}
function setRail(p){const r=document.getElementById('load-rail');r.style.width=p+'%';r.style.opacity='1';if(p>=100)setTimeout(()=>r.style.opacity='0',600);}
function setStatus(t,msg){const c=document.getElementById('status-chip');c.className='status-chip '+t;document.getElementById('status-text').textContent=msg;}
function showToast(msg,d=3000){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),d);}
function clearSearch(){document.getElementById('search').value='';searchQuery='';document.getElementById('clear-btn').classList.remove('show');document.getElementById('search-icon').style.display='';applyFilters();}
function exportCSV(){
  if(!filtered.length){showToast('No data');return;}
  const hdr='Symbol,Name,Series,Listed Date,Face Value,ISIN,Market Lot,Paid-Up Capital';
  const rows=filtered.map(s=>[s.sym,`"${s.name}"`,s.series,s.date,s.fv,s.isin,s.lot,s.paid].join(','));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[hdr,...rows].join('\n')],{type:'text/csv'}));
  a.download=`NSE_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  showToast('✅ '+filtered.length.toLocaleString('en-IN')+' stocks exported');
}
document.getElementById('sort-sel').addEventListener('change',e=>{const[k,d]=e.target.value.split('-');sortKey=k;sortDir=d==='asc'?1:-1;applyFilters();});
document.getElementById('pgsize-sel').addEventListener('change',e=>{pageSize=parseInt(e.target.value);currentPage=1;renderTable();});
let st;
document.getElementById('search').addEventListener('input',e=>{
  const v=e.target.value.trim();
  const cb=document.getElementById('clear-btn'),si=document.getElementById('search-icon');
  v?cb.classList.add('show'):cb.classList.remove('show');
  v?si.style.display='none':si.style.display='';
  clearTimeout(st);st=setTimeout(()=>{searchQuery=v;applyFilters();},180);
});
document.getElementById('search').addEventListener('keydown',e=>{if(e.key==='Escape')clearSearch();});
document.getElementById('ser-chips').addEventListener('click',e=>{
  const c=e.target.closest('.sch');if(!c)return;
  document.querySelectorAll('.sch').forEach(x=>x.classList.remove('on'));c.classList.add('on');
  activeSer=c.dataset.ser;applyFilters();
});

/* ═══ MODAL ═══ */
let activeSym='',activeRange='1mo',candleData=[];
function rowClick(sym,name){activeSym=sym;activeRange='1mo';candleData=[];openModal(sym,name);}
function openModal(sym,name){
  document.getElementById('m-sym').textContent=sym+' · NSE';
  document.getElementById('m-name').innerHTML=name+' <span class="live-badge loading" id="m-badge"><span class="bd"></span><span id="m-badge-txt">Loading…</span></span>';
  document.getElementById('m-price').textContent='—';
  document.getElementById('m-chg').textContent='—';document.getElementById('m-chg').className='mh-chg flat';
  document.getElementById('m-ohlc').textContent='Fetching data…';
  document.getElementById('m-fund-grid').innerHTML=loadSkeletons();
  document.getElementById('m-info-row').innerHTML='';
  document.getElementById('w52-section').style.display='none';
  document.getElementById('m-analyst-section').style.display='none';
  document.getElementById('chart-loading').style.display='flex';
  document.getElementById('candle-canvas').style.display='none';
  document.getElementById('vol-canvas').style.display='none';
  document.querySelectorAll('.rtab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow='hidden';
  Promise.all([fetchQuote(sym),fetchChart(sym,activeRange)]);
}
function loadSkeletons(){return Array(15).fill(0).map(()=>`<div class="fund-card" style="opacity:.35"><div style="background:rgba(255,255,255,.08);border-radius:4px;height:18px;width:65%;margin-bottom:5px"></div><div style="background:rgba(255,255,255,.05);border-radius:3px;height:10px;width:45%"></div></div>`).join('');}
function closeModal(){document.getElementById('modal-backdrop').classList.remove('open');document.body.style.overflow='';candleData=[];}
function handleBackdrop(e){if(e.target===document.getElementById('modal-backdrop'))closeModal();}
function setRange(r,btn){activeRange=r;document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  document.getElementById('chart-loading').style.display='flex';document.getElementById('candle-canvas').style.display='none';document.getElementById('vol-canvas').style.display='none';
  fetchChart(activeSym,r);}
function setBadge(cls,txt){const b=document.getElementById('m-badge'),t=document.getElementById('m-badge-txt');if(b&&t){b.className='live-badge '+cls;t.textContent=txt;}}

async function fetchQuote(sym){
  const data=await apiCall({type:'quote',symbol:sym});
  if(!data){setBadge('sim','No Data');return;}
  try{
    const r=data.quoteSummary?.result?.[0];
    const pr=r?.price,sd=r?.summaryDetail,fd=r?.financialData,ks=r?.defaultKeyStatistics,rt=r?.recommendationTrend;
    if(!pr?.regularMarketPrice?.raw){setBadge('sim','No Data');return;}
    const cur=pr.regularMarketPrice.raw,prev=pr.regularMarketPreviousClose?.raw||cur;
    const ca=+(cur-prev).toFixed(2),cp=+((cur-prev)/prev*100).toFixed(2),up=cur>=prev;
    document.getElementById('m-price').textContent='₹'+cur.toLocaleString('en-IN',{maximumFractionDigits:2});
    const ce=document.getElementById('m-chg');
    ce.textContent=`${up?'+':''}${ca} (${up?'+':''}${cp}%)`;ce.className='mh-chg '+(up?'up':'dn');
    const o=pr.regularMarketOpen?.raw||0,h=pr.regularMarketDayHigh?.raw||0,l=pr.regularMarketDayLow?.raw||0;
    document.getElementById('m-ohlc').textContent=`O ₹${o.toFixed(1)}  H ₹${h.toFixed(1)}  L ₹${l.toFixed(1)}  Prev ₹${prev.toFixed(1)}`;
    setBadge('sim','Estimated');
    const hi52=ks?.fiftyTwoWeekHigh?.raw||sd?.fiftyTwoWeekHigh?.raw;
    const lo52=ks?.fiftyTwoWeekLow?.raw||sd?.fiftyTwoWeekLow?.raw;
    if(hi52&&lo52){
      document.getElementById('w52-section').style.display='block';
      document.getElementById('w52-low').textContent='₹'+lo52.toLocaleString('en-IN',{maximumFractionDigits:0});
      document.getElementById('w52-high').textContent='₹'+hi52.toLocaleString('en-IN',{maximumFractionDigits:0});
      const pct=Math.min(100,Math.max(0,(cur-lo52)/(hi52-lo52)*100));
      document.getElementById('w52-fill').style.width=pct+'%';document.getElementById('w52-marker').style.left=pct+'%';
    }
    const mc=pr.marketCap?.raw||0,sec=pr.sector||'';
    document.getElementById('m-info-row').innerHTML=[
      mc?`<div class="info-chip">MC ₹${fmtMC(Math.round(mc/1e7))} Cr</div>`:'',
      sec?`<div class="info-chip">${sec}</div>`:'',
      `<div class="info-chip">NSE · INR</div>`,
      sd?.beta?.raw?`<div class="info-chip">β ${sd.beta.raw.toFixed(2)}</div>`:'',
    ].join('');
    const fmt=(v,s='')=>(v!=null&&!isNaN(v))?v.toFixed(2)+s:'—';
    const fmtP=v=>(v!=null&&!isNaN(v))?(v*100).toFixed(1)+'%':'—';
    const pe=sd?.trailingPE?.raw;
    const funds=[
      {l:'P/E Ratio',v:fmt(pe)},{l:'Forward P/E',v:fmt(sd?.forwardPE?.raw)},{l:'P/B Ratio',v:fmt(ks?.priceToBook?.raw)},
      {l:'EPS (TTM)',v:ks?.trailingEps?.raw?'₹'+ks.trailingEps.raw.toFixed(2):'—'},{l:'ROE',v:fmtP(fd?.returnOnEquity?.raw)},{l:'ROA',v:fmtP(fd?.returnOnAssets?.raw)},
      {l:'Revenue',v:fd?.totalRevenue?.raw?'₹'+fmtCr2(fd.totalRevenue.raw):'—'},{l:'Net Income',v:fd?.netIncomeToCommon?.raw?'₹'+fmtCr2(fd.netIncomeToCommon.raw):'—'},{l:'Profit Margin',v:fmtP(fd?.profitMargins?.raw)},
      {l:'Gross Margin',v:fmtP(fd?.grossMargins?.raw)},{l:'Debt/Equity',v:fmt(fd?.debtToEquity?.raw)},{l:'Current Ratio',v:fmt(fd?.currentRatio?.raw)},
      {l:'Div Yield',v:sd?.dividendYield?.raw?fmtP(sd.dividendYield.raw):'—'},{l:'Beta',v:fmt(sd?.beta?.raw)},{l:'Avg Volume',v:fmtVol(sd?.averageVolume?.raw)},
    ];
    document.getElementById('m-fund-grid').innerHTML=funds.map(f=>`<div class="fund-card"><div class="fund-val">${f.v}</div><div class="fund-lbl">${f.l}</div></div>`).join('');
    if(rt?.trend?.length){
      const t=rt.trend[0],buy=(t.strongBuy||0)+(t.buy||0),hold=t.hold||0,sell=(t.sell||0)+(t.strongSell||0),tot=buy+hold+sell||1;
      document.getElementById('m-analyst-section').style.display='block';
      document.getElementById('bsbar').innerHTML=`<div class="bar-buy" style="width:${(buy/tot*100).toFixed(0)}%"></div><div class="bar-hold" style="width:${(hold/tot*100).toFixed(0)}%"></div><div class="bar-sell" style="width:${(sell/tot*100).toFixed(0)}%"></div>`;
      document.getElementById('bl-buy').textContent=`Buy ${buy}`;document.getElementById('bl-hold').textContent=`Hold ${hold}`;document.getElementById('bl-sell').textContent=`Sell ${sell}`;
      const tgt=fd?.targetMeanPrice?.raw;
      if(tgt){document.getElementById('tgt-price').textContent='₹'+tgt.toLocaleString('en-IN',{maximumFractionDigits:0});
        const up2=tgt>=cur;document.getElementById('tgt-upside').innerHTML=`<span style="color:${up2?'var(--up)':'var(--dn)'}">${up2?'▲':'▼'} ${Math.abs(((tgt-cur)/cur*100)).toFixed(1)}% upside</span>`;}
    }
  }catch(e){setBadge('sim','Error');}
}

async function fetchChart(sym,range){
  const data=await apiCall({type:'chart',symbol:sym,range});
  if(!data){showChartErr();return;}
  try{
    const r=data?.chart?.result?.[0];if(!r){showChartErr();return;}
    const ts=r.timestamp||[],q=r.indicators?.quote?.[0]||{};
    candleData=ts.map((t,i)=>({t,date:new Date(t*1000),o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]})).filter(d=>d.o&&d.h&&d.l&&d.c);
    if(candleData.length<2){showChartErr();return;}
    drawChart();
  }catch(e){showChartErr();}
}
function showChartErr(){
  const cl=document.getElementById('chart-loading');cl.style.display='flex';
  cl.innerHTML='<span style="color:var(--dim)">⚠️ Chart unavailable</span>';
  document.getElementById('candle-canvas').style.display='none';document.getElementById('vol-canvas').style.display='none';
}

function drawChart(){
  const canvas=document.getElementById('candle-canvas'),vc=document.getElementById('vol-canvas'),cl=document.getElementById('chart-loading');
  cl.style.display='none';canvas.style.display='block';vc.style.display='block';
  const dpr=window.devicePixelRatio||1,W=canvas.offsetWidth,H=240,VH=55;
  canvas.width=W*dpr;canvas.height=H*dpr;vc.width=W*dpr;vc.height=VH*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';vc.style.width=W+'px';vc.style.height=VH+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const vctx=vc.getContext('2d');vctx.scale(dpr,dpr);
  const PAD={t:14,b:26,l:8,r:62},CW=W-PAD.l-PAD.r,CH=H-PAD.t-PAD.b,n=candleData.length;
  let pMin=Math.min(...candleData.map(d=>d.l)),pMax=Math.max(...candleData.map(d=>d.h));
  const pad=(pMax-pMin)*0.06;pMin-=pad;pMax+=pad;
  const toY=p=>PAD.t+CH-((p-pMin)/(pMax-pMin))*CH;
  const toX=i=>PAD.l+(i+0.5)*(CW/n);
  const cw=Math.max(1,(CW/n)*0.72);
  ctx.clearRect(0,0,W,H);
  for(let g=0;g<5;g++){
    const y=PAD.t+(CH/4)*g;
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.l,y);ctx.lineTo(W-PAD.r,y);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='9px Fira Code,monospace';ctx.textAlign='left';
    ctx.fillText('₹'+(pMax-(pMax-pMin)/4*g).toLocaleString('en-IN',{maximumFractionDigits:0}),W-PAD.r+4,y+4);
  }
  ctx.strokeStyle='rgba(255,224,75,0.65)';ctx.lineWidth=1.5;ctx.beginPath();let ms=false;
  for(let i=19;i<n;i++){const avg=candleData.slice(i-19,i+1).reduce((s,d)=>s+d.c,0)/20;const x=toX(i),y=toY(avg);ms?ctx.lineTo(x,y):(ctx.moveTo(x,y),ms=true);}ctx.stroke();
  candleData.forEach((d,i)=>{
    const x=toX(i),up=d.c>=d.o,col=up?'#00e676':'#ff4d6d';
    ctx.strokeStyle=up?'rgba(0,230,118,0.6)':'rgba(255,77,109,0.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,toY(d.h));ctx.lineTo(x,toY(d.l));ctx.stroke();
    const yO=toY(d.o),yC=toY(d.c),bH=Math.max(1,Math.abs(yO-yC)),bY=Math.min(yO,yC);
    ctx.fillStyle=col;ctx.fillRect(x-cw/2,bY,cw,bH);
  });
  ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='9px Fira Code,monospace';ctx.textAlign='center';
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step)ctx.fillText(candleData[i].date.toLocaleDateString('en-IN',{month:'short',day:'numeric'}),toX(i),H-PAD.b+14);
  const maxV=Math.max(...candleData.map(d=>d.v||0));
  vctx.clearRect(0,0,W,VH);
  candleData.forEach((d,i)=>{const x=toX(i),bh=((d.v||0)/maxV)*(VH-8),up=d.c>=d.o;vctx.fillStyle=up?'rgba(0,230,118,0.4)':'rgba(255,77,109,0.4)';vctx.fillRect(x-cw/2,VH-6-bh,cw,bh);});
  canvas.onmousemove=canvas.ontouchmove=function(e){
    const rect=canvas.getBoundingClientRect(),cx=e.touches?e.touches[0].clientX:e.clientX,mx=cx-rect.left;
    const idx=Math.min(n-1,Math.max(0,Math.floor((mx-PAD.l)/(CW/n))));const d=candleData[idx];if(!d)return;
    const tt=document.getElementById('chart-tooltip');tt.classList.add('show');
    document.getElementById('tt-date').textContent=d.date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    document.getElementById('tt-o').textContent='₹'+d.o.toFixed(1);document.getElementById('tt-h').textContent='₹'+d.h.toFixed(1);
    document.getElementById('tt-l').textContent='₹'+d.l.toFixed(1);document.getElementById('tt-c').textContent='₹'+d.c.toFixed(1);
  };
  canvas.onmouseleave=canvas.ontouchend=()=>document.getElementById('chart-tooltip').classList.remove('show');
}
window.addEventListener('resize',()=>{if(candleData.length&&document.getElementById('modal-backdrop').classList.contains('open'))drawChart();});

const BUNDLED='RELIANCE,Reliance Industries,EQ,01-01-2000,10,INE002A01018\nTCS,Tata Consultancy Services,EQ,25-08-2004,1,INE467B01029\nHDFCBANK,HDFC Bank,EQ,01-01-2000,1,INE040A01034\nINFY,Infosys,EQ,08-02-1993,5,INE009A01021\nICICIBANK,ICICI Bank,EQ,01-01-2000,2,INE090A01021\nSBIN,State Bank of India,EQ,01-01-2000,1,INE062A01020\nBHARTIARTL,Bharti Airtel,EQ,15-02-2002,5,INE397D01024\nKOTAKBANK,Kotak Mahindra Bank,EQ,01-01-2000,5,INE237A01028\nLT,Larsen and Toubro,EQ,01-01-2000,2,INE018A01030\nAXISBANK,Axis Bank,EQ,01-01-2000,2,INE238A01034\nWIPRO,Wipro,EQ,01-01-2000,2,INE075A01022\nNTPC,NTPC,EQ,05-11-2004,10,INE733E01010\nONGC,Oil and Natural Gas,EQ,19-03-2004,5,INE213A01029\nBAJFINANCE,Bajaj Finance,EQ,01-04-2008,2,INE296A01024\nMARUTI,Maruti Suzuki India,EQ,09-07-2003,5,INE585B01010\nSUNPHARMA,Sun Pharmaceutical,EQ,25-08-1994,1,INE044A01036\nTITAN,Titan Company,EQ,23-05-1994,1,INE280A01028\nULTRACEMCO,UltraTech Cement,EQ,01-01-2000,10,INE481G01011\nASIANPAINT,Asian Paints,EQ,01-01-2000,1,INE021A01026\nHINDUNILVR,Hindustan Unilever,EQ,01-01-2000,1,INE030A01027\nTECHM,Tech Mahindra,EQ,28-08-2006,5,INE669C01036\nHCLTECH,HCL Technologies,EQ,06-01-2000,2,INE860A01027\nADANIENT,Adani Enterprises,EQ,04-06-1997,1,INE423A01024\nADANIPORTS,Adani Ports,EQ,27-11-2007,2,INE742F01042\nCOALINDIA,Coal India,EQ,04-11-2010,10,INE522F01014\nPOWERGRID,Power Grid Corp,EQ,05-10-2007,10,INE752E01010\nJSWSTEEL,JSW Steel,EQ,14-03-2005,1,INE019A01038\nTATAMOTORS,Tata Motors,EQ,01-01-2000,2,INE155A01022\nTATASTEEL,Tata Steel,EQ,01-01-2000,1,INE081A01020\nDRREDDY,Dr Reddys Laboratories,EQ,01-01-2000,5,INE089A01023\nCIPLA,Cipla,EQ,01-01-2000,2,INE059A01026\nAPOLLOHOSP,Apollo Hospitals,EQ,01-01-2000,5,INE437A01024\nDMART,Avenue Supermarts,EQ,21-03-2017,10,INE584S01010\nZOMATO,Zomato,EQ,23-07-2021,1,INE758T01015\nIRFC,Indian Railway Finance,EQ,29-01-2021,10,INE053F01010\nIRCTC,Indian Railway Catering,EQ,14-10-2019,10,INE335Y01012\nBEL,Bharat Electronics,EQ,01-01-2001,1,INE263A01024\nLICI,Life Insurance Corp,EQ,17-05-2022,10,INE0J1Y01017\nSBILIFE,SBI Life Insurance,EQ,03-10-2017,10,INE123W01016\nHDFCLIFE,HDFC Life Insurance,EQ,17-11-2017,10,INE795G01014\nGAIL,GAIL India,EQ,01-01-2000,10,INE129A01019\nBRITANNIA,Britannia Industries,EQ,01-01-2000,1,INE216A01030\nHAVELLS,Havells India,EQ,25-01-2010,1,INE176B01034\nTATACONSUM,Tata Consumer Products,EQ,01-01-2000,1,INE192A01025\nMARICO,Marico,EQ,14-03-1996,1,INE196A01026\nDABUR,Dabur India,EQ,01-01-2000,1,INE016A01026\nBANKBARODA,Bank of Baroda,EQ,01-01-2000,2,INE028A01039\nINDUSINDBK,IndusInd Bank,EQ,01-01-2000,10,INE095A01012\nBAJAJFINSV,Bajaj Finserv,EQ,26-05-2008,1,INE918I01026\nTVSMOTOR,TVS Motor Company,EQ,01-01-2000,1,INE494B01023\nEICHERMOT,Eicher Motors,EQ,01-01-2000,1,INE066A01021\nHEROTOCO,Hero MotoCorp,EQ,14-02-2000,2,INE158A01026\nSIEMENS,Siemens,EQ,01-01-2000,2,INE003A01024\nBHEL,Bharat Heavy Electricals,EQ,01-01-2000,2,INE257A01026\nHINDALCO,Hindalco Industries,EQ,01-01-2000,1,INE038A01020\nVEDL,Vedanta,EQ,01-01-2000,1,INE205A01025\nSAIL,Steel Authority of India,EQ,01-01-2000,10,INE114A01011\nGRASIM,Grasim Industries,EQ,01-01-2000,2,INE047A01021\nJUBLFOOD,Jubilant FoodWorks,EQ,08-02-2010,10,INE797F01020\nTRENT,Trent,EQ,11-08-2000,1,INE849A01020\nNYKAA,FSN E-Commerce,EQ,10-11-2021,1,INE388Y01029\nPAYTM,One97 Communications,EQ,18-11-2021,1,INE982J01020\nCDSL,Central Depository,EQ,30-06-2017,10,INE736A01011\nMCX,Multi Commodity Exchange,EQ,09-03-2012,10,INE745G01035\nDIXON,Dixon Technologies,EQ,18-09-2017,2,INE935N01020\nLUPIN,Lupin,EQ,01-01-2000,2,INE326A01037\nAUROPHARMA,Aurobindo Pharma,EQ,01-01-2000,1,INE406A01037\nZYDUSLIFE,Zydus Lifesciences,EQ,01-07-2022,1,INE010B01027\nRVNL,Rail Vikas Nigam,EQ,11-04-2019,10,INE415G01027\nBPCL,Bharat Petroleum,EQ,01-01-2000,10,INE029A01011\nIOC,Indian Oil Corporation,EQ,01-01-2000,10,INE242A01010\nHINDPETRO,Hindustan Petroleum,EQ,01-01-2000,10,INE094A01015'.trim().split('\n').map(line=>{const p=line.split(',');return{sym:p[0],name:p[1],series:p[2],date:p[3],fv:parseFloat(p[4])||0,isin:p[5]||'',paid:0,lot:1};});

window.addEventListener('DOMContentLoaded', loadData);
