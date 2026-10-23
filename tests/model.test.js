const test=require("node:test"),assert=require("node:assert");const T=require("../web/model.js");
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test("game: known closed form",()=>{const p=.6,q=.4;const f=p**4*(1+4*q+10*q*q)+20*p**3*q**3*p*p/(1-2*p*q);close(T.gameWin(.6),f)});
test("game: from 40-0 and deuce/AD",()=>{assert.ok(T.gameWin(.6,3,0)>.95);close(T.gameWin(.6,3,3),.36/.52);assert.ok(T.gameWin(.6,4,3)>T.gameWin(.6,3,3))});
test("symmetric players -> 50 %",()=>{const r=T.inPlay(.64,.64,{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:3});close(r.match,.5,1e-9);close(r.decider,.5,1e-9);close(T.tbWin(.6,.6,0,0,true,7),.5,1e-9)});
test("leading increases win prob, finished state",()=>{const s={sa:1,sb:0,ga:5,gb:2,aServes:true,bo:3};assert.ok(T.inPlay(.64,.64,s).match>.9);
 assert.equal(T.inPlay(.6,.6,{sa:1,sb:1,ga:0,gb:0,aServes:true,bo:3}).decider,1)});
test("bo5 amplifies favourite",()=>{const a=T.inPlay(.68,.62,{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:3}).match,b=T.inPlay(.68,.62,{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:5}).match;assert.ok(b>a&&a>.5)});
test("calibrateServe hits target",()=>{const [a,b]=T.calibrateServe(.65,.63,.72,3);close(T.inPlay(a,b,{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:3}).match,.72,1e-3)});
test("simGames sane",()=>{const g=T.simGames(.64,.64,{sa:0,sb:0,ga:0,gb:0,aServes:true,bo:3});assert.ok(g.mean>18&&g.mean<30)});
test("bayes update",()=>{close(T.bayes(.6,0,0),.6);assert.ok(T.bayes(.6,30,40)>.6)});
test("phantom filter",()=>{const now=1e9;assert.ok(T.isPhantom({changes:{changeTimestamp:now-46*60},startTimestamp:now-3600},now));
 assert.ok(T.isPhantom({startTimestamp:now-13*3600},now));assert.ok(!T.isPhantom({changes:{changeTimestamp:now-60},startTimestamp:now-3600},now))});
test("dedupe by names (order/diacritics)",()=>{const r=T.dedupe([{home:"Tomáš Macháč",away:"Jiří Lehečka",rank:1},{home:"Jiri Lehecka",away:"Tomas Machac",rank:2}]);assert.equal(r.length,1)});
test("name matching + odds + value",()=>{const ix=T.nameIndex([{n:"Jannik Sinner",m:5},{n:"Carlos Alcaraz",m:5}]);assert.equal(T.findPlayer(ix,"Jannik Sinner"),0);assert.equal(T.findPlayer(ix,"Sinner Jannik"),0);
 assert.equal(T.fracToDec("3/4"),1.75);assert.ok(T.value(.6,1.9));assert.ok(!T.value(.5,1.9))});
test("liveState parses sofascore event",()=>{const s=T.liveState({homeScore:{period1:6,period2:3,point:"40"},awayScore:{period1:4,period2:2,point:"A"},firstToServe:1});
 assert.deepEqual([s.sa,s.sb,s.ga,s.gb,s.pa,s.pb,s.aServes],[1,0,3,2,3,4,false])});
test("built data + model sanity",()=>{for(const t of ["atp","wta"]){const D=require(`../web/data/${t}.json`);assert.equal(D.coef.length,4);assert.ok(D.metrics.model.brier<D.metrics.raw_overall_elo.brier);let mx=0;D.sample_X.forEach((x,i)=>{mx=Math.max(mx,Math.abs(1/(1+Math.exp(-T.gbRaw(D.gbm,x)))-D.sample_p[i]))});assert.ok(mx<1e-5,"GBM JS != python "+mx);let mm=0;D.sample_X.forEach((x,i)=>{mm=Math.max(mm,Math.abs(T.gbRaw(D.gbm,x)-D.sample_margin[i]))});assert.ok(mm<1e-5,"margin "+mm);console.log(t,"parita p",mx,"margin",mm);assert.equal(D.features.length,20);
 const top=D.players.slice().sort((a,b)=>b.e-a.e);assert.ok(T.predict(D.coef,top[0],top[50],"Hard")>.7)}});
