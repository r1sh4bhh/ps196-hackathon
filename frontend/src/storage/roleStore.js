const ROLE_KEY = "ps196_role";

export const ROLES = { PATIENT: "patient", CLINICIAN: "clinician" };

// This is a local display-mode switch only -- it is not authentication.
// There is no password, no verified identity, and no protected records; any
// user of this device can change it at any time.
export function getRole() {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    return raw === ROLES.PATIENT || raw === ROLES.CLINICIAN ? raw : null;
  } catch {
    return null;
  }
}

export function setRole(role) {
  if (role !== ROLES.PATIENT && role !== ROLES.CLINICIAN) {
    return false;
  }
  try {
    localStorage.setItem(ROLE_KEY, role);
    return true;
  } catch {
    return false;
  }
}

export function hasRole() {
  return getRole() !== null;
}

export function clearRole() {
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch {
    // Ignore storage errors on clear.
  }
}
