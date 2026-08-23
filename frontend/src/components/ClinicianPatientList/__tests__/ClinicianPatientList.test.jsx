import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ClinicianPatientList from "../ClinicianPatientList";

let container;
let root;

function renderList(props) {
  act(() =>
    root.render(
      <ClinicianPatientList
        patients={[]}
        onSelectPatient={() => {}}
        onAddPatient={() => {}}
        onLoadDemoPatients={() => {}}
        onClearDemoPatients={() => {}}
        onViewHistory={() => {}}
        {...props}
      />
    )
  );
}

function findButton(text) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === text
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("clinician patient list header", () => {
  it("keeps 'Add new patient' as the only primary action and de-emphasises demo controls", () => {
    renderList();

    const primaries = [...container.querySelectorAll(".btn-primary")];
    expect(primaries).toHaveLength(1);
    expect(primaries[0].textContent.trim()).toBe("Add new patient");

    const demoControls = container.querySelector(".clinician-demo-controls");
    expect(demoControls).not.toBeNull();
    expect(demoControls.textContent).toContain("Load demo patients");
    expect(demoControls.textContent).toContain("Clear demo patients");
    expect(demoControls.querySelector(".btn-primary")).toBeNull();
  });

  it("surfaces 'Load demo patients' inside the empty state", () => {
    let loaded = 0;
    renderList({
      onLoadDemoPatients: () => {
        loaded += 1;
      },
    });

    const emptyStateButton = container.querySelector(".clinician-patient-list-empty button");
    expect(emptyStateButton.textContent.trim()).toBe("Load demo patients");

    act(() => emptyStateButton.click());
    expect(loaded).toBe(1);
  });
});

describe("clearing demo patients", () => {
  it("does not clear anything until the action is confirmed", () => {
    let cleared = 0;
    renderList({
      onClearDemoPatients: () => {
        cleared += 1;
      },
    });

    act(() => findButton("Clear demo patients").click());
    expect(cleared).toBe(0);

    const confirmation = container.querySelector(".confirm-action");
    expect(confirmation.textContent).toContain("visit history will be removed");
    expect(confirmation.textContent).toContain("Real patient records are not affected");

    act(() => findButton("Yes, clear demo patients").click());
    expect(cleared).toBe(1);
  });

  it("cancels without clearing and restores the original button", () => {
    let cleared = 0;
    renderList({
      onClearDemoPatients: () => {
        cleared += 1;
      },
    });

    act(() => findButton("Clear demo patients").click());
    act(() => findButton("Cancel").click());

    expect(cleared).toBe(0);
    expect(container.querySelector(".confirm-action")).toBeNull();
    expect(findButton("Clear demo patients")).toBeDefined();
  });
});
