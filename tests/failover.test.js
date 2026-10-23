const test=require("node:test"),assert=require("node:assert");
globalThis.TM=require("../web/model.js");require("../web/live.js");const L=globalThis.LIVE;
const now=Math.floor(Date.now()/1000);
const sofa={events:[{id:1,tournament:{name:"Vienna",category:{slug:"atp"}},homeTeam:{name:"Jannik Sinner"},awayTeam:{name:"Carlos Alcaraz"},status:{type:"inprogress",description:"1st set",code:8},
 startTimestamp:now-1800,homeScore:{period1:3,point:"15"},awayScore:{period1:2,point:"30"},changes:{changeTimestamp:now-60},groundType:"Hardcourt indoor",firstToServe:1}]};
const espn={events:[{name:"Vienna",groupings:[{grouping:{displayName:"Men's Singles"},competitions:[{id:"9",date:new Date().toISOString(),status:{type:{state:"in"}},
 competitors:[{order:1,athlete:{displayName:"Jannik Sinner"},linescores:[{value:3}]},{order:2,athlete:{displayName:"Carlos Alcaraz"},linescores:[{value:2}]}]}]}]}]};
const s365={games:[{id:5,statusGroup:3,startTime:new Date().toISOString(),competitionDisplayName:"Vienna",homeCompetitor:{name:"Jannik Sinner",score:0,rankings:[{name:"ATP"}]},awayCompetitor:{name:"Carlos Alcaraz",score:0}}]};
let down=new Set();
globalThis.fetch=async u=>{const src=u.includes("sofascore")?"sofascore":u.includes("espn")?"espn":u.includes("365scores")?"365scores":"?";
 if(down.has(src))return {ok:false,status:503,json:async()=>({})};
 const body=src==="sofascore"?(u.includes("/events/live")?sofa:{events:[]}):src==="espn"?(u.includes("/atp/")?espn:{events:[]}):s365;return {ok:true,json:async()=>body}};
for(const [fail,exp] of [[[],"Sofascore"],[["sofascore"],"ESPN (záloha)"],[["sofascore","espn"],"365scores (záloha)"]]){
 test(`live: výpadek [${fail}] -> ${exp}`,async()=>{down=new Set(fail);const r=await L.getLive();assert.equal(r.source,exp);assert.ok(r.list.length>=1);assert.equal(r.list[0].home,"Jannik Sinner");assert.equal(r.errs.length,fail.length)})}
test("live: všechny zdroje mimo provoz -> prázdný seznam, bez výjimky",async()=>{down=new Set(["sofascore","espn","365scores"]);const r=await L.getLive();assert.equal(r.source,"nedostupné");assert.equal(r.list.length,0);assert.equal(r.errs.length,3)});
test("live: simulovaný výpadek přes LIVE.FAIL (?fail=)",async()=>{down=new Set();L.FAIL.add("sofascore");const r=await L.getLive();L.FAIL.clear();assert.equal(r.source,"ESPN (záloha)")});
test("den: Sofascore dole -> ESPN",async()=>{down=new Set(["sofascore"]);const r=await L.getDay("2026-10-23");assert.equal(r.source,"ESPN (záloha)")});
