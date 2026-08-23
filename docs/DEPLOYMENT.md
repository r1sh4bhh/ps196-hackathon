# Deploying PS196 on Render

PS196 is deployed as one Docker container. Express serves the built React app and
spawns the Python inference process for predictions.

## Render setup

1. In Render, select **New → Web Service** and connect this repository.
2. Choose the **Docker** runtime and a **Free** instance.
3. Set these environment variables:
   - `USE_MOCK_ML=false`
   - `PYTHON_BIN=python`
   - `ML_TIMEOUT_MS=20000`
4. Create the service and wait for the Docker build and deploy to complete.

Render injects `PORT` automatically. Do not set or override it; `backend/server.js`
already reads it.

## Verify real inference

`GET /health` only proves that Express is running. It does not exercise the Python
bridge or load the models.

Submit a patient through the UI and confirm that the prediction response contains
`"source": "model"`. The UI displays **⚠ Simulated data — not a real prediction**
whenever the source is anything else. If that badge appears, the deployment is
broken and is not returning real model output.

Check the Render logs for the `[mlClient] Real ML layer unavailable` warning. It
includes the underlying reason, such as Python failing to spawn or inference timing
out.

## Free-instance limitations

- The instance sleeps after inactivity. The first request after sleep commonly
  takes roughly 30–60 seconds, so warm the service before a demonstration.
- The free instance has 512 MB RAM. Spawning one Python process per request and
  loading three models is adequate for a single demo user, but not for concurrent
  load.

This deployment requires a network connection and provides no offline capability.
Inference runs on the server, not in the browser.
