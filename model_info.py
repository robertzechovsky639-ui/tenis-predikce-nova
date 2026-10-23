"""model_info.json – souhrn modelu pro sekci Model, generovaný jen z reálných artefaktů buildu (žádná ručně psaná čísla)."""
import json, os, subprocess, datetime as dt
from collections import Counter

def _j(p):
    try: return json.load(open(p))
    except Exception: return None

def _git_time(grep, path=None, invert=False):
    try:
        cmd=["git","log","-1","--format=%cI","--grep",grep]+(["--invert-grep"] if invert else [])+(["--",path] if path else [])
        r = subprocess.run(cmd,capture_output=True,text=True,timeout=10).stdout.strip()
        return dt.datetime.fromisoformat(r).astimezone(dt.timezone.utc).isoformat(timespec="minutes").replace("+00:00","Z") if r else None
    except Exception: return None

def _ymd(d): d=int(d); return f"{d//10000:04d}-{d//100%100:02d}-{d%100:02d}"

def split_importance(gbm, feats):
    """záloha: počet splitů na příznak z exportovaných stromů ([f,th,ml,l,r,is_leaf,v])"""
    c = Counter(n[0] for t in gbm["trees"] for n in t if n and not n[5])
    tot = sum(c.values()) or 1
    return [[feats[k], round(v/tot,4)] for k,v in c.most_common()]

def recent_acc(bt, days):
    if not bt: return None
    last = max(r[0] for r in bt); L = dt.date(last//10000,last//100%100,last%100)
    cut = int((L-dt.timedelta(days=days)).strftime("%Y%m%d"))
    rows = [r for r in bt if r[0] > cut]
    if not rows: return None
    ps = [r[6] for r in rows]  # p vítěze
    return {"days":days,"from":_ymd(min(r[0] for r in rows)),"to":_ymd(last),"capped":min(r[0] for r in bt)>cut,"n":len(rows),"accuracy":round(sum(p>.5 for p in ps)/len(ps),4),"brier":round(sum((1-p)**2 for p in ps)/len(ps),4)}

def build_info(outd="web/data", root="."):
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes").replace("+00:00","Z")
    info = {"generated": now, "tours": {}}
    for t in ("atp","wta"):
        D = _j(f"{outd}/{t}.json")
        if not D: continue
        M = _j(f"{outd}/{D.get('matches_file',t+'_m.json')}") or {}
        ms = M.get("matches") or []
        m = D.get("metrics") or {}
        imp = D.get("importance")
        kind = D.get("importance_kind","gain") if imp else None
        if not imp and D.get("gbm"):
            imp, kind = split_importance(D["gbm"], D["features"]), "splits"
        info["tours"][t] = {
            "model": "XGBoost + izotonická kalibrace" if D.get("best")=="gbm" else "logistická regrese",
            "gbm_kind": D.get("gbm_kind"), "n_trees": len((D.get("gbm") or {}).get("trees",[])),
            "features": D.get("features"), "importance": imp, "importance_kind": kind,
            "elo_from": (m.get("train") or {}).get("elo_from"),
            "data_from": _ymd(min(x[0] for x in ms)) if ms else None, "data_through": _ymd(D["data_through"]),
            "n_matches_history": len(ms), "n_players": len(D.get("players",[])),
            "shipped": D.get("shipped"), "train_desc": m.get("train"),
            "test_from": m.get("test_from"), "test": m.get("model"), "elo_only": m.get("raw_overall_elo"),
            "compare": {k:(m.get("all") or {}).get(k) for k in ("cmp_elo_main","cmp_lr_main","cmp_gbm_main")},
            "calibration": m.get("calibration"),
            "recent": [x for x in (recent_acc(D.get("backtest"),d) for d in (7,30)) if x],
            "added": D.get("added"), "light_update": D.get("light_update"),
            "trained_at": D.get("trained_at"), "guard": D.get("guard"),
        }
    info["last_full_retrain"] = next((v["trained_at"] for v in info["tours"].values() if v.get("trained_at")), None) or _git_time("(full)") or _git_time("(light)", f"{outd}/atp.json", invert=True)
    info["last_hourly_update"] = _git_time("(light)") or _git_time("Aktualizace dat")
    rl = _j(f"{outd}/retrain_log.json")
    if rl: info["retrain_log"] = rl[-6:]
    rs = _j(f"{root}/data/recent_sources.json")
    if rs: info["data_sources"] = rs
    tools = {k:_j(f"{root}/tools/{k}.json") for k in ("game_validation","inplay_ml_results","odds_backtest_results")}
    g = tools["game_validation"]
    if g: info["game"] = {k:g.get(k) for k in ("test","hold_rate_m","hold_rate_w","all_model_live","all_naive_score","all_naive_const","breakpoint_model_live","breakpoint_naive_score","breakpoint_naive_const","tb_mid_model_live","tb_mid_naive_pts","tb_start_model","tb_start_naive_pts") if g.get(k) is not None}
    ip = tools["inplay_ml_results"]
    if ip: info["inplay"] = {"n": ip.get("n"), "analytic": ip.get("analytic"), "lr_logit": ip.get("lr_logit")}
    ob = tools["odds_backtest_results"]
    if ob: info["odds"] = (ob.get("all") or {})
    return info

def write_model_info(outd="web/data", root="."):
    info = build_info(outd, root)
    json.dump(info, open(f"{outd}/model_info.json","w"), ensure_ascii=False, separators=(",",":"))
    return info

if __name__ == "__main__":
    i = write_model_info(); print({t:(v["test"], len(v["importance"] or []), v["importance_kind"]) for t,v in i["tours"].items()}, i["last_full_retrain"], i["last_hourly_update"])
