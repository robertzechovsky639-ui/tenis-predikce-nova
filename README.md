# Tenis predikce · nová (statická PWA)
- `python3 fetch_recent.py` – doplní výsledky od posledního Sackmann data (failover Sackmann → TennisMyLife → Sofascore → ESPN; test: `FAIL_SOURCES=tml,sofascore`)
- `python3 build.py` – Elo od 1968, LR + gradient boosting (izotonická kalibrace), export do web/data/*.json
- `cd web && python3 -m http.server 8765` → http://localhost:8765/ (simulace výpadku živých zdrojů: `?fail=sofascore,espn`)
- Testy: `node --test tests/` a `python3 -m unittest discover -s tests`
- Noční běh: .github/workflows/nightly.yml (02:30 UTC) – fetch, retrain, testy, commit dat, nasazení Pages (Settings → Pages → Source: GitHub Actions).
