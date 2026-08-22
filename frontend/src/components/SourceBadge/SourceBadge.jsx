import React from "react";
import { getSourceBadge } from "../../utils/mlDetail";
import "./sourceBadge.css";

// Says, at a glance, whether the numbers on screen came from the ML backend
// or from a fallback mock. A missing `source` renders the warning variant --
// silence must never read as "model output".
export default function SourceBadge({ prediction }) {
  const badge = getSourceBadge(prediction);

  return (
    <span className={`source-badge source-badge-${badge.variant}`} title={badge.title}>
      <span className="source-badge-label">{badge.label}</span>
      {badge.reason ? <span className="source-badge-reason">{badge.reason}</span> : null}
    </span>
  );
}
