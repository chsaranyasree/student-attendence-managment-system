require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { supabase, isConfigured } = require("./supabase");
const studentsRouter = require("./routes/students");
const attendanceRouter = require("./routes/attendance");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "30kb" }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", async (req, res) => {
  if (!isConfigured) return res.status(200).json({ status: "ok", database: "not_configured" });
  const { error } = await supabase.from("students").select("id", { head: true, count: "exact" });
  if (error) return res.status(503).json({ status: "degraded", database: "unavailable" });
  return res.json({ status: "ok", database: "connected" });
});

app.use("/api/students", studentsRouter);
app.use("/api/attendance", attendanceRouter);

app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();

  res.sendFile(
    path.join(__dirname, "..", "frontend", "index.html"),
    (err) => {
      if (err) next(err);
    }
  );
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON request body." });
  console.error("Request error:", err.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => console.log(`AttendEase server running at http://localhost:${PORT}`));
