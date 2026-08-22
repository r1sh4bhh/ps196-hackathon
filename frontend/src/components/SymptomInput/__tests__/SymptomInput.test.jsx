import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SymptomInput from "../SymptomInput";

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

describe("SymptomInput confirmation", () => {
  it("does not submit parsed suggestions until the user adds one", () => {
    const onChange = vi.fn();
    const parser = {
      parse: () => ({
        matched: [
          {
            symptom: "fatigue",
            displayLabel: "Fatigue",
            matchedText: "tired",
            confidence: 0.95,
            method: "synonym",
          },
        ],
        negated: [],
        ambiguous: [],
        unmatched: [],
      }),
    };

    act(() => root.render(<SymptomInput symptoms={[]} onChange={onChange} parser={parser} />));
    const textarea = container.querySelector("textarea");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(
        textarea,
        "tired"
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const reviewButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Review what we understood")
    );
    act(() => reviewButton.click());

    expect(container.textContent).toContain("Possible matches");
    expect(onChange).not.toHaveBeenCalled();

    const addButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("+ Fatigue")
    );
    act(() => addButton.click());
    expect(onChange).toHaveBeenCalledWith(["fatigue"]);
  });
});
