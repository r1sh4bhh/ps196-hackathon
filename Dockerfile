FROM python:3.14-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ml/requirements.txt ./ml/
RUN pip install --no-cache-dir -r ml/requirements.txt

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY . .
RUN cd frontend && VITE_API_BASE_URL= npm run build

ENV USE_MOCK_ML=false \
    PYTHON_BIN=python \
    ML_TIMEOUT_MS=20000

EXPOSE 4000

CMD ["node", "backend/server.js"]
