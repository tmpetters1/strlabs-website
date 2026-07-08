// Timeregistrering runtime config.
// Anon key is public-by-design (Supabase RLS gates reads/writes per row).
// The access code itself is never shipped here — it's verified server-side
// via the `verify_access_code` Postgres function (bcrypt-hashed, RLS-gated).

export const SUPABASE_URL = "https://tkqeoirgxorqznjsbtsa.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcWVvaXJneG9ycXpuanNidHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjE5NjAsImV4cCI6MjA5OTA5Nzk2MH0.IHUj5OLloVapomg2lDG2bUuWKe0bSARLoG_q9B2IIV4";
