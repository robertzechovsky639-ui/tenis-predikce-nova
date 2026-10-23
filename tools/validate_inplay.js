// validace in-play modelu na Sackmann slam PBP: Brier podle stavu zápasu
const T=require("../web/model.js");const M=JSON.parse(require("fs").readFileSync("/tmp/pbp.json"));
const STEP=+process.argv[2]||4;const B={};const add=(k,p,y)=>{const b=B[k]||(B[k]={n:0,s:0,ll:0});b.n++;b.s+=(p-y)**2;b.ll-=Math.log(Math.max(1e-6,y?p:1-p))};
for(const m of M){const avg=m.men?.64:.565;const slam=true;
 const [cA,cB]=T.calibrateServe(avg,avg,m.p,m.bo);const tag=m.men?"muži":"ženy";const rec=m.y>=2022;
 add(`${tag}|0 před zápasem`,m.p,m.win);let wA=0,tA=0,wB=0,tB=0;
 m.pts.forEach((q,i)=>{const [pw,srvA,sa,sb,ga,gb,pa0,pb0,tbf]=q;if(Math.max(sa,sb)>=(m.bo===5?3:2))return;
  const need=m.bo===5?3:2;const dec=sa===need-1&&sb===need-1;
  const ok=!(ga>6||gb>6)&&!(dec&&ga===6&&gb===6&&!rec);
  const setStart=ga===0&&gb===0&&pa0===0&&pb0===0;
  if(ok&&(setStart||i%STEP===0)){let pa=pa0,pb=pb0;const tb=ga===6&&gb===6;if(!tb)while(pa>=3&&pb>=3&&pa+pb>6){pa--;pb--}
   const st={sa,sb,ga,gb,pa,pb,aServes:tb?tbf===1:srvA===1,bo:m.bo,slam};
   let p1;try{p1=T.inPlay(cA,cB,st).match}catch(e){console.log("ERR",m.id,i,JSON.stringify(st),cA,cB);process.exit(1)}
   const bA=T.bayes(cA,wA,tA),bB=T.bayes(cB,wB,tB);const p2=T.inPlay(bA,bB,st).match;
   const k=tb?"4 tiebreak":setStart?`1 začátek setu ${sa}:${sb}`:(ga+gb>=8?"3 konec setu (8+ gemů)":"2 v setu");
   for(const [v,p] of [["statický",p1],["bayes",p2]]){add(`${tag}|${k}|${v}`,p,m.win);add(`${tag}|všechny body|${v}`,p,m.win);if(rec)add(`${tag}|2022+ všechny body|${v}`,p,m.win)}}
  if(srvA){tA++;wA+=pw}else{tB++;wB+=1-pw}})}
const R={};for(const k of Object.keys(B).sort()){const b=B[k];R[k]={n:b.n,brier:+(b.s/b.n).toFixed(4),logloss:+(b.ll/b.n).toFixed(4)};console.log(k.padEnd(48),b.n.toString().padStart(7),(b.s/b.n).toFixed(4),(b.ll/b.n).toFixed(4))}
require("fs").writeFileSync(__dirname+"/inplay_validation.json",JSON.stringify({matches:M.length,step:STEP,results:R},null,1));
