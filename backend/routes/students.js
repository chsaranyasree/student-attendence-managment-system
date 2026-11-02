const express = require("express");
const { supabase, isConfigured } = require("../supabase");
const { cleanText } = require("../utils/validation");
const router = express.Router();

function databaseRequired(req, res, next) {
  if (!isConfigured || !supabase) return res.status(503).json({ error: "Database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env." });
  next();
}
router.use(databaseRequired);

router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("students").select("id, name, roll_number, created_at").order("roll_number");
  if (error) return res.status(500).json({ error: "Could not load students. Check the database schema and Supabase connection." });
  res.json({ students: data });
});
router.post("/", async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const rollNumber = cleanText(req.body.rollNumber, 30);
  if (!name || !rollNumber) return res.status(400).json({ error: "Enter a name (up to 100 characters) and roll number (up to 30 characters)." });
  const { data, error } = await supabase.from("students").insert({ name, roll_number: rollNumber }).select("id, name, roll_number, created_at").single();
  if (error?.code === "23505") return res.status(409).json({ error: "That roll number already exists. Use a unique roll number." });
  if (error) return res.status(500).json({ error: "Could not add the student." });
  res.status(201).json({ student: data });
});
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Student ID must be a positive integer." });
  const { data, error } = await supabase.from("students").delete().eq("id", id).select("id");
  if (error) return res.status(500).json({ error: "Could not delete the student." });
  if (!data || data.length === 0) return res.status(404).json({ error: "Student not found." });
  res.json({ message: "Student deleted.", id });
});
module.exports = router;