test("TB: rotace podání 0-0, 1-0, 2-1, 6-6",()=>{const A=true;
 assert.equal(T.tbServer(A,0),true);   // 0-0: podává ten, kdo je na řadě
 assert.equal(T.tbServer(A,1),false);  // 1-0: soupeř (body 2-3)
 assert.equal(T.tbServer(A,2),false);  // 1-1 / 2-0
 assert.equal(T.tbServer(A,3),true);   // 2-1: zase první (body 4-5)
 assert.equal(T.tbServer(A,4),true);assert.equal(T.tbServer(A,5),false);
 assert.equal(T.tbServer(A,12),true);  // 6-6 (12 bodů): první hráč (bod 13 = liché pořadí)
 assert.equal(T.tbServer(false,0),false)});
test("TB: liveState ukazatel podání podle skóre TB",()=>{const ev=(h,a)=>({homeScore:{period1:6,period2:6,point:String(h)},awayScore:{period1:4,period2:6,point:String(a)},firstToServe:1});
 // set1 10 gamů, set2 12 -> game #23 (TB) = sudý index 22 -> domácí začíná TB
 assert.equal(T.liveState(ev(0,0)).serverNow,true);assert.equal(T.liveState(ev(1,0)).serverNow,false);assert.equal(T.liveState(ev(2,1)).serverNow,true);assert.equal(T.liveState(ev(6,6)).serverNow,true);assert.ok(T.liveState(ev(0,0)).tb)});
test("TB: 10bodový TB – rozhodnutí a podání",()=>{close(T.tbWin(.65,.65,0,0,true,10),.5,1e-9);assert.ok(T.tbWin(.65,.65,9,5,true,10)>.95);
 // asymetrie: při 9-9 (18 bodů) podává začínající (bod 19), výhra 2 bodů za sebou
 const p=T.tbWin(.7,.6,9,9,true,10);close(p,.7*.4/(.7*.4+.3*.6),1e-9);
 const st={sa:1,sb:1,ga:6,gb:6,pa:0,pb:0,aServes:true,bo:3};assert.ok(Math.abs(T.inPlay(.65,.65,st).match-.5)<1e-9)});
test("TB: první podávající dalšího setu = kdo v TB přijímal",()=>{assert.equal(T.nextSetFirstServer(true),false);
 const d=T.setDist(.9,.6,6,6,true,[0,0],7);close(d[0],0,1e-12);close(d[2],0,1e-12);assert.ok(d[1]>0&&d[3]>0); // A začal TB -> další set podává B
 const ev={homeScore:{period1:7,period2:0},awayScore:{period1:6,period2:0},firstToServe:1};assert.equal(T.liveState(ev).serverNow,false)}); // 13 gamů -> B podává 1. game 2. setu
test("TB: model používá správného podávajícího po bodech",()=>{// A silný podavač: při 0-0 (A podává) > při 0-0 kdy začíná B
 const f=(a,b)=>T.tbWin(.8,.6,a,b,true,7);
 close(f(0,0),.8*f(1,0)+.2*f(0,1));      // bod 1 podává A (p=.8)
 close(f(1,0),.4*f(2,0)+.6*f(1,1));      // bod 2 podává B (A vyhraje s 1-.6)
 close(f(1,1),.4*f(2,1)+.6*f(1,2));      // bod 3 podává B
 close(f(2,1),.8*f(3,1)+.2*f(2,2))});    // bod 4 podává A
test("TB typ: 10 bodů jen GS rozhodující set",()=>{
 assert.equal(T.tbTarget({bo:5,slam:true},2,2),10);assert.equal(T.tbTarget({bo:5,slam:true},1,1),7);assert.equal(T.tbTarget({bo:5,slam:true},2,1),7);
 assert.equal(T.tbTarget({bo:3,slam:true},1,1),10);   // ženy GS 3. set
 assert.equal(T.tbTarget({bo:3,slam:false},1,1),7);   // ATP/WTA/Challenger/ITF
 assert.equal(T.tbTarget({bo:5,slam:false},2,2),7);
 const ev=(slam,bo)=>({homeScore:{period1:6,period2:4,period3:6,point:"8"},awayScore:{period1:4,period2:6,period3:6,point:"7"},firstToServe:1,slam,bo});
 assert.equal(T.liveState(ev(true,3)).tbTo,10);assert.equal(T.liveState(ev(false,3)).tbTo,7);
 // 8:7 v 10bodovém TB není konec, v 7bodovém by po dalším bodu skončil – model musí rozlišit
 const a=T.inPlay(.65,.65,T.liveState(ev(true,3))).match,b=T.inPlay(.65,.65,T.liveState(ev(false,3))).match;assert.ok(a<b,`${a} ${b}`)});
