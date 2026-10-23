// Validace predikce aktuálního gemu (udrží/brejk) a tiebreaku na slam PBP (Sackmann). Train <2022 (empirické baseline), test 2022+.
const T=require("../web/model.js"),fs=require("fs");const M=JSON.parse(fs.readFileSync("/tmp/pbp.json"));
const K=+process.env.K||30;const R={};const add=(k,p,y)=>{(R[k]??=[0,0,0]);const c=Math.min(1-1e-6,Math.max(1e-6,p));R[k][0]+=(c-y)**2;R[k][1]-=y?Math.log(c):Math.log(1-c);R[k][2]++};
const emp={};// empirická hold rate podle (men, stav bodů) z train let
const games=[];
for(const m of M){const avg=m.men?.64:.565;const [cA,cB]=T.calibrateServe(avg,avg,m.p,m.bo);let wA=0,tA=0,wB=0,tB=0;let cur=null;
 m.pts.forEach((q,i)=>{const [pw,srvA,sa,sb,ga,gb,pa0,pb0,tbf]=q;const key=[sa,sb,ga,gb].join();
  if(!cur||cur.key!==key){if(cur)games.push(cur);cur={key,men:m.men,y:m.y,tb:ga===6&&gb===6,states:[],tbf,cA,cB,bo:m.bo}}
  const tb=cur.tb;let pa=pa0,pb=pb0;if(!tb)while(pa>=3&&pb>=3&&pa+pb>6){pa--;pb--}
  cur.states.push({srvA,pa,pb,wA,tA,wB,tB});cur.last=pw;cur.lastSrvA=srvA;
  if(srvA){tA++;wA+=pw}else{tB++;wB+=1-pw}});if(cur)games.push(cur)}
const live=(prior,w,t)=>(prior*K+w)/(K+t);
for(const g of games){if(g.states.length<2&&!g.tb)continue;// poslední zápasový gem bez dalšího stavu je OK, ale vyřaď neúplné
 if(g.tb){const aStart=g.tbf===1;const yA=g.last;// vítěz posledního bodu TB vyhrál TB
  g.states.forEach((s,i)=>{const [sa,sb]=g.key.split(',').map(Number),nd=g.bo===5?3:2;const T7=sa===nd-1&&sb===nd-1?10:7;const st=i===0?"tb_start":"tb_mid";if(g.y<2022)return;
   const pA=live(g.cA,s.wA,s.tA),pB=live(g.cB,s.wB,s.tB);add(st+"_model",T.tbWin(g.cA,g.cB,s.pa,s.pb,aStart,T7),yA);add(st+"_model_live",T.tbWin(pA,pB,s.pa,s.pb,aStart,T7),yA);
   add(st+"_naive_pts",T.tbWin(.5+.0,.5,s.pa,s.pb,aStart,T7)*0+(s.pa>s.pb?.5+.08*(s.pa-s.pb):s.pa<s.pb?.5-.08*(s.pb-s.pa):.5),yA)});continue}
 const srvA=g.states[0].srvA;const hold=srvA?g.last:1-g.last;
 g.states.forEach((s,i)=>{const sp=srvA?s.pa:s.pb,rp=srvA?s.pb:s.pa;const k=(g.men?"m":"w")+sp+"-"+rp;
  if(g.y<2022){(emp[k]??=[0,0]);emp[k][0]+=hold;emp[k][1]++;return}
  const prior=srvA?g.cA:g.cB,pl=srvA?live(g.cA,s.wA,s.tA):live(g.cB,s.wB,s.tB);const st=i===0?"start":"mid";const bp=rp>=3&&rp>sp;
  g._t=g._t||[];g._t.push([st,bp,k,prior,pl,sp,rp,hold])})}
const avgHold=men=>{const e=emp[(men?"m":"w")+"0-0"];return e[0]/e[1]};
for(const g of games)for(const [st,bp,k,prior,pl,sp,rp,y] of g._t||[]){const e=emp[k];const ne=e&&e[1]>50?e[0]/e[1]:avgHold(g.men);
 for(const sub of [st,...(bp?["breakpoint"]:[]),"all"]){add(sub+"_naive_const",avgHold(g.men),y);add(sub+"_naive_score",ne,y);add(sub+"_model",T.gameWin(prior,sp,rp),y);add(sub+"_model_live",T.gameWin(pl,sp,rp),y)}}
const out={K,test:"2022+",train_baseline:"<2022",hold_rate_m:+avgHold(true).toFixed(4),hold_rate_w:+avgHold(false).toFixed(4)};
for(const [k,[b,l,n]] of Object.entries(R).sort())out[k]={n,brier:+(b/n).toFixed(5),logloss:+(l/n).toFixed(5)};
console.log(JSON.stringify(out,null,1));fs.writeFileSync(__dirname+"/game_validation.json",JSON.stringify(out,null,1));
