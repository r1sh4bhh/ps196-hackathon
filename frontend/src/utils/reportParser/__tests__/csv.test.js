import { describe, expect, it } from "vitest";
import { parseCsv } from "../parsers/csv";

describe("parseCsv", () => {
  it("parses standard comma-delimited rows with header mapping", () => {
    const csv = ["Test Name,Value,Unit,Reference Range", "Glucose,145,mg/dL,70-110"].join("\n");

    const [observation] = parseCsv(csv, { fileName: "labs.csv" });

    expect(observation.key).toBe("glucose");
    expect(observation.value).toBe(145);
    expect(observation.unit).toBe("mg/dL");
    expect(observation.status).toBe("parsed");
  });

  it("auto-detects tab delimiters", () => {
    const tsv = ["Test Name\tValue\tUnit", "HDL\t35\tmg/dL"].join("\n");

    const [observation] = parseCsv(tsv, { fileName: "labs.tsv" });

    expect(observation.key).toBe("hdl");
    expect(observation.value).toBe(35);
  });

  it("handles quoted cells containing the delimiter", () => {
    const csv = ['Test Name,Value,Unit', '"Total, Cholesterol",220,mg/dL'].join("\n");

    const observations = parseCsv(csv, { fileName: "labs.csv" });

    expect(observations).toHaveLength(1);
    expect(observations[0].rawName).toBe("Total, Cholesterol");
  });

  it("returns an empty array when required headers are missing", () => {
    const csv = ["Foo,Bar", "1,2"].join("\n");

    expect(parseCsv(csv)).toEqual([]);
  });

  it("returns an empty array for malformed/empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv("just one line")).toEqual([]);
  });
});
