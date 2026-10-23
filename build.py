"""Build: Elo od 1968 (Sackmann) + čerstvá data (data/recent.csv), LR i Gradient Boosting (HistGB + izotonická kalibrace).
Výstup web/data/{atp,wta}.json. Test = 2024+ (časově oddělený)."""
import csv, glob, json, math, os, unicodedata, datetime as dt, numpy as np
from collections import defaultdict, deque
from sklearn.ensemble import HistGradientBoostingClassifier
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
import sys
LIGHT = '--light' in sys.argv
SURF = ["Hard","Clay","Grass","Carpet"]; FORM_N = 10; TEST_FROM = 20240101
FEAT = ["elo_logit","surf_elo_logit","form_diff","spw_diff","rpw_diff","h2h_diff","h2h_n","rank_logratio","age_diff","rest_a","rest_b","best_of","level","surface","log_n_a","log_n_b","surf_form_diff","elo_mom_diff","fat14_a","fat14_b"]
LEVEL = {"G":4,"M":3,"F":3,"1000":3,"PM":3,"A":2,"500":2,"250":2,"P":2,"I":2,"T":2,"W":2,"C":1,"D":0,"O":2}
def k(n): return 250/((n+5)**0.4)
def ep(a,b): return 1/(1+10**((b-a)/400))
def logit(p): p=min(max(p,1e-6),1-1e-6); return math.log(p/(1-p))
def norm(s): return " ".join(unicodedata.normalize("NFD",s).encode("ascii","ignore").decode().lower().replace("-"," ").replace(".","").split())
def ddays(a,b): return (dt.date(a//10000,a//100%100,a%100)-dt.date(b//10000,b//100%100,b%100)).days
def fnum(x):
    try: return float(x)
    except: return float("nan")
def fit_lr(X,y,l2=1e-3,it=50):
    X=np.c_[np.ones(len(X)),X]; w=np.zeros(X.shape[1])
    for _ in range(it):
        p=1/(1+np.exp(-X@w)); g=X.T@(p-y)+l2*w; H=(X.T*(p*(1-p)))@X+l2*np.eye(len(w)); w-=np.linalg.solve(H,g)
    return w
def lr_pred(w,X): return 1/(1+np.exp(-(np.c_[np.ones(len(X)),X]@w)))
def metrics(p,y):
    p=np.clip(p,1e-9,1-1e-9); return dict(brier=float(np.mean((p-y)**2)),logloss=float(-np.mean(y*np.log(p)+(1-y)*np.log(1-p))),accuracy=float(np.mean((p>.5)==y)),n=int(len(y)))
def calib(p,y):
    out=[]
    for b in range(10):
        m=(p>=b/10)&(p<(b+1)/10)
        if m.sum(): out.append([round(float(p[m].mean()),4),round(float(y[m].mean()),4),int(m.sum())])
    return out
XGB_P=dict(learning_rate=0.03,max_depth=4,n_estimators=400,subsample=0.8,colsample_bytree=0.8,min_child_weight=20,reg_lambda=1.0,tree_method="hist",random_state=0,verbosity=0,n_jobs=4)
def export_xgb(clf,X0):
    """stromy XGBoost -> stejný formát jako HGB: [f,th,missing_left,l,r,is_leaf,value]; split x<th (float32); vnitřní hodnoty = cover-vážený průměr (Saabas)"""
    bst=clf.get_booster(); trees=[]
    for js in bst.get_dump(dump_format="json",with_stats=True):
        t=json.loads(js); nodes={}
        def walk(n):
            nodes[n["nodeid"]]=n
            for c in n.get("children",[]): walk(c)
        walk(t); m=max(nodes)+1; arr=[None]*m
        def val(i):
            n=nodes[i]
            if "leaf" in n: return float(n["leaf"]),float(n["cover"])
            (a,ca),(b,cb)=val(n["yes"]),val(n["no"]); v=(a*ca+b*cb)/(ca+cb); n["_v"]=v; return v,ca+cb
        val(0)
        for i in range(m):
            n=nodes.get(i)
            if n is None: arr[i]=[0,0,0,0,0,1,0.0]; continue
            if "leaf" in n: arr[i]=[0,0,0,0,0,1,float(n["leaf"])]
            else: arr[i]=[int(str(n["split"]).lstrip("f")),float(np.float32(n["split_condition"])),int(n["missing"]==n["yes"]),n["yes"],n["no"],0,n["_v"]]
        trees.append(arr)
    g={"base":0.0,"trees":trees,"lt":1,"f32":1}
    # base = margin - součet listů (ověřeno na vzorku)
    mg=clf.predict(X0[:1],output_margin=True)[0]
    def raw(x):
        z=0
        for t in trees:
            i=0
            while not t[i][5]:
                f,th,ml,l,r=t[i][:5]; v=x[f]
                i=(l if ml else r) if (v is None or np.isnan(v)) else (l if np.float32(v)<th else r)
            z+=t[i][6]
        return z
    g["base"]=float(mg-raw(X0[0])); return g
def export_hgb(clf):
    trees=[]; lr=clf.learning_rate
    for (pr,) in clf._predictors:
        n=pr.nodes; val=[float(n["value"][i]) if n["is_leaf"][i] else float(n["value"][i])*lr for i in range(len(n))]
        if not n["is_leaf"][0]:
            l,r=int(n["left"][0]),int(n["right"][0]); cl,cr=float(n["count"][l]),float(n["count"][r]); val[0]=(val[l]*cl+val[r]*cr)/(cl+cr)
        trees.append([[int(n["feature_idx"][i]),(float(n["num_threshold"][i]) if np.isfinite(n["num_threshold"][i]) else 1e300),int(n["missing_go_to_left"][i]),int(n["left"][i]),int(n["right"][i]),int(n["is_leaf"][i]),round(val[i],6)] for i in range(len(n))])
    return {"base":float(np.ravel(clf._baseline_prediction)[0]),"trees":trees}
def load(tour):
    rows=[]
    for f in sorted(glob.glob(f"data/{tour}_[12][0-9][0-9][0-9].csv")):
        for r in csv.DictReader(open(f,encoding="utf-8",errors="ignore")):
            if r["winner_name"] and r["loser_name"] and r["tourney_date"][:8].isdigit(): r["_src"]="sackmann"; rows.append(r)
    last_sack=max(int(r["tourney_date"]) for r in rows)
    added=defaultdict(int)
    if os.path.exists("data/recent.csv"):
        meta=json.load(open("data/recent_sources.json")) if os.path.exists("data/recent_sources.json") else {}
        seen={(norm(r["winner_name"]),norm(r["loser_name"]),r["tourney_date"][:6]) for r in rows if int(r["tourney_date"])>=last_sack-400}
        for r in csv.DictReader(open("data/recent.csv",encoding="utf-8")):
            if r["tour"]!=tour or int(r["tourney_date"])<=last_sack: continue
            key=(norm(r["winner_name"]),norm(r["loser_name"]),r["tourney_date"][:6])
            if key in seen: continue
            seen.add(key); src="sofascore" if r["tourney_id"].startswith("sofa") else "espn" if r["tourney_id"].startswith("espn") else "tml"
            r["_src"]=src; r.setdefault("best_of","3"); r.setdefault("tourney_level",r.get("level","")); added[src+("/challenger" if r.get("level")=="C" else "")]+=1
            if r.get("level")=="C": r["tourney_level"]="C"
            rows.append(r)
    rows.sort(key=lambda r:(int(r["tourney_date"]),r["tourney_id"],int(fnum(r.get("match_num")) if not math.isnan(fnum(r.get("match_num"))) else 0)))
    return rows,last_sack,dict(added)
def build(tour):
    rows,last_sack,added=load(tour); MAXD=max(int(r["tourney_date"]) for r in rows)
    E=defaultdict(lambda:1500.); N=defaultdict(int); ES={s:defaultdict(lambda:1500.) for s in SURF}; NS={s:defaultdict(int) for s in SURF}
    F=defaultdict(lambda:deque(maxlen=FORM_N)); SPW={}; RPW={}; H2H=defaultdict(int); LAST={}; RANK={}; BY={}; NAME={}; META={}
    SV=defaultdict(lambda:[0,0,0,0,0,0,0]); MAIN=[]; XE=[]; FSU=defaultdict(lambda:deque(maxlen=10)); EH=defaultdict(lambda:deque(maxlen=11)); RD=defaultdict(lambda:deque(maxlen=20)); X=[]; Y=[]; D=[]; LRX=[]; REF=[]; H=[]
    rng=np.random.default_rng(0)
    for r in rows:
        w,l=norm(r["winner_name"]),norm(r["loser_name"]); NAME[w]=r["winner_name"]; NAME[l]=r["loser_name"]
        d=int(r["tourney_date"]); s=r["surface"] if r["surface"] in SURF else "Hard"; sc=r.get("score","")
        walk="W/O" in sc or "RET" in sc or "DEF" in sc or "unknown" in sc.lower() or not sc.strip()
        lvl=LEVEL.get(r.get("tourney_level",""),2); bo=fnum(r.get("best_of")) or 3
        for p,pre in ((w,"winner_"),(l,"loser_")):
            ag=fnum(r.get(pre+"age")); rk=fnum(r.get(pre+"rank"))
            if not math.isnan(ag): BY[p]=d/10000-ag
            if not math.isnan(rk): RANK[p]=rk
            m=META.setdefault(p,{})
            for kk in ("ioc","hand","ht"):
                if r.get(pre+kk): m[kk]=r[pre+kk]
        if not walk and d>=19950101:
            def side(a,b):
                ra,rb=RANK.get(a,np.nan),RANK.get(b,np.nan); aa=d/10000-BY[a] if a in BY else np.nan; ab=d/10000-BY[b] if b in BY else np.nan
                return [logit(ep(E[a],E[b])),logit(ep(ES[s][a],ES[s][b])),(np.mean(F[a]) if F[a] else .5)-(np.mean(F[b]) if F[b] else .5),
                        SPW.get(a,np.nan)-SPW.get(b,np.nan),RPW.get(a,np.nan)-RPW.get(b,np.nan),H2H[(a,b)]-H2H[(b,a)],H2H[(a,b)]+H2H[(b,a)],
                        math.log(rb)-math.log(ra) if ra>0 and rb>0 else np.nan, aa-ab,
                        min(ddays(d,LAST[a]),365) if a in LAST else np.nan, min(ddays(d,LAST[b]),365) if b in LAST else np.nan, bo, lvl, SURF.index(s), math.log1p(N[a]), math.log1p(N[b])]
            def extra(a,b):
                fs=lambda p:np.mean(FSU[(p,s)]) if FSU[(p,s)] else np.nan
                mom=lambda p:E[p]-EH[p][0] if len(EH[p])>=2 else np.nan
                fat=lambda p:sum(1 for x in RD[p] if 0<=ddays(d,x)<=14)
                return [fs(a)-fs(b),mom(a)-mom(b),fat(a),fat(b)]
            if rng.random()<.5: X.append(side(w,l)+extra(w,l)); XE.append(extra(w,l)); Y.append(1)
            else: X.append(side(l,w)+extra(l,w)); XE.append(extra(l,w)); Y.append(0)
            D.append(d); MAIN.append(r.get('tourney_level','')!='C' and r['_src']=='sackmann'); REF.append((d,w,l,s,r["tourney_name"],sc))
        if not walk:
            pw=ep(E[w],E[l]); E[w]+=k(N[w])*(1-pw); E[l]-=k(N[l])*(1-pw); N[w]+=1; N[l]+=1
            pw=ep(ES[s][w],ES[s][l]); ES[s][w]+=k(NS[s][w])*(1-pw); ES[s][l]-=k(NS[s][l])*(1-pw); NS[s][w]+=1; NS[s][l]+=1
            F[w].append(1); F[l].append(0); H2H[(w,l)]+=1; FSU[(w,s)].append(1); FSU[(l,s)].append(0); EH[w].append(E[w]); EH[l].append(E[l]); RD[w].append(d); RD[l].append(d)
            try:
                for a,pa,pb in ((w,"w_","l_"),(l,"l_","w_")):
                    sp=float(r[pa+"svpt"]); op=float(r[pb+"svpt"])
                    if sp<10 or op<10: raise ValueError
                    spw=(float(r[pa+"1stWon"])+float(r[pa+"2ndWon"]))/sp; rpw=1-(float(r[pb+"1stWon"])+float(r[pb+"2ndWon"]))/op
                    SPW[a]=spw if a not in SPW else .9*SPW[a]+.1*spw; RPW[a]=rpw if a not in RPW else .9*RPW[a]+.1*rpw
                    if d>=MAXD-20000:
                        v=SV[a]; v[0]+=sp; v[1]+=spw*sp; v[2]+=op; v[3]+=rpw*op; v[4]+=fnum(r[pa+"ace"]); v[5]+=fnum(r[pa+"df"]); v[6]+=fnum(r[pa+"SvGms"])
            except (ValueError,KeyError,TypeError): pass
        LAST[w]=d; LAST[l]=d
        if d>=20150101: H.append([d,w,l,s,sc,r["tourney_name"],r.get("round","")])
    X=np.array(X,float); Y=np.array(Y,float); D=np.array(D)
    if os.environ.get("DUMP"): np.savez_compressed(f"/tmp/feat_{tour}.npz",X=X,XE=np.array(XE,float),Y=Y,D=D,MAIN=np.array(MAIN)); print("dump",tour); return
    te=D>=TEST_FROM
    if not LIGHT:
        te=D>=TEST_FROM; lr_tr=(D>=20100101)&~te; lr_tr_all=(D>=19950101)&~te
        res={}; MAIN=np.array(MAIN); tm=MAIN[te]
        w_lr=fit_lr(X[lr_tr][:,:3],Y[lr_tr]); p_lr=lr_pred(w_lr,X[te][:,:3]); res["lr_2010"]=metrics(p_lr,Y[te])
        w_all=fit_lr(np.nan_to_num(X[lr_tr_all][:,:3]),Y[lr_tr_all]); res["lr_1995"]=metrics(lr_pred(w_all,X[te][:,:3]),Y[te])
        res["elo_only"]=metrics(1/(1+np.exp(-X[te][:,0])),Y[te])
        gtr=(D>=20000101)&(D<20220101); gcal=(D>=20220101)&~te
        mkh=lambda:HistGradientBoostingClassifier(max_iter=300,learning_rate=0.05,max_leaf_nodes=15,min_samples_leaf=80,l2_regularization=1.0,random_state=0)
        hg=mkh(); hg.fit(X[gtr][:,:16],Y[gtr]); ih=IsotonicRegression(out_of_bounds="clip",y_min=0.01,y_max=0.99).fit(hg.predict_proba(X[gcal][:,:16])[:,1],Y[gcal])
        ph_=ih.predict(hg.predict_proba(X[te][:,:16])[:,1]); res["hgb16_iso"]=metrics(ph_,Y[te]); res["cmp_hgb16_main"]=metrics(ph_[tm],Y[te][tm])
        mk=lambda:xgb.XGBClassifier(**XGB_P)
        clf=mk(); clf.fit(X[gtr],Y[gtr])
        raw_cal=clf.predict_proba(X[gcal])[:,1]; iso=IsotonicRegression(out_of_bounds="clip",y_min=0.01,y_max=0.99).fit(raw_cal,Y[gcal])
        p_raw=clf.predict_proba(X[te])[:,1]; p_gb=iso.predict(p_raw)
        res["gbm_raw"]=metrics(p_raw,Y[te]); res["gbm_iso"]=metrics(p_gb,Y[te])
        res["cmp_lr_main"]=metrics(p_lr[tm],Y[te][tm]); res["cmp_gbm_main"]=metrics(p_gb[tm],Y[te][tm]); res["cmp_elo_main"]=metrics(1/(1+np.exp(-X[te][tm][:,0])),Y[te][tm])
        best="gbm" if res["gbm_iso"]["logloss"]<res["lr_2010"]["logloss"] else "lr"
        pt=p_gb if best=="gbm" else p_lr
        print(tour,"best",best,{k_:(round(v["brier"],4),round(v["logloss"],4),round(v["accuracy"],4)) for k_,v in res.items()})
        # --- SHIPPED: refit na všech datech; kalibrace z holdoutu posledních ~6 měsíců (model trénovaný před holdoutem)
        hcut=int((dt.date(MAXD//10000,MAXD//100%100,MAXD%100)-dt.timedelta(days=182)).strftime("%Y%m%d"))  # ~6 měsíců
        hold=D>=hcut; pre=(D>=20000101)&~hold
        clf_h=mk(); clf_h.fit(X[pre],Y[pre]); ph=clf_h.predict_proba(X[hold])[:,1]
        iso_ship=IsotonicRegression(out_of_bounds="clip",y_min=0.01,y_max=0.99).fit(ph,Y[hold])
        res["ship_holdout_raw"]=metrics(ph,Y[hold]); res["ship_holdout_from"]=int(hcut)
        clf_ship=mk(); clf_ship.fit(X[D>=20000101],Y[D>=20000101])
        print(tour,"shipped: train 2000-01-01..",MAXD,"holdout od",hcut,res["ship_holdout_raw"])
        # finální LR refit na 2010+ (vč. testu)
        w_final=fit_lr(X[D>=20100101][:,:3],Y[D>=20100101])
    else:  # lehká hodinová aktualizace: Elo/forma/statistiky z nových výsledků, model (stromy, kalibrace) zůstává z noci
        prev=json.load(open(f'web/data/{tour}.json')); best=prev['best']
    # export hráčů aktivních od 2023
    act=[p for p in LAST if LAST[p]>=20230101]; idx={p:i for i,p in enumerate(act)}
    players=[]
    for p in act:
        v=SV[p]
        players.append({"n":NAME[p],"e":round(E[p],1),"m":N[p],"s":{s_:round(ES[s_][p],1) for s_ in SURF[:3]},"sm":{s_:NS[s_][p] for s_ in SURF[:3]},"f":list(F[p]),"last":LAST[p],
            "rank":RANK.get(p),"by":round(BY[p],2) if p in BY else None,"spw":round(SPW[p],4) if p in SPW else None,"rpw":round(RPW[p],4) if p in RPW else None,**META.get(p,{}),
            "fs":{s_:round(float(np.mean(FSU[(p,s_)])),4) for s_ in SURF[:3] if FSU[(p,s_)]},"mom":round(E[p]-EH[p][0],3) if len(EH[p])>=2 else None,"rd":list(RD[p]),
            "sv":{"spw":round(v[1]/v[0],4),"rpw":round(v[3]/v[2],4),"ace":round(v[4]/v[6],3) if v[6] else 0,"df":round(v[5]/v[6],3) if v[6] else 0,"pts":int(v[0])} if v[0]>=200 else None})
    matches=[[m[0],idx[m[1]],idx[m[2]],*m[3:]] for m in H if m[1] in idx and m[2] in idx]
    tot=np.array([v for v in SV.values()]).sum(0); avg_spw=float(tot[1]/tot[0])
    ti=np.where(te)[0]; bt=[]
    for j,pp in ([] if LIGHT else zip(ti[-400:],pt[-400:])):
        pass
    for j,pp in ([] if LIGHT else zip(ti[-400:],pt[-400:])):
        d0,a,b,s0,tn,sc=REF[j]
        if a in idx and b in idx: bt.append([d0,idx[a],idx[b],s0,tn,sc,round(float(pp if Y[j]==1 else 1-pp),4)])
    out={"tour":tour,"players":players,"matches":matches,"data_through":MAXD,"sackmann_through":last_sack,"added":added,"avg_spw":round(avg_spw,4)}
    if not LIGHT: out.update({"tour":tour,"best":best,"coef":list(map(float,w_final)),"features":FEAT,"gbm":export_xgb(clf_ship,X[te]),"gbm_kind":"xgboost","iso":{"x":[round(float(v),5) for v in iso_ship.X_thresholds_],"y":[round(float(v),5) for v in iso_ship.y_thresholds_]},"shipped":{"train_from":20000101,"train_to":MAXD,"calib_holdout_from":int(hcut),"n_train":int((D>=20000101).sum())},
        "metrics":{"test_from":"2024-01-01","model":res["gbm_iso"] if best=="gbm" else res["lr_2010"],"raw_overall_elo":res["elo_only"],"all":res,"calibration":calib(pt,Y[te]),"train":{"elo_from":int(D.min()) if False else 1968,"gbm_eval":"2000–2021, kalibrace 2022–2023","gbm_shipped":f"2000-01-01 až {MAXD}, kalibrace holdout od {hcut}","lr":"2010–2023 (dodávaná LR 2010+ vše)"}},
        "data_through":MAXD,"sackmann_through":last_sack,"added":added,"avg_spw":round(avg_spw,4),"players":players,"matches":matches,"backtest":bt,
        "sample_X":[[None if math.isnan(v) else v for v in row] for row in X[te][:50].tolist()],"sample_p":[float(v) for v in clf_ship.predict_proba(X[te][:50])[:,1]],"sample_margin":[float(v) for v in clf_ship.predict(X[te][:50],output_margin=True)]})
    if LIGHT:
        for k_ in ("best","coef","features","gbm","gbm_kind","iso","shipped","metrics","backtest","sample_X","sample_p","sample_margin"): out[k_]=prev.get(k_)
        out["light_update"]=dt.datetime.now().isoformat(timespec="minutes")
    out=json.loads(json.dumps(out).replace("NaN","null").replace("-Infinity","-1e300").replace("Infinity","1e300")); mt=out.pop("matches"); out["matches_file"]=f"{tour}_m.json"; json.dump({"matches":mt},open(f"web/data/{tour}_m.json","w"),separators=(",",":"),allow_nan=False); json.dump(out,open(f"web/data/{tour}.json","w"),ensure_ascii=False,separators=(",",":"),allow_nan=False)
    return out
if __name__=="__main__":
    for t in ("atp","wta"): build(t)
