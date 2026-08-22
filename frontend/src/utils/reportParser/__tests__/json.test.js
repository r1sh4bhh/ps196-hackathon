import { describe, expect, it } from "vitest";
import { parseJson } from "../parsers/json";

describe("parseJson", () => {
  it("parses a {results:[...]} shape", () => {
    const json = JSON.stringify({
      results: [{ testName: "Glucose", value: 145, unit: "mg/dL" }],
    });

    const [observation] = parseJson(json);

    expect(observation.key).toBe("glucose");
    expect(observation.value).toBe(145);
  });

  it("parses a {tests:[...]} shape", () => {
    const json = JSON.stringify({ tests: [{ name: "HDL", result: 35, units: "mg/dL" }] });

    const [observation] = parseJson(json);

    expect(observation.key).toBe("hdl");
    expect(observation.value).toBe(35);
  });

  it("parses a bare array", () => {
    const json = JSON.stringify([{ name: "Triglycerides", value: 150, unit: "mg/dL" }]);

    const [observation] = parseJson(json);

    expect(observation.key).toBe("triglycerides");
  });

  it("parses a flat object shape", () => {
    const json = JSON.stringify({ glucose: 145, cholesterol: 220 });

    const observations = parseJson(json);

    expect(observations).toHaveLength(2);
    expect(observations.map((o) => o.key).sort()).toEqual(["cholesterol", "glucose"]);
  });

  it("returns an empty array on malformed JSON", () => {
    expect(parseJson("{not valid json")).toEqual([]);
    expect(parseJson("")).toEqual([]);
    expect(parseJson(null)).toEqual([]);
  });
});
