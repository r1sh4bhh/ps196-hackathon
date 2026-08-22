# PS196 API Contract

This document defines the data exchanged between the Frontend, Backend, and Machine Learning modules.

> **Important:** All team members must follow this contract.
> Do not rename, remove, or change fields without informing the entire team.

---

## 1. POST /predict

### Purpose

Accept patient health data and return disease risk predictions, risk trajectory, evidence, and recommended next tests.

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
    "symptoms": [
      "fatigue",
      "frequent_urination",
      "blurred_vision"
    ],
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
        "risk": 0.82
      },
      {
        "day": 2,
        "risk": 0.83
      },
      {
        "day": 3,
        "risk": 0.84
      },
      {
        "day": 4,
        "risk": 0.85
      },
      {
        "day": 5,
        "risk": 0.86
      }
    ],
    "evidence": [
      {
        "disease": "diabetes",
        "factors": [
          "high_glucose"
        ],
        "next_test": "HbA1c"
      }
    ]
  }
}
```

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

### Input

```json
{
  "normalized_vitals": {
    "systolic_bp": 0.8,
    "diastolic_bp": 0.75,
    "heart_rate": 0.6,
    "bmi": 27.8
  },
  "symptoms_encoded": [
    1,
    1,
    0,
    0,
    1
  ],
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
- The final system must support local/offline operation.