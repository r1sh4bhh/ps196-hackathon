import React from "react";
import { formatStoredLabAge, getStoredLabStatus } from "../../utils/labFreshness";

const FIELDS = [
  { key: "glucose", label: "Glucose", unit: "mg/dL" },
  { key: "cholesterol", label: "Total Cholesterol", unit: "mg/dL" },
  { key: "triglycerides", label: "Triglycerides", unit: "mg/dL" },
  { key: "hdl", label: "HDL", unit: "mg/dL" },
];

export default function LabFields({
  labs,
  errors,
  storedLabs = {},
  reusedLabs = {},
  onChange,
  onReuse,
}) {
  return (
    <fieldset className="form-section">
      <legend>Laboratory Results</legend>
      <div className="form-grid">
        {FIELDS.map(({ key, label, unit }) => {
          const stored = getStoredLabStatus(key, storedLabs[key]);
          const isReused = Boolean(reusedLabs[key]);
          return (
            <label key={key}>
              {label} ({unit})
              <input
                className={isReused ? "lab-input-carried" : undefined}
                type="number"
                step="0.1"
                value={labs[key]}
                onChange={(event) => onChange(key, event.target.value)}
              />
              {stored ? (
                <span className={`lab-history${stored.isFresh ? "" : " lab-history-stale"}`}>
                  {isReused ? "Carried forward" : "Previous result"}: {label} {stored.value} {unit} —{" "}
                  {formatStoredLabAge(stored)}
                  {!stored.isFresh ? " — stale" : ""}
                  {!isReused ? (
                    // Stale values remain a visible reference but require an
                    // explicit action, preventing accidental silent reuse.
                    <button type="button" className="btn-ghost lab-reuse" onClick={() => onReuse(key)}>
                      Reuse previous value
                    </button>
                  ) : null}
                </span>
              ) : null}
              {errors[key] && <span className="field-error">{errors[key]}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
