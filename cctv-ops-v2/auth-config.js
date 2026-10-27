/**
 * CCTV OPS V2 - Cloudflare Pages Preview Default Configuration
 * 
 * Production Supabase database access is strictly isolated.
 * To enable backend operations in this preview deployment,
 * replace these placeholders with your dedicated staging Supabase project credentials.
 * 
 * NEVER put production credentials or service_role secret keys in this file.
 */

window.CCTV_AUTH_CONFIG = window.CCTV_AUTH_CONFIG || {
  SUPABASE_URL: null,
  SUPABASE_PUBLIC_KEY: null,
  IS_PREVIEW: true
};
