/**
 * Script to safely delete a member profile and all associated test data from Supabase
 * Usage: node scratch/delete_profile.cjs [email]
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or Service Role Key in .env');
  process.exit(1);
}

const targetEmail = (process.argv[2] || 'sandeepjohnrofficial@gmail.com').trim().toLowerCase();

async function run() {
  console.log(`[Delete Profile] Searching for ${targetEmail}...`);
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. Get profile
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(targetEmail)}&select=*`, { headers });
  const profiles = await profRes.json();
  if (!profiles || profiles.length === 0) {
    console.log(`No profile found for ${targetEmail}`);
  }

  const profileId = profiles && profiles.length > 0 ? profiles[0].id : null;
  console.log('Profile ID:', profileId);

  // 2. Delete dependent records if profile found
  if (profileId) {
    // Member pass credits (child of member_passes)
    const passesRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${profileId}&select=id`, { headers });
    const passes = await passesRes.json();
    for (const p of passes) {
      await fetch(`${SUPABASE_URL}/rest/v1/member_pass_credits?pass_id=eq.${p.id}`, { method: 'DELETE', headers });
    }

    // Bookings
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?member_id=eq.${profileId}`, { method: 'DELETE', headers });
    // Member passes
    await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${profileId}`, { method: 'DELETE', headers });
    // Health profiles
    await fetch(`${SUPABASE_URL}/rest/v1/health_profiles?member_id=eq.${profileId}`, { method: 'DELETE', headers });
    // Waiver acceptances
    await fetch(`${SUPABASE_URL}/rest/v1/waiver_acceptances?member_id=eq.${profileId}`, { method: 'DELETE', headers });
    // Activity logs
    await fetch(`${SUPABASE_URL}/rest/v1/activity_logs?user_id=eq.${profileId}`, { method: 'DELETE', headers });
    // Payments (set member_id to null or delete)
    await fetch(`${SUPABASE_URL}/rest/v1/payments?member_id=eq.${profileId}`, { method: 'DELETE', headers });

    // Delete public.profiles
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, { method: 'DELETE', headers });
    console.log(`Deleted public.profiles record for ${profileId}`);
  }

  // 3. Delete from auth.users via admin API
  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers });
  const usersList = await usersRes.json();
  const authUser = (usersList.users || []).find(u => (u.email || '').toLowerCase() === targetEmail);
  if (authUser) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, { method: 'DELETE', headers });
    console.log(`Deleted auth.users record for ${authUser.id} (${targetEmail})`);
  } else {
    console.log(`No auth.users record found for ${targetEmail}`);
  }

  console.log(`[Delete Profile] COMPLETE: ${targetEmail} fully purged from Supabase.`);
}

run().catch(err => console.error('Error:', err.message));
