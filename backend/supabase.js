const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const isConfigured = Boolean(url && key && !url.includes("your-project") && !key.includes("your-"));

const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

module.exports = { supabase, isConfigured };
