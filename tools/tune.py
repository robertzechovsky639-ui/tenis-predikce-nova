import numpy as np, json, itertools, sys, warnings; warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier as HGB
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import log_loss, brier_score_loss
import lightgbm as lgb, xgboost as xgb
FOLDS=[(20160101,20180101),(20180101,20200101),(20200101,20220101),(20220101,20240101)]
def models():
    for lr,leaves,msl,it in itertools.product([0.03,0.06],[15,31],[80,200],[300,600]):
        yield "hgb",dict(learning_rate=lr,max_leaf_nodes=leaves,min_samples_leaf=msl,max_iter=it,l2_regularization=1.0,random_state=0)
    for lr,leaves,it in itertools.product([0.03],[15,31],[400,800]):
        yield "lgb",dict(learning_rate=lr,num_leaves=leaves,n_estimators=it,min_child_samples=100,subsample=0.8,subsample_freq=1,colsample_bytree=0.8,reg_lambda=1.0,verbose=-1,random_state=0)
    for lr,depth,it in itertools.product([0.03],[4,6],[400,800]):
        yield "xgb",dict(learning_rate=lr,max_depth=depth,n_estimators=it,subsample=0.8,colsample_bytree=0.8,min_child_weight=20,reg_lambda=1.0,tree_method="hist",random_state=0,verbosity=0)
def mk(k,p): return HGB(**p) if k=="hgb" else lgb.LGBMClassifier(**p) if k=="lgb" else xgb.XGBClassifier(**p)
out={}
for tour in ("atp","wta"):
    z=np.load(f"/tmp/feat_{tour}.npz"); D=z["D"]; Y=z["Y"]; MAIN=z["MAIN"]
    sets={"base":z["X"],"plus":np.c_[z["X"],z["XE"]]}
    res=[]
    for fs,X in sets.items():
        for k,p in models():
            ll=[]
            for a,b in FOLDS:
                tr=(D>=20000101)&(D<a); va=(D>=a)&(D<b)
                m=mk(k,p).fit(X[tr],Y[tr]); ll.append(log_loss(Y[va],m.predict_proba(X[va])[:,1]))
            res.append((float(np.mean(ll)),fs,k,p)); print(tour,fs,k,p.get("learning_rate"),p.get("max_leaf_nodes",p.get("num_leaves",p.get("max_depth"))),p.get("max_iter",p.get("n_estimators")),p.get("min_samples_leaf",""),round(np.mean(ll),5),flush=True)
    res.sort(key=lambda r:r[0]); top=res[:3]
    te=D>=20240101; tm=MAIN[te]; rep=[]
    for cv,fs,k,p in top+[r for r in res if r[1]=="base" and r[2]=="hgb" and r[3]["learning_rate"]==0.06 and r[3]["max_leaf_nodes"]==15 and r[3]["min_samples_leaf"]==80 and r[3]["max_iter"]==300][:1]:
        X=sets[fs]; tr=(D>=20000101)&(D<20220101); ca=(D>=20220101)&~te
        m=mk(k,p).fit(X[tr],Y[tr]); iso=IsotonicRegression(out_of_bounds="clip",y_min=.01,y_max=.99).fit(m.predict_proba(X[ca])[:,1],Y[ca])
        pr=iso.predict(m.predict_proba(X[te])[:,1])
        rep.append(dict(cv=cv,fs=fs,k=k,p=p,test_ll=log_loss(Y[te],pr),test_brier=brier_score_loss(Y[te],pr),test_acc=float(np.mean((pr>.5)==Y[te])),main_ll=log_loss(Y[te][tm],pr[tm]),main_brier=brier_score_loss(Y[te][tm],pr[tm]),main_acc=float(np.mean((pr[tm]>.5)==Y[te][tm]))))
        print("TEST",tour,rep[-1],flush=True)
    out[tour]=rep
json.dump(out,open("/workspace/tennis-predict-new/tools/tune_results.json","w"),indent=1)
