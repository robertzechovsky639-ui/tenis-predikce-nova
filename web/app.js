const SN={Hard:"Tvrdý",Clay:"Antuka",Grass:"Tráva"};const DB={},IX={};
const $=s=>document.querySelector(s),V=()=>$("#view");const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pc=p=>(p*100).toFixed(0),fd=d=>{d=String(d);return d.slice(6,8)+"."+d.slice(4,6)+"."+d.slice(0,4)};
const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let S={blend:LS.get("tpn-blend",false),view:"zapasy",bo:3,lvl:2,cat:"Vše",day:"live",tour:"atp",surf:"Hard",p1:"",p2:"",open:null,player:null,list:[],src:"",phantoms:0,errs:[],chat:[]};
const TODAY=(()=>{const d=new Date();return d.getFullYear()*1e4+(d.getMonth()+1)*100+d.getDate()})();
const h2hC=new Map();function h2h(t,a,b){const D=DB[t];if(!D.matches)return [0,0];const ia=D.players.indexOf(a),ib=D.players.indexOf(b);if(ia<0||ib<0)return [0,0];const k=t+ia+"_"+ib;if(h2hC.has(k))return h2hC.get(k);
 let x=0,y=0;for(const m of D.matches){if(m[1]===ia&&m[2]===ib)x++;else if(m[1]===ib&&m[2]===ia)y++}h2hC.set(k,[x,y]);return [x,y]}
function P(t,a,b,s,o={}){const lvl=o.level??(/australian open|roland garros|wimbledon|us open/i.test(o.tourney||"")?4:o.cat==="Challenger"||o.cat==="ITF"||o.cat==="WTA 125"?1:2);
 return TM.predictBest(DB[t],a,b,{surface:s,date:TODAY,bo:o.bo||3,level:lvl,h2h:a&&b?h2h(t,a,b):[0,0]})}
const getP=(t,n)=>{const i=TM.findPlayer(IX[t],n);return i==null?null:DB[t].players[i]};
function preProb(m){let a=getP(m.tour,m.home),b=getP(m.tour,m.away);const known=!!(a&&b);const rk=m.rk||[];if(!a)a=TM.rankPrior(m.home,rk[0]);if(!b)b=TM.rankPrior(m.away,rk[1]);return {a,b,p:P(m.tour,a,b,m.surface,m),known,prior:!known&&!!(a&&b)}}
const servC=new Map();
function inplay(m,pre,st){const key=m.id;let sp=servC.get(key);if(!sp){const pr=TM.servePrior(pre.a,pre.b,DB[m.tour].avg_spw);sp=TM.calibrateServe(pr[0],pr[1],pre.p,m.bo);servC.set(key,sp)}
 let [pA,pB]=sp;const s=st||TM.liveState(m.ev);const r=TM.inPlay(pA,pB,s);
 // ML korekce (validováno na GS 2023–24): analytická p + pre-match p + momentum (posl. 20/50 bodů) + živé statistiky podání
 const w=m.pbp?TM.pbpWinners(m.pbp):[];const f={men:m.tour==="atp",mom20:TM.momentum(w,20),mom50:TM.momentum(w,50),swA:m.stats?m.stats.hWon:0,stA:m.stats?m.stats.hPlayed:0,swB:m.stats?m.stats.aWon:0,stB:m.stats?m.stats.aPlayed:0};
 const ml=TM.inplayML(r.match,pre.p,f);return {...r,analytic:r.match,match:ml,ml:{...f,n:w.length},pA,pB,s,games:TM.simGames(pA,pB,s)}}
function prob(m){const pre=preProb(m);pre.raw=pre.p;const q=mkt(m);if(S.blend&&q!=null){pre.p=blendP(pre.p,q);pre.bl=true}let p=pre.p,ip=null;if(m.status==="live"&&m.ev&&m.sets.length){ip=inplay(m,pre);p=ip.match}return {...pre,live:p,ip}}
// --- historie predikcí ---
const BW=0.7;// váha trhu v blendu (backtest 13.–22.10.2026, n=775: nejlepší z 0.3/0.5/0.7)
function mkt(m){return m.odds?TM.devig(m.odds[0],m.odds[1])[0]:null}
function blendP(p,q){if(q==null)return p;const L=x=>Math.log(x/(1-x)),c=x=>Math.min(.999,Math.max(.001,x));return 1/(1+Math.exp(-((1-BW)*L(c(p))+BW*L(c(q)))))}
let HC=null;function logPred(m,pr){if(!m.sid||pr.p==null||!isFinite(pr.p))return;const h=HC||(HC=LS.get("tpn-hist",{}));let x=h[m.id],ch=false;
 if(!x){if(m.status==="finished")return;x=h[m.id]={h:m.home,a:m.away,p:+pr.p.toFixed(4),t:m.start,cat:m.cat,tr:m.tourney,k:pr.known?1:pr.prior?2:0,d:TODAY};ch=true}
 const q=mkt(m);if(q!=null&&x.q==null&&m.status==="upcoming"){x.q=+q.toFixed(4);ch=true}
 if(pr.ip&&m.status==="live"){const l=+pr.ip.match.toFixed(4);if(x.l!==l){x.l=l;x.la=+pr.ip.analytic.toFixed(4);ch=true}}
 if(ch)LS.set("tpn-hist",h)}
function resolveHist(list){const h=HC||(HC=LS.get("tpn-hist",{}));let ch=false;list.forEach(m=>{if(m.status==="finished"&&h[m.id]&&h[m.id].y==null&&m.winner){h[m.id].y=m.winner===1?1:0;ch=true}});if(ch)LS.set("tpn-hist",h)}
// --- favority ---
const fav=()=>LS.get("tpn-fav",[]);function togFav(n){const f=fav();const i=f.indexOf(n);i<0?f.push(n):f.splice(i,1);LS.set("tpn-fav",f);render()}
const isFav=n=>fav().includes(n);
// --- načtení ---
async function getJ(u){const r=await fetch(u);if(!r.ok)throw new Error(u+" "+r.status);return r.json()}
async function loadData(){const [a,w]=await Promise.all(["atp","wta"].map(t=>getJ("data/"+t+".json")));DB.atp=a;DB.wta=w;
 for(const t of ["atp","wta"])IX[t]=TM.nameIndex(DB[t].players);
 // zápasy (H2H, historie) se načítají líně na pozadí – první vykreslení je rychlé
 Promise.all(["atp","wta"].map(async t=>{const f=DB[t].matches_file;if(!f||DB[t].matches)return;try{DB[t].matches=(await getJ("data/"+f)).matches}catch(e){DB[t].matches=[]}})).then(()=>{h2hC.clear();render(true)})}
