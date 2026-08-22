import React, { useState } from "react";
import DemographicFields from "./DemographicFields";
import VitalFields from "./VitalFields";
import SymptomFields from "./SymptomFields";
import LabFields from "./LabFields";
import { validatePatientData } from "../../utils/validation";
import { submitPatientData } from "../../api/predictService";
import { computeAllBaselines } from "../../utils/baseline";
import { listAssessments, saveAssessment } from "../../storage/assessmentHistory";
import "./patientForm.css";

const initialState = {
  patientId: "",
  age: "",
  vitals: {
    systolic_bp: "",
    diastolic_bp: "",
    heart_rate: "",
    temperature: "",
    weight_kg: "",
    height_cm: "",
  },
  symptoms: [],
  labs: {
    glucose: "",
    cholesterol: "",
    triglycerides: "",
    hdl: "",
  },
};

export default function PatientForm({ onPredictionReceived, initialData }) {
  const [formData, setFormData] = useState(() => mergeInitialData(initialData));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const updateField = (section, field, value) => {
    setFormData((previous) => {
      if (section === "root") {
        return { ...previous, [field]: value };
      }

      return {
        ...previous,
        [section]: {
          ...previous[section],
          [field]: value,
        },
      };
    });
  };

  const updateSymptoms = (symptoms) => {
    setFormData((previous) => ({ ...previous, symptoms }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const normalized = normalizeFormData(formData);
    const { isValid, errors: validationErrors } = validatePatientData(normalized);
    setErrors(validationErrors);

    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const prediction = await submitPatientData(normalized);
      const history = listAssessments(normalized.patientId);
      const baselines = computeAllBaselines(history, normalized);
      saveAssessment({
        patientId: normalized.patientId,
        patientData: normalized,
        prediction,
        baselines,
      });
      onPredictionReceived(normalized, prediction, baselines);
    } catch (error) {
      setSubmitError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <header className="form-header">
        <h1>Patient Health Intake</h1>
        <p className="subtitle">
          Enter patient demographics, vitals, symptoms, and lab results to generate a disease risk
          prediction.
        </p>
      </header>

      <DemographicFields
        formData={formData}
        errors={errors}
        onChange={(field, value) => updateField("root", field, value)}
      />

      <VitalFields
        vitals={formData.vitals}
        errors={errors}
        onChange={(field, value) => updateField("vitals", field, value)}
      />

      <SymptomFields symptoms={formData.symptoms} onChange={updateSymptoms} />

      <LabFields
        labs={formData.labs}
        errors={errors}
        onChange={(field, value) => updateField("labs", field, value)}
      />

      {submitError && <div className="form-error-banner">{submitError}</div>}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Analyzing..." : "Generate Risk Prediction"}
        </button>
      </div>
    </form>
  );
}

function mergeInitialData(initialData) {
  if (!initialData) {
    return initialState;
  }

  return {
    patientId: initialData.patientId ?? initialState.patientId,
    age: nullToEmpty(initialData.age) ?? initialState.age,
    vitals: mergeSection(initialState.vitals, initialData.vitals),
    symptoms: initialData.symptoms ?? initialState.symptoms,
    labs: mergeSection(initialState.labs, initialData.labs),
  };
}

function mergeSection(defaults, overrides) {
  if (!overrides) {
    return defaults;
  }

  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (overrides[key] !== undefined) {
      merged[key] = nullToEmpty(overrides[key]) ?? defaults[key];
    }
  }
  return merged;
}

function nullToEmpty(value) {
  return value === null || value === undefined ? "" : value;
}

function normalizeFormData(formData) {
  return {
    patientId: formData.patientId,
    age: toNumber(formData.age),
    vitals: mapNumbers(formData.vitals),
    symptoms: formData.symptoms,
    labs: mapNumbers(formData.labs),
  };
}

function mapNumbers(obj) {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = toNumber(value);
  }

  return result;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}
