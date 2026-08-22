import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import QuestionnaireStep from "../QuestionnaireStep";
import ReviewStep from "../ReviewStep";

let container;
let root;

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

describe("shared select controls", () => {
  it("styles every questionnaire and review select with the shared control class", () => {
    act(() =>
      root.render(
        <>
          <QuestionnaireStep answers={{}} errors={{}} onChange={() => {}} />
          <ReviewStep
            answers={{}}
            observations={[
              {
                __obsId: "unresolved-lab",
                rawName: "Unresolved lab",
                status: "needs_review",
                key: null,
              },
            ]}
            manualLabs={{}}
            onManualLabsChange={() => {}}
            onObservationsChange={() => {}}
          />
        </>
      )
    );

    const selects = [...container.querySelectorAll("select")];
    expect(selects.length).toBeGreaterThan(0);
    expect(selects.every((select) => select.classList.contains("form-control"))).toBe(true);
    expect(selects.slice(0, 5).every((select) => select.value === "")).toBe(true);
  });
});

describe("shared checkbox controls", () => {
  it("styles every boolean question's checkbox with the shared control class", () => {
    act(() => root.render(<QuestionnaireStep answers={{}} errors={{}} onChange={() => {}} />));

    const checkboxes = [...container.querySelectorAll('input[type="checkbox"]')];
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((checkbox) => checkbox.classList.contains("checkbox-control"))).toBe(
      true
    );
  });

  it("associates each checkbox with its visible label text via a wrapping <label>", () => {
    act(() => root.render(<QuestionnaireStep answers={{}} errors={{}} onChange={() => {}} />));

    const checkboxes = [...container.querySelectorAll('input[type="checkbox"]')];
    for (const checkbox of checkboxes) {
      const label = checkbox.closest("label");
      expect(label).not.toBeNull();
      expect(label.querySelector("span").textContent.length).toBeGreaterThan(0);
    }
  });

  it("toggles the checkbox when the answer changes, keeping it a real native input", () => {
    let answers = { family_diabetes: false };
    const handleChange = (next) => {
      answers = next;
    };

    act(() =>
      root.render(
        <QuestionnaireStep answers={answers} errors={{}} onChange={handleChange} />
      )
    );

    const checkbox = [...container.querySelectorAll('input[type="checkbox"]')].find(
      (input) => input.closest("label").textContent.includes("diabetes")
    );

    expect(checkbox.type).toBe("checkbox");
    expect(checkbox.checked).toBe(false);
  });
});
