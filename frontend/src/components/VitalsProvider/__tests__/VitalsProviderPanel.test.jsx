import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VitalsProviderPanel from "../VitalsProviderPanel";
import { getConnectedProviderId, listReadings } from "../../../storage/vitalsReadingStore";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

function render(patientId) {
  act(() => {
    root.render(<VitalsProviderPanel patientId={patientId} />);
  });
}

function findButton(text) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent.includes(text)
  );
}

async function click(button) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("VitalsProviderPanel", () => {
  it("labels the only available provider as simulated and does not imply a real device", () => {
    render("P001");

    expect(container.textContent).toContain("Simulated - not a real device");
    expect(container.textContent).toContain("No real device integration exists in this build");
    expect(container.textContent.toLowerCase()).not.toContain("fitbit");
  });

  it("records nothing until the provider is explicitly connected and fetched", async () => {
    render("P001");

    expect(listReadings("P001")).toEqual([]);
    expect(container.textContent).not.toContain("Recorded device readings");

    await click(findButton("Connect"));
    expect(getConnectedProviderId("P001")).toBe("simulated");
    expect(listReadings("P001")).toEqual([]);

    await click(findButton("Fetch last 24 hours"));
    expect(listReadings("P001").length).toBeGreaterThan(0);
  });

  it("marks displayed device values as simulated in plain language", async () => {
    render("P001");
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));

    expect(container.textContent).toContain("Simulated device data");
    expect(container.textContent).toContain("median of");
  });

  it("keeps readings and their simulated marking after disconnecting", async () => {
    render("P001");
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));
    const recorded = listReadings("P001");

    await click(findButton("Disconnect"));

    expect(getConnectedProviderId("P001")).toBeNull();
    expect(listReadings("P001")).toEqual(recorded);
    expect(listReadings("P001").every((reading) => reading.simulated)).toBe(true);
    expect(container.textContent).toContain("Simulated device data");
    expect(container.textContent).toContain("stay marked as simulated device data permanently");
  });

  it("never shows one person's device readings for another person", async () => {
    render("P001");
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));
    expect(container.textContent).toContain("Simulated device data");

    render("P002");

    expect(container.textContent).not.toContain("Recorded device readings");
    expect(getConnectedProviderId("P002")).toBeNull();
    expect(listReadings("P002")).toEqual([]);
    expect(listReadings("P001").length).toBeGreaterThan(0);
  });
});
