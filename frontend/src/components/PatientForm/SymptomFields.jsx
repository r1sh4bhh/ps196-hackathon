import React from "react";
import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../../constants/symptoms";

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
        {CANONICAL_SYMPTOMS.map((symptom) => (
          <button
            type="button"
            key={symptom}
            className={`chip ${symptoms.includes(symptom) ? "chip-active" : ""}`}
            onClick={() => toggle(symptom)}
          >
            {SYMPTOM_LABELS[symptom]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
