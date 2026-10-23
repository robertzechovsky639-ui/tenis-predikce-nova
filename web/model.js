// Čistá logika (bez DOM) – sdílená prohlížečem i testy (node).
(function(root){
const SURF=["Hard","Clay","Grass"];
const ep=(a,b)=>1/(1+Math.pow(10,(b-a)/400));
const lg=p=>{p=Math.min(Math.max(p,1e-6),1-1e-6);return Math.log(p/(1-p))};
const form=p=>p&&p.f&&p.f.length?p.f.reduce((a,b)=>a+b,0)/p.f.length:.5;
const DEF={e:1500,s:{Hard:1500,Clay:1500,Grass:1500},f:[],m:0,sm:{Hard:0,Clay:0,Grass:0},unknown:true};
function features(a,b,s){a=a||DEF;b=b||DEF;return [lg(ep(a.e,b.e)),lg(ep(a.s[s],b.s[s])),form(a)-form(b)]}
function predict(coef,a,b,s){const x=features(a,b,s);const z=coef[0]+coef[1]*x[0]+coef[2]*x[1]+coef[3]*x[2];return 1/(1+Math.exp(-z))}
function explain(coef,a,b,s){const x=features(a,b,s);return [
 {k:"Celkové Elo",v:coef[1]*x[0],d:`${Math.round((a||DEF).e)} vs ${Math.round((b||DEF).e)}`},
 {k:"Elo na povrchu",v:coef[2]*x[1],d:`${Math.round((a||DEF).s[s])} vs ${Math.round((b||DEF).s[s])}`},
 {k:"Forma (10 zápasů)",v:coef[3]*x[2],d:`${Math.round(form(a)*100)} % vs ${Math.round(form(b)*100)} %`}]}
function surfaceOf(g){g=(g||"").toLowerCase();return g.includes("clay")?"Clay":g.includes("grass")?"Grass":"Hard"}
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
function nameIndex(players){const full={},short={};players.forEach((p,i)=>{const n=norm(p.n),parts=n.split(" ");
 const k=parts.slice(1).join(" ")+" "+parts[0][0];if(!(n in full)||p.m>players[full[n]].m)full[n]=i;if(!(k in short)||p.m>players[short[k]].m)short[k]=i});return {full,short}}
function findPlayer(ix,name){const n=norm(name);if(n in ix.full)return ix.full[n];const p=n.split(" ");if(p.length<2)return null;
 const k1=p.slice(1).join(" ")+" "+p[0][0];if(k1 in ix.short)return ix.short[k1];
 const k2=p.slice(0,-1).join(" ")+" "+p[p.length-1][0];if(k2 in ix.short)return ix.short[k2];return null}
// --- tenisová matematika (přesné DP) ---
function gameWin(p,a=0,b=0){const m=new Map();const f=(a,b)=>{if(a>=4&&a-b>=2)return 1;if(b>=4&&b-a>=2)return 0;
 if(a>=3&&b>=3){if(a===b)return p*p/(p*p+(1-p)*(1-p));const c=Math.min(a,b)-3;a-=c;b-=c}
 const k=a*20+b;if(m.has(k))return m.get(k);const r=p*f(a+1,b)+(1-p)*f(a,b+1);m.set(k,r);return r};return f(a,b)}
function tbWin(pA,pB,a,b,aStarts,T){const m=new Map();const f=(a,b)=>{if(a>=T&&a-b>=2)return 1;if(b>=T&&b-a>=2)return 0;
 const pw=n=>((Math.floor((n+1)/2)%2===0)===aStarts)?pA:1-pB;
 if(a>=T-1&&a===b){const p1=pw(a+b),p2=pw(a+b+1);return p1*p2/(p1*p2+(1-p1)*(1-p2))}
 const k=a*100+b;if(m.has(k))return m.get(k);const p=pw(a+b);
 const r=p*f(a+1,b)+(1-p)*f(a,b+1);m.set(k,r);return r};return f(a,b)}
// rozdělení výsledku setu: [A vyhraje & A podává další game, A & B, B & A, B & B] + P(tiebreak)
function setDist(pA,pB,ga,gb,aServes,pts,T){const m=new Map();
 const f=(ga,gb,aS,first)=>{if((ga>=6&&ga-gb>=2)||ga===7)return aS?[1,0,0,0,0]:[0,1,0,0,0];if((gb>=6&&gb-ga>=2)||gb===7)return aS?[0,0,1,0,0]:[0,0,0,1,0];
  const pt=first?pts:[0,0];
  if(ga===6&&gb===6){const w=tbWin(pA,pB,pt[0],pt[1],aS,T);// po TB podává ten, kdo v TB přijímal
   return aS?[0,w,0,1-w,1]:[w,0,1-w,0,1]}
  const k=ga*100+gb*10+(aS?1:0);if(!first&&m.has(k))return m.get(k);
  const g=aS?gameWin(pA,pt[0],pt[1]):1-gameWin(pB,pt[1],pt[0]);const x=f(ga+1,gb,!aS,false),y=f(ga,gb+1,!aS,false);
  const r=x.map((v,i)=>g*v+(1-g)*y[i]);if(!first)m.set(k,r);return r};return f(ga,gb,aServes,true)}
// stav: {sa,sb,ga,gb,pa,pb,aServes,bo}; vrátí pravděpodobnosti
function inPlay(pA,pB,st){const need=st.bo===5?3:2;if(st.sa>=need||st.sb>=need){const w=st.sa>=need?1:0;return {match:w,set:w,tiebreak:0,decider:0}}const T=(sa,sb)=>tbTarget(st,sa,sb);const mm=new Map();
 const M=(sa,sb,aS)=>{if(sa===need)return 1;if(sb===need)return 0;const k=sa*10+sb+(aS?100:0);if(mm.has(k))return mm.get(k);
  const d=setDist(pA,pB,0,0,aS,[0,0],T(sa,sb));const r=d[0]*M(sa+1,sb,true)+d[1]*M(sa+1,sb,false)+d[2]*M(sa,sb+1,true)+d[3]*M(sa,sb+1,false);mm.set(k,r);return r};
 const R=(sa,sb,aS)=>{if(sa===need||sb===need)return 0;if(sa===need-1&&sb===need-1)return 1;const d=setDist(pA,pB,0,0,aS,[0,0],T(sa,sb));
  return d[0]*R(sa+1,sb,true)+d[1]*R(sa+1,sb,false)+d[2]*R(sa,sb+1,true)+d[3]*R(sa,sb+1,false)};
 const d=setDist(pA,pB,st.ga,st.gb,st.aServes,[st.pa||0,st.pb||0],T(st.sa,st.sb));
 const match=d[0]*M(st.sa+1,st.sb,true)+d[1]*M(st.sa+1,st.sb,false)+d[2]*M(st.sa,st.sb+1,true)+d[3]*M(st.sa,st.sb+1,false);
 const decider=(st.sa===need-1&&st.sb===need-1)?1:d[0]*R(st.sa+1,st.sb,true)+d[1]*R(st.sa+1,st.sb,false)+d[2]*R(st.sa,st.sb+1,true)+d[3]*R(st.sa,st.sb+1,false);
 return {match,set:d[0]+d[1],tiebreak:d[4],decider}}
// server v tiebreaku: bod 1 podává ten, kdo je na řadě; pak po dvou (2.–3. soupeř, 4.–5. první…). n = počet odehraných bodů v TB
function tbServer(aStarts,n){return (Math.floor((n+1)/2)%2===0)===aStarts}
function nextSetFirstServer(aStartedTB){return !aStartedTB}
// 10bodový TB jen na Grand Slamech v rozhodujícím setu (5. muži, 3. ženy) za 6:6; jinak vždy do 7
function tbTarget(st,sa,sb){const need=st.bo===5?3:2;return st.slam&&sa===need-1&&sb===need-1?10:7}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function simGames(pA,pB,st,n=1500,seed=7){const r=rng(seed),need=st.bo===5?3:2;const out=[];
 for(let i=0;i<n;i++){let {sa,sb,ga,gb,aServes:aS}=st,pa=st.pa||0,pb=st.pb||0,tot=st.prevGames||0;
  while(sa<need&&sb<need){const tb=ga===6&&gb===6;const T=tbTarget(st,sa,sb);
   if(tb){let a=pa,b=pb;while(!((a>=T||b>=T)&&Math.abs(a-b)>=2)){const n2=a+b;const as=(Math.floor((n2+1)/2)%2===0)===aS;const p=as?pA:1-pB;r()<p?a++:b++}
    a>b?ga++:gb++;aS=!aS}else{const p=aS?pA:pB;let s=aS?pa:pb,o=aS?pb:pa;while(!((s>=4||o>=4)&&Math.abs(s-o)>=2))r()<p?s++:o++;const srvWon=s>o;
    if(aS===srvWon)ga++;else gb++;aS=!aS}
   pa=pb=0;if((ga>=6&&ga-gb>=2)||ga===7){sa++;tot+=ga+gb;ga=gb=0}else if((gb>=6&&gb-ga>=2)||gb===7){sb++;tot+=ga+gb;ga=gb=0}}
  out.push(tot)}out.sort((a,b)=>a-b);return {mean:out.reduce((a,b)=>a+b,0)/n,median:out[n>>1],over:l=>out.filter(x=>x>l).length/n}}
// odhad pravd. vyhrání bodu na podání: hráčské statistiky + kalibrace na Elo + Bayes (Beta) z živých statistik
function servePrior(a,b,avg){const sa=a&&a.sv?a.sv:{spw:avg,rpw:1-avg},sb=b&&b.sv?b.sv:{spw:avg,rpw:1-avg};
 return [sa.spw-(sb.rpw-(1-avg)),sb.spw-(sa.rpw-(1-avg))]}
function calibrateServe(pA,pB,target,bo){let lo=-.25,hi=.25;for(let i=0;i<30;i++){const d=(lo+hi)/2;
 const w=inPlay(clip(pA+d),clip(pB-d),{sa:0,sb:0,ga:0,gb:0,aServes:true,bo}).match;w<target?lo=d:hi=d}const d=(lo+hi)/2;return [clip(pA+d),clip(pB-d)]}
const clip=p=>Math.min(.95,Math.max(.3,p));
function bayes(prior,won,total,strength=80){return (prior*strength+won)/(strength+total)}
// parsování bodů ve hře
function ptNum(s){return {"0":0,"15":1,"30":2,"40":3,"A":4}[String(s)]??0}
function liveState(ev){const h=ev.homeScore||{},a=ev.awayScore||{};let sa=0,sb=0,prev=0;const per=[];
 for(let i=1;i<=5;i++){if(h["period"+i]==null)break;per.push([h["period"+i],a["period"+i]])}
 const cur=per.length?per[per.length-1]:[0,0];const done=per.slice(0,-1);done.forEach(([x,y])=>{x>y?sa++:sb++;prev+=x+y});
 let ga=cur[0]||0,gb=cur[1]||0;let pa=0,pb=0;
 if(ga===6&&gb===6){pa=+h.point||0;pb=+a.point||0}else{pa=ptNum(h.point);pb=ptNum(a.point);if(pa===4&&pb===3){}else if(pb===4&&pa===3){}}
 // podávající: sofascore firstToServe (1=domácí) + počet odehraných gamů (TB = 1 game)
 const games=prev+ga+gb;const first=ev.firstToServe===2?false:true;const aServes=(games%2===0)===first; // TB se počítá jako 1 game
 const tb=ga===6&&gb===6;const serverNow=tb?tbServer(aServes,pa+pb):aServes;
 return {sa,sb,ga,gb,pa,pb,aServes,serverNow,tb,tbTo:tbTarget({bo:ev.bo||3,slam:!!ev.slam},sa,sb),prevGames:prev,bo:ev.bo||3,slam:!!ev.slam,known:ev.firstToServe!=null}}
function isPhantom(ev,nowSec){const ch=ev.changes&&ev.changes.changeTimestamp;
 if(ch&&nowSec-ch>45*60)return true;if(ev.startTimestamp&&Math.abs(nowSec-ev.startTimestamp)>12*3600)return true;return false}
function dedupe(list){const by=new Map();for(const m of list){const k=[norm(m.home),norm(m.away)].sort().join("|");const o=by.get(k);
 if(!o||(m.rank||0)>(o.rank||0))by.set(k,o?{...o,...m}:m)}return [...by.values()]}
function fracToDec(f){if(!f)return null;const [a,b]=String(f).split("/").map(Number);return b?+(a/b+1).toFixed(2):null}
// de-vig: férové pravděpodobnosti z kurzů (power metoda – přirozeně řeší favorit/outsider bias)
function devig(o1,o2){if(!(o1>1&&o2>1))return null;const r1=1/o1,r2=1/o2;let lo=.5,hi=3;for(let i=0;i<50;i++){const k=(lo+hi)/2;Math.pow(r1,k)+Math.pow(r2,k)>1?lo=k:hi=k}const k=(lo+hi)/2;return [Math.pow(r1,k),Math.pow(r2,k),r1+r2-1]}
// value tip: model se nejdřív stáhne k trhu (shrink – model není lepší než trh), hrana musí přežít a EV na reálném kurzu musí být kladná
function valueTip(p,odds,o={}){const {shrink=.5,minEdge=.04,minEV=.03}=o;if(!odds||!odds[0]||!odds[1])return null;const d=devig(odds[0],odds[1]);if(!d)return null;
 const pa=shrink*p+(1-shrink)*d[0];const c=[[0,pa,d[0],odds[0]],[1,1-pa,d[1],odds[1]]].map(([side,pm,q,od])=>({side,p:pm,fair:q,odds:od,edge:pm-q,ev:pm*od-1,margin:d[2]}));
 const b=c.sort((x,y)=>y.ev-x.ev)[0];return b.edge>=minEdge&&b.ev>=minEV?b:null}
function value(p,odds,margin=.08){if(Array.isArray(odds)){const t=valueTip(p,odds);return t?t.side:-1}return odds?p*odds-1>margin:false}
function brier(rows){return rows.reduce((s,[p,y])=>s+(p-y)**2,0)/rows.length}

// --- Gradient boosting (HistGB export) + izotonická kalibrace ---
function ddays(a,b){const f=x=>Date.UTC(Math.floor(x/1e4),Math.floor(x/100)%100-1,x%100);return Math.round((f(a)-f(b))/864e5)}
const LVL={"Grand Slam":4,"Masters":3,"ATP":2,"WTA":2,"WTA 125":1,"Challenger":1,"ITF":1};
function gbFeatures(a,b,c){a=a||DEF;b=b||DEF;const s=c.surface,d=c.date;const nz=v=>v==null?null:v;
 const age=p=>p.by!=null?d/1e4-p.by:null,rest=p=>p.last?Math.min(ddays(d,p.last),365):null,h=c.h2h||[0,0];
 const fat=p=>(p.rd||[]).filter(x=>{const k=ddays(d,x);return k>=0&&k<=14}).length;const sub=(x,y)=>x==null||y==null?null:x-y;
 return [lg(ep(a.e,b.e)),lg(ep(a.s[s],b.s[s])),form(a)-form(b),sub(nz(a.spw),nz(b.spw)),sub(nz(a.rpw),nz(b.rpw)),h[0]-h[1],h[0]+h[1],
  a.rank>0&&b.rank>0?Math.log(b.rank)-Math.log(a.rank):null,sub(age(a),age(b)),rest(a),rest(b),c.bo||3,c.level??2,SURF.indexOf(s),Math.log1p(a.m||0),Math.log1p(b.m||0),
  sub(a.fs&&a.fs[s]!=null?a.fs[s]:null,b.fs&&b.fs[s]!=null?b.fs[s]:null),sub(nz(a.mom),nz(b.mom)),fat(a),fat(b)]}
const goL=(g,v,th)=>g.lt?(g.f32?Math.fround(v):v)<th:v<=th;
function gbRaw(g,x){let z=g.base;for(const t of g.trees){let i=0;while(!t[i][5]){const [f,th,ml,l,r]=t[i];const v=x[f];i=(v==null||Number.isNaN(v))?(ml?l:r):(goL(g,v,th)?l:r)}z+=t[i][6]}return z}
function isoMap(iso,p){const X=iso.x,Y=iso.y;if(p<=X[0])return Y[0];if(p>=X[X.length-1])return Y[Y.length-1];let lo=0,hi=X.length-1;while(hi-lo>1){const m=(lo+hi)>>1;X[m]<=p?lo=m:hi=m}
 return X[hi]===X[lo]?Y[lo]:Y[lo]+(Y[hi]-Y[lo])*(p-X[lo])/(X[hi]-X[lo])}
function predictGB(D,a,b,c){const x=gbFeatures(a,b,c);const pr=1/(1+Math.exp(-gbRaw(D.gbm,x)));return isoMap(D.iso,pr)}
// Saabas: příspěvek prvku = součet změn hodnoty uzlu podél cesty stromem
function gbContrib(g,x){const c=new Array(x.length).fill(0);let bias=g.base;for(const t of g.trees){let i=0;bias+=t[0][6];while(!t[i][5]){const [f,th,ml,l,r]=t[i];const v=x[f];const j=(v==null||Number.isNaN(v))?(ml?l:r):(goL(g,v,th)?l:r);c[f]+=t[j][6]-t[i][6];i=j}}return {bias,c}}
const GBN={elo_logit:["Elo celkově"],surf_elo_logit:["Elo na povrchu"],form_diff:["Forma (10 zápasů)"],spw_diff:["Body na podání"],rpw_diff:["Body na příjmu"],h2h_diff:["Vzájemné zápasy"],h2h_n:["Vzájemné zápasy"],rank_logratio:["Žebříček"],age_diff:["Věk"],rest_a:["Odpočinek"],rest_b:["Odpočinek"],log_n_a:["Zkušenost (počet zápasů)"],log_n_b:["Zkušenost (počet zápasů)"],best_of:["Kontext zápasu"],level:["Kontext zápasu"],surface:["Kontext zápasu"],surf_form_diff:["Forma na povrchu"],elo_mom_diff:["Elo momentum (10 zápasů)"],fat14_a:["Únava (zápasy za 14 dní)"],fat14_b:["Únava (zápasy za 14 dní)"]};
function explainGB(D,a,b,c){const h=c.h2h||[0,0];const A=gbContrib(D.gbm,gbFeatures(a,b,c)),B=gbContrib(D.gbm,gbFeatures(b,a,{...c,h2h:[h[1],h[0]]}));
 const m=new Map();D.features.forEach((f,i)=>{const k=(GBN[f]||[f])[0];m.set(k,(m.get(k)||0)+(A.c[i]-B.c[i])/2)});
 return [...m].map(([k,v])=>({k,v})).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v))}
