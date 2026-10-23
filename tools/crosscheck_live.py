"""Křížová kontrola živého skóre Sofascore vs ESPN vs 365scores. Běží N minut, každou minutu. Výstup JSON."""
import json, sys, time, unicodedata, urllib.request
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r: return json.load(r)
n = lambda s: " ".join(unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().replace("-", " ").split())
def last(s): return n(s).split()[-1] if s else ""
def sofa():
    out = {}
    for e in get("https://api.sofascore1.com/api/v1/sport/tennis/events/live")["events"]:
        if "/" in e["homeTeam"]["name"]: continue
        h, a = e["homeScore"], e["awayScore"]; sets = [(h.get(f"period{i}"), a.get(f"period{i}")) for i in range(1, 6) if h.get(f"period{i}") is not None]
        out[frozenset([last(e["homeTeam"]["name"]), last(e["awayTeam"]["name"])])] = {"home": e["homeTeam"]["name"], "sets": sets, "setsWon": (h.get("current"), a.get("current")), "point": (h.get("point"), a.get("point")), "status": e["status"]["description"], "chg": (e.get("changes") or {}).get("changeTimestamp")}
    return out
def espn():
    out = {}
    for t in ("atp", "wta"):
        for ev in get(f"https://site.api.espn.com/apis/site/v2/sports/tennis/{t}/scoreboard").get("events", []):
            for g in ev.get("groupings", []):
                for c in g.get("competitions", []):
                    if c["status"]["type"]["state"] != "in": continue
                    cs = sorted(c["competitors"], key=lambda x: x["order"])
                    if len(cs) != 2 or "athlete" not in cs[0]: continue
                    sets = [(int(x["value"]), int(y["value"])) for x, y in zip(cs[0].get("linescores", []), cs[1].get("linescores", []))]
                    out[frozenset([last(cs[0]["athlete"]["displayName"]), last(cs[1]["athlete"]["displayName"])])] = {"home": cs[0]["athlete"]["displayName"], "sets": sets}
    return out
def s365():
    out = {}
    for g in get("https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=1&timezoneName=Europe%2FPrague&userCountryId=1&sports=3").get("games", []):
        if g.get("statusGroup") != 3 or "/" in g["homeCompetitor"]["name"]: continue
        out[frozenset([last(g["homeCompetitor"]["name"]), last(g["awayCompetitor"]["name"])])] = {"home": g["homeCompetitor"]["name"], "setsWon": (g["homeCompetitor"].get("score"), g["awayCompetitor"].get("score"))}
    return out
mins = int(sys.argv[1]) if len(sys.argv) > 1 else 10; log = []
for i in range(mins):
    snap = {"t": time.time()}
    for name, f in (("sofascore", sofa), ("espn", espn), ("365", s365)):
        try: snap[name] = f()
        except Exception as e: snap[name] = {}; snap[name + "_err"] = str(e)
    S = snap["sofascore"]; cmp = {"t": snap["t"], "n_sofa": len(S), "n_espn": len(snap["espn"]), "n_365": len(snap["365"]), "both_espn": 0, "both_365": 0, "mismatch": []}
    for k, v in snap["espn"].items():
        if k in S:
            cmp["both_espn"] += 1; s = S[k]; flip = last(s["home"]) != last(v["home"])
            es = [(b, a) for a, b in v["sets"]] if flip else v["sets"]
            if [tuple(x) for x in es] != [tuple(x) for x in s["sets"]]: cmp["mismatch"].append({"src": "espn", "match": sorted(k), "sofa": s["sets"], "other": es, "status": s["status"]})
    for k, v in snap["365"].items():
        if k in S:
            cmp["both_365"] += 1; s = S[k]; flip = last(s["home"]) != last(v["home"]); o = tuple(reversed(v["setsWon"])) if flip else tuple(v["setsWon"])
            if tuple(s["setsWon"]) != o: cmp["mismatch"].append({"src": "365", "match": sorted(k), "sofa": s["setsWon"], "other": o, "status": s["status"]})
    for x in ("espn_err", "365_err", "sofascore_err"):
        if x in snap: cmp[x] = snap[x]
    log.append(cmp); print(json.dumps({k: v for k, v in cmp.items() if k != "mismatch"}), len(cmp["mismatch"]), flush=True)
    json.dump(log, open("/workspace/tennis-predict-new/tools/crosscheck_log.json", "w"), indent=1, default=list)
    if i < mins - 1: time.sleep(60)
