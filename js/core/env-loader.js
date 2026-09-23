/**
 * Plash Pilates — Dynamic .env Loader for Browser Runtime
 * Reads and parses root .env file automatically when served over HTTP.
 * @module env-loader
 */

import { CONFIG } from './config.js';

export async function loadEnvConfig() {
  try {
    const res = await fetch('/api/public-config');
    if (!res.ok) return;

    const data = await res.json();
    if (data.supabaseUrl) CONFIG.SUPABASE.URL = data.supabaseUrl;
    if (data.supabaseAnonKey) CONFIG.SUPABASE.ANON_KEY = data.supabaseAnonKey;
    if (data.razorpayKeyId) CONFIG.RAZORPAY.KEY_ID = data.razorpayKeyId;
  } catch {
    // Fallback if running from static file protocol or without server
  }
}
