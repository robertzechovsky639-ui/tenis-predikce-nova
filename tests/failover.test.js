const test=require("node:test"),assert=require("node:assert");
globalThis.TM=require("../web/model.js");require("../web/live.js");const L=globalThis.LIVE;
const now=Math.floor(Date.now()/1000);
const sofa={events:[{id:1,tournament:{name:"Vienna",category:{slug:"atp"}},homeTeam:{name:"Jannik Sinner"},awayTeam:{name:"Carlos Alcaraz"},status:{type:"inprogress",description:"1st set",code:8},
 startTimestamp:now-1800,homeScore:{period1:3,point:"15"},awayScore:{period1:2,point:"30"},changes:{changeTimestamp:now-60},groundType:"Hardcourt indoor",firstToServe:1}]};
const espn={events:[{name:"Vienna",groupings:[{grouping:{displayName:"Men's Singles"},competitions:[{id:"9",date:new Date().toISOString(),status:{type:{state:"in"}},
 competitors:[{order:1,athlete:{displayName:"Jannik Sinner"},linescores:[{value:3}]},{order:2,athlete:{displayName:"Carlos Alcaraz"},linescores:[{value:2}]}]}]}]}]};
const tsEvs=[{id:77,name:"Vienna",match_type:"Men's Singles",event_status:"in_progress",ground_type:"hardcourt_indoor",tournament_type:"ATP 500",start_date:new Date(Date.now()-3*864e5).toUTCString(),end_date:new Date(Date.now()+3*864e5).toUTCString()}];
const tsM=[{id:5001,status:"in_progress",is_double:false,sets:3,match_date:new Date().toUTCString(),team_1:{id:11,player1:{first_name:"Jannik",last_name:"Sinner"}},team_2:{id:22,player1:{first_name:"Carlos",last_name:"Alcaraz"}},
 team_1_scores:[6,3],team_2_scores:[4,2],team_1_point_score:"40",team_2_point_score:"AD",current_server_id:22,team_1_tie_break:[],team_2_tie_break:[]},
 {id:5002,status:"final",is_double:false,team_1:{id:1,player1:{first_name:"A",last_name:"B"}},team_2:{id:2,player1:{first_name:"C",last_name:"D"}},match_date:new Date().toUTCString(),team_1_scores:[6,6],team_2_scores:[1,1],winner_id:1}];
const s365={games:[{id:5,statusGroup:3,startTime:new Date().toISOString(),competitionDisplayName:"Vienna",homeCompetitor:{name:"Jannik Sinner",score:0,rankings:[{name:"ATP"}]},awayCompetitor:{name:"Carlos Alcaraz",score:0}}]};
let down=new Set();
globalThis.fetch=async u=>{const src=u.includes("sofascore")?"sofascore":u.includes("espn")?"espn":u.includes("thescore")?"thescore":u.includes("365scores")?"365scores":"?";
 if(down.has(src))return {ok:false,status:503,json:async()=>({})};
 const body=src==="sofascore"?(u.includes("/events/live")?sofa:{events:[]}):src==="espn"?(u.includes("/atp/")?espn:{events:[]}):src==="thescore"?(u.includes("/matches")?(u.includes("/atp/")?tsM:[]):u.includes("/atp/")?tsEvs:[]):s365;return {ok:true,json:async()=>body}};
for(const [fail,exp] of [[[],"Sofascore"],[["sofascore"],"theScore (záloha)"],[["sofascore","thescore"],"365scores (záloha)"]]){
 test(`live: výpadek [${fail}] -> ${exp}`,async()=>{down=new Set(fail);const r=await L.getLive();assert.equal(r.source,exp);assert.ok(r.list.length>=1);assert.equal(r.list[0].home,"Jannik Sinner");assert.equal(r.errs.length,fail.length)})}
