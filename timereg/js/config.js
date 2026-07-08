// Timeregistrering runtime config.
// Anon key is public-by-design (Supabase RLS gates reads/writes per row).

export const SUPABASE_URL = "https://tkqeoirgxorqznjsbtsa.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcWVvaXJneG9ycXpuanNidHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjE5NjAsImV4cCI6MjA5OTA5Nzk2MH0.IHUj5OLloVapomg2lDG2bUuWKe0bSARLoG_q9B2IIV4";

// Soft app-level gate only — not a secret. Keeps random visitors from opening
// the app; real access control happens via Supabase Row Level Security tied
// to each browser's anonymous auth session. Change before sharing the link.
export const ACCESS_CODE = "OMBYGGET2026";
