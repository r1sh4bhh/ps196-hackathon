import React from "react";
import { API_LAB_KEYS, LAB_DEFINITIONS } from "../../constants/labAliases";
import { collapseObservations } from "../../utils/reportParser/normalizer";

export default function ReviewStep({
  answers,
  observations,
  manualLabs,
  onManualLabsChange,
  onObservationsChange,
}) {
  const accepted = collapseObservations(observations);
  const flagged = (observations || []).filter(
    (observation) =>
      observation.status === "needs_review" || observation.status === "pending_manual_entry"
  );

  const handleManualChange = (key, value) => {
    onManualLabsChange({ ...manualLabs, [key]: value });
  };

  const handleRemap = (index, newKey) => {
    const next = [...observations];
    next[index] = { ...next[index], key: newKey, status: newKey ? "parsed" : next[index].status };
    onObservationsChange(next);
  };

  const handleDiscard = (index) => {
    const next = observations.filter((_, i) => i !== index);
    onObservationsChange(next);
  };

  return (
    <div className="review-step">
      <section className="form-section">
        <legend>Accepted Values</legend>
        {Object.keys(accepted).length === 0 && <p className="hint">No values parsed yet.</p>}
        <ul className="review-list">
          {Object.entries(accepted).map(([key, observation]) => (
            <li className="review-item" key={key}>
              <span>{LAB_DEFINITIONS[key]?.label || key}</span>
              <span>
                {observation.value} {observation.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {flagged.length > 0 && (
        <section className="form-section">
          <legend>Needs Review</legend>
          <ul className="review-list">
            {(observations || []).map((observation, index) => {
              if (
                observation.status !== "needs_review" &&
                observation.status !== "pending_manual_entry"
              ) {
                return null;
              }
              return (
                <li className="review-item review-item-flagged" key={observation.__obsId || index}>
                  <span>{observation.rawName}</span>
                  <select
                    value={observation.key || ""}
                    onChange={(event) => handleRemap(index, event.target.value || null)}
                  >
                    <option value="">Unresolved</option>
                    {Object.keys(LAB_DEFINITIONS).map((key) => (
                      <option key={key} value={key}>
                        {LAB_DEFINITIONS[key].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDiscard(index)}
                  >
                    Discard
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="form-section">
        <legend>Manual Lab Entry</legend>
        <div className="form-grid">
          {API_LAB_KEYS.map((key) => (
            <label className="field" key={key}>
              <span>
                {LAB_DEFINITIONS[key].label} ({LAB_DEFINITIONS[key].unit})
              </span>
              <input
                type="number"
                value={manualLabs?.[key] ?? ""}
                placeholder={accepted[key]?.value !== undefined ? String(accepted[key].value) : ""}
                onChange={(event) => handleManualChange(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <legend>Summary</legend>
        <p className="hint">
          {Object.values(answers || {}).filter(Boolean).length} questionnaire responses recorded.
        </p>
      </section>
    </div>
  );
}