test("live: všechny zdroje mimo provoz -> prázdný seznam, bez výjimky",async()=>{down=new Set(["sofascore","espn","thescore","365scores"]);const r=await L.getLive();assert.equal(r.source,"nedostupné");assert.equal(r.list.length,0);assert.equal(r.errs.length,3)});
test("live: simulovaný výpadek přes LIVE.FAIL (?fail=)",async()=>{down=new Set();L.FAIL.add("sofascore");const r=await L.getLive();L.FAIL.clear();assert.equal(r.source,"theScore (záloha)")});
test("den: Sofascore dole -> ESPN",async()=>{down=new Set(["sofascore"]);const r=await L.getDay("2026-10-23");assert.equal(r.source,"theScore (záloha)")});
test("Sofascore parsing: přerušeno, skreč, stale, GS ženy",()=>{require("../web/model.js");require("../web/live.js");const L=globalThis.LIVE;
 const base=(st,ds,extra={})=>({id:1,tournament:{name:"US Open, New York, USA",category:{id:6,name:"WTA",slug:"wta"},uniqueTournament:{name:"US Open"}},homeTeam:{name:"A B",type:1},awayTeam:{name:"C D",type:1},status:{type:st,description:ds},homeScore:{period1:6,point:"A"},awayScore:{period1:4,point:"40"},startTimestamp:0,groundType:"Hardcourt outdoor",...extra});
 const s=L.fromSofa(base("interrupted","Interrupted"));assert.ok(s&&s.status==="live"&&s.suspended&&s.desc==="Přerušeno");
 const r=L.fromSofa(base("finished","Retired",{winnerCode:1}));assert.ok(r.retired&&r.desc==="Skreč"&&r.winner===1);
 const o=L.fromSofa(base("inprogress","2nd set",{changes:{changeTimestamp:Date.now()/1000-3600}}));assert.ok(o.stale);
 assert.ok(o.slam&&o.bo===3);});
test("parseStats + parsePBP",()=>{const L=globalThis.LIVE;
 const st=L.parseStats({statistics:[{period:"ALL",groups:[{statisticsItems:[{key:"aces",home:"5",away:"2",homeValue:5,awayValue:2},{key:"firstServeAccuracy",home:"30/50 (60%)",away:"20/40 (50%)",homeValue:30,awayValue:20,homeTotal:50,awayTotal:40},{key:"servicePointsScored",home:"35",away:"22",homeValue:35,awayValue:22}]}]}]});
 assert.equal(st.hPlayed,50);assert.equal(st.hWon,35);assert.ok(st.rows.find(r=>r.k==="aces").hv===5);
 const g=L.parsePBP({pointByPoint:[{set:2,games:[{game:1,score:{homeScore:1,awayScore:0,serving:1,scoring:1},points:[]}]},{set:1,games:[{game:2,score:{homeScore:6,awayScore:4,serving:2,scoring:1},points:[]},{game:1,score:{homeScore:5,awayScore:4,serving:1,scoring:1},points:[]}]}]});
 assert.deepEqual(g.map(x=>[x.set,x.game]),[[1,1],[1,2],[2,1]])});

test("theScore: parser – sety, body (AD→A), podávající → liveState, TB",()=>{const m=L.fromScore(tsM[0],tsEvs[0],"atp");assert.equal(m.home,"Jannik Sinner");assert.equal(m.status,"live");
 assert.deepEqual(m.sets,[[6,4],[3,2]]);assert.deepEqual(m.point,["40","A"]);assert.equal(m.surface,"Hard");const st=TM.liveState(m.ev);assert.ok(st.known);assert.equal(st.serverNow,false);assert.equal(st.pa,3);assert.equal(st.pb,4);
 const g=TM.gamePred(.65,.62,st);assert.ok(!g.srvA&&!g.bp&&g.gp);
 const tb={...tsM[0],team_1_scores:[6],team_2_scores:[6],team_1_tie_break:[3],team_2_tie_break:[1],current_server_id:11};const s2=TM.liveState(L.fromScore(tb,tsEvs[0],"atp").ev);assert.ok(s2.tb);assert.equal(s2.serverNow,true);assert.equal(s2.pa,3);
 const tb2={...tb,current_server_id:22};assert.equal(TM.liveState(L.fromScore(tb2,tsEvs[0],"atp").ev).serverNow,false);
 const f=L.fromScore(tsM[1],tsEvs[0],"atp");assert.equal(f.status,"finished");assert.equal(f.winner,1);assert.equal(L.fromScore({...tsM[0],is_double:true},tsEvs[0],"atp"),null)});
test("theScore: scoreLive vrací jen živé dvouhry",async()=>{down=new Set();const r=await L.scoreLive();assert.equal(r.length,1);assert.equal(r[0].src,"theScore")});
