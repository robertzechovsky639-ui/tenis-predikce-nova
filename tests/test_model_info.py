import json, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import model_info as MI

class T(unittest.TestCase):
    def test_values_come_from_artifacts(self):
        i = MI.build_info()
        for t in ("atp","wta"):
            D = json.load(open(f"web/data/{t}.json")); x = i["tours"][t]
            self.assertEqual(x["test"], D["metrics"]["model"])
            self.assertEqual(x["calibration"], D["metrics"]["calibration"])
            self.assertEqual(x["shipped"], D["shipped"])
            self.assertEqual(x["n_trees"], len(D["gbm"]["trees"]))
            self.assertAlmostEqual(sum(v for _,v in x["importance"]), 1, delta=0.01)
            self.assertTrue(set(f for f,_ in x["importance"]) <= set(D["features"]))
            for r in x["recent"]:
                rows = [b for b in D["backtest"] if b[0] >= int(r["from"].replace("-",""))]
                self.assertEqual(r["n"], len(rows)); self.assertAlmostEqual(r["accuracy"], sum(b[6]>.5 for b in rows)/len(rows), places=3)
        self.assertEqual(i["game"]["all_model_live"], json.load(open("tools/game_validation.json"))["all_model_live"])
    def test_recent_acc(self):
        bt = [[20261020,0,1,"Hard","X","",0.8],[20261021,0,1,"Hard","X","",0.4],[20260901,0,1,"Hard","X","",0.6]]
        r = MI.recent_acc(bt, 7); self.assertEqual(r["n"], 2); self.assertEqual(r["accuracy"], 0.5); self.assertAlmostEqual(r["brier"], (0.04+0.36)/2, places=4)
        self.assertEqual(MI.split_importance({"trees":[[[0,1,0,1,2,0,0],[0,0,0,0,0,1,1],None],[[1,1,0,1,2,0,0]]]},["a","b"]), [["a",0.5],["b",0.5]])

if __name__ == "__main__": unittest.main()