function dstr(off){const d=new Date(Date.now()+off*864e5);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
let loading=false;
async function refresh(){if(loading)return;loading=true;try{
 if(S.day==="live"){const r=await LIVE.getLive();S.list=TM.dedupe(r.list);S.src=r.source;S.phantoms=r.phantoms;S.errs=r.errs}
 else{const r=await LIVE.getDay(dstr(S.day==="today"?0:1));S.list=TM.dedupe(r.list).sort((a,b)=>a.start-b.start);S.src=r.source;S.errs=r.errs;S.phantoms=r.phantoms||0}
 S.loaded=true;S.list.forEach(m=>{if(STC.has(m.id))m.stats=STC.get(m.id);if(PBC.has(m.id))m.pbp=PBC.get(m.id)});trackLive();notifyCheck();
 resolveHist(S.list);$("#upd").innerHTML=`<span class="g"></span>${esc(S.src)} · aktualizováno ${new Date().toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"})}${S.phantoms?` · odfiltrováno ${S.phantoms} fantomů`:""}`;
 if(S.view==="zapasy"||S.view==="oblibene"||S.view==="tipy")render(true);loadOdds();const o=S.list.find(m=>m.id===S.open);if(o&&o.status==="live")loadDetail(o)}catch(e){S.errs=["chyba: "+e.message];S.loaded=true;render(true)}finally{loading=false}}
const STC=new Map(),PBC=new Map(),PH=new Map(),PREV=new Map();
// průběh pravděpodobnosti během sledování (každé obnovení)
function trackLive(){const now=Date.now();S.list.forEach(m=>{if(m.status!=="live")return;const pr=prob(m);const h=PH.get(m.id)||[];if(!h.length||Math.abs(h[h.length-1].p-pr.live)>1e-4||now-h[h.length-1].t>120000)h.push({t:now,p:pr.live});PH.set(m.id,h.slice(-240))})}
async function loadDetail(m){if(!m.sid)return;const [st,pb]=await Promise.all([LIVE.stats(m.sid),LIVE.pbp(m.sid)]);if(st){m.stats=st;STC.set(m.id,st)}if(pb){m.pbp=pb;PBC.set(m.id,pb)}m.detailLoaded=true;render(true)}
// upozornění pro oblíbené: brejk, konec setu, konec zápasu
const notifOn=()=>LS.get("tpn-notif",false)&&"Notification" in globalThis&&Notification.permission==="granted";
function notifyCheck(){const f=fav();S.list.forEach(m=>{if(!(f.includes(m.home)||f.includes(m.away))||!m.ev)return;const st=TM.liveState(m.ev);const p=PREV.get(m.id);
 PREV.set(m.id,{sa:st.sa,sb:st.sb,ga:st.ga,gb:st.gb,g:st.ga+st.gb,srvA:st.aServes,fin:m.status==="finished"});if(!p||!notifOn())return;const sc=m.sets.map(s=>s.join(":")).join(" ");let msg=null;
 if(m.status==="finished"&&!p.fin)msg="Konec zápasu";else if(st.sa+st.sb>p.sa+p.sb)msg="Konec setu";else if(st.ga+st.gb===p.g+1&&!(p.ga===6&&p.gb===6)){const aWon=st.ga>p.ga;if(aWon!==p.srvA)msg="Brejk"}
 if(msg)try{new Notification(`${msg}: ${m.home} – ${m.away}`,{body:sc,tag:m.id+msg,icon:"icon.svg"})}catch(e){}})}
async function toggleNotif(){if(!("Notification" in globalThis)){alert("Prohlížeč nepodporuje upozornění.");return}if(LS.get("tpn-notif",false)){LS.set("tpn-notif",false);render();return}
 const r=await Notification.requestPermission();LS.set("tpn-notif",r==="granted");render()}
async function loadOdds(){const todo=S.list.filter(m=>m.sid&&m.status!=="finished"&&m.cat!=="ITF"&&m.odds===undefined).slice(0,80);
 for(let i=0;i<todo.length;i+=6){await Promise.all(todo.slice(i,i+6).map(async m=>{m.odds=await LIVE.odds(m.sid)}));if(S.view==="zapasy"||S.view==="tipy")render(true)}}
// --- komponenty ---
const flag=cc=>cc&&cc.length===2?String.fromCodePoint(...[...cc.toUpperCase()].map(c=>127397+c.charCodeAt(0))):"";
const photo=(id,n)=>id?`<img class="ph" loading="lazy" decoding="async" alt="" src="${LIVE.photo(id)}" onerror="this.remove()">`:`<span class="ph i" aria-hidden="true">${esc((n||"?")[0])}</span>`;
function spark(h){if(!h||h.length<2)return "";const W=64,H=18,xs=h.map((_,i)=>i/(h.length-1)*W);return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M${h.map((q,i)=>xs[i].toFixed(1)+","+((1-q.p)*H).toFixed(1)).join("L")}"/></svg>`}
// graf pravděpodobnosti v čase (bod po bodu z PBP, jinak z historie obnovení)
function chart(series,a,b){if(!series||series.length<2)return `<div class="empty sm">Průběh se zobrazí po prvních bodech.</div>`;const W=600,H=150,n=series.length-1;const X=i=>(i/n*W).toFixed(1),Y=p=>((1-p)*H).toFixed(1);
 const line=series.map((q,i)=>X(i)+","+Y(q.p)).join("L");let sets="";let prev=series[0].set;series.forEach((q,i)=>{if(q.set!==prev){sets+=`<line x1="${X(i)}" x2="${X(i)}" y1="0" y2="${H}" class="sl"/>`;prev=q.set}});
 const ev=series.map((q,i)=>q.ev==="break"||q.ev==="set"?`<circle cx="${X(i)}" cy="${Y(q.p)}" r="${q.ev==="set"?4:3}" class="${q.ev}"><title>${q.ev==="set"?"konec setu":"brejk"} ${q.g}</title></circle>`:"").join("");
 const last=series[n].p;return `<figure class="chart" role="img" aria-label="Průběh pravděpodobnosti výhry: ${esc(a)} nyní ${pc(last)} %"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
 <line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" class="mid"/>${sets}<path class="area" d="M0,${H/2}L${line}L${W},${H/2}Z"/><path class="ln" d="M${line}"/>${ev}</svg>
 <figcaption><span>▲ ${esc(a)}</span><span>svislé čáry = konec setu · <b style="color:#ffd166">●</b> brejk · <b style="color:#7cf2b0">●</b> set</span><span>${esc(b)} ▼</span></figcaption></figure>`}
function timeline(m){const g=m.pbp;if(!g||!g.length)return "";const by={};g.forEach(x=>(by[x.set]??=[]).push(x));
 return `<div class="tl" aria-label="Průběh gamů">${Object.entries(by).map(([s,gs])=>`<div class="tlr"><b>${s}.</b>${gs.map(x=>{const fin=x.scoring===1||x.scoring===2;const brk=fin&&x.scoring!==x.serving&&!(x.h===7||x.a===7)&&x.points.length<20;
  return `<span class="gm ${fin?(x.scoring===1?"h":"a"):"cur"} ${brk?"brk":""}" title="${x.serving===1?esc(m.home):esc(m.away)} podává · ${x.points.map(p=>p.join(":")).join(", ")}"><i class="${x.serving===1?"sh":"sa"}"></i>${x.h}:${x.a}${brk?"<em>B</em>":""}</span>`}).join("")}</div>`).join("")}<small>● podává · <em class="bk">B</em> brejk · najeďte na game pro body</small></div>`}
function statsTable(m){const s=m.stats;if(!s||!s.rows||!s.rows.length)return m.detailLoaded?`<div class="empty sm">Statistiky zatím nejsou k dispozici.</div>`:`<div class="skel" style="height:90px"></div>`;
 return `<table class="stt"><tr><th>${esc(m.home.split(" ").pop())}</th><th></th><th>${esc(m.away.split(" ").pop())}</th></tr>${s.rows.map(r=>{const t=(r.hv+r.av)||1;const hb=r.k==="doubleFaults"?r.hv<r.av:r.hv>r.av,ab=r.k==="doubleFaults"?r.av<r.hv:r.av>r.hv;
  return `<tr><td class="${hb?"lead":""}">${esc(r.h)}</td><td><small>${esc(r.l)}</small><div class="sbar"><i style="width:${r.hv/t*100}%"></i><u style="width:${r.av/t*100}%"></u></div></td><td class="${ab?"lead":""}">${esc(r.a)}</td></tr>`}).join("")}</table>`}
function skeleton(n=5){return Array.from({length:n},()=>`<div class="m skel-card" aria-hidden="true"><div class="skel" style="width:40%"></div><div class="skel"></div><div class="skel"></div><div class="skel" style="width:70%"></div></div>`).join("")}
function probBlock(a,b,p){return `<div class="prob"><div class="pl">${esc(a)}</div><div class="pct a">${pc(p)}<small>%</small></div><div class="pct b">${pc(1-p)}<small>%</small></div><div class="pl r">${esc(b)}</div></div><div class="split"><i style="width:${p*100}%"></i></div>`}
const mini=(l,p)=>`<div class="mini"><span style="min-width:96px">${l}</span><b>${pc(p)} %</b><div class="t"><i style="width:${p*100}%"></i></div><b style="text-align:right">${pc(1-p)} %</b></div>`;
function badge(c){const k={ATP:"atp",WTA:"wta","WTA 125":"wta",Challenger:"ch",ITF:"itf"}[c]||"";return `<span class="badge ${k}">${esc(c)}</span>`}
function matchRow(m){const pr=prob(m),p=pr.live;if(pr.a&&pr.b)logPred(m,{...pr,p:pr.raw});const st=m.status==="live"&&m.ev?TM.liveState(m.ev):null;
 const sc=i=>m.sets.map((s,k)=>`<span class="${m.status==="live"&&k===m.sets.length-1?"cur":""}">${s[i]}</span>`).join("")+(m.status==="live"&&m.point&&m.point[i]!=null?`<span class="pt">${esc(m.point[i])}</span>`:"");
 const t=m.status==="live"?`<span class="badge live">● ${esc(m.desc||"živě")}</span>${m.stale?`<span class="badge">⚠ skóre se nemění 15+ min</span>`:""}`:m.status==="finished"?`<span class="badge">${m.retired?esc(m.desc):"Konec"}</span>`:`<span class="badge">${new Date(m.start*1000).toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"})}</span>`;
 const o=m.odds;const ok=pr.known&&pr.a.m>=20&&pr.b.m>=20;const vt=o&&ok?TM.valueTip(p,o):null;const v=[vt&&vt.side===0,vt&&vt.side===1];
 const open=S.open===m.id;return `<div class="m${open?" open":""}" data-id="${m.id}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${esc(m.home)} proti ${esc(m.away)}, ${m.status==="live"?"živě":m.status==="finished"?"skončeno":"nezačalo"}, výhra ${esc(m.home)} ${pc(p)} procent"><div class="row" style="margin-bottom:4px">${t}${m.status==="live"?spark(PH.get(m.id)):""}<small class="nm">${esc(SN[m.surface])}${pr.known?"":pr.prior?" · odhad z žebříčku":" · málo dat o hráčích"}</small></div>
 ${[0,1].map(i=>{const n=i?m.away:m.home;return `<div class="row"><span class="srv ${st&&st.known&&(st.serverNow===!i)?"on":""}"></span><span class="nm ${m.winner===i+1?"w":""}">${m.cc&&m.cc[i]?`<span class="fl" aria-hidden="true">${flag(m.cc[i])}</span>`:""}${esc(n)}</span><button class="star ${isFav(n)?"on":""}" data-fav="${esc(n)}" aria-label="${isFav(n)?"Odebrat z":"Přidat do"} oblíbených: ${esc(n)}" aria-pressed="${isFav(n)}">★</button><div class="sc">${sc(i)}</div></div>`}).join("")}
 <div style="margin-top:6px">${mini(m.status==="live"?"Výhra (živě)":"Výhra",p)}</div>
 ${o?`<div class="odds">Kurzy <span class="ob ${v[0]?"val":""}">${o[0]}</span><span class="ob ${v[1]?"val":""}">${o[1]}</span>${v[0]||v[1]?`<span class="badge val">VALUE: ${esc(v[0]?m.home:m.away)}</span>`:""}</div>`:""}
 ${S.open===m.id?`<div class="detail-in" role="region" aria-label="Detail zápasu">${detail(m,pr)}</div>`:""}</div>`}
function factors(t,a,b,s,o={}){const D=DB[t];if(D.best==="gbm"&&D.gbm){const lvl=o.level??2;const r=TM.explainGB(D,a,b,{surface:s,date:TODAY,bo:o.bo||3,level:lvl,h2h:h2h(t,a,b)});
  return `<table>${r.map(f=>`<tr><td>${f.k}</td><td class="num ${f.v>=0?"W":"L"}" style="text-align:right">${f.v>=0?"+":""}${f.v.toFixed(2)}</td></tr>`).join("")}</table><small>Příspěvky prvků v gradient boostingu (Saabas, log-odds před kalibrací, symetrizováno). Kladné zvýhodňují prvního hráče.</small>`}
 return `<table>${TM.explain(D.coef,a,b,s).map(f=>`<tr><td>${f.k}</td><td><small>${esc(f.d)}</small></td><td class="num ${f.v>=0?"W":"L"}" style="text-align:right">${f.v>=0?"+":""}${f.v.toFixed(2)}</td></tr>`).join("")}</table><small>Kladné hodnoty (log-odds) zvyhodňují prvního hráče.</small>`}
function detail(m,pr){const head=`<div class="vs">${photo(m.hid,m.home)}<b>${esc(m.home)}</b><span>vs</span><b>${esc(m.away)}</b>${photo(m.aid,m.away)}</div>`;
 let live="";if(m.sid&&(m.status==="live"||m.status==="finished")){const sp=pr.ip?[pr.ip.pA,pr.ip.pB]:servC.get(m.id);let ser=null;
  if(m.pbp&&m.pbp.length&&sp)ser=TM.pbpSeries(sp[0],sp[1],m.pbp,m.bo,!!m.slam);else if(PH.get(m.id))ser=PH.get(m.id).map(q=>({p:q.p,set:0}));
  live=`<div class="card" style="margin:10px 0 0"><h3>Průběh – pravděpodobnost výhry bod po bodu</h3>${m.detailLoaded||ser?chart(ser,m.home,m.away):`<div class="skel" style="height:150px"></div>`}${timeline(m)}</div>
  <div class="card" style="margin:10px 0 0"><h3>Statistiky zápasu</h3>${statsTable(m)}</div>`}
 let h=head+live+`<div class="card hi" style="margin:10px 0 0"><h3>Predikce před zápasem</h3>${probBlock(m.home,m.away,pr.p)}<h3 style="margin-top:12px">Faktory</h3>${factors(m.tour,pr.a,pr.b,m.surface)}</div>`;
 if(pr.ip){const ip=pr.ip,s=ip.s;h+=`<div class="card" style="margin:10px 0 0"><h3>In-play (stav ${s.sa}:${s.sb} sety, ${s.ga}:${s.gb} gamy)</h3>
 ${mini("Zápas",ip.match)}${mini("Aktuální set",ip.set)}
 <div class="grid" style="margin-top:10px"><div class="kpi"><small>Tiebreak v setu</small><b>${pc(ip.tiebreak)} %</b></div><div class="kpi"><small>Rozhodující set</small><b>${pc(ip.decider)} %</b></div>
 <div class="kpi"><small>Gamů celkem (Ø)</small><b>${ip.games.mean.toFixed(1)}</b></div><div class="kpi"><small>Over ${Math.floor(ip.games.median)+.5}</small><b>${pc(ip.games.over(Math.floor(ip.games.median)+.5))} %</b></div></div>
 <p><small>Bod na podání: ${esc(m.home)} ${pc(ip.pA)} %, ${esc(m.away)} ${pc(ip.pB)} % ${m.stats&&m.stats.hPlayed?`· živě ${m.stats.hWon}/${m.stats.hPlayed} a ${m.stats.aWon}/${m.stats.aPlayed}`:"· živé statistiky se načítají…"}<br>Analytický model ${pc(ip.analytic)} % → ML korekce ${pc(ip.match)} % (momentum posl. 20 bodů ${ip.ml.n?((ip.ml.mom20+.5)*100).toFixed(0)+" % pro "+esc(m.home.split(" ").pop()):"—"})</small></p></div>`}
 else if(m.status==="upcoming"){const sp=TM.servePrior(pr.a,pr.b,DB[m.tour].avg_spw);const c=TM.calibrateServe(sp[0],sp[1],pr.p,m.bo);const g=TM.simGames(c[0],c[1],{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:m.bo});
  const r=TM.inPlay(c[0],c[1],{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:m.bo});h+=`<div class="card" style="margin:10px 0 0"><h3>Průběh</h3><div class="grid"><div class="kpi"><small>Tiebreak v 1. setu</small><b>${pc(r.tiebreak)} %</b></div><div class="kpi"><small>Rozhodující set</small><b>${pc(r.decider)} %</b></div><div class="kpi"><small>Gamů (Ø)</small><b>${g.mean.toFixed(1)}</b></div><div class="kpi"><small>1. set ${esc(m.home.split(" ").pop())}</small><b>${pc(r.set)} %</b></div></div></div>`}
 return h}
// --- pohledy ---
function calib(done){if(!done.length)return "";const met=f=>{const L=done.filter(x=>f(x)!=null);if(!L.length)return null;return {n:L.length,b:TM.brier(L.map(x=>[f(x),x.y])),a:L.filter(x=>(f(x)>.5)===(x.y===1)).length/L.length}};
 const rows=[["Model (před zápasem)",x=>x.p],["Trh (kurzy bez marže)",x=>x.q??null],["Blend model+trh",x=>x.q!=null?blendP(x.p,x.q):null],["Živě – poslední ML odhad",x=>x.l??null]].map(([k,f])=>[k,met(f)]).filter(r=>r[1]);
 const bins=Array.from({length:10},()=>[0,0]);done.forEach(x=>{const p=Math.max(x.p,1-x.p),y=x.p>=.5?x.y:1-x.y,i=Math.min(9,Math.floor(p*10));bins[i][0]++;bins[i][1]+=y});
 const W=300,H=170,X=v=>(30+(v-.5)*2*(W-40)).toFixed(1),Y=v=>(H-20-v*(H-30)).toFixed(1);
 const pts=bins.map((b,i)=>b[0]?`<circle cx="${X((i+.5)/10)}" cy="${Y(b[1]/b[0])}" r="${Math.min(9,3+Math.sqrt(b[0]))}"><title>${i*10}–${i*10+10} %: ${b[1]}/${b[0]}</title></circle>`:"").join("");
 const days=[...new Set(done.map(x=>x.d||0))].sort();let cum=[],nn=0,hh=0,bb=0;days.forEach(d=>{done.filter(x=>(x.d||0)===d).forEach(x=>{nn++;hh+=(x.p>.5)===(x.y===1);bb+=(x.p-x.y)**2});cum.push([d,hh/nn,bb/nn,nn])});
 const tl=cum.length>1?`<figure class="cal"><svg viewBox="0 0 ${W} 120" role="img" aria-label="Úspěšnost v čase"><path class="g" d="M30 ${(110-.5*100).toFixed(0)}H${W-10}"/><path class="ln" d="M${cum.map((c,i)=>(30+i/(cum.length-1)*(W-40)).toFixed(1)+","+(110-c[1]*100).toFixed(1)).join("L")}"/></svg><figcaption>Kumulativní úspěšnost podle dne (čára 50 %) · poslední: ${pc(cum.at(-1)[1])} % z ${cum.at(-1)[3]}</figcaption></figure>`:"";
 return `<div class="calwrap"><figure class="cal"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalibrace"><path class="g" d="M${X(.5)},${Y(.5)}L${X(1)},${Y(1)}"/>${pts}</svg><figcaption>Kalibrace: osa x = predikovaná šance favorita (50–100 %), y = skutečná úspěšnost; ideál = diagonála</figcaption></figure>${tl}</div>
 <table><tr><th>Zdroj</th><th>n</th><th>Brier</th><th>Úspěšnost</th></tr>${rows.map(([k,m])=>`<tr><td>${k}</td><td class="num">${m.n}</td><td class="num">${m.b.toFixed(3)}</td><td class="num">${pc(m.a)} %</td></tr>`).join("")}</table>`}
function cmpBar(k,va,vb,fmt=v=>v){const s=Math.abs(va)+Math.abs(vb)||1;return `<div class="cbar"><span class="num">${fmt(va)}</span><div class="cb"><i class="a" style="width:${(va/s*100).toFixed(1)}%"></i><i class="b" style="width:${(vb/s*100).toFixed(1)}%"></i></div><span class="num">${fmt(vb)}</span><small>${k}</small></div>`}
const VIEWS={
tipy(){const L=S.list.filter(m=>m.status==="upcoming").map(m=>({m,pr:prob(m)})).filter(x=>x.pr.known&&x.pr.a.m>=20&&x.pr.b.m>=20).map(x=>({...x,c:Math.max(x.pr.p,1-x.pr.p),vt:x.m.odds?TM.valueTip(x.pr.p,x.m.odds):null})).sort((a,b)=>b.c-a.c);
 const pick=L[0],val=L.filter(x=>x.vt).sort((a,b)=>b.vt.edge-a.vt.edge).slice(0,5);const nm=x=>x.pr.p>=.5?x.m.home:x.m.away;
 const row=x=>`<tr><td>${badge(x.m.cat)} <small>${esc(x.m.tourney)}</small><br><b>${esc(nm(x))}</b> <small>vs ${esc(x.pr.p>=.5?x.m.away:x.m.home)}</small></td><td class="num">${pc(x.c)} %</td><td class="num"><small>${x.m.odds?x.m.odds[x.pr.p>=.5?0:1]:"—"}</small></td></tr>`;
 return `<h1>Tipy dne</h1>${!S.loaded?skeleton(3):!L.length?`<div class="empty">Dnes zatím nejsou nadcházející zápasy se známými hráči (min. 20 zápasů v datech).</div>`:`
 <div class="card hi"><h3>Tip dne</h3>${probBlock(pick.m.home,pick.m.away,pick.pr.p)}<p><small>${esc(pick.m.tourney)} · nejjistější predikce modelu ze ${L.length} dnešních zápasů${pick.vt?` · VALUE vs. kurz ${pick.m.odds[pick.vt.side]}`:""}</small></p></div>
 <div class="card"><h3>Nejjistější tipy</h3><table><tr><th>Favorit</th><th>Šance</th><th>Kurz</th></tr>${L.slice(0,15).map(row).join("")}</table><small>Seřazeno podle jistoty modelu; zobrazeni jen hráči s ≥ 20 zápasy v datech. Ani 80 % není jistota.</small></div>
 ${val.length?`<div class="card"><h3>Value tipy (model vs. kurz bez marže)</h3><table>${val.map(x=>`<tr><td><b>${esc(x.vt.side?x.m.away:x.m.home)}</b> <small>${esc(x.m.tourney)}</small></td><td class="num">+${(x.vt.edge*100).toFixed(1)} %</td><td class="num">${x.m.odds[x.vt.side]}</td></tr>`).join("")}</table><small>Backtest 13.–22.10.2026: trh byl přesnější než model (Brier 0.205 vs 0.227) – value tipy berte s rezervou.</small></div>`:""}`}`},
srovnani(){const t=S.ctour||(S.ctour="atp"),D=DB[t];const opts=D.players.filter(p=>p.m>=5).sort((a,b)=>b.e-a.e);if(!S.c1){S.c1=opts[0].n;S.c2=opts[1].n}
 const a=getP(t,S.c1),b=getP(t,S.c2);let body=`<div class="empty">Vyberte dva různé hráče.</div>`;
 if(a&&b&&a!==b){const ps=TM.SURF.map(s=>[s,P(t,a,b,s,{bo:3,level:2})]);const f=(x,n)=>x.f.slice(-n);const roll=x=>{const r=x.f.slice();return r.map((_,i)=>r.slice(0,i+1).reduce((s,v)=>s+v,0)/(i+1))};
  const sv=x=>x.sv||{spw:x.spw,rpw:x.rpw};const pct=v=>v==null||!isFinite(v)?"—":(v*100).toFixed(1);const r=x=>Math.round(x);
  const ra=roll(a),rb=roll(b),W=300,H=90,line=(arr,c)=>arr.length>1?`<path class="${c}" d="M${arr.map((v,i)=>(10+i/(arr.length-1)*(W-20)).toFixed(1)+","+(H-10-v*(H-20)).toFixed(1)).join("L")}"/>`:"";
  body=`<div class="card hi"><h3>Šance na výhru podle povrchu</h3>${ps.map(([s,p])=>`<div class="srow"><small>${SN[s]}</small>${probBlock(a.n,b.n,p)}</div>`).join("")}</div>
  <div class="card"><h3>Srovnání</h3><div class="cleg"><span class="a">${esc(a.n)}</span><span class="b">${esc(b.n)}</span></div>
  ${cmpBar("Elo",a.e,b.e,r)}${TM.SURF.map(s=>cmpBar("Elo "+SN[s].toLowerCase(),a.s[s],b.s[s],r)).join("")}
  ${cmpBar("Body na podání %",sv(a).spw||0,sv(b).spw||0,pct)}${cmpBar("Body na příjmu %",sv(a).rpw||0,sv(b).rpw||0,pct)}
  ${cmpBar("Forma (posl. 10) %",TM.form(a),TM.form(b),v=>pc(v))}
  ${cmpBar("Odehráno zápasů",a.m,b.m)}${a.rank&&b.rank?cmpBar("Žebříček (menší = lepší, osa 1/rank)",1/a.rank,1/b.rank,v=>Math.round(1/v)):""}</div>
  <div class="card"><h3>Vývoj formy (kumulativní podíl výher, posl. 10)</h3><figure class="cal"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:140px" role="img" aria-label="Forma"><path class="g" d="M10 ${H/2}H${W-10}"/>${line(ra,"la")}${line(rb,"lb")}</svg><figcaption><span class="a">■</span> ${esc(a.n)} · <span class="b">■</span> ${esc(b.n)}</figcaption></figure></div>`}
 return `<h1>Srovnání hráčů</h1><div class="filters"><div class="sel" style="max-width:110px"><label>Okruh</label><select id="ctour"><option value="atp">ATP</option><option value="wta" ${t==="wta"?"selected":""}>WTA</option></select></div>
 <div class="sel"><label>Hráč 1</label><input id="c1" list="cpl" value="${esc(S.c1)}"></div><div class="sel"><label>Hráč 2</label><input id="c2" list="cpl" value="${esc(S.c2)}"></div></div><datalist id="cpl">${opts.slice(0,1500).map(p=>`<option value="${esc(p.n)}">`).join("")}</datalist><div id="cbody">${body}</div>`},
hledat(){const q=TM.norm(S.q||"");let body="";if(q.length>=2){const ws=q.split(" ");const hit=s=>{const n=TM.norm(s||"");return ws.every(w=>n.includes(w))};
  const pl=["atp","wta"].flatMap(t=>DB[t].players.filter(p=>hit(p.n)).map(p=>[t,p])).sort((x,y)=>y[1].e-x[1].e).slice(0,12);
  const ms=S.list.filter(m=>hit(m.home+" "+m.away+" "+m.tourney)).slice(0,12);const tr=[...new Set(S.list.filter(m=>hit(m.tourney)).map(m=>m.tourney))].slice(0,6);
  const vw=[["zapasy","Zápasy"],["oblibene","Oblíbené"],["predikce","Predikce"],["hraci","Hráči"],["historie","Historie"],["tipy","Tipy dne"],["srovnani","Srovnání hráčů"],["chat","Chat"],["model","Model"]].filter(([k,l])=>hit(l));
  body=`${pl.length?`<div class="card"><h3>Hráči</h3><table>${pl.map(([t,p])=>`<tr><td><a href="#" data-prof="${esc(p.n)}">${esc(p.n)}</a></td><td>${t.toUpperCase()}</td><td class="num">Elo ${Math.round(p.e)}</td></tr>`).join("")}</table></div>`:""}
  ${ms.length?`<div class="grp"><div class="ghead">Zápasy (${S.day==="live"?"živě":"vybraný den"})</div>${ms.map(matchRow).join("")}</div>`:""}
  ${tr.length?`<div class="card"><h3>Turnaje</h3>${tr.map(t=>`<div>${esc(t)}</div>`).join("")}</div>`:""}
  ${vw.length?`<div class="card"><h3>Sekce</h3>${vw.map(([k,l])=>`<button class="btn" data-v="${k}">${l}</button> `).join("")}</div>`:""}
  ${!pl.length&&!ms.length&&!tr.length&&!vw.length?`<div class="empty">Nic nenalezeno pro „${esc(S.q)}“.</div>`:""}`}else body=`<div class="empty">Hledejte hráče, turnaje, zápasy nebo sekce (min. 2 znaky).</div>`;
 return `<h1>Hledat</h1><div class="sel" style="max-width:none"><label for="gq">Hledat</label><input id="gq" type="search" autocomplete="off" placeholder="např. Sinner, Wimbledon, Shanghai…" value="${esc(S.q||"")}"></div><div id="gres">${body}</div>`},
zapasy(){const cats=["Vše","ATP","WTA","Challenger","ITF"];let L=S.list.filter(m=>S.cat==="Vše"||m.cat===S.cat||(S.cat==="WTA"&&m.cat==="WTA 125"));
 const groups={};L.forEach(m=>(groups[m.cat+"|"+m.tourney]??=[]).push(m));
 return `<h1>Zápasy</h1><div class="seg" id="days">${[["live","● Živě"],["today","Dnes"],["tomorrow","Zítra"]].map(([k,l])=>`<button data-day="${k}" class="${S.day===k?"on":""}">${l}</button>`).join("")}</div>
 <div class="seg">${cats.map(c=>`<button data-cat="${c}" class="${S.cat===c?"on":""}">${c}</button>`).join("")}</div>
 <div class="card" style="padding:10px 14px"><label class="tog"><input type="checkbox" id="blend" ${S.blend?"checked":""}> Kombinovat s kurzy (${Math.round(BW*100)} % trh)</label><small>Aktivní zdroj: <b style="color:var(--grn)">${esc(S.src||"…")}</b>${S.errs.length?" · výpadky: "+S.errs.map(esc).join("; "):""}</small></div>
 ${Object.entries(groups).map(([k,ms])=>{const [c,t]=k.split("|");return `<div class="grp"><div class="ghead"><span>${badge(c)} ${esc(t)}</span><small>${ms.length}</small></div>${ms.map(matchRow).join("")}</div>`}).join("")||(!S.loaded?skeleton():S.src==="nedostupné"?`<div class="empty err" role="alert">Živá data jsou teď nedostupná ze všech 3 zdrojů.<br><button class="btn" data-retry="1">Zkusit znovu</button></div>`:`<div class="empty">Žádné zápasy${S.cat!=="Vše"?" v kategorii "+esc(S.cat):""}.</div>`)}`},
oblibene(){const f=fav();const ms=S.list.filter(m=>f.includes(m.home)||f.includes(m.away));
 const nOn=notifOn();return `<h1>Oblíbené</h1><div class="card row" style="justify-content:space-between"><span><b>🔔 Upozornění</b><br><small>Brejk, konec setu a konec zápasu u oblíbených (když je aplikace otevřená).</small></span><button class="btn ${nOn?"on":""}" data-notif="1" aria-pressed="${nOn}">${nOn?"Zapnuto":"Zapnout"}</button></div>${f.length?"":`<div class="empty">Zatím nic. Přidejte hráče hvězdičkou ★ u zápasu nebo v profilu.</div>`}
 ${f.length?`<div class="card"><h3>Hráči</h3><table>${f.map(n=>{const t=getP("atp",n)?"atp":"wta";const p=getP(t,n);return `<tr><td><a href="#" data-prof="${esc(n)}" style="color:var(--txt)">${esc(n)}</a></td><td class="num">${p?Math.round(p.e):"—"}</td><td><button class="star on" data-fav="${esc(n)}">★</button></td></tr>`}).join("")}</table></div>`:""}
 ${ms.length?`<div class="grp"><div class="ghead">Zápasy oblíbených</div>${ms.map(matchRow).join("")}</div>`:f.length?`<div class="empty">Oblíbení hráči teď nehrají (${S.day==="live"?"živě":"vybraný den"}).</div>`:""}`},
predikce(){const D=DB[S.tour];const opts=D.players.filter(p=>p.m>=5).sort((a,b)=>b.e-a.e);if(!S.p1){S.p1=opts[0].n;S.p2=opts[1].n}
 const a=getP(S.tour,S.p1),b=getP(S.tour,S.p2);let body="";
 if(a&&b&&a!==b){const p=P(S.tour,a,b,S.surf,{bo:S.bo,level:S.lvl});const ia=D.players.indexOf(a),ib=D.players.indexOf(b);
  const h=(D.matches||[]).filter(m=>(m[1]===ia&&m[2]===ib)||(m[1]===ib&&m[2]===ia)).reverse(),hw=h.filter(m=>m[1]===ia).length;
  body=`<div class="card hi"><h3>Pravděpodobnost výhry · ${SN[S.surf]}</h3>${probBlock(a.n,b.n,p)}</div>
  <div class="card"><h3>Proč</h3>${factors(S.tour,a,b,S.surf,{bo:+S.bo||3,level:S.lvl})}<small>Výsledná pravděpodobnost je z modelu ${D.best==="gbm"?"XGBoost (20 vstupů: Elo, povrch, forma i forma na povrchu, Elo momentum, únava za 14 dní, podání/příjem, H2H, žebříček, věk, odpočinek, počet setů, úroveň turnaje)":"logistické regrese"}.</small></div>
  <div class="card"><h3>Elo</h3><table><tr><th>Hráč</th><th>Celk.</th><th>Tvrdý</th><th>Antuka</th><th>Tráva</th></tr>${[a,b].map(x=>`<tr><td>${esc(x.n)}</td><td class="num">${Math.round(x.e)}</td>${TM.SURF.map(s=>`<td class="num">${Math.round(x.s[s])}</td>`).join("")}</tr>`).join("")}</table></div>
  <div class="card"><h3>Vzájemné zápasy <span class="num" style="color:var(--pink)">${hw}</span> : <span class="num" style="color:var(--vio)">${h.length-hw}</span></h3>${h.length?`<table>${h.slice(0,10).map(m=>`<tr><td>${fd(m[0])}</td><td><b>${esc(D.players[m[1]].n)}</b></td><td>${esc(m[4])}</td><td><small>${esc(m[5])} · ${SN[m[3]]}</small></td></tr>`).join("")}</table>`:"<small>Žádné vzájemné zápasy od 2015.</small>"}</div>
  <div class="card"><h3>Forma (posl. 10)</h3><table>${[a,b].map(x=>`<tr><td>${esc(x.n)}</td><td>${x.f.slice().reverse().map(r=>`<span class="${r?"W":"L"}">${r?"V":"P"}</span>`).join(" ")}</td><td class="num">${pc(TM.form(x))} %</td></tr>`).join("")}</table></div>`}
 else body=`<div class="empty">Vyberte dva různé hráče ze seznamu.</div>`;
 return `<h1>Predikce</h1><div class="filters"><div class="sel"><label>Okruh</label><select id="tour"><option value="atp">ATP</option><option value="wta" ${S.tour==="wta"?"selected":""}>WTA</option></select></div>
 <div class="sel"><label>Povrch</label><select id="surf">${TM.SURF.map(s=>`<option value="${s}" ${S.surf===s?"selected":""}>${SN[s]}</option>`).join("")}</select></div>
 <div class="sel"><label>Turnaj</label><select id="lvl">${[[4,"Grand Slam"],[3,"Masters / 1000"],[2,"ATP/WTA 250–500"],[1,"Challenger / 125"]].map(([v,l])=>`<option value="${v}" ${S.lvl==v?"selected":""}>${l}</option>`).join("")}</select></div>
 <div class="sel" style="max-width:110px"><label>Sety</label><select id="bo"><option value="3">na 2 vítězné</option><option value="5" ${S.bo==5?"selected":""}>na 3 vítězné</option></select></div></div>
 <div class="filters"><div class="sel"><label>Hráč 1</label><input id="p1" list="pl" value="${esc(S.p1)}"></div><div class="sel"><label>Hráč 2</label><input id="p2" list="pl" value="${esc(S.p2)}"></div></div>
 <datalist id="pl">${opts.map(p=>`<option value="${esc(p.n)}">`).join("")}</datalist><div id="pbody">${body}</div>`},
hraci(){const D=DB[S.tour];const top=D.players.filter(p=>p.m>=10&&p.last>=D.data_through-10000).sort((a,b)=>b.e-a.e);const p=S.player&&getP(S.tour,S.player);
 let prof="";if(p){const i=D.players.indexOf(p);const rec=(D.matches||[]).filter(m=>m[1]===i||m[2]===i).slice(-10).reverse();const sv=p.sv;
  prof=`<div class="card hi"><div class="row"><h2 style="margin:0;flex:1;font-style:italic;font-weight:900">${esc(p.n)}</h2><button class="star ${isFav(p.n)?"on":""}" data-fav="${esc(p.n)}">★</button></div>
  <small style="color:#d9d0ff">${esc(p.ioc||"")} · ${p.hand==="L"?"levák":p.hand==="R"?"pravák":"—"}${p.ht?` · ${p.ht} cm`:""}${p.rank?` · žebříček ${p.rank}`:""} · ${p.m} zápasů od 2015</small>
  <div class="grid" style="margin-top:10px"><div class="kpi"><small>Elo celkové</small><b>${Math.round(p.e)}</b></div>${TM.SURF.map(s=>`<div class="kpi"><small>${SN[s]} (${p.sm[s]})</small><b>${Math.round(p.s[s])}</b></div>`).join("")}</div></div>
  <div class="card"><h3>Podání a příjem (posl. 2 roky)</h3>${sv?`<div class="grid"><div class="kpi"><small>Body na podání</small><b>${pc(sv.spw)} %</b></div><div class="kpi"><small>Body na příjmu</small><b>${pc(sv.rpw)} %</b></div><div class="kpi"><small>Esa / game</small><b>${sv.ace}</b></div><div class="kpi"><small>Dvojchyby / game</small><b>${sv.df}</b></div></div>`:"<small>Nedostatek dat.</small>"}</div>
  <div class="card"><h3>Forma · ${pc(TM.form(p))} %</h3><table>${rec.map(m=>`<tr><td>${fd(m[0])}</td><td class="${m[1]===i?"W":"L"}">${m[1]===i?"V":"P"}</td><td>${esc(D.players[m[1]===i?m[2]:m[1]].n)}</td><td>${esc(m[4])}</td><td><small>${esc(m[5])}</small></td></tr>`).join("")}</table></div>`}
 return `<h1>Hráči</h1><div class="filters"><div class="sel" style="max-width:110px"><label>Okruh</label><select id="tour"><option value="atp">ATP</option><option value="wta" ${S.tour==="wta"?"selected":""}>WTA</option></select></div>
 <div class="sel"><label>Hledat hráče</label><input id="psearch" list="pl2" placeholder="Jméno…" value="${esc(S.player||"")}"></div></div><datalist id="pl2">${D.players.filter(p=>p.m>=5).map(p=>`<option value="${esc(p.n)}">`).join("")}</datalist>
 ${prof}<div class="card"><h3>Top 30 podle Elo</h3><table><tr><th>#</th><th>Hráč</th><th>Elo</th><th>Tvrdý</th><th>Antuka</th><th>Tráva</th></tr>${top.slice(0,30).map((x,k)=>`<tr><td>${k+1}</td><td><a href="#" data-prof="${esc(x.n)}" style="color:var(--txt)">${esc(x.n)}</a></td><td class="num">${Math.round(x.e)}</td>${TM.SURF.map(s=>`<td>${Math.round(x.s[s])}</td>`).join("")}</tr>`).join("")}</table></div>`},
historie(){const h=Object.values(HC||(HC=LS.get("tpn-hist",{}))).sort((a,b)=>b.t-a.t);const done=h.filter(x=>x.y!=null);
 const bt=[...DB.atp.backtest.map(r=>["atp",...r]),...DB.wta.backtest.map(r=>["wta",...r])].sort((a,b)=>b[1]-a[1]);const hit=bt.filter(r=>r[7]>.5).length;
 return `<h1>Historie</h1><div class="card hi"><h3>Moje sledované predikce (toto zařízení)</h3><div class="grid"><div class="kpi"><small>Uloženo</small><b>${h.length}</b></div><div class="kpi"><small>Vyhodnoceno</small><b>${done.length}</b></div>
 <div class="kpi"><small>Úspěšnost</small><b>${done.length?pc(done.filter(x=>(x.p>.5)===(x.y===1)).length/done.length)+" %":"—"}</b></div><div class="kpi"><small>Brier</small><b>${done.length?TM.brier(done.map(x=>[x.p,x.y])).toFixed(3):"—"}</b></div></div>
 ${calib(done)}<small style="color:#d9d0ff">Každá predikce, kterou aplikace zobrazí (vč. odhadů z žebříčku, kurzů a živé ML pravděpodobnosti), se uloží automaticky; výsledek se doplní, když se zápas objeví jako dohraný (záložka Dnes).</small></div>
 ${h.length?`<div class="card"><table>${h.slice(0,50).map(x=>`<tr><td><small>${new Date(x.t*1000).toLocaleDateString("cs-CZ")}</small></td><td>${esc(x.h)} – ${esc(x.a)}</td><td class="num">${pc(x.p)} %</td><td>${x.y==null?"<small>čeká</small>":(x.p>.5)===(x.y===1)?'<span class="W">✓</span>':'<span class="L">✗</span>'}</td></tr>`).join("")}</table></div>`:""}
 <div class="card"><h3>Backtest · posledních ${bt.length} zápasů testu</h3><p><small>Model natrénovaný do 31.12.2023, predikce na dohraných zápasech: favorit vyhrál ${hit}/${bt.length} (${pc(hit/bt.length)} %).</small></p>
 <table>${bt.slice(0,40).map(r=>{const D=DB[r[0]];return `<tr><td><small>${fd(r[1])}</small></td><td><b>${esc(D.players[r[2]].n)}</b> – ${esc(D.players[r[3]].n)}</td><td><small>${esc(r[5])}</small></td><td class="num ${r[7]>.5?"W":"L"}">${pc(r[7])} %</td></tr>`}).join("")}</table></div>`},
chat(){return `<h1>Chat</h1><div class="card"><div class="chat" id="chatlog">${(S.chat.length?S.chat:[["b","Ahoj! Zeptej se třeba:\n• Sinner vs Alcaraz na antuce\n• Elo Swiatek\n• forma Djokovic\n• value tipy\n• kdo je nejlepší na trávě"]]).map(([w,t])=>`<div class="msg ${w}">${esc(t)}</div>`).join("")}</div></div>
 <div class="chatin"><input id="q" placeholder="Napiš otázku…" autocomplete="off"><button class="btn" id="send">Poslat</button></div>`},
model(){return `<h1>Model</h1>${["atp","wta"].map(t=>{const D=DB[t],m=D.metrics;return `<div class="card ${t==="atp"?"hi":""}"><h3>${t.toUpperCase()} · test od ${m.test_from} (n=${m.model.n})</h3>
 <div class="grid"><div class="kpi"><small>Brier</small><b>${m.model.brier.toFixed(4)}</b></div><div class="kpi"><small>Log-loss</small><b>${m.model.logloss.toFixed(4)}</b></div><div class="kpi"><small>Přesnost</small><b>${(m.model.accuracy*100).toFixed(1)} %</b></div><div class="kpi"><small>Jen Elo – Brier</small><b>${m.raw_overall_elo.brier.toFixed(4)}</b></div></div>
 <h3 style="margin-top:14px">Kalibrace</h3><div class="cal">${m.calibration.map(c=>`<div title="predikce ${pc(c[0])} %, skutečnost ${pc(c[1])} %, n=${c[2]}"><i style="height:${c[0]*100}%"></i><u style="height:${c[1]*100}%"></u></div>`).join("")}</div>
 <small><span style="color:var(--vio)">■</span> průměrná predikce · <span style="color:var(--pink)">■</span> skutečný podíl výher (10 košů)</small>
 <h3 style="margin-top:14px">Porovnání modelů (test 2024+, hlavní okruh)</h3><table><tr><th>Model</th><th>Brier</th><th>Log-loss</th><th>Přesnost</th></tr>${[["Jen Elo","cmp_elo_main"],["Logistická regrese","cmp_lr_main"],["HistGB (16 vstupů, předchozí)","cmp_hgb16_main"],["XGBoost (20 vstupů) + izotonická kal.","cmp_gbm_main"]].map(([l,k])=>{const x=m.all[k];return x?`<tr><td>${l}${(k==="cmp_gbm_main")===(D.best==="gbm")&&k!=="cmp_elo_main"?" ✓":""}</td><td class="num">${x.brier.toFixed(4)}</td><td class="num">${x.logloss.toFixed(4)}</td><td class="num">${(x.accuracy*100).toFixed(1)} %</td></tr>`:""}).join("")}</table>
 <small>Elo od roku 1968 · data do ${fd(D.data_through)} (Sackmann do ${fd(D.sackmann_through)}, doplněno: ${Object.entries(D.added||{}).map(([k,v])=>k+" "+v).join(", ")})</small>
 <p><small>Koeficienty LR: ${D.coef.map(x=>x.toFixed(3)).join(" / ")} (intercept, celk. Elo, povrch Elo, forma) · data do ${fd(D.data_through)} · ${D.players.length} hráčů</small></p></div>`}).join("")}
 <div class="card"><h3>Jak to funguje</h3><small>Elo od roku 1968 (K klesající s počtem zápasů) celkové + zvlášť pro každý povrch, forma = podíl výher z posledních 10 zápasů. Hlavní model je gradient boosting (HistGradientBoosting, 300 stromů) na 16 vstupech – Elo, Elo na povrchu, forma, podání/příjem (EWMA), H2H, žebříček, věk, dny odpočinku, počet setů, úroveň turnaje, povrch, zkušenost – trénink 2000–2021, izotonická kalibrace 2022–2023, test 2024+. Stromy běží přímo v prohlížeči (JSON). Pro srovnání je k dispozici logistická regrese (Elo + forma). Data se každou noc doplňují se zdroji v pořadí Sackmann → TennisMyLife → Sofascore → ESPN. Pro živé zápasy se z podání/příjmu hráčů odvodí pravděpodobnost vyhrání bodu na podání, zkalibruje se tak, aby odpovídala předzápasové predikci, a během zápasu se Bayesovsky (Beta prior, síla 80 bodů) aktualizuje živými statistikami. Z aktuálního skóre se přesně (dynamické programování) spočítá výhra v zápase, v setu, tiebreak a rozhodující set; celkový počet gamů simulací Monte Carlo. Value tip = model × kurz − 1 > 8 %.</small></div>`}};
// --- chat ---
function answer(q){const n=TM.norm(q);const surf=/antuk|clay/.test(n)?"Clay":/trav|grass/.test(n)?"Grass":/tvrd|hard/.test(n)?"Hard":null;
 const find=s=>{for(const t of ["atp","wta"]){const ix=IX[t];let i=TM.findPlayer(ix,s);if(i==null){const w=TM.norm(s).split(" ").filter(x=>x.length>2);const c=DB[t].players.map((p,k)=>[p,k]).filter(([p])=>w.some(x=>TM.norm(p.n).split(" ").includes(x))).sort((a,b)=>b[0].m-a[0].m)[0];if(c)i=c[1]}if(i!=null)return [t,DB[t].players[i]]}return null};
 if(/value|kurz/.test(n)){const v=S.list.filter(m=>{const r=prob(m);return m.odds&&r.known&&r.a.m>=20&&r.b.m>=20}).map(m=>{const p=prob(m).live;return [m,p]}).map(([m,p])=>[m,p,TM.valueTip(p,m.odds)]).filter(x=>x[2]).sort((x,y)=>y[2].ev-x[2].ev);
  return v.length?v.slice(0,8).map(([m,p,t])=>`${t.side?m.away:m.home} @ ${t.odds} (model po stažení k trhu ${pc(t.p)} %, férově ${pc(t.fair)} %, EV ${(t.ev*100).toFixed(1)} %)`).join("\n"):"Teď nevidím žádné value tipy (načti záložku Zápasy s kurzy)."}
 if(/nejlep|top|nejsiln/.test(n)){const t=/wta|zen|hrack/.test(n)?"atp_wta".slice(4):"atp";const s=surf;const D=DB[t];const L=D.players.filter(p=>p.m>=10&&p.last>=D.data_through-10000).sort((a,b)=>(s?b.s[s]-a.s[s]:b.e-a.e)).slice(0,5);
  return `Top ${t.toUpperCase()}${s?" – "+SN[s]:""}:\n`+L.map((p,i)=>`${i+1}. ${p.n} (${Math.round(s?p.s[s]:p.e)})`).join("\n")}
 const vs=q.split(/\s+(?:vs\.?|proti|x|-)\s+/i);if(vs.length===2){const a=find(vs[0].replace(/^(kdo vyhraje|predikce)\s*/i,"")),b=find(vs[1].replace(/\s+na\s+.*$/i,""));
  if(a&&b&&a[0]===b[0]){const s=surf||"Hard";const p=P(a[0],a[1],b[1],s);const f=TM.explain(DB[a[0]].coef,a[1],b[1],s).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v))[0];
   return `${a[1].n} vs ${b[1].n} (${SN[s]}): ${pc(p)} % : ${pc(1-p)} %.\nNejvíc rozhoduje: ${f.k} (${f.d}).`}return "Nenašel jsem oba hráče ve stejném okruhu."}
 const pl=find(q.replace(/^(elo|forma|profil|podani)\s+/i,""));if(pl){const p=pl[1];
  if(/forma/.test(n))return `${p.n}: forma ${pc(TM.form(p))} % (posl. ${p.f.length}: ${p.f.slice().reverse().map(x=>x?"V":"P").join("")}).`;
  if(/podani|serv/.test(n)&&p.sv)return `${p.n}: body na podání ${pc(p.sv.spw)} %, na příjmu ${pc(p.sv.rpw)} %, esa ${p.sv.ace}/game.`;
  return `${p.n} (${pl[0].toUpperCase()}): Elo ${Math.round(p.e)} · tvrdý ${Math.round(p.s.Hard)} · antuka ${Math.round(p.s.Clay)} · tráva ${Math.round(p.s.Grass)}.`}
 return "Nerozumím. Zkus „Sinner vs Alcaraz na trávě“, „Elo Sabalenka“, „forma Djokovic“, „value tipy“ nebo „nejlepší na antuce“."}
