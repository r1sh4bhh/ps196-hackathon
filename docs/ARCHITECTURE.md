# PS196 Architecture

## 1. Project Overview

PS196 is an AI-powered early disease detection platform for the SIH 2026 hackathon. The application runs as an offline-first desktop app using Electron, with a React frontend, a local Node.js + Express backend, and a local Python ML inference layer.

The goal of the architecture is to let all five team members build in parallel, integrate through fixed API contracts in `docs/API.md`, and deliver a final application that works without internet access.

## 2. High-Level Architecture

```text
+---------------------------+
| Electron Desktop App      |
| Offline runtime container |
+------------+--------------+
             |
             v
+---------------------------+
| React Frontend            |
| UI, forms, dashboard      |
+------------+--------------+
             |
             v
+---------------------------+
| Express Backend           |
| Validation, orchestration |
+------------+--------------+
             |
             v
+---------------------------+
| Python ML Inference       |
| Preprocessing + inference |
+------------+--------------+
             |
             v
+---------------------------+
| ML Model                  |
| Risk prediction           |
+---------------------------+

Response path:
ML Model -> Python ML Inference -> Express Backend -> React Frontend
```

## 3. Component Responsibilities

### Frontend

React is responsible for user interaction, local UI state, and presentation of prediction results.

- Devansh
  - Patient input form
  - Form validation
  - `localStorage`
  - Dashboard shell
  - API client
- Shivangi
  - Risk trajectory visualization
  - Evidence/disease cards
  - Baseline comparison
  - Next-best-test UI

### Backend

Express is the orchestration layer between the frontend and ML module.

- Rishabh
  - Express server
  - `POST /predict`
  - `GET /health`
  - Input validation
  - Data normalization
  - Backend-to-ML communication
  - Disease/evidence rules
  - Response orchestration
  - Mock fallback during development

### ML

Python handles inference and model-facing logic.

- Shayan + Aneesh
  - Model loading/training
  - ML preprocessing
  - Risk prediction
  - Model inference
  - Return risk scores, top disease, and confidence
  - Support integration with the backend

### Electron

Electron packages and runs the complete application locally so the React frontend, Express backend, and Python ML inference can operate without internet connectivity.

## 4. Data Flow

1. The user enters patient data in the React frontend.
2. The frontend validates input and sends it to `POST /predict`.
3. The Express backend validates and normalizes the request data.
4. The backend sends processed input to the Python ML inference module.
5. Python runs preprocessing and model inference.
6. The ML module returns risk scores, top disease, and confidence to the backend.
7. The backend applies disease/evidence rules and assembles the final response.
8. The frontend renders trajectory, disease evidence, baseline comparison, and next-best-test UI.

## 5. Integration Boundaries

The system is intentionally split so each layer stays replaceable and independently testable.

- Frontend communicates only with the backend through the API contract in `docs/API.md`.
- Backend communicates with the ML module through the backend-to-ML contract in `docs/API.md`.
- Frontend components must not directly call or depend on the ML model.
- ML logic must not be placed directly inside Express routes.
- Mock data must follow the same structure as the real contract so teams can work independently before integration.

## 6. Offline Architecture

The final application must work fully offline.

- Electron runs the desktop application shell.
- React runs as the local user interface.
- Express runs as the local backend service.
- Python ML inference runs locally with the model.
- No internet connection is required for prediction flow in the final application.

## 7. Development And Integration Strategy

The development flow for the 24-hour hackathon is:

1. Independent development with mocks
2. Frontend -> Backend integration
3. Backend -> ML integration
4. Full end-to-end integration
5. Electron/offline integration
6. Testing and polishing

This approach allows every member to make progress in parallel while reducing integration risk late in the hackathon.

## 8. Repository And Ownership

```text
frontend/   React UI and client-side logic
backend/    Express API and orchestration
ml/         Python inference and model logic
electron/   Desktop application wrapper
docs/       Shared contracts and architecture docs
```

Ownership mapping:

- `frontend/`: Devansh and Shivangi
- `backend/`: Rishabh
- `ml/`: Shayan and Aneesh
- `electron/`: Integration during offline packaging
- `docs/`: Shared reference for all members

## 9. Important Architectural Rules

- Treat `docs/API.md` as the source of truth for module communication.
- Do not modify implementation contracts without first updating the shared docs process as a team.
- Build every module so it works with mock data before real integration.
- Keep frontend, backend, and ML concerns separated.
- Keep ML logic inside the Python ML layer, not inside Express route handlers.
- Keep the final app runnable without internet.
- Optimize for simple integration and fast debugging over unnecessary complexity.
