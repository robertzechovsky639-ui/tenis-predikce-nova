"""Doplnění čerstvých výsledků s automatickým failoverem mezi 3+ zdroji.
Pořadí: Sackmann (GitHub) -> TennisMyLife (stats.tennismylife.org) -> Sofascore -> ESPN.
Každý zdroj pokryje co umí; zbylý konec intervalu doplní další zdroj. Test: FAIL_SOURCES=tml,sofascore python3 fetch_recent.py
Výstup: data/recent.csv (+ data/recent_sources.json)."""
import csv, io, json, os, sys, time, urllib.request, datetime as dt
FAIL = set(filter(None, os.environ.get("FAIL_SOURCES", "").split(",")))
FROM = os.environ.get("FROM", "20260525"); TODAY = dt.date.today()
COLS = ["tour","level","tourney_id","tourney_name","surface","tourney_date","match_num","winner_id","winner_name","loser_id","loser_name","score","round",
        "w_ace","w_df","w_svpt","w_1stIn","w_1stWon","w_2ndWon","w_SvGms","l_ace","l_df","l_svpt","l_1stIn","l_1stWon","l_2ndWon","l_SvGms","winner_ioc","loser_ioc","winner_hand","loser_hand","winner_ht","loser_ht","winner_rank","loser_rank"]
def get(u, t=25):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=t) as r: return r.read()
def days(a, b):
    d = dt.date(int(a[:4]), int(a[4:6]), int(a[6:])); e = dt.date(int(b[:4]), int(b[4:6]), int(b[6:]))
    while d <= e: yield d; d += dt.timedelta(days=1)
def csv_rows(raw, tour, level):
    out = []
    for r in csv.DictReader(io.StringIO(raw.decode("utf-8", "ignore"))):
        if r.get("winner_name") and r.get("tourney_date", "") > FROM: out.append({**{c: r.get(c, "") for c in COLS}, "tour": tour, "level": level})
    return out
def src_sackmann(a, b):
    out = []
    for t in ("atp", "wta"):
        out += csv_rows(get(f"https://raw.githubusercontent.com/JeffSackmann/tennis_{t}/master/{t}_matches_{a[:4]}.csv"), t, "T")
    return out
def src_tml(a, b):
    out = csv_rows(get("https://stats.tennismylife.org/data/2026.csv"), "atp", "T") + csv_rows(get("https://stats.tennismylife.org/data/2026_wta.csv"), "wta", "T")
    try: out += csv_rows(get("https://stats.tennismylife.org/data/2026_challenger.csv"), "atp", "C")
    except Exception as e: print("  TML challenger:", e)
    return out
def src_sofascore(a, b):
    out = []; seen = set(); ok = 0
    for d in days(a, b):
        for c, cat in ((3, "atp"), (6, "wta"), (72, "challenger")):
            try: evs = json.loads(get(f"https://api.sofascore1.com/api/v1/category/{c}/scheduled-events/{d}", 12)).get("events", []); ok += 1
            except Exception as e: print("  sofascore", d, c, e); continue
            for e in evs:
                if e["status"]["type"] != "finished" or e.get("winnerCode") not in (1, 2) or e["id"] in seen: continue
                if e["homeTeam"].get("type") == 2 or "/" in e["homeTeam"]["name"] or e["tournament"]["category"]["id"] != c: continue
                seen.add(e["id"]); h, aw = e["homeScore"], e["awayScore"]
                W, L, ws, ls_ = (e["homeTeam"], e["awayTeam"], h, aw) if e["winnerCode"] == 1 else (e["awayTeam"], e["homeTeam"], aw, h)
                sets = [f"{ws[f'period{i}']}-{ls_[f'period{i}']}" for i in range(1, 6) if ws.get(f"period{i}") is not None]
                ret = "retired" in e["status"].get("description", "").lower() or e["status"]["code"] in (92, 93)
                g = (e.get("groundType") or "").lower()
                day = dt.datetime.fromtimestamp(e["startTimestamp"], dt.timezone.utc).strftime("%Y%m%d")
                out.append({**{k: "" for k in COLS}, "tour": "wta" if cat == "wta" else "atp", "level": "C" if cat == "challenger" else "T", "tourney_id": f"sofa-{day}",
                    "tourney_name": e["tournament"]["name"], "surface": "Clay" if "clay" in g else "Grass" if "grass" in g else "Hard", "tourney_date": day,
                    "match_num": str(e["id"] % 100000), "winner_name": W["name"], "loser_name": L["name"], "score": " ".join(sets) + (" RET" if ret else "") + ("" if sets else "W/O"), "round": (e.get("roundInfo") or {}).get("name", "")})
    if not ok: raise RuntimeError("sofascore: žádný požadavek neprošel")
    return out
