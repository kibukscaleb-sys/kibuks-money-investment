require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true
}));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kibuks-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log("Kibuks API listening on port " + port);
});
