# připraví data pro validaci in-play modelu na Sackmann slam point-by-point (2011–2024)
import csv,glob,json,math,os,re,unicodedata
from collections import defaultdict
P="/workspace/tennis-app/raw/sackmann/slam_pointbypoint/"
norm=lambda s:re.sub(r"[^a-z ]","",unicodedata.normalize("NFKD",s).encode("ascii","ignore").decode().lower().replace("-"," ")).strip()
SL={"Australian Open":"ausopen","Roland Garros":"frenchopen","Wimbledon":"wimbledon","Us Open":"usopen","US Open":"usopen"}
pre={}
for tour in ("atp","wta"):
    E=defaultdict(lambda:1500.); N=defaultdict(int); rows=[]
    for f in sorted(glob.glob(f"data/{tour}_*.csv")): rows+=list(csv.DictReader(open(f,encoding="utf-8",errors="ignore")))
    rows.sort(key=lambda r:(r["tourney_date"],int(r.get("match_num") or 0)))
    for r in rows:
        sc=r.get("score","")
        if "W/O" in sc or "RET" in sc or "DEF" in sc or not r["winner_name"]: continue
        w,l=norm(r["winner_name"]),norm(r["loser_name"]); p=1/(1+10**((E[l]-E[w])/400))
        t=r["tourney_name"]; y=r["tourney_date"][:4]
        if t in SL and int(y)>=2011: pre[(y,SL[t],w,l)]=p
        kw=250/((N[w]+5)**.4); kl=250/((N[l]+5)**.4); E[w]+=kw*(1-p); E[l]-=kl*(1-p); N[w]+=1; N[l]+=1
out=[]
for mf in sorted(glob.glob(P+"*-matches.csv")):
    if "doubles" in mf or "mixed" in mf: continue
    y,sl=os.path.basename(mf).split("-")[:2]; pf=mf.replace("matches","points")
    if not os.path.exists(pf): continue
    M={r["match_id"]:r for r in csv.DictReader(open(mf,encoding="utf-8",errors="ignore"))}
    pts=defaultdict(list)
    for r in csv.DictReader(open(pf,encoding="utf-8",errors="ignore")):
        if r.get("PointWinner") in ("1","2"): pts[r["match_id"]].append(r)
    for mid,R in pts.items():
        m=M.get(mid); 
        if not m: continue
        t=mid.split("-")[-1]
        if t[:2] in ("MS","WS"): men=t[:2]=="MS"
        elif t.isdigit() and int(t)<3000: men=int(t)<2000
        else: continue
        a,b=norm(m["player1"]),norm(m["player2"]); bo=5 if men else 3; need=3 if men else 2
        if (y,sl,a,b) in pre: p=pre[(y,sl,a,b)]; win=1
        elif (y,sl,b,a) in pre: p=1-pre[(y,sl,b,a)]; win=0
        else: continue
        sa=sb=ga=gb=pa=pb=0; tbf=None; S=[]; ok=True
        for r in R:
            srv=r["PointServer"]
            if srv not in ("1","2"): ok=False; break
            tb=ga==6 and gb==6
            if tb and tbf is None: tbf=srv=="1"
            S.append([1 if r["PointWinner"]=="1" else 0,1 if srv=="1" else 0,sa,sb,ga,gb,pa,pb,(1 if tbf else 0) if tb else -1])
            if r["PointWinner"]=="1": pa+=1
            else: pb+=1
            if r["SetWinner"] in ("1","2"):
                sa+=r["SetWinner"]=="1"; sb+=r["SetWinner"]=="2"; ga=gb=pa=pb=0; tbf=None
            elif r["GameWinner"] in ("1","2"):
                ga+=r["GameWinner"]=="1"; gb+=r["GameWinner"]=="2"; pa=pb=0; tbf=None
        if not ok or max(sa,sb)!=need or (sa==need)!=(win==1): continue   # neúplné / skreč
        out.append(dict(id=mid,y=int(y),sl=sl,men=men,bo=bo,p=p,win=win,pts=S))
json.dump(out,open("/tmp/pbp.json","w"))
print(len(out),"zápasů",sum(len(o["pts"]) for o in out),"bodů",sum(o["men"] for o in out),"muži")