def src_espn(a, b):
    out = []; ok = 0
    for d in days(a, b):
        for t in ("atp", "wta"):
            try: j = json.loads(get(f"https://site.api.espn.com/apis/site/v2/sports/tennis/{t}/scoreboard?dates={d:%Y%m%d}", 12)); ok += 1
            except Exception as e: print("  espn", d, t, e); continue
            for ev in j.get("events", []):
                for g in ev.get("groupings", []):
                    if "singles" not in (g.get("grouping", {}).get("displayName", "").lower()): continue
                    for c in g.get("competitions", []):
                        if not c["status"]["type"].get("completed"): continue
                        cs = c.get("competitors", []); w = [x for x in cs if x.get("winner")]
                        if len(cs) != 2 or len(w) != 1 or "athlete" not in cs[0]: continue
                        W = w[0]; L = cs[0] if cs[1] is W else cs[1]
                        sets = [f"{int(x['value'])}-{int(y['value'])}" for x, y in zip(W.get("linescores", []), L.get("linescores", []))]
                        day = c["date"][:10].replace("-", "")
                        if not (a <= day <= b): continue
                        out.append({**{k: "" for k in COLS}, "tour": t, "level": "T", "tourney_id": f"espn-{day}", "tourney_name": ev["name"], "surface": "Hard", "tourney_date": day,
                            "match_num": str(c["id"])[-5:], "winner_name": W["athlete"]["displayName"], "loser_name": L["athlete"]["displayName"], "score": " ".join(sets), "round": ""})
    if not ok: raise RuntimeError("espn: žádný požadavek neprošel")
    return out
CHAIN = [("sackmann", src_sackmann), ("tml", src_tml), ("sofascore", src_sofascore), ("espn", src_espn)]
def run():
    cursor = FROM; end = (TODAY - dt.timedelta(days=1)).strftime("%Y%m%d"); rows = []; log = []
    for name, fn in CHAIN:
        if cursor >= end: log.append({"source": name, "ok": True, "rows": 0, "note": "nebylo potřeba"}); continue
        start = (dt.datetime.strptime(cursor, "%Y%m%d") + dt.timedelta(days=1)).strftime("%Y%m%d")
        try:
            if name in FAIL: raise RuntimeError("simulovaný výpadek (FAIL_SOURCES)")
            got = [r for r in fn(start, end) if r["tourney_date"] >= start]
            if not got: raise RuntimeError("žádná nová data")
            # TML/Sackmann: tourney_date = začátek turnaje; další zdroj navazuje od posledního týdne (duplicity řeší dedupe)
            mx = max(r["tourney_date"] for r in got)
            # týdenní zdroje (datum = začátek turnaje): pokračuj od nejstaršího „posledního turnaje" napříč okruhy, překryv odstraní dedupe
            nxt = mx if fn in (src_sofascore, src_espn) else min(max(r["tourney_date"] for r in got if r["tour"] == t and r["level"] == "T") for t in ("atp", "wta") if any(r["tour"] == t and r["level"] == "T" for r in got))
            rows += got; log.append({"source": name, "ok": True, "rows": len(got), "from": start, "to": mx}); print(f"{name}: {len(got)} zápasů {start}..{mx}")
            cursor = max(cursor, nxt)
        except Exception as e:
            log.append({"source": name, "ok": False, "error": str(e)[:200]}); print(f"{name}: SELHAL – {e}")
    # dedupe (stejná dvojice jmen v okně 14 dní)
    import unicodedata
    n = lambda s: " ".join(unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().replace("-", " ").split())
    keep = []; idx = {}
    for r in rows:
        k = (r["tour"], n(r["winner_name"]), n(r["loser_name"]))
        d = dt.datetime.strptime(r["tourney_date"], "%Y%m%d")
        if any(abs((d - x).days) <= 14 for x in idx.get(k, [])): continue
        idx.setdefault(k, []).append(d); keep.append(r)
    with open("data/recent.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(keep)
    json.dump({"generated": TODAY.isoformat(), "chain": log, "rows": len(keep), "dupes_removed": len(rows) - len(keep)}, open("data/recent_sources.json", "w"), ensure_ascii=False, indent=1)
    print("celkem", len(keep), "po dedupe (odstraněno", len(rows) - len(keep), ")"); return log, keep
if __name__ == "__main__": run()