// symetrizace: průměr p(A,B) a 1-p(B,A)
function predictBest(D,a,b,c){if(D.best!=="gbm"||!D.gbm)return predict(D.coef,a,b,c.surface);const h=c.h2h||[0,0];
 const p1=predictGB(D,a,b,c),p2=predictGB(D,b,a,{...c,h2h:[h[1],h[0]]});return (p1+1-p2)/2}

// průběh pravděpodobnosti bod po bodu z point-by-point dat (pro graf momentu)
function pbpSeries(pA,pB,games,bo,slam){const need=bo===5?3:2;let sa=0,sb=0,cur=games.length?games[0].set:1;const out=[];
 const tn=v=>{const n=parseInt(v,10);return Number.isFinite(n)?n:0};
 const P=(st)=>inPlay(pA,pB,{...st,bo,slam}).match;
 if(!games.length)return out;let aS=games[0].serving===1;out.push({p:P({sa,sb,ga:0,gb:0,pa:0,pb:0,aServes:aS}),set:1,g:"0:0",ev:"start"});
 let ga=0,gb=0;
 games.forEach((g,gi)=>{if(g.set!==cur){if(ga>gb)sa++;else sb++;ga=gb=0;cur=g.set}
  if(sa>=need||sb>=need)return;const tb=ga===6&&gb===6;aS=g.serving===1;
  const fin=g.scoring===1||g.scoring===2;const pts=fin?g.points.slice(0,-1):g.points;
  pts.forEach(([h,a])=>{let pa=tb?tn(h):ptNum(h),pb=tb?tn(a):ptNum(a);if(!tb){if(h==="A")pa=4,pb=3;if(a==="A")pb=4,pa=3}
   out.push({p:P({sa,sb,ga,gb,pa,pb,aServes:aS}),set:cur,g:`${ga}:${gb}`,pt:`${h}:${a}`})});
  if(fin){const brk=!tb&&g.scoring!==g.serving;ga=g.h;gb=g.a;let sa2=sa,sb2=sb,ga2=ga,gb2=gb;
   const setEnd=(ga>=6&&ga-gb>=2)||(gb>=6&&gb-ga>=2)||ga===7||gb===7;if(setEnd){ga>gb?sa2++:sb2++;ga2=gb2=0}
   const p=sa2>=need?1:sb2>=need?0:P({sa:sa2,sb:sb2,ga:ga2,gb:gb2,pa:0,pb:0,aServes:!aS});out.push({p,set:cur,g:`${ga}:${gb}`,ev:setEnd?"set":brk?"break":"game",who:g.scoring})}});
 return out}
