# Tenis predikce · nová (statická PWA)
- Build modelu: `python3 build.py` (data/*.csv Sackmann -> web/data/atp.json, wta.json)
- Spuštění: `cd web && python3 -m http.server 8765` -> http://localhost:8765/
- Testy: `node --test tests/` a `python3 -m unittest discover -s tests`
- Živá data: Sofascore (api.sofascore1.com, CORS *), záloha ESPN, 365scores – přímo z prohlížeče, bez proxy.
