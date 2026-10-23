// vygeneruje trénovací data pro ML in-play model (Sackmann slam PBP): analytická p + stav + momentum + živé statistiky
const T=require("../web/model.js");const M=JSON.parse(require("fs").readFileSync("/tmp/pbp.json"));const STEP=+process.argv[2]||3;
const out=["y,year,men,match,pre,ana,sa,sb,ga,gb,pa,pb,srvA,tb,dec,mom20,mom50,swA,stA,swB,stB,npts"];
for(const m of M){const avg=m.men?.64:.565;const [cA,cB]=T.calibrateServe(avg,avg,m.p,m.bo);const need=m.bo===5?3:2;const rec=m.y>=2022;let wA=0,tA=0,wB=0,tB=0;const hist=[];
 m.pts.forEach((q,i)=>{const [pw,srvA,sa,sb,ga,gb,pa0,pb0,tbf]=q;
  if(Math.max(sa,sb)<need){const dec=sa===need-1&&sb===need-1;const ok=!(ga>6||gb>6)&&!(dec&&ga===6&&gb===6&&!rec);
   if(ok&&i%STEP===0){let pa=pa0,pb=pb0;const tb=ga===6&&gb===6;if(!tb)while(pa>=3&&pb>=3&&pa+pb>6){pa--;pb--}
    const ana=T.inPlay(cA,cB,{sa,sb,ga,gb,pa,pb,aServes:tb?tbf===1:srvA===1,bo:m.bo,slam:true}).match;
    const mo=k=>{const h=hist.slice(-k);return h.length?h.reduce((s,x)=>s+x,0)/h.length-.5:0};
    out.push([m.win,m.y,m.men?1:0,m.id,m.p.toFixed(5),ana.toFixed(6),sa,sb,ga,gb,pa,pb,srvA,tb?1:0,dec?1:0,mo(20).toFixed(3),mo(50).toFixed(3),wA,tA,wB,tB,i].join(","))}}
  hist.push(pw);if(srvA){tA++;wA+=pw}else{tB++;wB+=1-pw}})}
require("fs").writeFileSync("/tmp/inplay.csv",out.join("\n"));console.log(out.length-1);
