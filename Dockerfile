# Single-container deployment: Node (Express + built React frontend) and
# Python (scikit-learn inference) live in the same image, so
# backend/ml/pythonBridge.js can keep spawning ml/inference/inference.py as a
# subprocess exactly as it does locally.
#
# The Python version must match the one ml/requirements.txt was pinned
# against (3.14) -- joblib artefacts do not unpickle reliably across
# mismatched environments.
FROM python:3.14-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get purge -y curl \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency manifests are copied before the source so the (slow) installs
# stay cached when only application code changes.
COPY ml/requirements.txt ./ml/requirements.txt
RUN pip install --no-cache-dir -r ml/requirements.txt

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY . .

# Empty VITE_API_BASE_URL => the client uses the same origin, which is what
# Express serves the bundle from. client.js uses `??` so "" is honoured.
RUN cd frontend && VITE_API_BASE_URL= npm run build

# The three .joblib artefacts are committed under ml/models/, and
# ml/data/*.csv is gitignored, so training must NOT run at build time.

ENV USE_MOCK_ML=false \
    PYTHON_BIN=python \
    ML_TIMEOUT_MS=20000

# PORT is intentionally not set: server.js reads process.env.PORT and Render
# injects it. EXPOSE only documents the local default.
EXPOSE 4000

CMD ["node", "backend/server.js"]
