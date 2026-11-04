/**
 * CCTV OPS V2 - Staging / Preview Supabase Configuration Template
 * 
 * Instructions to connect an isolated staging database:
 * 1. Create a dedicated staging project at https://supabase.com (do NOT use production).
 * 2. Execute SQL migrations located in supabase/migrations/ on the staging database.
 * 3. Copy this file or set window.CCTV_AUTH_CONFIG before scripts load with your staging details:
 */

window.CCTV_AUTH_CONFIG = {
  // Staging Project URL (e.g., https://your-staging-ref.supabase.co)
  SUPABASE_URL: "https://your-staging-project.supabase.co",

  // Staging Anonymous / Publishable Public Key (NOT service_role key)
  SUPABASE_PUBLIC_KEY: "your-staging-anon-key",

  // Designates this deployment as preview / staging environment
  IS_PREVIEW: true
};
