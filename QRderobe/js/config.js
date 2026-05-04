// QRderobe runtime config.
// Anon key is public-by-design (Supabase RLS gates reads, edge functions gate writes).

export const SUPABASE_URL  = "https://rmtnejvqpduroxhlhqzt.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdG5lanZxcGR1cm94aGxocXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTkwOTMsImV4cCI6MjA5MzQ5NTA5M30.pXas7aqJgzyTKyXDgvMDWi9ON8y7vZ_IZFbjl-Lw3hg";

// Default venue for the test deploy.
export const DEFAULT_VENUE_SLUG = "test-venue";

// Vipps brand orange — used only for the mock pay button.
export const VIPPS_ORANGE = "#FF5B24";
