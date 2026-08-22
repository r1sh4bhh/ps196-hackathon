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
