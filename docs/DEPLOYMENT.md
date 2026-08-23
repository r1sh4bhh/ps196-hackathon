# Deploying PS196 to Render

PS196 ships as a **single Docker container**: Express serves the built React
frontend from `frontend/dist` and, on the same machine,
`backend/ml/pythonBridge.js` spawns `ml/inference/inference.py` as a subprocess.
Both runtimes live in one image (see the `Dockerfile` at the repository root),
so the ML boundary described in `docs/ARCHITECTURE.md` is unchanged.

Because the frontend is built with an empty `VITE_API_BASE_URL`, the browser
calls the API on the same origin — there is no CORS configuration and no API
base URL to keep in sync between environments.

---

## 1. Render setup

1. Push `main` to GitHub.
2. In the Render dashboard: **New → Web Service**, then connect this repository.
3. **Runtime: Docker.** Render detects the root `Dockerfile`; leave build and
   start commands empty (the image's `CMD` runs `node backend/server.js`).
4. Pick a region close to your audience and the **Free** instance type.
5. Set the environment variables below.
6. **Create Web Service.** The first build takes roughly 5–10 minutes, mostly
   pip and npm installs.

### Environment variables

| Variable        | Value    | Why                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------ |
| `USE_MOCK_ML`   | `false`  | `backend/ml/mlClient.js` uses the mock unless this is exactly `"false"`. |
| `PYTHON_BIN`    | `python` | The `python:3.14-slim` base image provides `python`, not `python3` only. |
| `ML_TIMEOUT_MS` | `20000`  | A cold container loading three models can exceed the 10s default.        |

These are already baked into the `Dockerfile` as defaults; set them in Render
too if you want them visible and overridable from the dashboard.

> **Do not set `PORT`.** Render injects it and `backend/server.js` already
> reads `process.env.PORT`. Overriding it makes Render's health check fail
> because the container listens on the wrong port.

---

## 2. Verify the deploy is using the real ML layer

`GET /health` is **not** a sufficient check. It only proves Express is up; it
says nothing about whether Python spawned, whether the `.joblib` artefacts
loaded, or whether the backend quietly fell back to the mock predictor.

The real check:

1. Open the deployed URL and submit a patient through the UI.
2. Inspect the `POST /predict` response (browser devtools → Network) and
   confirm `prediction.source` is `"model"`.

`frontend/src/utils/mlDetail.js` renders a
**"⚠ Simulated data — not a real prediction"** badge whenever `source` is
anything other than `"model"`. **If that badge appears, the deployment is
broken** — you are looking at fabricated risk scores, not model output. The
most likely cause is Python failing to spawn.

To diagnose, open the Render **Logs** tab and look for:

```text
[mlClient] Real ML layer unavailable, falling back to mock: <reason>
```

The `<reason>` is the underlying error — for example a missing Python
executable (`Python executable not found (...)`), a missing model artefact, or
a timeout. Fix that cause rather than the symptom; do not ship a demo showing
the simulated-data badge.

---

## 3. Free-tier caveats

- **The instance sleeps after inactivity.** The first request after a sleep
  takes roughly **30–60 seconds** while the container spins back up. Hit the
  URL a few minutes before a demo so it is warm.
- **512 MB RAM.** Every prediction spawns a Python process that loads all
  three models. That is adequate for a single demo user; it is **not**
  adequate for concurrent load, where you should expect timeouts or the
  process being killed (which surfaces as the simulated-data badge).
- Free instances also have limited build minutes and no persistent disk —
  nothing here writes to disk, so that is not a problem today.

---

## Demo mode

In the clinician view, select **Load demo patients** to add three clearly
marked demo records to that browser's local storage. Each has five dated,
fictional patient-entered visits, so its personal baseline is already
established. Use **Clear demo patients** to remove only these demo profiles
and assessments; records created by a user are left intact.

The demo histories contain no seeded risk scores, evidence, or confidence.
Selecting a demo patient runs the live `/predict` service for its visit
history, so the risk dashboard is populated with current model or rule output.
If the service falls back to simulated data, the dashboard's visible
simulated-data warning remains in place.

Warm the Render instance by loading a demo dashboard a few minutes before
presenting. A sleeping free-tier instance can take 30–60 seconds to start,
and the UI will show that the model is running while it waits.

---

## 4. This deployment is online-only

Inference runs server-side, in the container. The hosted app therefore
**requires a network connection** and provides **no offline capability**: with
no connection the UI cannot obtain a prediction.

This is a property of the deployment, not of the system. PS196 makes no
external API calls and runs its models locally, so the same code base still
runs entirely on a machine with no internet — that is the local
(`npm run dev` + backend) setup, not this one. Do not describe the hosted
deployment as offline-capable.
