import React from "react";

const FIELDS = [
  { key: "glucose", label: "Glucose (mg/dL)" },
  { key: "cholesterol", label: "Total Cholesterol (mg/dL)" },
  { key: "triglycerides", label: "Triglycerides (mg/dL)" },
  { key: "hdl", label: "HDL (mg/dL)" },
];

export default function LabFields({ labs, errors, onChange }) {
  return (
    <fieldset className="form-section">
      <legend>Laboratory Results</legend>
      <div className="form-grid">
        {FIELDS.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="0.1"
              value={labs[key]}
              onChange={(event) => onChange(key, event.target.value)}
            />
            {errors[key] && <span className="field-error">{errors[key]}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
