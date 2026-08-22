import React from "react";

const SYMPTOM_OPTIONS = [
  "fatigue",
  "frequent_urination",
  "blurred_vision",
  "chest_pain",
  "shortness_of_breath",
  "headache",
  "dizziness",
  "weight_loss",
  "nausea",
  "swelling",
];

export default function SymptomFields({ symptoms, onChange }) {
  const toggle = (symptom) => {
    const next = new Set(symptoms);
    if (next.has(symptom)) {
      next.delete(symptom);
    } else {
      next.add(symptom);
    }
    onChange(Array.from(next));
  };

  return (
    <fieldset className="form-section">
      <legend>Symptoms</legend>
      <div className="chip-group">
        {SYMPTOM_OPTIONS.map((symptom) => (
          <button
            type="button"
            key={symptom}
            className={`chip ${symptoms.includes(symptom) ? "chip-active" : ""}`}
            onClick={() => toggle(symptom)}
          >
            {symptom.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
