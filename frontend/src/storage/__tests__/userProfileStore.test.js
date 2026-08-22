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

  it("round-trips a draft and clears it", () => {
    saveDraft({ stepIndex: 1, answers: { age: 25 } });
    const draft = loadDraft();
    expect(draft.stepIndex).toBe(1);
    expect(draft.answers.age).toBe(25);

    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
