import React from "react";
import "./personSwitcher.css";

// Shown for the patient role: makes it unambiguous whose data is being
// entered, and offers explicit ways to switch to another saved person or
// add a new one (e.g. a family member). Switching is always explicit -
// never inferred from typed input.
export default function PersonSwitcher({
  profiles,
  activePatientId,
  onSwitch,
  onAddPerson,
  addLabel = "Add a family member",
}) {
  const active = profiles.find((profile) => profile.patientId === activePatientId);

  return (
    <div className="person-switcher">
      <span className="person-switcher-current">
        Continuing as <strong>{active?.patientId || activePatientId}</strong>
      </span>
      {profiles.length > 1 && (
        <label className="person-switcher-select-label">
          Switch person
          <select
            className="form-control"
            value={activePatientId || ""}
            onChange={(event) => onSwitch(event.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.patientId} value={profile.patientId}>
                {profile.patientId}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="btn-secondary" onClick={onAddPerson}>
        {addLabel}
      </button>
    </div>
  );
}
