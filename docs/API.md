# PS196 API Contract

This document defines the data exchanged between the Frontend, Backend, and Machine Learning modules.

> **Important:** All team members must follow this contract.
> Do not rename, remove, or change fields without informing the entire team.

---

## 1. POST /predict

### Purpose

Accept patient health data and return disease risk predictions, an illustrative
trajectory, evidence, and recommended next tests.

---

### Request

**Frontend → Backend**

**Endpoint:**

```text
POST /predict
```

Request Body:

```json
{
  "patientData": {
    "patientId": "P001",
    "age": 45,
    "vitals": {
      "systolic_bp": 140,
      "diastolic_bp": 90,
      "heart_rate": 85,
      "temperature": 98.6,
      "weight_kg": 85,
      "height_cm": 175
    },
    "symptoms": ["fatigue", "frequent_urination", "blurred_vision"],
    "labs": {
      "glucose": 145,
      "cholesterol": 220,
      "triglycerides": 150,
      "hdl": 35
    }
  }
}
```

### Success Response

**Backend → Frontend**

HTTP Status:

```text
200 OK
```

Response Body:

```json
{
  "status": "success",
  "prediction": {
    "risk_scores": {
      "diabetes": 0.82,
      "hypertension": 0.71,
      "heart_disease": 0.64,
      "obesity": 0.58
    },
    "top_disease": "diabetes",
    "confidence": 0.82,
    "trajectory": [
      {
        "day": 1,
        "risk": 0.83,
        "illustrative": true
      },
      {
        "day": 2,
        "risk": 0.84,
        "illustrative": true
      },
      {
        "day": 3,
        "risk": 0.85,
        "illustrative": true
      },
      {
        "day": 4,
        "risk": 0.86,
        "illustrative": true
      },
      {
        "day": 5,
        "risk": 0.87,
        "illustrative": true
      }
    ],
    "evidence": [
      {
        "disease": "diabetes",
        "factors": ["high_glucose"],
        "next_test": "HbA1c"
      }
    ]
  }
}
```

### Additive fields (optional, may be absent)

When the real ML layer (`USE_MOCK_ML=false`) produces a prediction, the response also
includes:

- `source`: `"model"` when the result came from the trained models/rules, or `"mock"`
  when it fell back to the mock layer (see `fallback_reason` below).
- `fallback_reason` (mock only): why the real ML layer was unavailable.
- `ml_detail`: the full output of `ml/inference/inference.py`, preserved rather than
  discarded so the honest caveats survive the trip to the frontend. Includes
  `symptom_differential`, `diabetes_risk`, `cardiac_risk`, `hypertension`, `obesity`,
  `review_priority`, `degraded`, and `disclaimer` — in particular the `partial_input`,
  `missing_key_inputs`, `defaulted_features`, `risk_band`,
  `confidence_is_ranking_only`, and `sparse_input` fields nested within those
  sections. The frontend may ignore this field today; it must not be removed from
  the response.
- `trajectory[].illustrative`: `true` on every point — the trajectory is a placeholder
  curve (today's top risk plus a fixed increment per day), not a model forecast.

None of these change the existing `risk_scores` / `top_disease` / `confidence` /
`trajectory` / `evidence` shape above.

### Error Response

**Backend → Frontend**

HTTP Status:

```text
400 Bad Request
```

Response Body:

```json
{
  "status": "error",
  "message": "Invalid patient data"
}
```

## 2. GET /health

### Purpose

Check whether the local backend server is running.

### Endpoint:

```text
GET /health
```

### Success Response

HTTP Status:

```text
200 OK
```

Response Body:

```json
{
  "status": "ok"
}
```

## 3. Backend → ML Contract

The Backend sends processed patient data to the ML inference module.

### Legacy normalized shape

`symptoms_encoded` is retained for compatibility with the normalized mock
payload, but neither the mock predictor nor the real inference bridge consumes
it. The real bridge sends the confirmed `symptoms` names from the request, and
Python builds its own vector using `MODEL_A_SYMPTOMS`.

```json
{
  "normalized_vitals": {
    "systolic_bp": 0.8,
    "diastolic_bp": 0.75,
    "heart_rate": 0.6,
    "bmi": 27.8
  },
  "symptoms_encoded": [0, 0, "... 132 entries in MODEL_A_SYMPTOMS order"],
  "labs_normalized": {
    "glucose": 0.9,
    "cholesterol": 0.7
  }
}
```

### ML Output

```json
{
  "risk_scores": {
    "diabetes": 0.82,
    "hypertension": 0.71,
    "heart_disease": 0.64,
    "obesity": 0.58
  },
  "top_disease": "diabetes",
  "confidence": 0.82
}
```

## 4. Contract Rules

- Frontend must send patient data according to the request schema.
- Backend must validate incoming patient data.
- Backend must return responses according to the success/error schemas.
- ML output must be compatible with the Backend.
- Mock responses must follow the same structure as real responses.
- Field names must remain consistent across Frontend, Backend, and ML.
- Do not rename, remove, or change fields without informing the entire team.
- If the contract changes, update this document before changing implementation code.
- Frontend components should be developed using mock data before backend integration.
- Backend should initially support a mock ML response before the real ML model is integrated.
- ML development should be independent of the Frontend.
- This hosted API requires a network connection; local/offline operation requires
  running the backend and Python inference layer on the same local machine.