// ML korekce in-play (LR na logitech; trénink Sackmann slam PBP 2011–2022, test 2023–24: Brier 0.1532 → 0.1502)
const IPML={bias:0.01932,l_ana:0.98011,l_pre:-0.14828,mom20:0.38123,mom50:-0.0178,sw_diff:3.89445};
function inplayML(ana,pre,f={}){if(ana<=0||ana>=1)return ana;const L=p=>{p=Math.min(1-1e-4,Math.max(1e-4,p));return Math.log(p/(1-p))};const avg=f.men?.64:.565;
 const sr=(w,t)=>(w+.64*30)/(t+30)-avg;const sw=(f.stA||f.stB)?sr(f.swA||0,f.stA||0)-sr(f.swB||0,f.stB||0):0;
 const z=IPML.bias+IPML.l_ana*L(ana)+IPML.l_pre*L(pre)+IPML.mom20*(f.mom20||0)+IPML.mom50*(f.mom50||0)+IPML.sw_diff*sw;return 1/(1+Math.exp(-z))}
// vítězové bodů z point-by-point (1 = domácí), pro momentum
function pbpWinners(games){const out=[];const v=(x,tb)=>tb?(parseInt(x,10)||0):ptNum(x);let ga=0,gb=0,cur=null;
 for(const g of games){if(g.set!==cur){cur=g.set;ga=gb=0}const tb=ga===6&&gb===6;let ph=0,pa=0;
  for(const [h,a] of g.points){const hv=v(h,tb),av=v(a,tb);if(hv>ph)out.push(1);else if(av>pa)out.push(0);else if(ph===4&&!tb)out.push(0);else if(pa===4&&!tb)out.push(1);ph=hv;pa=av}
  if(g.scoring===1||g.scoring===2){const lp=g.points[g.points.length-1];if(!lp||!(lp[0]==="0"&&lp[1]==="0"))out.push(g.scoring===1?1:0);ga=g.h;gb=g.a}}
 return out}
function momentum(w,k){const h=w.slice(-k);return h.length?h.reduce((s,x)=>s+x,0)/h.length-.5:0}
// prior pro neznámého hráče z žebříčku (Sofascore): Elo ≈ 2286 − 107,4·ln(rank) (fit na aktivních hráčích, rozptyl ±100)
function rankPrior(name,rank){const e=!(rank>0)?1450:Math.min(1900,Math.max(1350,2286-107.4*Math.log(rank)));return {n:name,e,s:{Hard:e,Clay:e,Grass:e},m:0,f:[],rank,prior:true}}
const api={rankPrior,inplayML,pbpWinners,momentum,pbpSeries,devig,valueTip,gbContrib,explainGB,tbTarget,tbServer,nextSetFirstServer,ddays,gbFeatures,gbRaw,isoMap,predictGB,predictBest,SURF,ep,lg,form,features,predict,explain,surfaceOf,norm,nameIndex,findPlayer,gameWin,tbWin,setDist,inPlay,simGames,servePrior,calibrateServe,bayes,liveState,isPhantom,dedupe,fracToDec,value,brier,ptNum};
if(typeof module!=="undefined")module.exports=api;root.TM=api})(typeof globalThis!=="undefined"?globalThis:this);
