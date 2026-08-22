import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SymptomInput from "../SymptomInput";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function Harness({ onChange = () => {}, inputRef }) {
  const [symptoms, setSymptoms] = useState([]);
  return (
    <SymptomInput
      ref={inputRef}
      symptoms={symptoms}
      onChange={(nextSymptoms) => {
        setSymptoms(nextSymptoms);
        onChange(nextSymptoms);
      }}
    />
  );
}

function typeDescription(text) {
  const textarea = container.querySelector("textarea");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(
      textarea,
      text
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return textarea;
}

function finishDebounce() {
  act(() => vi.advanceTimersByTime(350));
}

describe("SymptomInput automatic parsing", () => {
  it("automatically includes and displays confident matches without a review click", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("peeing a lot more, feeling pain in my chest");
    finishDebounce();

    expect(onChange).toHaveBeenLastCalledWith(["polyuria", "chest_pain"]);
    expect(container.textContent).toContain("Passing urine very often");
    expect(container.textContent).toContain("Chest pain");
    expect(container.textContent).not.toContain("Review what we understood");
  });

  it("flushes text synchronously before the debounce has fired", () => {
    const onChange = vi.fn();
    const inputRef = React.createRef();
    act(() => root.render(<Harness inputRef={inputRef} onChange={onChange} />));

    typeDescription("peeing a lot more, feeling pain in my chest");
    let submittedSymptoms;
    act(() => {
      submittedSymptoms = inputRef.current.flush();
    });

    expect(submittedSymptoms).toEqual(["polyuria", "chest_pain"]);
    expect(onChange).toHaveBeenLastCalledWith(["polyuria", "chest_pain"]);
  });

  it("keeps negated symptoms visible but excluded", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("not feeling any chest pain");
    finishDebounce();

    expect(container.textContent).toContain("Not present: Chest pain");
    expect(container.querySelector('[aria-label="Remove Chest pain"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("requires a choice for ambiguous symptoms", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("I have swelling");
    finishDebounce();

    expect(container.textContent).toContain("What did “swelling” mean?");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("surfaces unmatched text without coercing it", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("flibbertigibbet");
    finishDebounce();

    expect(container.textContent).toContain("We didn’t recognise this");
    expect(container.textContent).toContain("flibbertigibbet");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("merges manual and parsed symptoms without duplicates", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("chest pain");
    finishDebounce();

    const manualSelect = container.querySelector(".symptom-manual-pick select");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(
        manualSelect,
        "chest_pain"
      );
      manualSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => container.querySelector(".symptom-manual-pick button").click());

    expect(container.querySelectorAll('[aria-label="Remove Chest pain"]')).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("keeps automatically parsed chips individually removable", () => {
    const onChange = vi.fn();
    act(() => root.render(<Harness onChange={onChange} />));

    typeDescription("chest pain");
    finishDebounce();
    act(() => container.querySelector('[aria-label="Remove Chest pain"]').click());

    expect(container.querySelector('[aria-label="Remove Chest pain"]')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("defaults the manual-add dropdown to a placeholder", () => {
    act(() => root.render(<Harness />));

    const manualSelect = container.querySelector(".symptom-manual-pick select");
    expect(manualSelect.value).toBe("");
    expect([...manualSelect.options].find((option) => option.value === "").textContent).toBe(
      "Select a symptom…"
    );
    expect(container.querySelector(".symptom-manual-pick button").disabled).toBe(true);
  });

  it("renders chip labels in sentence case rather than title case", () => {
    act(() =>
      root.render(<SymptomInput symptoms={["polyuria", "chest_pain"]} onChange={() => {}} />)
    );

    expect(container.textContent).toContain("Passing urine very often");
    expect(container.textContent).toContain("Chest pain");
    expect(container.textContent).not.toContain("Passing Urine Very Often");
  });

  it("renders manual dropdown options in sentence case without changing their values", () => {
    act(() => root.render(<Harness />));

    const option = [...container.querySelector(".symptom-manual-pick select").options].find(
      (item) => item.value === "polyuria"
    );
    expect(option.textContent).toBe("Passing urine very often");
    expect(option.value).toBe("polyuria");
  });
});
