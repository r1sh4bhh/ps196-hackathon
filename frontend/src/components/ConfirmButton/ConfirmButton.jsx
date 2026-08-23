import React, { useState } from "react";
import "./confirmButton.css";

// Inline two-step confirmation for destructive actions. Deliberately not a
// modal: it reuses the existing button styles and keeps the action in place,
// so a misclick costs one extra click rather than the data.
export default function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel = "Cancel",
  message,
  className = "btn-secondary",
  onConfirm,
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button type="button" className={className} onClick={() => setIsConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-action" role="alert">
      {message ? <span className="confirm-action-message">{message}</span> : null}
      <span className="confirm-action-buttons">
        <button
          type="button"
          className={className}
          onClick={() => {
            setIsConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setIsConfirming(false)}>
          {cancelLabel}
        </button>
      </span>
    </span>
  );
}
