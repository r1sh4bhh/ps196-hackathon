import React from "react";

export default function DemographicFields({ formData, errors, onChange }) {
  return (
    <fieldset className="form-section">
      <legend>Demographics</legend>
      <div className="form-grid">
        <label>
          Patient ID
          <input
            type="text"
            value={formData.patientId}
            onChange={(event) => onChange("patientId", event.target.value)}
            placeholder="e.g. P001"
          />
          {errors.patientId && <span className="field-error">{errors.patientId}</span>}
        </label>

        <label>
          Age
          <input
            type="number"
            value={formData.age}
            onChange={(event) => onChange("age", event.target.value)}
            placeholder="e.g. 45"
          />
          {errors.age && <span className="field-error">{errors.age}</span>}
        </label>
      </div>
    </fieldset>
  );
}
