import React from "react";
import { ROLES } from "../../storage/roleStore";
import "./roleSelect.css";

// This is a local display-mode switch, not a login. There is no password,
// account, or verified identity behind it - anyone using this device can
// change it at any time from the header.
export default function RoleSelect({ onSelect }) {
  return (
    <div className="role-select">
      <h1>Welcome to PS196</h1>
      <p className="subtitle">
        Choose how you&apos;ll use this device. This isn&apos;t a login - it just changes what you
        see, and you can switch it at any time.
      </p>
      <div className="role-select-options">
        <button
          type="button"
          className="role-select-option"
          onClick={() => onSelect(ROLES.PATIENT)}
        >
          <span className="role-select-title">I&apos;m a Patient</span>
          <span className="role-select-hint">Track your own health assessments over time.</span>
        </button>
        <button
          type="button"
          className="role-select-option"
          onClick={() => onSelect(ROLES.CLINICIAN)}
        >
          <span className="role-select-title">I&apos;m a Clinician</span>
          <span className="role-select-hint">Manage assessments for multiple patients.</span>
        </button>
      </div>
    </div>
  );
}
