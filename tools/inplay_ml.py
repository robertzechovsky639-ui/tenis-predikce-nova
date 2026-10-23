# ML in-play model vs analytický: trénink 2011–2020, kalibrace/validace 2021–2022, test 2023–2024 (held-out roky)
import numpy as np, pandas as pd, json, xgboost as xgb
from sklearn.metrics import brier_score_loss as BS, log_loss as LL
d=pd.read_csv("/tmp/inplay.csv"); lg=lambda p:np.log(np.clip(p,1e-4,1-1e-4)/(1-np.clip(p,1e-4,1-1e-4)))
d["l_pre"]=lg(d.pre); d["l_ana"]=lg(d.ana); d["sd"]=d.sa-d.sb; d["gd"]=d.ga-d.gb; d["pd_"]=d.pa-d.pb
d["swA_r"]=(d.swA+.64*30)/(d.stA+30)-np.where(d.men==1,.64,.565); d["swB_r"]=(d.swB+.64*30)/(d.stB+30)-np.where(d.men==1,.64,.565); d["sw_diff"]=d.swA_r-d.swB_r
F=["l_ana","l_pre","sd","gd","pd_","srvA","tb","dec","mom20","mom50","sw_diff","stA","stB","men"]
FL=["l_ana","l_pre","mom20","mom50","sw_diff"]   # LR na logitech (snadný export do JS)
tr=d.year<=2020; va=(d.year>=2021)&(d.year<=2022); te=d.year>=2023
y=d.y.values; res={"n":{"train":int(tr.sum()),"val":int(va.sum()),"test":int(te.sum()),"test_matches":int(d[te].match.nunique())}}
def ev(name,p):
    res[name]={"brier":round(BS(y[te],p[te]),5),"logloss":round(LL(y[te],p[te]),5)}
    for g,lab in ((d.men==1,"men"),(d.men==0,"women")): m=te&g; res[name][lab]=round(BS(y[m],p[m]),5)
    print(name,res[name])
ev("analytic",d.ana.values)
# LR (Newton)
def fit(X,y,l2=1e-3):
    X=np.c_[np.ones(len(X)),X]; w=np.zeros(X.shape[1])
    for _ in range(30):
        p=1/(1+np.exp(-X@w)); g=X.T@(p-y)+l2*w; H=(X*(p*(1-p))[:,None]).T@X+l2*np.eye(len(w)); w-=np.linalg.solve(H,g)
    return w
Xl=d[FL].values; w=fit(Xl[tr|va],y[tr|va]); pl=1/(1+np.exp(-np.c_[np.ones(len(Xl)),Xl]@w)); ev("lr_logit",pl)
m=xgb.XGBClassifier(n_estimators=300,max_depth=4,learning_rate=0.05,subsample=0.8,colsample_bytree=0.8,min_child_weight=50,tree_method="hist",n_jobs=4)
m.fit(d[F][tr],y[tr],eval_set=[(d[F][va],y[va])],verbose=False); px=m.predict_proba(d[F])[:,1]; ev("xgb",px)
res["lr_coef"]=dict(zip(["bias"]+FL,[round(float(v),5) for v in w]))
# po stavech
for nm,p in (("analytic",d.ana.values),("lr_logit",pl),("xgb",px)):
    for st,msk in (("tiebreak",d.tb==1),("deciding_set",d.dec==1),("early(<60 bodů)",d.npts<60)):
        mm=te&msk; res.setdefault("by_state",{}).setdefault(st,{})[nm]=round(BS(y[mm],p[mm]),5)
print(res["by_state"]); print(res["lr_coef"])
json.dump(res,open("/workspace/tennis-predict-new/tools/inplay_ml_results.json","w"),indent=1)
