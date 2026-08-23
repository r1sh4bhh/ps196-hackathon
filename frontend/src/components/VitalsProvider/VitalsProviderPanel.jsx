import React, { useState } from "react";
import {
  connectProvider,
  disconnectProvider,
  getConnectedProviderId,
  listReadings,
  saveReadings,
} from "../../storage/vitalsReadingStore";
import { listProviders, getProvider } from "../../vitals/providerRegistry";
import { aggregateDailyReadings, describeAggregate } from "../../vitals/aggregateDailyReadings";
import { VITALS_METRICS } from "../../vitals/vitalsProvider";
import { BASELINE_METRICS } from "../../utils/baseline";
import { formatMeasurement } from "../../utils/format";
import "./vitalsProviderPanel.css";

const DAY_MS = 24 * 60 * 60 * 1000;

// Connect / disconnect a vitals source for one person, and show what it has
// recorded. Only a simulated source exists in this build; it is labelled as
// simulated here and next to every value it produced, not only in this panel.
export default function VitalsProviderPanel({ patientId }) {
  const [connectedProviderId, setConnectedProviderId] = useState(() =>
    getConnectedProviderId(patientId)
  );
  const [readings, setReadings] = useState(() => listReadings(patientId));
  const [status, setStatus] = useState(null);
  const [renderedPatientId, setRenderedPatientId] = useState(patientId);
  const providers = listProviders();

  // React's documented "adjust state when a prop changes" pattern: the state
  // is corrected during render and React re-renders immediately with it.
  // Belt and braces alongside the `key={patientId}` remount in App: if this
  // panel is ever reused across a person switch, its state is rebuilt from
  // the new person's storage so one person's device readings can never be
  // shown for another.
  if (renderedPatientId !== patientId) {
    setRenderedPatientId(patientId);
    setConnectedProviderId(getConnectedProviderId(patientId));
    setReadings(listReadings(patientId));
    setStatus(null);
    return null;
  }

  if (!patientId) {
    return null;
  }

  const handleConnect = (providerId) => {
    if (connectProvider(patientId, providerId)) {
      setConnectedProviderId(providerId);
      setStatus(null);
    }
  };

  const handleDisconnect = () => {
    if (disconnectProvider(patientId)) {
      setConnectedProviderId(null);
      setStatus(null);
    }
  };

  const handleSync = async () => {
    const provider = getProvider(connectedProviderId);
    if (!provider) {
      return;
    }
    const now = new Date();
    const incoming = await provider.read(patientId, {
      from: new Date(now.getTime() - DAY_MS),
      to: now,
    });
    const accepted = saveReadings(patientId, incoming);
    setReadings(listReadings(patientId));
    setStatus(
      `Recorded ${accepted.length} reading${accepted.length === 1 ? "" : "s"} from ${provider.label}.`
    );
  };

  const aggregates = aggregateDailyReadings(readings, { includeUnderSampled: true });
  const hasSimulatedReadings = readings.some((reading) => reading.simulated);

  return (
    <section className="vitals-provider-panel" aria-label="Vitals sources">
      <header className="vitals-provider-header">
        <h2>Vitals sources</h2>
        <p className="vitals-provider-subtitle">
          Readings can be typed in by hand or reported by a connected source. No real device
          integration exists in this build.
        </p>
      </header>

      <ul className="vitals-provider-list">
        {providers.map((provider) => {
          const isConnected = provider.id === connectedProviderId;
          return (
            <li key={provider.id} className="vitals-provider-item">
              <div>
                <span className="vitals-provider-name">{provider.label}</span>
                {provider.simulated ? (
                  <span className="vitals-provider-simulated-tag">
                    Simulated - not a real device
                  </span>
                ) : null}
                <span className="vitals-provider-metrics">
                  Reports: {provider.supportedMetrics.map(metricLabel).join(", ")}. Does not report:{" "}
                  {unsupportedMetrics(provider).map(metricLabel).join(", ") || "nothing else"}.
                </span>
                {provider.description ? (
                  <span className="vitals-provider-description">{provider.description}</span>
                ) : null}
              </div>
              <div className="vitals-provider-actions">
                {isConnected ? (
                  <>
                    <button type="button" className="btn-secondary" onClick={handleSync}>
                      Fetch last 24 hours
                    </button>
                    <button type="button" className="btn-ghost" onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleConnect(provider.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {status ? <p className="vitals-provider-status">{status}</p> : null}

      {aggregates.length > 0 ? (
        <div className="vitals-provider-readings">
          <h3>Recorded device readings</h3>
          <p className="vitals-provider-note">
            Many readings a day are collapsed to one representative value (the median) per metric
            per day, so a day of device data counts as a single observation - the same as one manual
            entry.
          </p>
          <ul className="vitals-provider-aggregates">
            {aggregates.map((aggregate) => (
              <li
                key={`${aggregate.day}-${aggregate.metric}`}
                className={aggregate.simulated ? "vitals-aggregate simulated" : "vitals-aggregate"}
              >
                <span className="vitals-aggregate-metric">
                  {metricLabel(aggregate.metric)} on {aggregate.day}
                </span>
                <span className="vitals-aggregate-value">
                  {formatMeasurement(aggregate.value, BASELINE_METRICS[aggregate.metric]?.unit)}
                  {aggregate.simulated ? (
                    <span className="vitals-aggregate-simulated"> Simulated device data</span>
                  ) : (
                    <span className="vitals-aggregate-origin"> Device data</span>
                  )}
                </span>
                <span className="vitals-aggregate-provenance">{describeAggregate(aggregate)}</span>
                {aggregate.underSampled ? (
                  <span className="vitals-aggregate-excluded">
                    Excluded from baseline: too few readings that day to represent it.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {!connectedProviderId && hasSimulatedReadings ? (
            <p className="vitals-provider-note">
              The source is disconnected. Readings already recorded are kept and stay marked as
              simulated device data permanently.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function metricLabel(metric) {
  return BASELINE_METRICS[metric]?.label || metric.replace(/_/g, " ");
}

// Metrics this provider cannot measure are named explicitly, so a missing
// value reads as "not measured" rather than as an absence of concern.
function unsupportedMetrics(provider) {
  return VITALS_METRICS.filter((metric) => !provider.supportedMetrics.includes(metric));
}