test("Saabas příspěvky GBM sedí na raw skóre",()=>{
 const D=JSON.parse(require("fs").readFileSync(__dirname+"/../web/data/atp.json"));const I=T.nameIndex(D.players);
 const a=D.players[T.findPlayer(I,"Jannik Sinner")],b=D.players[T.findPlayer(I,"Carlos Alcaraz")];
 const c={surface:"Hard",date:20261023,bo:3,level:2,h2h:[5,10]};const x=T.gbFeatures(a,b,c);const r=T.gbContrib(D.gbm,x);
 assert.ok(Math.abs(r.bias+r.c.reduce((s,v)=>s+v,0)-T.gbRaw(D.gbm,x))<1e-9);
 const e=T.explainGB(D,a,b,c);assert.ok(e.length>=8&&e.every(f=>Number.isFinite(f.v)));
 const e2=T.explainGB(D,b,a,{...c,h2h:[10,5]});const m=new Map(e2.map(f=>[f.k,f.v]));e.forEach(f=>assert.ok(Math.abs(f.v+m.get(f.k))<1e-9))});
test("de-vig + value tip přežije stažení k trhu",()=>{const d=T.devig(1.5,2.6);assert.ok(Math.abs(d[0]+d[1]-1)<1e-9&&d[2]>0);
 assert.equal(T.valueTip(.62,[1.5,2.6]),null);           // model blízko trhu → nic
 const t=T.valueTip(.85,[1.5,2.6]);assert.ok(t&&t.side===0&&t.ev>.03);
 assert.equal(T.valueTip(.5,[1.9,1.9]),null);assert.ok(T.valueTip(.35,[1.9,1.9]).side===1)});
test("pbpSeries: průběh z point-by-point",()=>{const G=[];// A drží, B drží ... A brejkne v 3. gamu
 const hold=(srv,h,a)=>({set:1,game:G.length+1,h,a,serving:srv,scoring:srv,points:[["15","0"],["30","0"],["40","0"],["0","0"]].map(x=>srv===1?x:[x[1],x[0]])});
 G.push(hold(1,1,0));G.push(hold(2,1,1));G.push({set:1,game:3,h:2,a:1,serving:1,scoring:1,points:[["15","0"]]});G[2].serving=2;G[2].points=[["15","0"],["30","0"],["40","0"],["0","0"]];
 const s=T.pbpSeries(.64,.64,G,3,false);assert.ok(s.length>10);assert.ok(Math.abs(s[0].p-.5)<.02);const b=s.find(x=>x.ev==="break");assert.ok(b&&b.p>.6,JSON.stringify(b));
 s.forEach(x=>assert.ok(x.p>=0&&x.p<=1))});
test("in-play ML korekce + PBP vítězové bodů",()=>{assert.ok(Math.abs(T.inplayML(.5,.5)-.5)<.01);
 assert.ok(T.inplayML(.6,.6,{mom20:.2,men:true})>T.inplayML(.6,.6,{mom20:-.2,men:true}));
 assert.ok(T.inplayML(.6,.6,{swA:40,stA:50,swB:25,stB:50})>T.inplayML(.6,.6));assert.equal(T.inplayML(1,.3),1);
 const w=T.pbpWinners([{set:1,game:1,h:1,a:0,serving:1,scoring:1,points:[["15","0"],["15","15"],["30","15"],["40","15"]]},{set:1,game:2,h:1,a:0,serving:2,scoring:-1,points:[["0","15"],["15","15"]]}]);
 assert.deepEqual(w,[1,0,1,1,1,0,1])});
test("rankPrior: Elo z žebříčku, bez žebříčku 1450, monotónní",()=>{const a=TM.rankPrior("X",10),b=TM.rankPrior("Y",500),c=TM.rankPrior("Z",null);
 assert.ok(a.e>b.e&&b.e>=1350&&a.e<=1900);assert.equal(c.e,1450);assert.ok(a.prior&&a.s.Clay===a.e)});