// --- render + události ---
// měkké vykreslení: při živém obnovení se mění jen karty, které se opravdu změnily (bez blikání a skoků)
function patch(html){const el=V();const tmp=document.createElement("main");tmp.innerHTML=html;
 if(el.children.length!==tmp.children.length){el.innerHTML=html;return}
 [...tmp.children].forEach((n,i)=>{const o=el.children[i];if(o.outerHTML===n.outerHTML)return;
  const om=[...o.querySelectorAll(":scope > .m,:scope .m[data-id]")],nm=[...n.querySelectorAll(":scope > .m,:scope .m[data-id]")];
  if(om.length&&om.length===nm.length&&om.every((x,k)=>x.dataset.id===nm[k].dataset.id)&&o.className===n.className){nm.forEach((x,k)=>{if(om[k].outerHTML!==x.outerHTML)om[k].replaceWith(x)});
   const oh=o.querySelector(".ghead"),nh=n.querySelector(".ghead");if(oh&&nh&&oh.outerHTML!==nh.outerHTML)oh.replaceWith(nh)}else o.replaceWith(n)})}
function render(soft){const html=VIEWS[S.view]();const act=document.activeElement&&document.activeElement.id;
 if(soft===true&&S.view!=="chat"&&S.view!=="hledat")patch(html);else V().innerHTML=html;if(act&&soft===true){const e=document.getElementById(act);if(e)e.focus()}
 document.querySelectorAll("nav.bottom button").forEach(b=>{b.classList.toggle("on",b.dataset.v===S.view);b.setAttribute("aria-current",b.dataset.v===S.view?"page":"false")});document.querySelectorAll("nav.bottom button").forEach(b=>b.classList.toggle("on",b.dataset.v===S.view));
 if(S.view==="chat"){const go=()=>{const q=$("#q").value.trim();if(!q)return;S.chat.push(["u",q],["b",answer(q)]);render();$("#q").focus()};$("#send").onclick=go;$("#q").onkeydown=e=>{if(e.key==="Enter")go()};const l=$("#chatlog");l.scrollTop=l.scrollHeight}}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-v],[data-day],[data-cat],[data-fav],[data-prof],[data-retry],[data-notif],[data-search],.m");if(!t)return;
 if(t.dataset.retry){S.loaded=false;render();refresh();return}if(t.dataset.notif){toggleNotif();return}
 if(t.dataset.search){S.view="hledat";render();const q=$("#gq");if(q)q.focus();return}
 if(t.dataset.v){S.view=t.dataset.v;render();scrollTo(0,0);if(S.view==="zapasy"||S.view==="oblibene")refresh();return}
 if(t.dataset.day){S.day=t.dataset.day;S.list=[];S.open=null;render();refresh();return}
 if(t.dataset.cat){S.cat=t.dataset.cat;render();return}
 if(t.dataset.fav!=null){e.stopPropagation();togFav(t.dataset.fav);return}
 if(t.dataset.prof!=null){e.preventDefault();const n=t.dataset.prof;S.tour=getP("atp",n)?"atp":"wta";S.player=n;S.view="hraci";render();scrollTo(0,0);return}
 if(t.classList.contains("m")){if(e.target.closest(".detail-in"))return;const m=S.list.find(x=>x.id===t.dataset.id);if(!m)return;S.open=S.open===m.id?null:m.id;render(true);if(S.open&&m.sid&&m.status!=="upcoming")loadDetail(m)}});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("m")){e.preventDefault();e.target.click()}
 if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();S.view="hledat";render();$("#gq").focus()}});
