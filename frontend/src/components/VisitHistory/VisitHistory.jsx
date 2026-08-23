import React, { useMemo } from "react";
import SourceBadge from "../SourceBadge/SourceBadge";
import { EvidenceList } from "../EvidenceCard/EvidenceCard";
import NextTestCard from "../NextTestCard/NextTestCard";
import { LAB_DEFINITIONS } from "../../constants/labAliases";
import { getRiskDetail, ML_DETAIL_SECTIONS } from "../../utils/mlDetail";
import "./visitHistory.css";

const SUMMARY_METRICS = [
  ["systolic_bp", "Systolic", "vitals", "mmHg"],
  ["diastolic_bp", "Diastolic", "vitals", "mmHg"],
  ["heart_rate", "Heart rate", "vitals", "bpm"],
  ["weight_kg", "Weight", "vitals", "kg"],
  ["glucose", "Glucose", "labs", "mg/dL"],
  ["cholesterol", "Cholesterol", "labs", "mg/dL"],
  ["hdl", "HDL", "labs", "mg/dL"],
  ["triglycerides", "Triglycerides", "labs", "mg/dL"],
];

const VITAL_LABELS = {
  systolic_bp: ["Systolic blood pressure", "mmHg"],
  diastolic_bp: ["Diastolic blood pressure", "mmHg"],
  heart_rate: ["Heart rate", "bpm"],
  temperature: ["Temperature", "°F"],
  weight_kg: ["Weight", "kg"],
  height_cm: ["Height", "cm"],
  bmi: ["BMI", ""],
};

export function getVisitDelta(current, previous) {
  const currentNumber = numericValue(current);
  const previousNumber = numericValue(previous);
  if (currentNumber === null || previousNumber === null) return null;
  const delta = currentNumber - previousNumber;
  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    symbol: delta > 0 ? "↑" : delta < 0 ? "↓" : "→",
    delta,
  };
}

