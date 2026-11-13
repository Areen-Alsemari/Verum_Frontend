# Demo checklist

Two repositories, two terminals. The backend path is the repository root (`Verum Backend`); the frontend is this one.
Commands come from the backend's `docs/service_api.md` and this repo's `docs/backend_integration_results.md`,
except the rebuild command, which is from the project brief (its flags `--chain` and `--out` exist in
`tools/agents/run_runner_sample.py`).

## 1. Before the visit

Rebuild the replay sample, from the backend root, about 6 minutes. It writes `sample.json` and `bundles/`:

```bash
PYTHONPATH=src python tools/agents/run_runner_sample.py --chain --out local/replay_sample
```

## 2. Start, in this order

Backend, from the backend root, terminal 1:

```bash
PYTHONPATH=src .venv/bin/python -m verum.service --port 8765 --replay-dir local/replay_sample --release data/reference_release_v2/verum_reference_v2
```

It prints `verum service listening on http://127.0.0.1:8765`. Check: `curl localhost:8765/api/health` gives `"status": "ok"`.

Frontend, from this repo, terminal 2:

```bash
npm install     # first time only
npm run dev
```

Open **http://localhost:5173**. The port is fixed (`strictPort`): the service allows CORS only for that origin, so if
5173 is taken the dev server fails instead of moving. Stop whatever holds it. `VITE_API_URL` changes the service
URL (default `http://localhost:8765`); set it only if the service runs elsewhere.

## 3. WebGL check

In the browser console run `!!document.createElement('canvas').getContext('webgl2')`. `true`: the 3D view works.
`false`: the page shows "WebGL is not available here, so the 2D diagram is shown." and everything else still works.

## 4. If something is wrong

| What you see | Cause and action |
|---|---|
| "The run service is not running" with the start command | The service is down or not on port 8765. Start it (step 2), then press Try again. |
| "No replay episodes: the replay directory is empty ..." | `sample.json` has no episodes, or the service was started without `--replay-dir`. Rebuild the sample (step 1) and restart the service. Live mode still works. |
| "The episode list could not be loaded ... 500: FileNotFoundError" | `sample.json` is missing from the replay directory. Rebuild the sample and restart the service. |
| Run creation error | The page shows the service's own text (for example a speed outside 0 to 1e6). Change the setting. |
| "The event stream dropped. Reconnecting ..." | The page resumes by itself (up to 5 tries), then says the connection was lost. Check the service, start a new run. |
| Live mode not offered | The service was started without `--release`. |

"Stop watching" only closes the stream. The service has no stop route and may keep running that run.

## 5. Simulation truth

Off by default. It appears only if "Reveal simulation truth after the run" is ticked before Run, on the
Investigation tab, labelled **"simulation truth, not visible to the agents"**. It is kept apart from what the agents
see, and the service answers 400 or 404 for runs without it; the page then shows a plain message.

## 6. Things to say out loud

Synthetic data, not plant data. Mode (replay or live) and the time-compression note are on every screen. The
facility layout is a static snapshot; the service sends no coordinates and flags no assets. Advisory only: a human decides.
