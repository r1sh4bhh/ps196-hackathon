import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import QuestionnaireStep from "../QuestionnaireStep";

let container;
let root;

function renderStep(answers = {}) {
  act(() => root.render(<QuestionnaireStep answers={answers} errors={{}} onChange={() => {}} />));
}

function findOption(value) {
  return [...container.querySelectorAll("option")].find((option) => option.value === value);
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

describe("questionnaire option labels", () => {
  it("renders dropdown options in sentence case without changing their values", () => {
    renderStep();

    expect(findOption("sedentary").textContent).toBe("Sedentary");
    expect(findOption("sedentary").value).toBe("sedentary");
    expect(findOption("occasional").textContent).toBe("Occasional");
    expect(findOption("occasional").value).toBe("occasional");
  });

  it("renders chip options in sentence case rather than title case", () => {
    renderStep();

    const chips = [...container.querySelectorAll(".chip")].map((chip) => chip.textContent);
    expect(chips).toContain("Kidney disease");
    expect(chips).not.toContain("Kidney Disease");
    expect(chips).not.toContain("kidney_disease");
  });

  it("keeps the stored value byte-identical when a chip is toggled", () => {
    let answers = {};
    act(() =>
      root.render(
        <QuestionnaireStep
          answers={answers}
          errors={{}}
          onChange={(next) => {
            answers = next;
          }}
        />
      )
    );

    const chip = [...container.querySelectorAll(".chip")].find(
      (button) => button.textContent === "Kidney disease"
    );
    act(() => chip.click());

    expect(answers.chronic_conditions).toEqual(["kidney_disease"]);
  });

  it("uses an explicit optionLabels entry verbatim instead of re-casing it", () => {
    renderStep();

    const chips = [...container.querySelectorAll(".chip")].map((chip) => chip.textContent);
    // baseline_symptoms carries SYMPTOM_LABELS as optionLabels.
    expect(chips).toContain("Passing urine very often");
  });
});
