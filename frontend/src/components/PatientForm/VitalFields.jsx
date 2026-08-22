import React from "react";

const FIELDS = [
  { key: "systolic_bp", label: "Systolic BP (mmHg)" },
  { key: "diastolic_bp", label: "Diastolic BP (mmHg)" },
  { key: "heart_rate", label: "Heart Rate (bpm)" },
  { key: "temperature", label: "Temperature (°F)" },
  { key: "weight_kg", label: "Weight (kg)" },
  { key: "height_cm", label: "Height (cm)" },
];

export default function VitalFields({ vitals, errors, onChange, hiddenFields = [] }) {
  const visibleFields = FIELDS.filter(({ key }) => !hiddenFields.includes(key));

  return (
    <fieldset className="form-section">
      <legend>Vitals</legend>
      <div className="form-grid">
        {visibleFields.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="0.1"
              value={vitals[key]}
              onChange={(event) => onChange(key, event.target.value)}
            />
            {errors[key] && <span className="field-error">{errors[key]}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
