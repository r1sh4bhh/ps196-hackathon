import React from "react";
import { RiskCardGrid } from "./RiskCard/RiskCard";
import RiskTrajectory from "./RiskTrajectory/RiskTrajectory";
import { EvidenceList } from "./EvidenceCard/EvidenceCard";
import BaselineComparison from "./BaselineComparison/BaselineComparison";
import NextTestCard from "./NextTestCard/NextTestCard";
import { mockPrediction, mockBaseline } from "../mocks/mockPrediction";

export default function PredictionResultPreview({
  prediction = mockPrediction,
  baseline = mockBaseline,
}) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <RiskCardGrid
        riskScores={prediction.risk_scores}
        topDisease={prediction.top_disease}
      />
      <RiskTrajectory trajectory={prediction.trajectory} />
      <BaselineComparison current={prediction.risk_scores} baseline={baseline} />
      <NextTestCard evidenceItems={prediction.evidence} />
      <EvidenceList evidenceItems={prediction.evidence} />
    </div>
  );
}
