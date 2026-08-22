// Builds a real risk trend from stored assessment history, never from
// fabricated or seeded data. Each point reflects an actual visit's
// prediction for `disease`; visits without that risk score are skipped
// rather than filled in with a guess.
export function buildRiskTrajectory(assessments, disease) {
  if (!Array.isArray(assessments) || !disease) {
    return [];
  }

  return assessments
    .map((assessment) => {
      const risk = assessment?.prediction?.risk_scores?.[disease];
      const numericRisk = Number(risk);
      if (!Number.isFinite(numericRisk)) {
        return null;
      }
      return { timestamp: assessment.timestamp, risk: numericRisk };
    })
    .filter(Boolean)
    .sort((first, second) => String(first.timestamp).localeCompare(String(second.timestamp)))
    .map((point, index) => ({ day: index + 1, risk: point.risk, timestamp: point.timestamp }));
}
