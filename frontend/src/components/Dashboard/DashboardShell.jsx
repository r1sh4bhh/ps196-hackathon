import React from "react";
import BaselineComparison from "../BaselineComparison/BaselineComparison";
import SourceBadge from "../SourceBadge/SourceBadge";
import {
  getDisclaimer,
  getRiskDetail,
  getSymptomDifferential,
  isDegraded,
} from "../../utils/mlDetail";
import "./dashboardShell.css";

// Sparse rankings below 0.4 are too weak to present as meaningful review prompts.
const MIN_SPARSE_DIFFERENTIAL_SCORE = 0.4;

export default function DashboardShell({
  patientData,
  prediction,
  baselineCurrent,
  baselineData,
  onBackToForm,
}) {
  if (!prediction) {
    return (
      <div className="dashboard-empty">
        <p>No prediction available yet.</p>
        <button className="btn-secondary" onClick={onBackToForm}>
          Back to Form
        </button>
      </div>
    );
  }

  const riskScores =
    prediction.risk_scores && typeof prediction.risk_scores === "object"
      ? prediction.risk_scores
      : {};
  const disclaimer = getDisclaimer(prediction);
  const degraded = isDegraded(prediction);
  const differential = getSymptomDifferential(prediction);
  const topDifferentialScore = Number(differential?.predictions?.[0]?.confidence);
  const suppressDifferential =
    differential?.sparseInput === true &&
    Number.isFinite(topDifferentialScore) &&
    topDifferentialScore < MIN_SPARSE_DIFFERENTIAL_SCORE;

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <h1>Risk Dashboard</h1>
          <SourceBadge prediction={prediction} />
          <p className="subtitle">
            Patient {patientData?.patientId}
            {prediction.top_disease ? (
              <>
                {" - "}Top risk: <strong>{prediction.top_disease}</strong>
                {Number.isFinite(Number(prediction.confidence))
                  ? ` (${Math.round(Number(prediction.confidence) * 100)}% confidence)`
                  : ""}
              </>
            ) : null}
          </p>
        </div>
        <button className="btn-secondary" onClick={onBackToForm}>
          New Entry
        </button>
      </header>

      {degraded ? (
        <p className="dashboard-notice">
          One or more models were unavailable for this assessment, so the results below are
          incomplete.
        </p>
      ) : null}

      <section className="summary-cards">
        {Object.entries(riskScores).map(([disease, score]) => {
          const detail = getRiskDetail(prediction, disease);

          return (
            <div className="summary-card" key={disease}>
              <span className="disease-name">{disease.replace(/_/g, " ")}</span>
              <span className="risk-value">{Math.round(score * 100)}%</span>
              {detail?.band ? (
                <span className="risk-band">Band: {detail.band.replace(/_/g, " ")}</span>
              ) : null}
              {detail?.provenance === "rule" ? (
                <span className="risk-provenance">
                  Rule-derived band{detail.description ? ` - ${detail.description}` : ""}
                </span>
              ) : null}
              {detail?.provenance === "model" ? (
                <span className="risk-provenance">Model-derived score</span>
              ) : null}
              {detail?.partialInput ? (
                <span className="risk-caveat">
                  Computed without all trained features
                  {detail.missingKeyInputs.length
                    ? `; missing: ${detail.missingKeyInputs.join(", ")}`
                    : ""}
                </span>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="visualization-slot" data-owner="shivangi">
        <p className="placeholder-note">
          Visualization components (trajectory chart, evidence panel) will be integrated here.
        </p>
      </section>

      <section className="visualization-slot" data-owner="shivangi">
        <BaselineComparison current={baselineCurrent} baseline={baselineData} />
      </section>

      {differential ? (
        <details className="symptom-differential">
          <summary>Symptom-based ranking (weak signal)</summary>
          <div className="differential-content">
            <p className="differential-note">
              This rough review prompt comes from a model trained on a synthetic dataset; it is not
              a diagnosis, and the lab-derived risk scores above are the stronger signal.
            </p>
            {differential.rankingOnly ? (
              <p className="differential-note">
                Ranking only - these scores order plausible conditions and are not probabilities of
                disease.
              </p>
            ) : null}
            {differential.sparseInput ? (
              <p className="differential-note">
                Few symptoms matched the model vocabulary, so this ranking is weak evidence.
              </p>
            ) : null}
            {differential.unmatchedSymptoms > 0 ? (
              <p className="differential-note">
                {differential.unmatchedSymptoms} submitted symptom
                {differential.unmatchedSymptoms === 1 ? " was" : "s were"} not recognized by the
                model.
              </p>
            ) : null}
            {suppressDifferential ? (
              <p className="differential-empty">
                Not enough symptom detail for a meaningful ranking.
              </p>
            ) : (
              <ol className="differential-list">
                {differential.predictions.map((item) => (
                  <li key={item.condition}>
                    <span className="differential-condition">{item.condition}</span>
                    {Number.isFinite(Number(item.confidence)) ? (
                      <span className="differential-score">
                        {differential.rankingOnly ? "ranking score " : ""}
                        {Number(item.confidence).toFixed(2)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </details>
      ) : null}

      {disclaimer ? <p className="dashboard-disclaimer">{disclaimer}</p> : null}
    </div>
  );
}
