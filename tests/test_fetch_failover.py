import importlib, json, os, sys, unittest
from unittest import mock
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
FR = importlib.import_module("fetch_recent")
ROW = lambda src, d: {**{c: "" for c in FR.COLS}, "tour": "atp", "level": "T", "tourney_id": f"{src}-{d}", "tourney_date": d, "winner_name": f"A {src}{d}", "loser_name": "B", "score": "6-1 6-1"}
class T(unittest.TestCase):
    def run_with(self, fail, tmp_suffix):
        calls = []
        def mk(name, last):
            def f(a, b): calls.append(name); return [ROW(name, a), ROW(name, last)]
            return f
        chain = [("sackmann", mk("sackmann", "20260601")), ("tml", mk("tml", "20261001")), ("sofascore", mk("sofascore", "20261020")), ("espn", mk("espn", "20261022"))]
        with mock.patch.object(FR, "CHAIN", chain), mock.patch.dict(os.environ, {}), mock.patch.object(FR, "FAIL", set(fail)), \
             mock.patch("builtins.open", mock.mock_open()), mock.patch.object(FR.json, "dump"), mock.patch.object(FR, "src_sofascore", chain[2][1]), mock.patch.object(FR, "src_espn", chain[3][1]):
            log, rows = FR.run()
        return {l["source"]: l["ok"] for l in log}, calls, rows
    def test_all_up_primary_then_tail(self):
        ok, calls, rows = self.run_with([], "a"); self.assertTrue(ok["sackmann"]); self.assertIn("sackmann", calls)
    def test_sackmann_down_uses_tml(self):
        ok, calls, rows = self.run_with(["sackmann"], "b"); self.assertFalse(ok["sackmann"]); self.assertIn("tml", calls); self.assertTrue(rows)
    def test_two_down_still_data(self):
        ok, calls, rows = self.run_with(["sackmann", "tml"], "c"); self.assertEqual(calls[0], "sofascore"); self.assertTrue(rows)
    def test_three_down_espn(self):
        ok, calls, rows = self.run_with(["sackmann", "tml", "sofascore"], "d"); self.assertEqual(calls, ["espn"]); self.assertTrue(rows)
if __name__ == "__main__": unittest.main()
