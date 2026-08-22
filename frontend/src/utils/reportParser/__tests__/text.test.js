import { describe, expect, it } from "vitest";
import { parseText } from "../parsers/text";

describe("parseText", () => {
  it("extracts test name, value, unit, and reference range", () => {
    const text = "Glucose: 145 mg/dL (70-110)\nHDL 35 mg/dL";

    const observations = parseText(text, { fileName: "report.txt" });

    expect(observations).toHaveLength(2);
    expect(observations[0].key).toBe("glucose");
    expect(observations[0].value).toBe(145);
    expect(observations[0].refRange).toBe("70-110");
    expect(observations[1].key).toBe("hdl");
  });

  it("sniffs a document-level date", () => {
    const text = "Report date: 2024-01-15\nGlucose 145 mg/dL";

    const [observation] = parseText(text);

    expect(observation.observedAt).toBe("2024-01-15");
  });

  it("drops lines that don't resolve to a known lab key", () => {
    const text = "Some Unknown Marker 42 units\nGlucose 145 mg/dL";

    const observations = parseText(text);

    expect(observations).toHaveLength(1);
    expect(observations[0].key).toBe("glucose");
  });

  it("returns an empty array for empty/garbage input", () => {
    expect(parseText("")).toEqual([]);
    expect(parseText(null)).toEqual([]);
    expect(parseText("....!!!###")).toEqual([]);
  });
});
