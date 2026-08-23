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

function toggle() {
  return container.querySelector(".vitals-provider-toggle");
}

async function expand() {
  await click(toggle());
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
  it("labels the only available provider as simulated and does not imply a real device", async () => {
    render("P001");
    await expand();

    expect(container.textContent).toContain("Simulated - not a real device");
    expect(container.textContent).toContain("No real device integration exists in this build");
    expect(container.textContent.toLowerCase()).not.toContain("fitbit");
  });

  it("starts collapsed to a summary row and only reveals the sources on request", async () => {
    render("P001");

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".vitals-provider-details")).toBeNull();
    expect(container.textContent).toContain("Vitals sources");
    expect(container.textContent).toContain("Not connected");
    expect(findButton("Connect")).toBeUndefined();

    await expand();

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const details = container.querySelector(".vitals-provider-details");
    expect(details).toBeTruthy();
    expect(toggle().getAttribute("aria-controls")).toBe(details.id);
    expect(findButton("Connect")).toBeTruthy();

    await click(toggle());

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".vitals-provider-details")).toBeNull();
  });

  it("keeps the collapsed panel to a single compact row above the form", async () => {
    render("P001");

    const panel = container.querySelector(".vitals-provider-panel");
    // Collapsed, the panel is only the summary row: nothing else is rendered
    // that could stretch it into a full-width block above the form.
    expect(panel.children).toHaveLength(1);
    expect(panel.firstElementChild.classList.contains("vitals-provider-summary")).toBe(true);

    await expand();

    // Expanding adds the card that carries the provider list and actions.
    expect(panel.children).toHaveLength(2);
    expect(container.querySelector(".vitals-provider-details")).toBeTruthy();
  });

  it("keeps the simulated disclosure and the reading count on the collapsed row", async () => {
    render("P001");
    await expand();
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));
    const recordedCount = listReadings("P001").length;

    await click(toggle());

    const summary = container.querySelector(".vitals-provider-summary");
    expect(container.querySelector(".vitals-provider-details")).toBeNull();
    expect(summary.textContent).toContain("Simulated - not a real device");
    expect(summary.textContent).toContain("connected");
    expect(summary.textContent).toContain(`${recordedCount} readings recorded`);
  });

  it("records nothing until the provider is explicitly connected and fetched", async () => {
    render("P001");

    await expand();
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
    await expand();
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));

    expect(container.textContent).toContain("Simulated device data");
    expect(container.textContent).toContain("median of");
  });

  it("keeps readings and their simulated marking after disconnecting", async () => {
    render("P001");
    await expand();
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
    await expand();
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));
    expect(container.textContent).toContain("Simulated device data");

    render("P002");

    expect(container.textContent).not.toContain("Recorded device readings");
    expect(getConnectedProviderId("P002")).toBeNull();
    expect(listReadings("P002")).toEqual([]);
    expect(listReadings("P001").length).toBeGreaterThan(0);
  });

  it("resets the expanded state and the summary count when the person changes", async () => {
    render("P001");
    await expand();
    await click(findButton("Connect"));
    await click(findButton("Fetch last 24 hours"));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");

    render("P002");

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".vitals-provider-details")).toBeNull();
    const summary = container.querySelector(".vitals-provider-summary");
    expect(summary.textContent).toContain("Not connected");
    expect(summary.textContent).not.toContain("readings recorded");
    expect(summary.textContent).not.toContain("Simulated - not a real device");
  });
});
