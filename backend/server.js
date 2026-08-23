const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const healthRoute = require("./routes/health");
const predictRoute = require("./routes/predict");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/health", healthRoute);
app.use("/predict", predictRoute);

// Single-container deployment: Express also serves the built frontend, so the
// browser talks to the same origin as the API (no CORS, no API base URL to
// manage). This must sit AFTER /health and /predict so the API wins, and
// BEFORE the 404 handler below -- otherwise every asset request is answered
// with {"status":"error","message":"Route not found"}.
// Resolved from __dirname (same convention as ml/pythonBridge.js) so it does
// not depend on the process cwd.
const distPath = path.join(__dirname, "..", "frontend", "dist");
const indexHtmlPath = path.join(distPath, "index.html");

// Paths owned by the API. An unmatched request under one of these (e.g. a
// typo'd endpoint, or GET /predict where only POST exists) is an API error
// and must still get the JSON 404 below, not a 200 page of HTML.
const API_PREFIXES = ["/health", "/predict"];

function isApiPath(pathname) {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Running the backend locally without building the frontend is a supported
// workflow, so a missing dist directory must not stop the API from serving.
if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (isApiPath(req.path)) {
      return next();
    }
    res.sendFile(indexHtmlPath);
  });
} else {
  console.warn(
    `[server] No built frontend at ${distPath} - serving API only. Run "npm run build" in frontend/ to serve the UI.`
  );
}

app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`PS196 backend running locally on http://localhost:${PORT}`);
});
