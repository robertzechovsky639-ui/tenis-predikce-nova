import json,os,unittest
D=os.path.join(os.path.dirname(__file__),"..","web","data")
class T(unittest.TestCase):
    def test_json(self):
        for t in ("atp","wta"):
            d=json.load(open(os.path.join(D,t+".json")))
            m=d["metrics"]["model"]; self.assertLess(m["brier"],0.25); self.assertLess(m["logloss"],0.69); self.assertGreater(m["n"],1000)
            self.assertTrue(all(0<=c[0]<=1 for c in d["metrics"]["calibration"]))
            self.assertEqual(len(d["players"][0]["s"]),3)
if __name__=="__main__": unittest.main()
