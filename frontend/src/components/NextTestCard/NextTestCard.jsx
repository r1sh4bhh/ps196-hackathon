import React from "react";
import "./nextTestCard.css";

export default function NextTestCard({ evidenceItems }) {
  if (!evidenceItems || evidenceItems.length === 0) {
    return null;
  }

  const uniqueTests = Array.from(
    new Map(evidenceItems.map((item) => [item.next_test, item])).values()
  );

  return (
    <div className="next-test-card">
      <h4 className="next-test-title">Recommended Next Steps</h4>
      <ul className="next-test-list">
        {uniqueTests.map((item) => (
          <li key={item.next_test} className="next-test-item">
            <span className="next-test-name">{item.next_test}</span>
            <span className="next-test-reason">
              for {formatDiseaseName(item.disease)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDiseaseName(disease) {
  return disease.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
