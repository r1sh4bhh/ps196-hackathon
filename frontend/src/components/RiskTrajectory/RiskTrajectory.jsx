import React from "react";
import "./riskTrajectory.css";

export default function RiskTrajectory({
  trajectory,
  label = "Projected Risk Trend",
}) {
  if (!trajectory || trajectory.length === 0) {
    return <div className="trajectory-empty">No trajectory data available.</div>;
  }

  const width = 320;
  const height = 140;
  const padding = 24;

  const maxRisk = Math.max(...trajectory.map((point) => point.risk), 1);
  const minRisk = Math.min(...trajectory.map((point) => point.risk), 0);

  const points = trajectory.map((point, index) => {
    const x =
      padding + (index / (trajectory.length - 1 || 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((point.risk - minRisk) / (maxRisk - minRisk || 1)) * (height - padding * 2);

    return { x, y, ...point };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="trajectory-container">
      <h3 className="trajectory-title">{label}</h3>
      <svg width={width} height={height} className="trajectory-svg">
        <path d={pathD} fill="none" stroke="#2f6f5e" strokeWidth="2" />
        {points.map((point) => (
          <circle key={point.day} cx={point.x} cy={point.y} r="4" fill="#2f6f5e" />
        ))}
      </svg>
      <div className="trajectory-labels">
        {trajectory.map((point) => (
          <span key={point.day}>Day {point.day}</span>
        ))}
      </div>
    </div>
  );
}
