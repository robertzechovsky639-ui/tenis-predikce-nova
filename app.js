const SN={Hard:"Tvrdý",Clay:"Antuka",Grass:"Tráva"};const DB={},IX={};
const $=s=>document.querySelector(s),V=()=>$("#view");const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pc=p=>(p*100).toFixed(0),fd=d=>{d=String(d);return d.slice(6,8)+"."+d.slice(4,6)+"."+d.slice(0,4)};
const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let S={view:"zapasy",cat:"Vše",day:"live",tour:"atp",surf:"Hard",p1:"",p2:"",open:null,player:null,list:[],src:"",phantoms:0,errs:[],chat:[]};
const getP=(t,n)=>{const i=TM.findPlayer(IX[t],n);return i==null?null:DB[t].players[i]};
function preProb(m){const a=getP(m.tour,m.home),b=getP(m.tour,m.away);return {a,b,p:TM.predict(DB[m.tour].coef,a,b,m.surface),known:!!(a&&b)}}
const servC=new Map();
function inplay(m,pre,st){const key=m.id;let sp=servC.get(key);if(!sp){const pr=TM.servePrior(pre.a,pre.b,DB[m.tour].avg_spw);sp=TM.calibrateServe(pr[0],pr[1],pre.p,m.bo);servC.set(key,sp)}
 let [pA,pB]=sp;if(m.stats){pA=TM.bayes(pA,m.stats.hWon,m.stats.hPlayed);pB=TM.bayes(pB,m.stats.aWon,m.stats.aPlayed)}
 const s=st||TM.liveState(m.ev);return {...TM.inPlay(pA,pB,s),pA,pB,s,games:TM.simGames(pA,pB,s)}}
function prob(m){const pre=preProb(m);let p=pre.p,ip=null;if(m.status==="live"&&m.ev&&m.sets.length){ip=inplay(m,pre);p=ip.match}return {...pre,live:p,ip}}
// --- historie predikcí ---
function logPred(m,p){if(!m.sid)return;const h=LS.get("tpn-hist",{});if(!h[m.id]&&m.status!=="finished"){h[m.id]={h:m.home,a:m.away,p:+p.toFixed(4),t:m.start,cat:m.cat,tr:m.tourney};LS.set("tpn-hist",h)}}
function resolveHist(list){const h=LS.get("tpn-hist",{});let ch=false;list.forEach(m=>{if(m.status==="finished"&&h[m.id]&&h[m.id].y==null&&m.winner){h[m.id].y=m.winner===1?1:0;ch=true}});if(ch)LS.set("tpn-hist",h)}
// --- favority ---
const fav=()=>LS.get("tpn-fav",[]);function togFav(n){const f=fav();const i=f.indexOf(n);i<0?f.push(n):f.splice(i,1);LS.set("tpn-fav",f);render()}
const isFav=n=>fav().includes(n);
// --- načtení ---
async function loadData(){const [a,w]=await Promise.all(["atp","wta"].map(t=>fetch("data/"+t+".json").then(r=>r.json())));DB.atp=a;DB.wta=w;
 for(const t of ["atp","wta"])IX[t]=TM.nameIndex(DB[t].players)}
