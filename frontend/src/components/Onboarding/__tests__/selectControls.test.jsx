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
