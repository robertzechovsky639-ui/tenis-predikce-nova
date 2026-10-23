// Živá data: Sofascore (primární, CORS povolen), záloha theScore a 365scores (ESPN jen v nočním doplňování výsledků – v prohlížeči blokuje CORS). Bez proxy.
(function(root){
const SS="https://api.sofascore1.com/api/v1";
const CATS={atp:["ATP","atp"],wta:["WTA","wta"],challenger:["Challenger","atp"],"itf-men":["ITF","atp"],"itf-women":["ITF","wta"],"wta-125":["WTA 125","wta"]};
const SCHED_IDS=[3,6,72,785,213,871];
const SLAM=/australian open|roland garros|french open|wimbledon|us open/i;
async function j(u,ms=9000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}}
function fromSofa(e){const slug=e.tournament&&e.tournament.category&&e.tournament.category.slug;const c=CATS[slug];if(!c)return null;
 if((e.homeTeam.type===2)||/\//.test(e.homeTeam.name))return null; // čtyřhra
 const ty=e.status.type,ds=e.status.description||"";const susp=ty==="interrupted"||ty==="suspended"||/interrupt|suspend|delay/i.test(ds)&&ty!=="finished";
 const st=ty==="inprogress"||susp?"live":ty==="notstarted"?"upcoming":ty==="finished"?"finished":null;if(!st)return null;
 const ret=ty==="finished"&&/retir|walkover|default|w\/o/i.test(ds);const ch=e.changes&&e.changes.changeTimestamp||0;const stale=st==="live"&&!susp&&ch>0&&(Date.now()/1000-ch)>15*60;
 const sets=[];for(let i=1;i<=5;i++){if(e.homeScore["period"+i]==null)break;sets.push([e.homeScore["period"+i],e.awayScore["period"+i]])}
 const slam=(c[0]==="ATP"||c[0]==="WTA")&&SLAM.test(e.tournament.name+" "+((e.tournament.uniqueTournament||{}).name||""))&&!/qualif|junior|boys|girls|wheelchair/i.test(e.tournament.name);const bo=slam&&c[1]==="atp"?5:3;
 return {id:"s"+e.id,sid:e.id,src:"Sofascore",cat:c[0],tour:c[1],tourney:e.tournament.name,surface:TM.surfaceOf(e.groundType),home:e.homeTeam.name,away:e.awayTeam.name,hid:e.homeTeam.id,aid:e.awayTeam.id,rk:[e.homeTeam.ranking||null,e.awayTeam.ranking||null],cc:[(e.homeTeam.country||{}).alpha2||"",(e.awayTeam.country||{}).alpha2||""],
  status:st,start:e.startTimestamp,sets,point:[e.homeScore.point,e.awayScore.point],winner:e.winnerCode||null,desc:susp?"Přerušeno":ret?(/walkover|w\/o/i.test(ds)?"Skreč před zápasem (W/O)":"Skreč"):e.status.description,suspended:susp,retired:ret,stale,bo,slam,ev:{...e,bo,slam},rank:e.changes&&e.changes.changeTimestamp||0}}
async function sofaLive(){const d=await j(SS+"/sport/tennis/events/live",6000);const now=Date.now()/1000;let ph=0;
 const out=[];for(const e of d.events||[]){if(TM.isPhantom(e,now)){ph++;continue}const m=fromSofa(e);if(m)out.push(m)}return {list:out,phantoms:ph}}
async function sofaDay(date){const rs=await Promise.allSettled(SCHED_IDS.map(c=>j(`${SS}/category/${c}/scheduled-events/${date}`)));
 const now=Date.now()/1000;let ph=0;const out=[];rs.forEach(r=>{if(r.status==="fulfilled")(r.value.events||[]).forEach(e=>{if(e.status&&e.status.type==="inprogress"&&TM.isPhantom(e,now)){ph++;return}const m=fromSofa(e);if(m)out.push(m)})});if(!out.length&&rs.every(r=>r.status==="rejected"))throw new Error("sofascore day");return {list:out,phantoms:ph}}
// theScore (api.thescore.com, CORS *, bez klíče): ATP + WTA dvouhra, sety, body, podávající, TB body. Challenger/ITF nepokrývá.
const TS="https://api.thescore.com",tsEv={};
async function tsEvents(t){const c=tsEv[t];if(c&&Date.now()-c.t<1800e3)return c.d;const d=await j(`${TS}/${t}/events`,6000);tsEv[t]={t:Date.now(),d};return d}
const TSURF=g=>/clay/i.test(g||"")?"Clay":/grass/i.test(g||"")?"Grass":"Hard";
const tsPt=p=>p==null||p===""?null:/^a/i.test(String(p))?"A":String(p);
function fromScore(x,ev,t){if(x.is_double||!x.team_1||!x.team_2)return null;const nm=s=>s&&s.player1?((s.player1.first_name||"")+" "+(s.player1.last_name||"")).trim():null;
 const home=nm(x.team_1),away=nm(x.team_2);if(!home||!away)return null;const st=x.status;
 const status=st==="pre_game"?"upcoming":/final|retired|walkover|cancel/.test(st)?"finished":/postpon|delay|suspend/.test(st)&&!(x.team_1_scores||[]).length?"upcoming":"live";
 const s1=x.team_1_scores||[],s2=x.team_2_scores||[];const sets=s1.map((v,i)=>[v??0,s2[i]??0]);const slam=SLAM.test(ev.name||"");const bo=x.sets===5||(slam&&t==="atp")?5:3;
 const tb1=x.team_1_tie_break||[],tb2=x.team_2_tie_break||[];const cur=sets.length?sets[sets.length-1]:[0,0];const inTB=status==="live"&&cur[0]===6&&cur[1]===6;
 const point=status==="live"?(inTB?[tb1[sets.length-1]??x.team_1_point_score??0,tb2[sets.length-1]??x.team_2_point_score??0].map(v=>String(v??0)):[tsPt(x.team_1_point_score),tsPt(x.team_2_point_score)]):[];
 const winner=x.winner_id?(x.winner_id===x.team_1.id?1:x.winner_id===x.team_2.id?2:null):null;
 let ev2=null;if(status==="live"&&sets.length){const hs={},as={};sets.forEach((s,i)=>{hs["period"+(i+1)]=s[0];as["period"+(i+1)]=s[1]});if(point[0]!=null){hs.point=point[0];as.point=point[1]}
  let fts=null;const srv=x.current_server_id;if(srv&&(srv===x.team_1.id||srv===x.team_2.id)){const home=srv===x.team_1.id;let g=0;sets.forEach(s=>g+=s[0]+s[1]);
   // liveState: aServes=(games%2===0)===first; v TB je server bodu tbServer(aServes,n)
   let aS=home;if(inTB){const n=(+point[0]||0)+(+point[1]||0);if(Math.floor((n+1)/2)%2===1)aS=!aS}fts=((g%2===0)===aS)?1:2}
  ev2={homeScore:hs,awayScore:as,firstToServe:fts,bo,slam}}
 const tt=ev.tournament_type||"";return {id:"t"+x.id,src:"theScore",cat:/125/.test(tt)?"WTA 125":t.toUpperCase(),tour:t,tourney:ev.name,surface:TSURF(ev.ground_type),home,away,status,winner,start:Date.parse(x.match_date)/1000,sets,point,bo,slam,ev:ev2,rank:Date.parse(x.updated_at)/1000||0}}
async function scoreLive(date){const out=[];const day=date?Date.parse(date+"T12:00:00Z"):Date.now();
 await Promise.all(["atp","wta"].map(async t=>{const evs=(await tsEvents(t)).filter(e=>/singles/i.test(e.match_type||"")&&(date?Date.parse(e.start_date)-864e5<=day&&day<=Date.parse(e.end_date)+864e5:e.event_status==="in_progress"));
  await Promise.all(evs.map(async ev=>{const ms=await j(`${TS}/${t}/events/${ev.id}/matches`,6000);for(const x of ms||[]){const m=fromScore(x,ev,t);if(!m)continue;
   if(date){const d=new Date(m.start*1000);const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");if(ds!==date)continue}else if(m.status!=="live")continue;out.push(m)}}))}));return out}
async function s365Live(date){const q=date?`&startDate=${date.split("-").reverse().join("/")}&endDate=${date.split("-").reverse().join("/")}`:"";
 const d=await j("https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=1&timezoneName=Europe%2FPrague&userCountryId=1&sports=3"+q);const out=[];
 for(const g of d.games||[]){if(!date&&g.statusGroup!==3&&g.statusGroup!==2)continue;const h=g.homeCompetitor,a=g.awayCompetitor;if(!h||/\//.test(h.name))continue;
  const r=(h.rankings||[])[0];const tour=r&&r.name==="WTA"?"wta":"atp";
  out.push({id:"x"+g.id,src:"365scores",cat:r?r.name:"—",tour,tourney:g.competitionDisplayName,surface:"Hard",home:h.name,away:a.name,status:g.statusGroup===3?"live":g.statusGroup===4?"finished":"upcoming",winner:g.statusGroup===4?(h.isWinner?1:a.isWinner?2:null):null,start:Date.parse(g.startTime)/1000,sets:[[h.score>=0?h.score:0,a.score>=0?a.score:0]],setsOnly:true,point:[],bo:3,rank:0})}return out}
// failover: zdroje v pořadí; LIVE.fail (nebo ?fail=sofascore,espn v URL) simuluje výpadek
const FAIL=new Set((typeof location!=="undefined"&&new URLSearchParams(location.search).get("fail")||"").split(",").filter(Boolean));
async function chain(srcs){const errs=[];for(const [name,label,fn] of srcs){try{if(FAIL.has(name))throw new Error("simulovaný výpadek");const r=await fn();const list=r.list||r;
 if(!list.length&&name!==srcs[srcs.length-1][0])throw new Error("prázdná odpověď");return {list,phantoms:r.phantoms||0,source:label,errs}}catch(e){errs.push(label+": "+e.message)}}
 return {list:[],phantoms:0,source:"nedostupné",errs}}
// živě: primární Sofascore; když neodpoví do 3 s, paralelně se spustí zálohy a vyhraje první neprázdná odpověď
function race(srcs,head=3000){return new Promise(res=>{const errs=[],st=srcs.map(()=>null),rs=[];let done=false,slow=false,started=0;
 const check=()=>{if(done)return;const i=st.findIndex(x=>x!=="fail");if(i<0){done=true;return res({list:[],phantoms:0,source:errs.some(x=>/prázdná/.test(x))?srcs[0][1]:"nedostupné",errs})}
  let k=st[i]==="ok"?i:slow?st.findIndex(x=>x==="ok"):-1;if(k>=0){done=true;res({...rs[k],errs})}else if(st[i]===null&&i>=started)start()};
 const run=i=>{const [name,label,fn]=srcs[i];st[i]="run";(async()=>{if(FAIL.has(name))throw new Error("simulovaný výpadek");const r=await fn();const list=r.list||r;if(!list.length)throw new Error("prázdná odpověď");return {list,phantoms:r.phantoms||0,source:label}})()
  .then(r=>{st[i]="ok";rs[i]=r;check()},e=>{st[i]="fail";errs.push(label+": "+e.message);if(i===0)start();check()})};
 const start=()=>{while(started<srcs.length)run(started++)};run(started++);setTimeout(()=>{slow=true;start();check()},head)})}
const getLive=()=>race([["sofascore","Sofascore",sofaLive],["thescore","theScore (záloha)",()=>scoreLive()],["365scores","365scores (záloha)",()=>s365Live()]]);
const getDay=date=>chain([["sofascore","Sofascore",()=>sofaDay(date)],["thescore","theScore (záloha)",()=>scoreLive(date)],["365scores","365scores (záloha)",()=>s365Live(date)]]);
const oddsCache=new Map();
async function odds(sid){if(oddsCache.has(sid))return oddsCache.get(sid);let r=null;try{const d=await j(`${SS}/event/${sid}/odds/1/featured`,6000);const ch=d.featured&&d.featured.default&&d.featured.default.choices;
 if(ch&&ch.length>=2)r=[TM.fracToDec(ch[0].fractionalValue),TM.fracToDec(ch[1].fractionalValue)]}catch(e){}oddsCache.set(sid,r);return r}
const STATK=[["aces","Esa"],["doubleFaults","Dvojchyby"],["firstServeAccuracy","1. podání"],["firstServePointsAccuracy","Body po 1. podání"],["secondServePointsAccuracy","Body po 2. podání"],["breakPointsScored","Brejkboly proměněné"],["serviceGamesWon","Gamy na podání"],["receiverPointsScored","Body na příjmu"],["pointsTotal","Body celkem"],["maxPointsInRow","Max. bodů v řadě"]];
function parseStats(d){const all=(d.statistics||[]).find(p=>p.period==="ALL")||(d.statistics||[])[0];if(!all)return null;
 const it={};all.groups.forEach(g=>g.statisticsItems.forEach(x=>{if(!it[x.key])it[x.key]=x}));const f=it.firstServeAccuracy,w=it.servicePointsScored;
 const rows=STATK.filter(([k])=>it[k]).map(([k,l])=>({k,l,h:it[k].home,a:it[k].away,hv:+it[k].homeValue||0,av:+it[k].awayValue||0}));
 return {hPlayed:f?f.homeTotal:0,aPlayed:f?f.awayTotal:0,hWon:w?w.homeValue:0,aWon:w?w.awayValue:0,aces:[it.aces&&it.aces.homeValue,it.aces&&it.aces.awayValue],rows,ok:!!(f&&w)}}
async function stats(sid){try{const s=parseStats(await j(`${SS}/event/${sid}/statistics`,6000));return s}catch(e){return null}}
// point-by-point → chronologická posloupnost gamů [{set,game,h,a,serving,scoring,points:[[h,a]]}]
function parsePBP(d){const out=[];for(const s of (d.pointByPoint||[]).slice().sort((x,y)=>x.set-y.set))for(const g of (s.games||[]).slice().sort((x,y)=>x.game-y.game))
 out.push({set:s.set,game:g.game,h:g.score.homeScore,a:g.score.awayScore,serving:g.score.serving,scoring:g.score.scoring,points:(g.points||[]).map(p=>[p.homePoint,p.awayPoint])});return out}
async function pbp(sid){try{return parsePBP(await j(`${SS}/event/${sid}/point-by-point`,7000))}catch(e){return null}}
const photo=id=>id?`${SS}/team/${id}/image`:"";
root.LIVE={fromScore,scoreLive,pbp,parsePBP,parseStats,photo,STATK,getLive,getDay,FAIL,sofaDay,odds,stats,fromSofa}})(globalThis);
