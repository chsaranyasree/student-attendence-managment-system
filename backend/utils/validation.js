function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/\s+/g, " ");
  if (!result || result.length > maxLength) return null;
  return result;
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function requireDatabase(req, res, next) {
  if (!req.app.locals.databaseConfigured) {
    return res.status(503).json({ error: "Database is not configured. Add valid Supabase credentials to backend/.env and restart the server." });
  }
  next();
}
module.exports = { cleanText, validDate, requireDatabase };
