import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing SUPABASE_URL in environment. Create Backend/.env with SUPABASE_URL and key."
  );
}

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY in Backend/.env."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;