"""Dohrané zápasy ATP/WTA/Challenger ze Sofascore pro zadané dny -> data/sofa_recent.csv (formát jako Sackmann)."""
import csv, json, sys, time, urllib.request, datetime as dt
CATS = {3: "atp", 6: "wta", 72: "challenger"}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20) as r: return json.load(r)
start = dt.date.fromisoformat(sys.argv[1]); end = dt.date.fromisoformat(sys.argv[2])
rows = []; seen = set()
d = start
while d <= end:
    for c, cat in CATS.items():
        try: evs = get(f"https://api.sofascore1.com/api/v1/category/{c}/scheduled-events/{d}").get("events", [])
        except Exception as e: print("fail", d, c, e); continue
        for e in evs:
            if e["status"]["type"] != "finished" or e.get("winnerCode") not in (1, 2) or e["id"] in seen: continue
            if e["homeTeam"].get("type") == 2 or "/" in e["homeTeam"]["name"]: continue
            if e["tournament"]["category"]["id"] != c: continue
            seen.add(e["id"]); h, a = e["homeScore"], e["awayScore"]
            w, l = (e["homeTeam"], e["awayTeam"]) if e["winnerCode"] == 1 else (e["awayTeam"], e["homeTeam"])
            ws, ls_ = (h, a) if e["winnerCode"] == 1 else (a, h)
            sets = []
            for i in range(1, 6):
                if ws.get(f"period{i}") is None: break
                sets.append(f"{ws[f'period{i}']}-{ls_[f'period{i}']}")
            st = e["status"].get("description", "")
            score = " ".join(sets) + (" RET" if st.lower().startswith("retired") or e["status"]["code"] in (92,) else "") + (" W/O" if not sets else "")
            g = (e.get("groundType") or "").lower(); surf = "Clay" if "clay" in g else "Grass" if "grass" in g else "Hard"
            day = dt.datetime.fromtimestamp(e["startTimestamp"], dt.timezone.utc).strftime("%Y%m%d")
            rows.append({"tour": "wta" if cat == "wta" else "atp", "level": "C" if cat == "challenger" else "T", "tourney_id": f"sofa-{e['tournament'].get('uniqueTournament',{}).get('id','')}-{day[:6]}",
                "tourney_name": e["tournament"]["name"], "surface": surf, "tourney_date": day, "match_num": str(e["id"] % 100000), "winner_id": "", "winner_name": w["name"],
                "loser_id": "", "loser_name": l["name"], "score": score, "round": (e.get("roundInfo") or {}).get("name", "")})
        time.sleep(0.3)
    d += dt.timedelta(days=1)
with open("data/sofa_recent.csv", "w", newline="", encoding="utf-8") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)
print(len(rows), "zápasů")
