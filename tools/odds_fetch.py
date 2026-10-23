# Sofascore: dokončené singlové zápasy + kurzy (featured, otevírací/uzavírací) pro backtest blendu s trhem
import json,urllib.request,concurrent.futures as cf,datetime as dt,sys
SS="https://api.sofascore1.com/api/v1"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=20) as r: return json.load(r)
CATS={"atp":"atp","wta":"wta","challenger":"atp","wta-125":"wta"}
d0,d1=sys.argv[1],sys.argv[2]; ev={}
d=dt.date.fromisoformat(d0)
while d<=dt.date.fromisoformat(d1):
    evs=[]
    for cid in (3,6,72,871):
        try: evs+=get(f"{SS}/category/{cid}/scheduled-events/{d}")["events"]
        except Exception as x: print(d,cid,x)
    for e in evs:
        c=e["tournament"]["category"].get("slug")
        if c not in CATS or "/" in e["homeTeam"]["name"] or e["status"]["type"]!="finished" or e.get("winnerCode") not in (1,2): continue
        if any(k in e["status"].get("description","").lower() for k in ("retired","walkover")): continue
        ev[e["id"]]=dict(id=e["id"],date=int(dt.datetime.utcfromtimestamp(e["startTimestamp"]).strftime("%Y%m%d")),tour=CATS[c],cat=c,home=e["homeTeam"]["name"],away=e["awayTeam"]["name"],
            win=1 if e["winnerCode"]==1 else 0,tourney=e["tournament"]["name"],ground=e.get("groundType",""),rk=[e["homeTeam"].get("ranking"),e["awayTeam"].get("ranking")])
    d+=dt.timedelta(days=1)
def odds(i):
    try:
        ch=get(f"{SS}/event/{i}/odds/1/featured")["featured"]["default"]["choices"]
        f=lambda s:(lambda a,b:a/b+1)(*map(float,s.split("/")))
        return i,[f(ch[0]["fractionalValue"]),f(ch[1]["fractionalValue"])]
    except Exception: return i,None
with cf.ThreadPoolExecutor(8) as ex:
    for i,o in ex.map(odds,list(ev)): ev[i]["odds"]=o
L=[v for v in ev.values() if v.get("odds")]; json.dump(L,open("/tmp/odds_events.json","w"))
print(len(ev),"zápasů,",len(L),"s kurzy")
