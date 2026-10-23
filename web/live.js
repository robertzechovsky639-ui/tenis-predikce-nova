// Živá data: Sofascore (primární, CORS povolen), záloha ESPN a 365scores. Bez proxy.
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
async function sofaLive(){const d=await j(SS+"/sport/tennis/events/live");const now=Date.now()/1000;let ph=0;
 const out=[];for(const e of d.events||[]){if(TM.isPhantom(e,now)){ph++;continue}const m=fromSofa(e);if(m)out.push(m)}return {list:out,phantoms:ph}}
async function sofaDay(date){const rs=await Promise.allSettled(SCHED_IDS.map(c=>j(`${SS}/category/${c}/scheduled-events/${date}`)));
 const now=Date.now()/1000;let ph=0;const out=[];rs.forEach(r=>{if(r.status==="fulfilled")(r.value.events||[]).forEach(e=>{if(e.status&&e.status.type==="inprogress"&&TM.isPhantom(e,now)){ph++;return}const m=fromSofa(e);if(m)out.push(m)})});if(!out.length&&rs.every(r=>r.status==="rejected"))throw new Error("sofascore day");return {list:out,phantoms:ph}}
async function espnLive(date){const out=[];for(const t of ["atp","wta"]){const d=await j(`https://site.api.espn.com/apis/site/v2/sports/tennis/${t}/scoreboard`+(date?`?dates=${date.replace(/-/g,"")}`:""));
 for(const ev of d.events||[])for(const g of ev.groupings||[]){if(!/singles/i.test(g.grouping&&g.grouping.displayName||"singles"))continue;for(const c of g.competitions||[]){const s=c.status.type.state;if(!date&&s!=="in"&&s!=="pre")continue;
  const [h,a]=c.competitors.sort((x,y)=>x.order-y.order);if(!h||!a||!h.athlete)continue;const sets=(h.linescores||[]).map((l,i)=>[l.value,(a.linescores[i]||{}).value||0]);
  out.push({id:"e"+c.id,src:"ESPN",cat:t.toUpperCase(),tour:t,tourney:ev.name,surface:"Hard",home:h.athlete.displayName,away:a.athlete.displayName,status:s==="in"?"live":s==="post"?"finished":"upcoming",winner:h.winner?1:a.winner?2:null,start:Date.parse(c.date)/1000,sets,point:[],bo:3,rank:1})}}}return out}
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
const getLive=()=>chain([["sofascore","Sofascore",sofaLive],["espn","ESPN (záloha)",()=>espnLive()],["365scores","365scores (záloha)",()=>s365Live()]]);
const getDay=date=>chain([["sofascore","Sofascore",()=>sofaDay(date)],["espn","ESPN (záloha)",()=>espnLive(date)],["365scores","365scores (záloha)",()=>s365Live(date)]]);
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
root.LIVE={pbp,parsePBP,parseStats,photo,STATK,getLive,getDay,FAIL,sofaDay,odds,stats,fromSofa}})(globalThis);