function dstr(off){const d=new Date(Date.now()+off*864e5);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
let loading=false;
async function refresh(){if(loading)return;loading=true;try{
 if(S.day==="live"){const r=await LIVE.getLive();S.list=TM.dedupe(r.list);S.src=r.source;S.phantoms=r.phantoms;S.errs=r.errs}
 else{try{S.list=TM.dedupe(await LIVE.sofaDay(dstr(S.day==="today"?0:1))).sort((a,b)=>a.start-b.start);S.src="Sofascore";S.errs=[]}catch(e){S.list=[];S.src="nedostupné";S.errs=["Sofascore: "+e.message]}}
 resolveHist(S.list);$("#upd").innerHTML=`<span class="g"></span>${esc(S.src)} · aktualizováno ${new Date().toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"})}${S.phantoms?` · odfiltrováno ${S.phantoms} fantomů`:""}`;
 if(S.view==="zapasy"||S.view==="oblibene")render();loadOdds()}finally{loading=false}}
async function loadOdds(){const todo=S.list.filter(m=>m.sid&&m.status!=="finished"&&m.cat!=="ITF"&&m.odds===undefined).slice(0,40);
 for(let i=0;i<todo.length;i+=6){await Promise.all(todo.slice(i,i+6).map(async m=>{m.odds=await LIVE.odds(m.sid)}));if(S.view==="zapasy")render()}}
// --- komponenty ---
function probBlock(a,b,p){return `<div class="prob"><div class="pl">${esc(a)}</div><div class="pct a">${pc(p)}<small>%</small></div><div class="pct b">${pc(1-p)}<small>%</small></div><div class="pl r">${esc(b)}</div></div><div class="split"><i style="width:${p*100}%"></i></div>`}
const mini=(l,p)=>`<div class="mini"><span style="min-width:96px">${l}</span><b>${pc(p)} %</b><div class="t"><i style="width:${p*100}%"></i></div><b style="text-align:right">${pc(1-p)} %</b></div>`;
function badge(c){const k={ATP:"atp",WTA:"wta","WTA 125":"wta",Challenger:"ch",ITF:"itf"}[c]||"";return `<span class="badge ${k}">${esc(c)}</span>`}
function matchRow(m){const pr=prob(m),p=pr.live;if(pr.known)logPred(m,pr.p);const st=m.status==="live"&&m.ev?TM.liveState(m.ev):null;
 const sc=i=>m.sets.map((s,k)=>`<span class="${m.status==="live"&&k===m.sets.length-1?"cur":""}">${s[i]}</span>`).join("")+(m.status==="live"&&m.point&&m.point[i]!=null?`<span class="pt">${esc(m.point[i])}</span>`:"");
 const t=m.status==="live"?`<span class="badge live">● ${esc(m.desc||"živě")}</span>`:m.status==="finished"?`<span class="badge">Konec</span>`:`<span class="badge">${new Date(m.start*1000).toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"})}</span>`;
 const o=m.odds;const ok=pr.known&&pr.a.m>=20&&pr.b.m>=20;const v=o&&ok?[TM.value(p,o[0]),TM.value(1-p,o[1])]:[0,0];
 return `<div class="m" data-id="${m.id}"><div class="row" style="margin-bottom:4px">${t}<small class="nm">${esc(SN[m.surface])}${pr.known?"":" · málo dat o hráčích"}</small></div>
 ${[0,1].map(i=>{const n=i?m.away:m.home;return `<div class="row"><span class="srv ${st&&st.known&&(st.aServes===!i)?"on":""}"></span><span class="nm ${m.winner===i+1?"w":""}">${esc(n)}</span><button class="star ${isFav(n)?"on":""}" data-fav="${esc(n)}">★</button><div class="sc">${sc(i)}</div></div>`}).join("")}
 <div style="margin-top:6px">${mini(m.status==="live"?"Výhra (živě)":"Výhra",p)}</div>
 ${o?`<div class="odds">Kurzy <span class="ob ${v[0]?"val":""}">${o[0]}</span><span class="ob ${v[1]?"val":""}">${o[1]}</span>${v[0]||v[1]?`<span class="badge val">VALUE: ${esc(v[0]?m.home:m.away)}</span>`:""}</div>`:""}
 ${S.open===m.id?detail(m,pr):""}</div>`}
function factors(t,a,b,s){return `<table>${TM.explain(DB[t].coef,a,b,s).map(f=>`<tr><td>${f.k}</td><td><small>${esc(f.d)}</small></td><td class="num ${f.v>=0?"W":"L"}" style="text-align:right">${f.v>=0?"+":""}${f.v.toFixed(2)}</td></tr>`).join("")}</table><small>Kladné hodnoty (log-odds) zvyhodňují prvního hráče.</small>`}
function detail(m,pr){let h=`<div class="card hi" style="margin:10px 0 0"><h3>Predikce před zápasem</h3>${probBlock(m.home,m.away,pr.p)}<h3 style="margin-top:12px">Faktory</h3>${factors(m.tour,pr.a,pr.b,m.surface)}</div>`;
 if(pr.ip){const ip=pr.ip,s=ip.s;h+=`<div class="card" style="margin:10px 0 0"><h3>In-play (stav ${s.sa}:${s.sb} sety, ${s.ga}:${s.gb} gamy)</h3>
 ${mini("Zápas",ip.match)}${mini("Aktuální set",ip.set)}
 <div class="grid" style="margin-top:10px"><div class="kpi"><small>Tiebreak v setu</small><b>${pc(ip.tiebreak)} %</b></div><div class="kpi"><small>Rozhodující set</small><b>${pc(ip.decider)} %</b></div>
 <div class="kpi"><small>Gamů celkem (Ø)</small><b>${ip.games.mean.toFixed(1)}</b></div><div class="kpi"><small>Over ${Math.floor(ip.games.median)+.5}</small><b>${pc(ip.games.over(Math.floor(ip.games.median)+.5))} %</b></div></div>
 <p><small>Bod na podání: ${esc(m.home)} ${pc(ip.pA)} %, ${esc(m.away)} ${pc(ip.pB)} % ${m.stats?`(Bayes: ${m.stats.hWon}/${m.stats.hPlayed} a ${m.stats.aWon}/${m.stats.aPlayed} živě)`:"(prior, živé statistiky se načítají…)"}</small></p></div>`}
 else if(m.status==="upcoming"){const sp=TM.servePrior(pr.a,pr.b,DB[m.tour].avg_spw);const c=TM.calibrateServe(sp[0],sp[1],pr.p,m.bo);const g=TM.simGames(c[0],c[1],{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:m.bo});
  const r=TM.inPlay(c[0],c[1],{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:m.bo});h+=`<div class="card" style="margin:10px 0 0"><h3>Průběh</h3><div class="grid"><div class="kpi"><small>Tiebreak v 1. setu</small><b>${pc(r.tiebreak)} %</b></div><div class="kpi"><small>Rozhodující set</small><b>${pc(r.decider)} %</b></div><div class="kpi"><small>Gamů (Ø)</small><b>${g.mean.toFixed(1)}</b></div><div class="kpi"><small>1. set ${esc(m.home.split(" ").pop())}</small><b>${pc(r.set)} %</b></div></div></div>`}
 return h}
// --- pohledy ---
const VIEWS={
zapasy(){const cats=["Vše","ATP","WTA","Challenger","ITF"];let L=S.list.filter(m=>S.cat==="Vše"||m.cat===S.cat||(S.cat==="WTA"&&m.cat==="WTA 125"));
 const groups={};L.forEach(m=>(groups[m.cat+"|"+m.tourney]??=[]).push(m));
 return `<h1>Zápasy</h1><div class="seg" id="days">${[["live","● Živě"],["today","Dnes"],["tomorrow","Zítra"]].map(([k,l])=>`<button data-day="${k}" class="${S.day===k?"on":""}">${l}</button>`).join("")}</div>
 <div class="seg">${cats.map(c=>`<button data-cat="${c}" class="${S.cat===c?"on":""}">${c}</button>`).join("")}</div>
 ${S.errs.length?`<div class="card"><small>${S.errs.map(esc).join("<br>")}</small></div>`:""}
 ${Object.entries(groups).map(([k,ms])=>{const [c,t]=k.split("|");return `<div class="grp"><div class="ghead"><span>${badge(c)} ${esc(t)}</span><small>${ms.length}</small></div>${ms.map(matchRow).join("")}</div>`}).join("")||`<div class="empty">${loading?"Načítám…":"Žádné zápasy."}</div>`}`},
oblibene(){const f=fav();const ms=S.list.filter(m=>f.includes(m.home)||f.includes(m.away));
 return `<h1>Oblíbené</h1>${f.length?"":`<div class="empty">Zatím nic. Přidejte hráče hvězdičkou ★ u zápasu nebo v profilu.</div>`}
 ${f.length?`<div class="card"><h3>Hráči</h3><table>${f.map(n=>{const t=getP("atp",n)?"atp":"wta";const p=getP(t,n);return `<tr><td><a href="#" data-prof="${esc(n)}" style="color:var(--txt)">${esc(n)}</a></td><td class="num">${p?Math.round(p.e):"—"}</td><td><button class="star on" data-fav="${esc(n)}">★</button></td></tr>`}).join("")}</table></div>`:""}
 ${ms.length?`<div class="grp"><div class="ghead">Zápasy oblíbených</div>${ms.map(matchRow).join("")}</div>`:f.length?`<div class="empty">Oblíbení hráči teď nehrají (${S.day==="live"?"živě":"vybraný den"}).</div>`:""}`},
predikce(){const D=DB[S.tour];const opts=D.players.filter(p=>p.m>=5).sort((a,b)=>b.e-a.e);if(!S.p1){S.p1=opts[0].n;S.p2=opts[1].n}
 const a=getP(S.tour,S.p1),b=getP(S.tour,S.p2);let body="";
 if(a&&b&&a!==b){const p=TM.predict(D.coef,a,b,S.surf);const ia=D.players.indexOf(a),ib=D.players.indexOf(b);
  const h=D.matches.filter(m=>(m[1]===ia&&m[2]===ib)||(m[1]===ib&&m[2]===ia)).reverse(),hw=h.filter(m=>m[1]===ia).length;
  body=`<div class="card hi"><h3>Pravděpodobnost výhry · ${SN[S.surf]}</h3>${probBlock(a.n,b.n,p)}</div>
  <div class="card"><h3>Proč</h3>${factors(S.tour,a,b,S.surf)}</div>
  <div class="card"><h3>Elo</h3><table><tr><th>Hráč</th><th>Celk.</th><th>Tvrdý</th><th>Antuka</th><th>Tráva</th></tr>${[a,b].map(x=>`<tr><td>${esc(x.n)}</td><td class="num">${Math.round(x.e)}</td>${TM.SURF.map(s=>`<td class="num">${Math.round(x.s[s])}</td>`).join("")}</tr>`).join("")}</table></div>
  <div class="card"><h3>Vzájemné zápasy <span class="num" style="color:var(--pink)">${hw}</span> : <span class="num" style="color:var(--vio)">${h.length-hw}</span></h3>${h.length?`<table>${h.slice(0,10).map(m=>`<tr><td>${fd(m[0])}</td><td><b>${esc(D.players[m[1]].n)}</b></td><td>${esc(m[4])}</td><td><small>${esc(m[5])} · ${SN[m[3]]}</small></td></tr>`).join("")}</table>`:"<small>Žádné vzájemné zápasy od 2015.</small>"}</div>
  <div class="card"><h3>Forma (posl. 10)</h3><table>${[a,b].map(x=>`<tr><td>${esc(x.n)}</td><td>${x.f.slice().reverse().map(r=>`<span class="${r?"W":"L"}">${r?"V":"P"}</span>`).join(" ")}</td><td class="num">${pc(TM.form(x))} %</td></tr>`).join("")}</table></div>`}
 else body=`<div class="empty">Vyberte dva různé hráče ze seznamu.</div>`;
 return `<h1>Predikce</h1><div class="filters"><div class="sel"><label>Okruh</label><select id="tour"><option value="atp">ATP</option><option value="wta" ${S.tour==="wta"?"selected":""}>WTA</option></select></div>
 <div class="sel"><label>Povrch</label><select id="surf">${TM.SURF.map(s=>`<option value="${s}" ${S.surf===s?"selected":""}>${SN[s]}</option>`).join("")}</select></div></div>
 <div class="filters"><div class="sel"><label>Hráč 1</label><input id="p1" list="pl" value="${esc(S.p1)}"></div><div class="sel"><label>Hráč 2</label><input id="p2" list="pl" value="${esc(S.p2)}"></div></div>
 <datalist id="pl">${opts.map(p=>`<option value="${esc(p.n)}">`).join("")}</datalist><div id="pbody">${body}</div>`},
hraci(){const D=DB[S.tour];const top=D.players.filter(p=>p.m>=10&&p.last>=D.data_through-10000).sort((a,b)=>b.e-a.e);const p=S.player&&getP(S.tour,S.player);
 let prof="";if(p){const i=D.players.indexOf(p);const rec=D.matches.filter(m=>m[1]===i||m[2]===i).slice(-10).reverse();const sv=p.sv;
  prof=`<div class="card hi"><div class="row"><h2 style="margin:0;flex:1;font-style:italic;font-weight:900">${esc(p.n)}</h2><button class="star ${isFav(p.n)?"on":""}" data-fav="${esc(p.n)}">★</button></div>
  <small style="color:#d9d0ff">${esc(p.ioc||"")} · ${p.hand==="L"?"levák":p.hand==="R"?"pravák":"—"}${p.ht?` · ${p.ht} cm`:""}${p.rank?` · žebříček ${p.rank}`:""} · ${p.m} zápasů od 2015</small>
  <div class="grid" style="margin-top:10px"><div class="kpi"><small>Elo celkové</small><b>${Math.round(p.e)}</b></div>${TM.SURF.map(s=>`<div class="kpi"><small>${SN[s]} (${p.sm[s]})</small><b>${Math.round(p.s[s])}</b></div>`).join("")}</div></div>
  <div class="card"><h3>Podání a příjem (posl. 2 roky)</h3>${sv?`<div class="grid"><div class="kpi"><small>Body na podání</small><b>${pc(sv.spw)} %</b></div><div class="kpi"><small>Body na příjmu</small><b>${pc(sv.rpw)} %</b></div><div class="kpi"><small>Esa / game</small><b>${sv.ace}</b></div><div class="kpi"><small>Dvojchyby / game</small><b>${sv.df}</b></div></div>`:"<small>Nedostatek dat.</small>"}</div>
  <div class="card"><h3>Forma · ${pc(TM.form(p))} %</h3><table>${rec.map(m=>`<tr><td>${fd(m[0])}</td><td class="${m[1]===i?"W":"L"}">${m[1]===i?"V":"P"}</td><td>${esc(D.players[m[1]===i?m[2]:m[1]].n)}</td><td>${esc(m[4])}</td><td><small>${esc(m[5])}</small></td></tr>`).join("")}</table></div>`}
 return `<h1>Hráči</h1><div class="filters"><div class="sel" style="max-width:110px"><label>Okruh</label><select id="tour"><option value="atp">ATP</option><option value="wta" ${S.tour==="wta"?"selected":""}>WTA</option></select></div>
 <div class="sel"><label>Hledat hráče</label><input id="psearch" list="pl2" placeholder="Jméno…" value="${esc(S.player||"")}"></div></div><datalist id="pl2">${D.players.filter(p=>p.m>=5).map(p=>`<option value="${esc(p.n)}">`).join("")}</datalist>
 ${prof}<div class="card"><h3>Top 30 podle Elo</h3><table><tr><th>#</th><th>Hráč</th><th>Elo</th><th>Tvrdý</th><th>Antuka</th><th>Tráva</th></tr>${top.slice(0,30).map((x,k)=>`<tr><td>${k+1}</td><td><a href="#" data-prof="${esc(x.n)}" style="color:var(--txt)">${esc(x.n)}</a></td><td class="num">${Math.round(x.e)}</td>${TM.SURF.map(s=>`<td>${Math.round(x.s[s])}</td>`).join("")}</tr>`).join("")}</table></div>`},
historie(){const h=Object.entries(LS.get("tpn-hist",{})).map(([k,v])=>v).sort((a,b)=>b.t-a.t);const done=h.filter(x=>x.y!=null);
 const bt=[...DB.atp.backtest.map(r=>["atp",...r]),...DB.wta.backtest.map(r=>["wta",...r])].sort((a,b)=>b[1]-a[1]);const hit=bt.filter(r=>r[7]>.5).length;
 return `<h1>Historie</h1><div class="card hi"><h3>Moje sledované predikce (toto zařízení)</h3><div class="grid"><div class="kpi"><small>Uloženo</small><b>${h.length}</b></div><div class="kpi"><small>Vyhodnoceno</small><b>${done.length}</b></div>
 <div class="kpi"><small>Úspěšnost</small><b>${done.length?pc(done.filter(x=>(x.p>.5)===(x.y===1)).length/done.length)+" %":"—"}</b></div><div class="kpi"><small>Brier</small><b>${done.length?TM.brier(done.map(x=>[x.p,x.y])).toFixed(3):"—"}</b></div></div>
 <small style="color:#d9d0ff">Predikce se ukládají při zobrazení zápasu; výsledek se doplní, když se zápas objeví jako dohraný (záložka Dnes).</small></div>
 ${h.length?`<div class="card"><table>${h.slice(0,50).map(x=>`<tr><td><small>${new Date(x.t*1000).toLocaleDateString("cs-CZ")}</small></td><td>${esc(x.h)} – ${esc(x.a)}</td><td class="num">${pc(x.p)} %</td><td>${x.y==null?"<small>čeká</small>":(x.p>.5)===(x.y===1)?'<span class="W">✓</span>':'<span class="L">✗</span>'}</td></tr>`).join("")}</table></div>`:""}
 <div class="card"><h3>Backtest · posledních ${bt.length} zápasů testu</h3><p><small>Model natrénovaný do 31.12.2023, predikce na dohraných zápasech: favorit vyhrál ${hit}/${bt.length} (${pc(hit/bt.length)} %).</small></p>
 <table>${bt.slice(0,40).map(r=>{const D=DB[r[0]];return `<tr><td><small>${fd(r[1])}</small></td><td><b>${esc(D.players[r[2]].n)}</b> – ${esc(D.players[r[3]].n)}</td><td><small>${esc(r[5])}</small></td><td class="num ${r[7]>.5?"W":"L"}">${pc(r[7])} %</td></tr>`}).join("")}</table></div>`},
chat(){return `<h1>Chat</h1><div class="card"><div class="chat" id="chatlog">${(S.chat.length?S.chat:[["b","Ahoj! Zeptej se třeba:\n• Sinner vs Alcaraz na antuce\n• Elo Swiatek\n• forma Djokovic\n• value tipy\n• kdo je nejlepší na trávě"]]).map(([w,t])=>`<div class="msg ${w}">${esc(t)}</div>`).join("")}</div></div>
 <div class="chatin"><input id="q" placeholder="Napiš otázku…" autocomplete="off"><button class="btn" id="send">Poslat</button></div>`},
model(){return `<h1>Model</h1>${["atp","wta"].map(t=>{const D=DB[t],m=D.metrics;return `<div class="card ${t==="atp"?"hi":""}"><h3>${t.toUpperCase()} · test od ${m.test_from} (n=${m.model.n})</h3>
 <div class="grid"><div class="kpi"><small>Brier</small><b>${m.model.brier.toFixed(4)}</b></div><div class="kpi"><small>Log-loss</small><b>${m.model.logloss.toFixed(4)}</b></div><div class="kpi"><small>Přesnost</small><b>${(m.model.accuracy*100).toFixed(1)} %</b></div><div class="kpi"><small>Jen Elo – Brier</small><b>${m.raw_overall_elo.brier.toFixed(4)}</b></div></div>
 <h3 style="margin-top:14px">Kalibrace</h3><div class="cal">${m.calibration.map(c=>`<div title="predikce ${pc(c[0])} %, skutečnost ${pc(c[1])} %, n=${c[2]}"><i style="height:${c[0]*100}%"></i><u style="height:${c[1]*100}%"></u></div>`).join("")}</div>
 <small><span style="color:var(--vio)">■</span> průměrná predikce · <span style="color:var(--pink)">■</span> skutečný podíl výher (10 košů)</small>
 <p><small>Koeficienty: ${D.coef.map(x=>x.toFixed(3)).join(" / ")} (intercept, celk. Elo, povrch Elo, forma) · data do ${fd(D.data_through)} · ${D.players.length} hráčů</small></p></div>`}).join("")}
 <div class="card"><h3>Jak to funguje</h3><small>Elo (K klesající s počtem zápasů) celkové + zvlášť pro každý povrch, forma = podíl výher z posledních 10 zápasů. Logistická regrese kombinuje tyto vstupy (trénink 2016–2023, test 2024+). Pro živé zápasy se z podání/příjmu hráčů odvodí pravděpodobnost vyhrání bodu na podání, zkalibruje se tak, aby odpovídala předzápasové predikci, a během zápasu se Bayesovsky (Beta prior, síla 80 bodů) aktualizuje živými statistikami. Z aktuálního skóre se přesně (dynamické programování) spočítá výhra v zápase, v setu, tiebreak a rozhodující set; celkový počet gamů simulací Monte Carlo. Value tip = model × kurz − 1 > 5 %.</small></div>`}};
// --- chat ---
function answer(q){const n=TM.norm(q);const surf=/antuk|clay/.test(n)?"Clay":/trav|grass/.test(n)?"Grass":/tvrd|hard/.test(n)?"Hard":null;
 const find=s=>{for(const t of ["atp","wta"]){const ix=IX[t];let i=TM.findPlayer(ix,s);if(i==null){const w=TM.norm(s).split(" ").filter(x=>x.length>2);const c=DB[t].players.map((p,k)=>[p,k]).filter(([p])=>w.some(x=>TM.norm(p.n).split(" ").includes(x))).sort((a,b)=>b[0].m-a[0].m)[0];if(c)i=c[1]}if(i!=null)return [t,DB[t].players[i]]}return null};
 if(/value|kurz/.test(n)){const v=S.list.filter(m=>{const r=prob(m);return m.odds&&r.known&&r.a.m>=20&&r.b.m>=20}).map(m=>{const p=prob(m).live;return [m,p]}).filter(([m,p])=>TM.value(p,m.odds[0])||TM.value(1-p,m.odds[1]));
  return v.length?v.slice(0,8).map(([m,p])=>TM.value(p,m.odds[0])?`${m.home} @ ${m.odds[0]} (model ${pc(p)} %)`:`${m.away} @ ${m.odds[1]} (model ${pc(1-p)} %)`).join("\n"):"Teď nevidím žádné value tipy (načti záložku Zápasy s kurzy)."}
 if(/nejlep|top|nejsiln/.test(n)){const t=/wta|zen|hrack/.test(n)?"atp_wta".slice(4):"atp";const s=surf;const D=DB[t];const L=D.players.filter(p=>p.m>=10&&p.last>=D.data_through-10000).sort((a,b)=>(s?b.s[s]-a.s[s]:b.e-a.e)).slice(0,5);
  return `Top ${t.toUpperCase()}${s?" – "+SN[s]:""}:\n`+L.map((p,i)=>`${i+1}. ${p.n} (${Math.round(s?p.s[s]:p.e)})`).join("\n")}
 const vs=q.split(/\s+(?:vs\.?|proti|x|-)\s+/i);if(vs.length===2){const a=find(vs[0].replace(/^(kdo vyhraje|predikce)\s*/i,"")),b=find(vs[1].replace(/\s+na\s+.*$/i,""));
  if(a&&b&&a[0]===b[0]){const s=surf||"Hard";const p=TM.predict(DB[a[0]].coef,a[1],b[1],s);const f=TM.explain(DB[a[0]].coef,a[1],b[1],s).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v))[0];
   return `${a[1].n} vs ${b[1].n} (${SN[s]}): ${pc(p)} % : ${pc(1-p)} %.\nNejvíc rozhoduje: ${f.k} (${f.d}).`}return "Nenašel jsem oba hráče ve stejném okruhu."}
 const pl=find(q.replace(/^(elo|forma|profil|podani)\s+/i,""));if(pl){const p=pl[1];
  if(/forma/.test(n))return `${p.n}: forma ${pc(TM.form(p))} % (posl. ${p.f.length}: ${p.f.slice().reverse().map(x=>x?"V":"P").join("")}).`;
  if(/podani|serv/.test(n)&&p.sv)return `${p.n}: body na podání ${pc(p.sv.spw)} %, na příjmu ${pc(p.sv.rpw)} %, esa ${p.sv.ace}/game.`;
  return `${p.n} (${pl[0].toUpperCase()}): Elo ${Math.round(p.e)} · tvrdý ${Math.round(p.s.Hard)} · antuka ${Math.round(p.s.Clay)} · tráva ${Math.round(p.s.Grass)}.`}
 return "Nerozumím. Zkus „Sinner vs Alcaraz na trávě“, „Elo Sabalenka“, „forma Djokovic“, „value tipy“ nebo „nejlepší na antuce“."}
