import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  saveProfile,
  loadProfile,
  hasProfile,
  clearProfile,
  exportProfile,
  importProfile,
  saveDraft,
  loadDraft,
  clearDraft,
  listProfiles,
  getActivePatientId,
  setActivePatientId,
} from "../userProfileStore";

describe("userProfileStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a saved profile", () => {
    saveProfile({ patientId: "P001", questionnaire: { age: 30 } });

    const loaded = loadProfile();
    expect(loaded.patientId).toBe("P001");
    expect(loaded.questionnaire.age).toBe(30);
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.updatedAt).toBeTruthy();
    expect(hasProfile()).toBe(true);
  });

  it("returns null when no profile has been saved", () => {
    expect(loadProfile()).toBeNull();
    expect(hasProfile()).toBe(false);
  });

  it("returns null instead of throwing on corrupted storage", () => {
    localStorage.setItem("ps196_user_profile", "{not valid json");
    expect(() => loadProfile()).not.toThrow();
    expect(loadProfile()).toBeNull();
  });

  it("clears a stored profile", () => {
    saveProfile({ patientId: "P001" });
    clearProfile();
    expect(loadProfile()).toBeNull();
  });

  it("exports and imports a profile as JSON", () => {
    saveProfile({ patientId: "P002" });
    const exported = exportProfile();
    expect(typeof exported).toBe("string");

    clearProfile();
    const imported = importProfile(exported);
    expect(imported.patientId).toBe("P002");
    expect(loadProfile().patientId).toBe("P002");
  });

  it("returns null when importing invalid JSON", () => {
    expect(importProfile("not json")).toBeNull();
  });

  it("migrates a legacy single-profile record into the multi-person store", () => {
    localStorage.setItem(
      "ps196_user_profile",
      JSON.stringify({ patientId: "P001", schemaVersion: 1, questionnaire: { age: 40 } })
    );

    expect(loadProfile().patientId).toBe("P001");
    expect(getActivePatientId()).toBe("P001");
    expect(listProfiles()).toHaveLength(1);
  });

  it("supports multiple saved people without one leaking into another", () => {
    saveProfile({ patientId: "P001", questionnaire: { age: 30 } });
    saveProfile({ patientId: "P002", questionnaire: { age: 55 } });

    expect(listProfiles().map((profile) => profile.patientId).sort()).toEqual(["P001", "P002"]);
    expect(getActivePatientId()).toBe("P002");
    expect(loadProfile("P001").questionnaire.age).toBe(30);
    expect(loadProfile("P002").questionnaire.age).toBe(55);
    expect(loadProfile().patientId).toBe("P002");

    expect(setActivePatientId("P001")).toBe(true);
    expect(getActivePatientId()).toBe("P001");
    expect(loadProfile().patientId).toBe("P001");

    // Switching back must not have mutated the other person's stored data.
    expect(loadProfile("P002").questionnaire.age).toBe(55);
  });

  it("does not switch the active person to one that was never saved", () => {
    saveProfile({ patientId: "P001" });
    expect(setActivePatientId("does-not-exist")).toBe(false);
    expect(getActivePatientId()).toBe("P001");
  });

  it("falls back to an empty store instead of throwing on malformed multi-profile data", () => {
    localStorage.setItem("ps196_user_profiles", "{not valid json");
    expect(() => loadProfile()).not.toThrow();
    expect(loadProfile()).toBeNull();
    expect(listProfiles()).toEqual([]);
  });

  it("round-trips a draft and clears it", () => {
    saveDraft({ stepIndex: 1, answers: { age: 25 } });
    const draft = loadDraft();
    expect(draft.stepIndex).toBe(1);
    expect(draft.answers.age).toBe(25);

    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
