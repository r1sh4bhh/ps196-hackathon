import React from "react";
import { ROLES } from "../storage/roleStore";

// A visible, reversible display-mode switch - not an authentication
// control. Anyone using this device can flip roles at any time.
export default function RoleSwitcher({ role, onSwitch }) {
  if (!role) {
    return null;
  }

  const nextRole = role === ROLES.CLINICIAN ? ROLES.PATIENT : ROLES.CLINICIAN;

  return (
    <button
      type="button"
      className="theme-toggle role-switcher"
      onClick={() => onSwitch(nextRole)}
    >
      Mode: {role === ROLES.CLINICIAN ? "Clinician" : "Patient"} - switch to{" "}
      {nextRole === ROLES.CLINICIAN ? "Clinician" : "Patient"}
    </button>
  );
}
