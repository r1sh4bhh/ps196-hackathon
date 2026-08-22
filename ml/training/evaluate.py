"""Shared, honest model evaluation used by every training script.

Computes stratified k-fold cross-validated accuracy, precision, recall, F1
(macro and weighted), ROC-AUC where applicable, a confusion matrix,
calibration curve data, and (for tree ensembles) feature importances. Only
metrics computed here may ever be reported - no hardcoded or assumed
figures.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict


def safe_n_splits(y: np.ndarray, desired: int = 5) -> int:
    """Pick a stratified fold count that is valid for the given labels.

    Real datasets have thousands of rows and comfortably support 5-fold CV.
    The small synthetic fixtures used for pipeline testing may have as few
    as 2 examples of a class, so this clamps ``desired`` down to the
    smallest class count (with a floor of 2) rather than letting
    ``StratifiedKFold`` raise.

    Args:
        y: Integer/label array of target values.
        desired: The preferred number of folds (default 5).

    Returns:
        A fold count between 2 and ``desired`` that is valid for ``y``.
    """
    _, counts = np.unique(y, return_counts=True)
    smallest_class = int(counts.min())
    return max(2, min(desired, smallest_class))


def evaluate_classifier(
    estimator: Any,
    x: np.ndarray,
    y: np.ndarray,
    *,
    feature_names: list[str] | None = None,
    binary_positive_label: Any = None,
    n_splits: int | None = None,
    random_state: int = 42,
) -> dict[str, Any]:
    """Run stratified k-fold CV and compute an honest metrics report.

    Args:
        estimator: An unfitted scikit-learn compatible classifier.
        x: Feature matrix.
        y: Target labels.
        feature_names: Optional feature names, aligned to ``x`` columns,
            used to report feature importances.
        binary_positive_label: For binary classification, the label
            considered "positive" for ROC-AUC / calibration curve
            purposes. If ``None``, ROC-AUC/calibration are only computed
            when there are exactly two classes (using the second class in
            sorted order as positive).
        n_splits: Number of CV folds. Auto-selected via
            :func:`safe_n_splits` when omitted.
        random_state: Random seed for the CV splitter and estimator.

    Returns:
        A JSON-serializable dict of computed metrics.
    """
    x = np.asarray(x)
    y = np.asarray(y)
    n_splits = n_splits or safe_n_splits(y)
    classes = np.unique(y)
    is_binary = len(classes) == 2

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    y_pred = cross_val_predict(estimator, x, y, cv=skf)

    metrics: dict[str, Any] = {
        "cv_folds": n_splits,
        "n_samples": int(len(y)),
        "n_classes": int(len(classes)),
        "accuracy": float(accuracy_score(y, y_pred)),
        "precision_macro": float(precision_score(y, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(
            precision_score(y, y_pred, average="weighted", zero_division=0)
        ),
        "recall_weighted": float(recall_score(y, y_pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y, y_pred, average="weighted", zero_division=0)),
        "confusion_matrix": confusion_matrix(y, y_pred).tolist(),
        "confusion_matrix_labels": [str(c) for c in classes],
    }

    fitted = estimator.fit(x, y)

    if is_binary and hasattr(estimator, "predict_proba"):
        positive_label = binary_positive_label if binary_positive_label is not None else classes[1]
        proba = cross_val_predict(estimator, x, y, cv=skf, method="predict_proba")
        positive_index = list(fitted.classes_).index(positive_label)
        y_score = proba[:, positive_index]
        y_true_binary = (y == positive_label).astype(int)

        metrics["roc_auc"] = float(roc_auc_score(y_true_binary, y_score))

        fraction_positive, mean_predicted = calibration_curve(
            y_true_binary, y_score, n_bins=min(10, max(2, len(y) // 5))
        )
        metrics["calibration_curve"] = {
            "mean_predicted_value": mean_predicted.tolist(),
            "fraction_of_positives": fraction_positive.tolist(),
        }

    if hasattr(fitted, "feature_importances_") and feature_names is not None:
        importances = fitted.feature_importances_
        ranked = sorted(
            zip(feature_names, importances.tolist()), key=lambda pair: pair[1], reverse=True
        )
        metrics["feature_importances"] = [
            {"feature": name, "importance": float(importance)} for name, importance in ranked
        ]

    return metrics


def write_metrics(metrics: dict[str, Any], output_path: str | Path) -> None:
    """Write a metrics dict to disk as pretty-printed JSON.

    Args:
        metrics: The metrics dict produced by :func:`evaluate_classifier`
            (optionally with extra keys such as caveats added by the
            calling training script).
        output_path: Destination JSON file path. Parent directories are
            created if necessary.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)
