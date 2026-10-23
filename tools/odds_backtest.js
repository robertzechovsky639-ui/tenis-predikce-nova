// Backtest: model (data do MAXDATE) vs trh (de-vig) vs blend na zápasech po MAXDATE. node tools/odds_backtest.js /tmp/bt_data /tmp/odds_events.json
const fs=require("fs"),TM=require("../web/model.js");const [dir,evf]=process.argv.slice(2);
const DB={},IX={};for(const t of["atp","wta"]){DB[t]=JSON.parse(fs.readFileSync(dir+"/"+t+".json"));DB[t].matches=JSON.parse(fs.readFileSync(dir+"/"+t+"_m.json")).matches;IX[t]=TM.nameIndex(DB[t].players)}
const getP=(t,n)=>{const i=TM.findPlayer(IX[t],n);return i==null?null:DB[t].players[i]};
const ev=JSON.parse(fs.readFileSync(evf));const R=[];
for(const e of ev){const known=getP(e.tour,e.home)&&getP(e.tour,e.away);let a=getP(e.tour,e.home)||TM.rankPrior(e.home,e.rk[0]),b=getP(e.tour,e.away)||TM.rankPrior(e.away,e.rk[1]);if(!a||!b)continue;
 const lvl=/australian open|roland garros|wimbledon|us open/i.test(e.tourney)?4:/challenger|125/.test(e.cat)?1:2;
 const p=TM.predictBest(DB[e.tour],a,b,{surface:TM.surfaceOf(e.ground),date:e.date,bo:3,level:lvl,h2h:[0,0]});if(!isFinite(p))continue;
 const q=(1/e.odds[0])/((1/e.odds[0])+(1/e.odds[1]));R.push({p,q,y:e.win,known:!!known,ch:lvl===1})}
const lg=x=>Math.log(x/(1-x)),sg=z=>1/(1+Math.exp(-z)),cl=x=>Math.min(1-1e-6,Math.max(1e-6,x));
const met=(L,f)=>{let b=0,l=0,a=0;for(const r of L){const x=cl(f(r));b+=(x-r.y)**2;l-=r.y?Math.log(x):Math.log(1-x);a+=(x>.5)===(r.y===1)}const n=L.length;return {n,brier:+(b/n).toFixed(4),logloss:+(l/n).toFixed(4),acc:+(a/n*100).toFixed(1)}};
const out={};for(const [k,L] of Object.entries({all:R,known:R.filter(r=>r.known),prior:R.filter(r=>!r.known),challenger:R.filter(r=>r.ch),main:R.filter(r=>!r.ch)})){if(!L.length)continue;
 out[k]={model:met(L,r=>r.p),market:met(L,r=>r.q)};for(const w of[.3,.5,.7])out[k]["blend_w"+w]=met(L,r=>sg((1-w)*lg(cl(r.p))+w*lg(cl(r.q))))}
console.log(JSON.stringify(out,null,1));fs.writeFileSync(__dirname+"/odds_backtest_results.json",JSON.stringify(out,null,1));
