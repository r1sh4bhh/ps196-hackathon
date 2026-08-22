import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROLES, clearRole, getRole, hasRole, setRole } from "../roleStore";

describe("roleStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("has no role by default", () => {
    expect(getRole()).toBeNull();
    expect(hasRole()).toBe(false);
  });

  it("persists a chosen role across reads", () => {
    expect(setRole(ROLES.PATIENT)).toBe(true);
    expect(getRole()).toBe(ROLES.PATIENT);
    expect(hasRole()).toBe(true);
  });

  it("allows switching roles at any time", () => {
    setRole(ROLES.PATIENT);
    expect(getRole()).toBe(ROLES.PATIENT);

    setRole(ROLES.CLINICIAN);
    expect(getRole()).toBe(ROLES.CLINICIAN);
  });

  it("rejects unknown role values", () => {
    expect(setRole("admin")).toBe(false);
    expect(getRole()).toBeNull();
  });

  it("ignores malformed stored values instead of throwing", () => {
    localStorage.setItem("ps196_role", "not-a-role");
    expect(() => getRole()).not.toThrow();
    expect(getRole()).toBeNull();
  });

  it("clears a stored role", () => {
    setRole(ROLES.CLINICIAN);
    clearRole();
    expect(getRole()).toBeNull();
    expect(hasRole()).toBe(false);
  });
});