// --- render + události ---
function render(){V().innerHTML=VIEWS[S.view]();document.querySelectorAll("nav.bottom button").forEach(b=>b.classList.toggle("on",b.dataset.v===S.view));
 if(S.view==="chat"){const go=()=>{const q=$("#q").value.trim();if(!q)return;S.chat.push(["u",q],["b",answer(q)]);render();$("#q").focus()};$("#send").onclick=go;$("#q").onkeydown=e=>{if(e.key==="Enter")go()};const l=$("#chatlog");l.scrollTop=l.scrollHeight}}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-v],[data-day],[data-cat],[data-fav],[data-prof],.m");if(!t)return;
 if(t.dataset.v){S.view=t.dataset.v;render();scrollTo(0,0);if(S.view==="zapasy"||S.view==="oblibene")refresh();return}
 if(t.dataset.day){S.day=t.dataset.day;S.list=[];S.open=null;render();refresh();return}
 if(t.dataset.cat){S.cat=t.dataset.cat;render();return}
 if(t.dataset.fav!=null){e.stopPropagation();togFav(t.dataset.fav);return}
 if(t.dataset.prof!=null){e.preventDefault();const n=t.dataset.prof;S.tour=getP("atp",n)?"atp":"wta";S.player=n;S.view="hraci";render();scrollTo(0,0);return}
 if(t.classList.contains("m")){const m=S.list.find(x=>x.id===t.dataset.id);S.open=S.open===m.id?null:m.id;render();if(S.open&&m.status==="live"&&m.sid){m.stats=await LIVE.stats(m.sid);render()}}});
document.addEventListener("input",e=>{const id=e.target.id;
 if(id==="p1"||id==="p2"){S[id]=e.target.value;if(getP(S.tour,S[id])){const y=scrollY;render();scrollTo(0,y)}}
 if(id==="surf"){S.surf=e.target.value;render()}if(id==="tour"){S.tour=e.target.value;S.p1=S.p2="";S.player=null;render()}
 if(id==="psearch"&&getP(S.tour,e.target.value)){S.player=e.target.value;render()}});
(async()=>{await loadData();const h=location.hash.slice(1);if(VIEWS[h])S.view=h;render();refresh();setInterval(()=>{if(S.day==="live"&&(S.view==="zapasy"||S.view==="oblibene"))refresh()},30000);
 if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{})})();
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(VIEWS[h]&&DB.atp){S.view=h;render();if(h==="zapasy"||h==="oblibene")refresh()}});
