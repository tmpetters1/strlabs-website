import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