document.addEventListener("input",e=>{const id=e.target.id;
 if(id==="blend"){S.blend=e.target.checked;LS.set("tpn-blend",S.blend);render(true);return}
 if(id==="c1"||id==="c2"){S[id]=e.target.value;if(getP(S.ctour,S[id])){const y=scrollY;render();scrollTo(0,y)}return}
 if(id==="ctour"){S.ctour=e.target.value;S.c1=S.c2="";render();return}
 if(id==="gq"){S.q=e.target.value;const tmp=document.createElement("div");tmp.innerHTML=VIEWS.hledat();$("#gres").innerHTML=tmp.querySelector("#gres").innerHTML;return}
 if(id==="p1"||id==="p2"){S[id]=e.target.value;if(getP(S.tour,S[id])){const y=scrollY;render();scrollTo(0,y)}}
 if(id==="surf"){S.surf=e.target.value;render()}if(id==="bo"||id==="lvl"){S[id]=+e.target.value;render()}if(id==="tour"){S.tour=e.target.value;S.p1=S.p2="";S.player=null;render()}
 if(id==="psearch"&&getP(S.tour,e.target.value)){S.player=e.target.value;render()}});
(async()=>{V().innerHTML=`<h1>Zápasy</h1>${skeleton(4)}`;try{await loadData()}catch(e){V().innerHTML=`<div class="empty err" role="alert">Nepodařilo se načíst data modelu (${esc(e.message)}).<br><button class="btn" onclick="location.reload()">Načíst znovu</button></div>`;return}const h=location.hash.slice(1);if(VIEWS[h])S.view=h;render();refresh();setInterval(()=>{if(S.day==="live"&&(S.view==="zapasy"||S.view==="oblibene"||S.view==="tipy"))refresh()},30000);
 if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{})})();
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(VIEWS[h]&&DB.atp){S.view=h;render();if(h==="tipy"&&S.day==="live"){S.day="today";S.loaded=false}if(h==="zapasy"||h==="oblibene"||h==="tipy")refresh()}});