export default function VisitHistory({ patientId, visits = [], onBack }) {
  const chronological = useMemo(
    () =>
      visits
        .filter((visit) => visit?.patientId === patientId)
        .slice()
        .sort((first, second) => String(first.timestamp).localeCompare(String(second.timestamp))),
    [patientId, visits]
  );
  const newestFirst = chronological.slice().reverse();

  return (
    <main className="visit-history">
      <header className="visit-history-header">
        <div>
          <h1>Visit history</h1>
          <p>
            Patient <strong>{patientId}</strong>
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </header>

      {newestFirst.length === 0 ? (
        <section className="visit-history-empty">
          <h2>No visits recorded yet</h2>
          <p>Completed assessments will appear here with their measurements and risk output.</p>
        </section>
      ) : (
        <>
          {newestFirst.length === 1 ? (
            <p className="visit-history-note">
              This patient has one recorded visit, so change indicators will appear after the next
              visit.
            </p>
          ) : null}
          <div className="visit-history-table-wrap">
            <table className="visit-history-table">
              <thead>
                <tr>
                  <th className="visit-date-column">Visit date</th>
                  {SUMMARY_METRICS.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                  <th>Symptoms</th>
                  <th>Top risk</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((visit) => {
                  const index = chronological.indexOf(visit);
                  const previous = index > 0 ? chronological[index - 1] : null;
                  return (
                    <VisitRows
                      key={visit.id || visit.timestamp}
                      visit={visit}
                      previous={previous}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function VisitRows({ visit, previous }) {
  const prediction = visit.prediction || {};
  const topDisease = prediction.top_disease;
  const topScore = topDisease ? numericValue(prediction.risk_scores?.[topDisease]) : null;
  const symptomCount = Array.isArray(visit.patientData?.symptoms)
    ? visit.patientData.symptoms.length
    : 0;

  return (
    <>
      <tr className="visit-summary-row">
        <th scope="row" className="visit-date-column">
          <details className="visit-expander">
            <summary aria-label={`View full record for ${formatDate(visit.timestamp)}`}>
              <span>{formatDate(visit.timestamp)}</span>
              {visit.isDemo ? <span className="history-badge history-badge-demo">Demo</span> : null}
            </summary>
          </details>
        </th>
        {SUMMARY_METRICS.map(([key, , section, unit]) => (
          <td key={key}>
            <MetricValue
              value={visit.patientData?.[section]?.[key]}
              unit={unit}
              delta={
                previous
                  ? getVisitDelta(
                      visit.patientData?.[section]?.[key],
                      previous.patientData?.[section]?.[key]
                    )
                  : null
              }
              provenance={metricProvenance(visit, section, key)}
            />
          </td>
        ))}
        <td>{symptomCount}</td>
        <td>
          {topDisease && topScore !== null ? (
            <span className="top-risk">
              {formatLabel(topDisease)} <strong>{formatNumber(topScore * 100)}%</strong>
            </span>
          ) : (
            <span className="not-recorded">not recorded</span>
          )}
        </td>
      </tr>
      <tr className="visit-detail-row">
        <td colSpan={SUMMARY_METRICS.length + 3}>
          <VisitDetail visit={visit} />
        </td>
      </tr>
    </>
  );
}

function MetricValue({ value, unit, delta, provenance }) {
  const number = numericValue(value);
  if (number === null) return <span className="not-recorded">not recorded</span>;
  return (
    <span className="history-metric">
      <span>
        {formatNumber(number)} {unit}
      </span>
      {delta ? (
        <span
          className={`history-delta delta-${delta.direction}`}
          aria-label={`${delta.direction}, change ${formatSigned(delta.delta)}`}
        >
          {delta.symbol} {formatSigned(delta.delta)}
        </span>
      ) : null}
      {provenance.map((item) => (
        <span key={item.label} className={`history-badge history-badge-${item.variant}`}>
          {item.label}
        </span>
      ))}
    </span>
  );
}

function VisitDetail({ visit }) {
  const prediction = visit.prediction || {};
  const details = Object.entries(prediction.risk_scores || {});
  const mlSections = Object.values(ML_DETAIL_SECTIONS)
    .map((key) => prediction.ml_detail?.[key])
    .filter((section) => section && typeof section === "object");
  const defaulted = [...new Set(mlSections.flatMap((section) => section.defaulted_features || []))];
  const missing = [...new Set(mlSections.flatMap((section) => section.missing_key_inputs || []))];
  const partial = mlSections.some((section) => section.partial_input === true);

  return (
    <div className="visit-detail">
      <DetailGroup title="All vitals">
        <RecordGrid
          entries={Object.entries(visit.patientData?.vitals || {})}
          definitions={VITAL_LABELS}
          visit={visit}
          section="vitals"
        />
      </DetailGroup>
      <DetailGroup title="All labs">
        <RecordGrid
          entries={Object.entries(visit.patientData?.labs || {})}
          definitions={Object.fromEntries(
            Object.entries(LAB_DEFINITIONS).map(([key, value]) => [key, [value.label, value.unit]])
          )}
          visit={visit}
          section="labs"
        />
      </DetailGroup>
      <DetailGroup title="Symptoms exactly as recorded">
        {Array.isArray(visit.patientData?.symptoms) && visit.patientData.symptoms.length ? (
          <ul>
            {visit.patientData.symptoms.map((symptom, index) => (
              <li key={`${symptom}-${index}`}>{symptom}</li>
            ))}
          </ul>
        ) : (
          <p className="not-recorded">No symptoms recorded</p>
        )}
      </DetailGroup>
      <DetailGroup title="Full risk output">
        {Object.keys(prediction).length ? <SourceBadge prediction={prediction} /> : null}
        {details.length ? (
          <div className="visit-risk-grid">
            {details.map(([disease, score]) => {
              const detail = getRiskDetail(prediction, disease);
              return (
                <div key={disease} className="visit-risk-item">
                  <strong>{formatLabel(disease)}</strong>
                  <span>
                    {numericValue(score) === null
                      ? "not recorded"
                      : `${formatNumber(Number(score) * 100)}%`}
                  </span>
                  {detail?.band ? <span>Band: {formatLabel(detail.band)}</span> : null}
                  {detail?.provenance ? (
                    <span>
                      {formatLabel(detail.provenance).replace(/^./, (letter) =>
                        letter.toUpperCase()
                      )}
                      -derived
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="not-recorded">Risk output not recorded</p>
        )}
        {partial || defaulted.length || missing.length ? (
          <div className="history-input-caveat">
            {partial ? (
              <span className="history-badge history-badge-warning">Partial input</span>
            ) : null}
            {defaulted.length ? <p>Defaulted features: {defaulted.join(", ")}</p> : null}
            {missing.length ? <p>Missing key inputs: {missing.join(", ")}</p> : null}
          </div>
        ) : null}
        <NextTestCard evidenceItems={prediction.evidence} />
        <EvidenceList evidenceItems={prediction.evidence} />
        {prediction.next_test && !prediction.evidence?.length ? (
          <p>Recommended next test: {prediction.next_test}</p>
        ) : null}
      </DetailGroup>
    </div>
  );
}

function DetailGroup({ title, children }) {
  return (
    <section className="visit-detail-group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function RecordGrid({ entries, definitions, visit, section }) {
  if (!entries.length) return <p className="not-recorded">No {section} recorded</p>;
  return (
    <dl className="visit-record-grid">
      {entries.map(([key, value]) => {
        const [label, unit] = definitions[key] || [formatLabel(key), ""];
        const number = numericValue(value);
        return (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {number === null
                ? "not recorded"
                : `${formatNumber(number)}${unit ? ` ${unit}` : ""}`}
              {metricProvenance(visit, section, key).map((item) => (
                <span key={item.label} className={`history-badge history-badge-${item.variant}`}>
                  {item.label}
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function metricProvenance(visit, section, key) {
  const badges = [];
  const raw = visit.patientData?.[section]?.[key];
  const reused = section === "labs" ? visit.reusedLabs?.[key] : null;
  if (reused) {
    badges.push({
      variant: "warning",
      label: reused.isStale ? "Stale carried forward" : "Carried forward",
    });
  }
  const defaulted = Object.values(ML_DETAIL_SECTIONS).some((sectionName) => {
    const features = visit.prediction?.ml_detail?.[sectionName]?.defaulted_features;
    return Array.isArray(features) && features.includes(key);
  });
  if (defaulted) {
    badges.push({ variant: "warning", label: "Defaulted for prediction" });
  }
  if (
    (raw && typeof raw === "object" && raw.source === "device" && raw.simulated === true) ||
    (visit.source === "device" && visit.simulated === true) ||
    (visit.patientData?.source === "device" && visit.patientData?.simulated === true)
  ) {
    badges.push({ variant: "warning", label: "Simulated device" });
  }
  return badges;
}

function numericValue(value) {
  const candidate = value && typeof value === "object" ? value.value : value;
  return candidate === "" ||
    candidate === null ||
    candidate === undefined ||
    !Number.isFinite(Number(candidate))
    ? null
    : Number(candidate);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatLabel(value) {
  return String(value).replace(/_/g, " ");
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}
