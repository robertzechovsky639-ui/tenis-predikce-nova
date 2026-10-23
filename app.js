const SN={Hard:"Tvrdý",Clay:"Antuka",Grass:"Tráva"};let D=null,byName={};
const $=id=>document.getElementById(id);
const ep=(a,b)=>1/(1+Math.pow(10,(b-a)/400)),lg=p=>{p=Math.min(Math.max(p,1e-6),1-1e-6);return Math.log(p/(1-p))};
const fd=d=>{d=String(d);return d.slice(6,8)+"."+d.slice(4,6)+"."+d.slice(0,4)};
const form=p=>p.f.length?p.f.reduce((a,b)=>a+b,0)/p.f.length:.5;
function predict(a,b,s){const c=D.coef,x=[lg(ep(a.e,b.e)),lg(ep(a.s[s],b.s[s])),form(a)-form(b)];
 const z=c[0]+c[1]*x[0]+c[2]*x[1]+c[3]*x[2];return 1/(1+Math.exp(-z));}
async function load(t){$("meta").innerHTML="<small>Načítám…</small>";D=await (await fetch("data/"+t+".json")).json();byName={};
 const opts=D.players.map((p,i)=>[p,i]).filter(([p])=>p.m>=5).sort((a,b)=>b[0].e-a[0].e);
 opts.forEach(([p,i])=>byName[p.n]=i);$("pl").innerHTML=opts.map(([p])=>`<option value="${p.n}">`).join("");
 const m=D.metrics;$("meta").innerHTML=`<b>Model</b>: Elo podle povrchu + celkové Elo + forma (posl. 10 zápasů), kalibrace logistickou regresí.<br>
 Test (zápasy od ${m.test_from}, n=${m.model.n}): Brier <b>${m.model.brier.toFixed(4)}</b>, log-loss <b>${m.model.logloss.toFixed(4)}</b>, přesnost ${(m.model.accuracy*100).toFixed(1)} %
 <small>(samotné Elo: Brier ${m.raw_overall_elo.brier.toFixed(4)}, log-loss ${m.raw_overall_elo.logloss.toFixed(4)})</small><br><small>Data: Jeff Sackmann tennis_${D.tour}, 2015 – ${fd(D.data_through)}</small>`;render();}
function render(){const i=byName[$("p1").value],j=byName[$("p2").value],s=$("surf").value;
 if(i==null||j==null||i===j){$("out").innerHTML='<div class="card"><small>Vyberte dva různé hráče ze seznamu.</small></div>';return}
 const a=D.players[i],b=D.players[j],p=predict(a,b,s),pc=(p*100).toFixed(1),qc=(100-p*100).toFixed(1);
 const h=D.matches.filter(m=>(m[1]===i&&m[2]===j)||(m[1]===j&&m[2]===i)).reverse();const hw=h.filter(m=>m[1]===i).length;
 const rec=k=>D.matches.filter(m=>m[1]===k||m[2]===k).slice(-10).reverse();
 const fr=(k,pl)=>`<td>${pl.n}</td><td>${pl.f.slice().reverse().map(r=>`<span class="${r?"W":"L"}">${r?"V":"P"}</span>`).join(" ")}</td><td>${(form(pl)*100).toFixed(0)} %</td>`;
 const recT=k=>`<table>${rec(k).map(m=>`<tr><td>${fd(m[0])}</td><td class="${m[1]===k?"W":"L"}">${m[1]===k?"V":"P"}</td><td>${D.players[m[1]===k?m[2]:m[1]].n}</td><td>${m[4]}</td><td><small>${m[5]} (${SN[m[3]]})</small></td></tr>`).join("")}</table>`;
 $("out").innerHTML=`<div class="card"><h2>Pravděpodobnost výhry – ${SN[s]}</h2><div class="bar"><div style="width:${pc}%;background:#2e7d32">${a.n} ${pc} %</div><div style="width:${qc}%;background:#1565c0">${qc} % ${b.n}</div></div></div>
 <div class="card"><h3>Elo hodnocení</h3><table><tr><th>Hráč</th><th>Celkové</th><th>Tvrdý</th><th>Antuka</th><th>Tráva</th><th>Zápasů</th></tr>
 ${[a,b].map(x=>`<tr><td>${x.n}</td><td><b>${x.e.toFixed(0)}</b></td>${["Hard","Clay","Grass"].map(z=>`<td>${x.s[z].toFixed(0)} <small>(${x.sm[z]})</small></td>`).join("")}<td>${x.m}</td></tr>`).join("")}</table></div>
 <div class="card"><h3>Vzájemné zápasy: ${a.n} ${hw} – ${h.length-hw} ${b.n}</h3>${h.length?`<table>${h.map(m=>`<tr><td>${fd(m[0])}</td><td><b>${D.players[m[1]].n}</b></td><td>${m[4]}</td><td><small>${m[5]} ${m[6]} (${SN[m[3]]})</small></td></tr>`).join("")}</table>`:"<small>Žádné vzájemné zápasy od 2015.</small>"}</div>
 <div class="card"><h3>Aktuální forma (posl. 10)</h3><table><tr>${fr(i,a)}</tr><tr>${fr(j,b)}</tr></table>
 <div class="row"><div><h4>${a.n}</h4>${recT(i)}</div><div><h4>${b.n}</h4>${recT(j)}</div></div></div>`;}
["p1","p2","surf"].forEach(x=>$(x).addEventListener("input",render));
$("tour").addEventListener("change",e=>{$("p1").value=$("p2").value="";load(e.target.value)});
load("atp").then(()=>{const t=Object.keys(byName);$("p1").value=t[0];$("p2").value=t[1];render()});
