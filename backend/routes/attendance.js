const express = require("express");
const { supabase, isConfigured } = require("../supabase");
const { validDate } = require("../utils/validation");
const router = express.Router();

function databaseRequired(req, res, next) {
  if (!isConfigured || !supabase) return res.status(503).json({ error: "Database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env." });
  next();
}
router.use(databaseRequired);

router.get("/", async (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ error: "Provide a valid date in YYYY-MM-DD format." });
  const { data, error } = await supabase.from("attendance").select("id, student_id, attendance_date, status").eq("attendance_date", date);
  if (error) return res.status(500).json({ error: "Could not load attendance for this date." });
  res.json({ attendance: data });
});
router.put("/bulk", async (req, res) => {
  const { date, records } = req.body || {};
  if (!validDate(date)) return res.status(400).json({ error: "Provide a valid date in YYYY-MM-DD format." });
  if (!Array.isArray(records) || records.length > 500) return res.status(400).json({ error: "Records must be an array containing at most 500 students." });
  const ids = [];
  for (const record of records) {
    if (!record || !Number.isSafeInteger(Number(record.studentId)) || Number(record.studentId) < 1 || !["present", "absent"].includes(record.status)) {
      return res.status(400).json({ error: "Each record needs a positive studentId and a status of present or absent." });
    }
    ids.push(Number(record.studentId));
  }
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: "Duplicate student IDs were found in the request." });
  if (ids.length) {
    const { data: existing, error: lookupError } = await supabase.from("students").select("id").in("id", ids);
    if (lookupError) return res.status(500).json({ error: "Could not validate the student list." });
    if (existing.length !== ids.length) return res.status(400).json({ error: "One or more students do not exist. Refresh the page and try again." });
    const rows = records.map(record => ({ student_id: Number(record.studentId), attendance_date: date, status: record.status }));
    const { data, error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,attendance_date" }).select("id, student_id, attendance_date, status");
    if (error) return res.status(500).json({ error: "Could not save attendance. Check the database schema." });
    return res.json({ message: "Attendance saved.", attendance: data });
  }
  res.json({ message: "No attendance records to save.", attendance: [] });
});
module.exports = router;
