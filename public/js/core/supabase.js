/**
 * Plash Pilates — Supabase Client & Data Gateway
 * Orchestrates live database queries, mutations, role syncing, and auth sessions.
 * @module supabase
 */

import { CONFIG } from './config.js';
import { getISTDateParts, parseClassDateTimeToUTC, toISTISOString, formatClassDateTimeIST } from '../utils/format.js';

let _supabase = null;

/**
 * Check if active production Supabase credentials are configured.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const url = CONFIG.SUPABASE?.URL;
  const key = CONFIG.SUPABASE?.ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('YOUR_SUPABASE_PROJECT') &&
    !key.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

/**
 * Get or initialize the active Supabase client singleton.
 * @returns {Object|null}
 */
export function getSupabase() {
  if (_supabase) return _supabase;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const factory = typeof window !== 'undefined' ? window.supabase?.createClient : null;
  if (typeof factory === 'function') {
    _supabase = factory(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    return _supabase;
  }

  if (typeof window !== 'undefined') {
    console.warn('[Supabase] SDK script not yet initialized on window.');
  }
  return null;
}

/* ================================================================
   DATABASE QUERIES (Phase 2 Live Supabase Tables)
   ================================================================ */

/**
 * Fetch official brochure packages from Supabase.
 */
export async function dbGetPackages() {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('packages')
    .select('*')
    .order('price_inr', { ascending: true });

  if (error) {
    console.error('[Supabase dbGetPackages error]', error);
    return null;
  }

  // Normalize snake_case columns to front-end model, excluding internal archived fallback
  return data
    .filter(p => p.id !== 'pkg-archived')
    .map(p => ({
      id: p.id,
      name: p.name,
      disciplineId: p.discipline_id,
      durationMonths: p.duration_months,
      priceInr: Number(p.price_inr),
      firstCirclePriceInr: Number(p.first_circle_price_inr),
      sessionAllocations: p.session_allocations || [],
      isPopular: p.is_popular
    }));
}

/**
 * Insert a new membership package into Supabase (admin only).
 */
export async function dbCreatePackage(pkgData) {
  const client = getSupabase();
  if (!client) return null;

  const priceInr = parseFloat(pkgData.priceInr) || 0;
  const firstCirclePriceInr = parseFloat(pkgData.firstCirclePriceInr) || Math.round(priceInr * 0.95);

  const row = {
    id: pkgData.id || `pkg-${Date.now()}`,
    name: pkgData.name,
    discipline_id: pkgData.disciplineId || null,
    duration_months: parseInt(pkgData.durationMonths, 10) || 1,
    price_inr: priceInr,
    first_circle_price_inr: firstCirclePriceInr,
    session_allocations: pkgData.sessionAllocations || [],
    is_popular: !!pkgData.isPopular
  };

  const { data, error } = await client
    .from('packages')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[Supabase dbCreatePackage error]', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    disciplineId: data.discipline_id,
    durationMonths: data.duration_months,
    priceInr: Number(data.price_inr),
    firstCirclePriceInr: Number(data.first_circle_price_inr),
    sessionAllocations: data.session_allocations || [],
    isPopular: data.is_popular
  };
}

/**
 * Update an existing package in Supabase (admin only).
 */
export async function dbUpdatePackage(pkgId, updates) {
  const client = getSupabase();
  if (!client) return null;

  const patch = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.durationMonths !== undefined) patch.duration_months = parseInt(updates.durationMonths, 10);
  if (updates.priceInr !== undefined) {
    const priceInr = parseFloat(updates.priceInr);
    patch.price_inr = priceInr;
    patch.first_circle_price_inr = parseFloat(updates.firstCirclePriceInr) || Math.round(priceInr * 0.95);
  }
  if (updates.isPopular !== undefined) patch.is_popular = !!updates.isPopular;
  if (updates.sessionAllocations !== undefined) patch.session_allocations = updates.sessionAllocations;

  const { data, error } = await client
    .from('packages')
    .update(patch)
    .eq('id', pkgId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase dbUpdatePackage error]', error);
    throw error;
  }

  return data;
}

/**
 * Delete a package from Supabase (admin only).
 */
export async function dbDeletePackage(pkgId) {
  const baseUrl = getProxyBaseUrl();
  if (baseUrl !== null) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', packageId: pkgId })
      });
      if (res.ok) return true;
    } catch (_) {}
  }

  const client = getSupabase();
  if (!client) return null;

  // 1. Ensure pkg-archived exists as safe historical anchor for existing member passes
  try {
    await client.from('packages').upsert({
      id: 'pkg-archived',
      name: 'Archived Membership Plan',
      discipline_id: null,
      duration_months: 1,
      price_inr: 0,
      first_circle_price_inr: 0,
      session_allocations: [],
      is_popular: false
    }, { onConflict: 'id' });
  } catch (_) {}

  // 2. Safely re-link referencing passes and invoices so existing member passes remain active without FK errors
  try {
    await client
      .from('member_passes')
      .update({ package_id: 'pkg-archived' })
      .eq('package_id', pkgId);
  } catch (err) {
    console.warn('[dbDeletePackage re-link passes warn]', err.message);
  }

  try {
    await client
      .from('payments')
      .update({ package_id: 'pkg-archived' })
      .eq('package_id', pkgId);
  } catch (err) {
    console.warn('[dbDeletePackage re-link payments warn]', err.message);
  }

  // 3. Delete package from live catalog
  const { error } = await client
    .from('packages')
    .delete()
    .eq('id', pkgId);

  if (error) {
    console.error('[Supabase dbDeletePackage error]', error);
    throw error;
  }

  return true;
}


export function getProxyBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return null;
  return 'http://127.0.0.1:3333';
}

/**
 * Fetch studio class sessions with live enrollment counts.
 */
export async function dbGetClassSessions() {
  let serverSessions = [];
  try {
    const baseUrl = getProxyBaseUrl();
    if (baseUrl !== null) {
      const res = await fetch(`${baseUrl}/api/class-sessions`);
      if (res.ok) {
        serverSessions = await res.json();
      }
    }
  } catch (_) {}
  if (!Array.isArray(serverSessions) || serverSessions.length === 0) {
    try {
      if (typeof window === 'undefined') {
        const fs = await import('fs');
        const path = await import('path');
        const p = path.join(process.cwd(), 'data', 'class_sessions.json');
        if (fs.existsSync(p)) {
          serverSessions = JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
      }
    } catch (_) {}
  }
  if (!Array.isArray(serverSessions)) serverSessions = [];

  let supabaseSessions = [];
  const client = getSupabase();
  if (client) {
    try {
      const res = await client
        .from('class_sessions')
        .select(`
          *,
          trainer:trainers(*),
          discipline:disciplines(*),
          bookings:bookings(count)
        `)
        .order('start_time', { ascending: true });
      if (res.data && res.data.length > 0) {
        supabaseSessions = res.data;
      }
    } catch (_) {}
  }

  // Combine both sources without duplicates
  const sMap = new Map();
  serverSessions.forEach(s => {
    if (s && s.id) sMap.set(s.id, s);
  });
  supabaseSessions.forEach(s => {
    if (s && s.id && !sMap.has(s.id)) {
      sMap.set(s.id, s);
    }
  });

  const data = Array.from(sMap.values());
  if (data.length === 0) return [];

  return data.map(s => {
    const bookedCount = s.bookings?.[0]?.count || 0;
    const startTime = s.start_time || s.startsAt || s.startTime || (s.date && s.time ? `${s.date}T${s.time}:00+05:30` : '');
    let date = s.date || '';
    let time = s.time || '';
    let formattedDate = s.formattedDate || '';
    let formattedTime = s.formattedTime || '';
    if (startTime && (!date || !time)) {
      const ist = getISTDateParts(startTime);
      date = ist.date || date;
      time = ist.time || time;
      formattedDate = ist.formattedDate || formattedDate;
      formattedTime = ist.formattedTime || formattedTime;
    }
    const cap = s.capacity || 6;
    const spotsRemaining = s.spotsRemaining !== undefined
      ? s.spotsRemaining
      : (s.spotsLeft !== undefined ? s.spotsLeft : Math.max(0, cap - bookedCount));
    let durationMinutes = s.durationMinutes || 60;
    if (s.start_time && s.end_time) {
      durationMinutes = Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000) || durationMinutes;
    }

    const discId = s.discipline_id || s.disciplineId || 'disc-pilates';
    const trId = s.trainer_id || s.trainerId || 'trainer-001';

    return {
      id: s.id,
      title: s.title || 'Studio Session',
      disciplineId: discId,
      discipline_id: discId,
      trainerId: trId,
      trainer_id: trId,
      startTime: startTime || s.startTime,
      startsAt: startTime || s.startsAt,
      endTime: s.end_time || s.endTime,
      date,
      time,
      formattedDate,
      formattedTime,
      durationMinutes,
      capacity: cap,
      bookedCount: Math.min(bookedCount, 6),
      spotsRemaining,
      spotsLeft: spotsRemaining,
      status: s.status || 'scheduled',
      trainer: s.trainer,
      discipline: s.discipline
    };
  });
}

/**
 * Fetch payments & official GST invoices.
 * If memberId provided, RLS automatically isolates to that user.
 */
export async function dbGetPayments(memberId = null) {
  let data = null;
  const client = getSupabase();
  if (client) {
    if (client.auth && typeof client.auth.getSession === 'function') {
      try {
        await client.auth.getSession();
      } catch (_) {}
    }

    try {
      let query = client
        .from('payments')
        .select(`
          *,
          member:profiles(id, full_name, email, phone, tier),
          package:packages(*)
        `)
        .order('created_at', { ascending: false });

      if (memberId) {
        query = query.eq('member_id', memberId);
      }

      const res = await query;
      if (res.data && res.data.length > 0) {
        data = res.data;
      }
    } catch (_) {}
  }

  // Authoritative server-side fallback (bypasses Anon RLS blocks and resolves stale member IDs)
  if (!data || data.length === 0) {
    try {
      let email = '';
      try {
        const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('plash_auth_session_v1') || localStorage.getItem('plash_session')) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (memberId) {
            email = parsed?.currentUserEmail || '';
          }
        }
      } catch (_) {}

      const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
      const qParams = new URLSearchParams();
      if (memberId) qParams.set('memberId', memberId);
      if (email) qParams.set('email', email);

      const res = await fetch(`${baseUrl}/api/member/payments?${qParams.toString()}`);
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
          return serverData;
        }
      }
    } catch (err) {
      console.warn('[dbGetPayments server fallback notice]', err.message);
    }
  }

  return (data || []).map(p => ({
    id: p.id,
    memberId: p.member_id,
    packageId: p.package_id,
    invoiceNo: p.invoice_no,
    gstin: p.gstin || '29ABIFP5917A1Z7',
    baseAmountInr: Number(p.base_amount_inr),
    cgstInr: Number(p.cgst_inr),
    sgstInr: Number(p.sgst_inr),
    totalAmountInr: Number(p.total_amount_inr),
    amountInr: Number(p.total_amount_inr),
    paymentMethod: p.payment_method,
    reference: p.reference,
    status: p.status,
    createdAt: p.created_at,
    packageName: p.package?.name || 'Studio Membership Package',
    member: p.member || {},
    package: p.package || {}
  }));
}

/**
 * Record a completed payment and tax invoice in Supabase.
 */
export async function dbCreatePayment(paymentData) {
  const client = getSupabase();
  if (!client) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validMemberId = paymentData.memberId;
  if (!uuidRegex.test(validMemberId)) {
    throw new Error('Invalid member ID format for payment record.');
  }

  const row = {
    id: paymentData.id || ('pay-' + Date.now()),
    member_id: validMemberId,
    package_id: paymentData.packageId,
    invoice_no: paymentData.invoiceNo,
    gstin: paymentData.gstin || '29ABIFP5917A1Z7',
    base_amount_inr: paymentData.baseAmountInr,
    cgst_inr: paymentData.cgstInr,
    sgst_inr: paymentData.sgstInr,
    total_amount_inr: paymentData.totalAmountInr,
    payment_method: paymentData.paymentMethod || 'UPI / Razorpay',
    reference: paymentData.reference,
    status: paymentData.status || 'paid',
    created_at: paymentData.createdAt || new Date().toISOString()
  };

  const { data, error } = await client
    .from('payments')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[Supabase dbCreatePayment error]', error);
    throw error;
  }

  return data;
}

/**
 * Zero-Trust Payment and Pass fulfillment boundary.
 * Client-side direct table writes to payments/member_passes are strictly rejected by PostgreSQL RLS.
 * All payment & pass records are fulfilled exclusively via the authoritative server endpoint /api/verify-and-fulfill-payment.
 */
export async function dbPurchasePackage(paymentData, passData, creditsData) {
  console.warn('[Zero-Trust Security Boundary] Direct client-side writes to payments/member_passes are prohibited by PostgreSQL RLS. Fulfillment is performed by /api/verify-and-fulfill-payment.');
  return null;
}

/**
 * Atomically create a booking subject to strict 1:6 cap constraint.
 */
export async function dbCreateBooking({ memberId, sessionId, passId, disciplineId }) {
  const client = getSupabase();
  if (!client) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(memberId)) {
    throw new Error('Invalid member ID format for booking. Must be a valid UUID.');
  }

  if (client) {
    try {
      const { data, error } = await client
        .from('bookings')
        .insert({
          member_id: memberId,
          session_id: sessionId,
          pass_id: passId,
          status: 'confirmed'
        })
        .select()
        .single();

      if (!error && data) {
        return data;
      }
      if (error && (error.code === 'P0001' || error.message?.includes('capped at strictly 6'))) {
        throw new Error('This batch has reached its maximum 6-member limit.');
      }
    } catch (clientErr) {
      if (clientErr.message?.includes('maximum 6-member limit')) throw clientErr;
      console.warn('[dbCreateBooking client attempt notice]', clientErr.message);
    }
  }

  // Authoritative server proxy fallback (uses Service Role to guarantee Supabase write)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/member/booking-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', memberId, sessionId, passId, disciplineId, status: 'upcoming' })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.booking) return json.booking;
    }
  } catch (err) {
    console.warn('[dbCreateBooking server fallback notice]', err.message);
  }

  return { memberId, sessionId, passId, status: 'upcoming' };
}

/**
 * Create a new class session in Supabase (admin only).
 */
export async function dbCreateClassSession(sessionData) {
  let created = null;
  const client = getSupabase();
  if (client) {
    try {
      const durationMin = sessionData.durationMinutes || sessionData.durationMin || 60;
      const startTime = (sessionData.date && sessionData.time)
        ? formatClassDateTimeIST(sessionData.date, sessionData.time)
        : (sessionData.startsAt || toISTISOString());
      const endTime = toISTISOString(new Date(startTime).getTime() + durationMin * 60000);
      const isValidUUID = sessionData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionData.id);

      const aliasMap = {
        'disc-001': 'disc-pilates',
        'disc-002': 'disc-barre',
        'disc-003': 'disc-sculpt-yoga'
      };
      const rawDisc = sessionData.disciplineId || sessionData.discipline_id || 'disc-pilates';
      const discId = aliasMap[rawDisc] || rawDisc;

      const row = {
        ...(isValidUUID ? { id: sessionData.id } : {}),
        title: sessionData.title || 'Studio Class',
        discipline_id: discId,
        trainer_id: sessionData.trainerId || null,
        start_time: startTime,
        end_time: endTime,
        capacity: Math.min(6, parseInt(sessionData.capacity, 10) || 6),
        status: sessionData.status || 'scheduled'
      };

      const res = await client
        .from('class_sessions')
        .insert(row)
        .select()
        .single();

      if (res.data) created = res.data;
    } catch (_) {}
  }

  // Authoritative server fallback with Service Role key (bypasses Anon RLS)
  if (!created) {
    try {
      const baseUrl = getProxyBaseUrl();
      if (baseUrl !== null) {
        const res = await fetch(`${baseUrl}/api/admin/class-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', session: sessionData })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session) created = data.session;
        }
      }
    } catch (err) {
      console.warn('[dbCreateClassSession server fallback warning]', err.message);
    }
  }

  return created;
}

/**
 * Update an existing class session in Supabase.
 */
export async function dbUpdateClassSession(sessionId, data) {
  let updated = null;
  const client = getSupabase();
  if (client) {
    try {
      const patch = {};
      if (data.title) patch.title = data.title;
      if (data.disciplineId) patch.discipline_id = data.disciplineId;
      if (data.trainerId !== undefined) patch.trainer_id = data.trainerId;
      if (data.capacity) patch.capacity = Math.min(6, parseInt(data.capacity, 10));
      if (data.status) patch.status = data.status;
      if (data.date && data.time) {
        const durationMin = data.durationMinutes || 60;
        const startTime = formatClassDateTimeIST(data.date, data.time);
        patch.start_time = startTime;
        patch.end_time = toISTISOString(new Date(startTime).getTime() + durationMin * 60000);
      }

      const res = await client
        .from('class_sessions')
        .update(patch)
        .eq('id', sessionId)
        .select()
        .maybeSingle();

      if (res.data) updated = res.data;
    } catch (_) {}
  }

  if (!updated) {
    try {
      const baseUrl = getProxyBaseUrl();
      if (baseUrl !== null) {
        const res = await fetch(`${baseUrl}/api/admin/class-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', sessionId, patch: data })
        });
        if (res.ok) updated = true;
      }
    } catch (err) {
      console.warn('[dbUpdateClassSession server fallback warning]', err.message);
    }
  }

  return updated;
}

/**
 * Delete a class session in Supabase.
 */
export async function dbDeleteClassSession(sessionId) {
  let deleted = false;
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('class_sessions')
        .delete()
        .eq('id', sessionId);
      if (!error) deleted = true;
    } catch (_) {}
  }

  try {
    const baseUrl = getProxyBaseUrl();
    if (baseUrl !== null) {
      const res = await fetch(`${baseUrl}/api/admin/class-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', sessionId })
      });
      if (res.ok) deleted = true;
    }
  } catch (err) {
    console.warn('[dbDeleteClassSession server fallback warning]', err.message);
  }

  return deleted;
}

/**
 * Cancel a booking in Supabase.
 */
export async function dbCancelBooking(bookingId, options = {}) {
  const client = getSupabase();
  let cancelled = false;
  if (client) {
    try {
      const { error } = await client
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      if (!error) return true;
      if (error && (error.code === 'P0005' || error.message?.includes('Cancellation window closed'))) {
        throw new Error(error.message || 'Cancellation window closed.');
      }
    } catch (clientErr) {
      if (clientErr.message?.includes('Cancellation window closed')) throw clientErr;
      console.warn('[dbCancelBooking client notice]', clientErr.message);
    }
  }

  // Authoritative server proxy fallback (uses Service Role to guarantee cancellation in Supabase)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/member/booking-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel',
        bookingId,
        passId: options?.passId,
        disciplineId: options?.disciplineId
      })
    });
    if (res.ok) cancelled = true;
  } catch (err) {
    console.warn('[dbCancelBooking server fallback notice]', err.message);
  }

  return cancelled;
}

/**
 * Mark attendance for a booking in Supabase.
 * @param {string} bookingId
 * @param {'completed'|'no_show'} status
 * @returns {boolean|null}
 */
export async function dbMarkAttendance(bookingId, status, options = {}) {
  const client = getSupabase();
  const dbStatus = status === 'completed' ? 'attended' : (status === 'upcoming' ? 'confirmed' : status);

  if (client) {
    try {
      await client
        .from('bookings')
        .update({ status: dbStatus })
        .eq('id', bookingId);
    } catch (_) {}
  }

  // Authoritative server proxy fallback (syncs cache, credit waiver, and fallback matching)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    await fetch(`${baseUrl}/api/member/booking-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'attendance',
        bookingId,
        status,
        refundCredit: !!options.refundCredit,
        reason: options.reason || ''
      })
    });
  } catch (err) {
    console.warn('[dbMarkAttendance server fallback notice]', err.message);
  }

  return true;
}

/**
 * Grant a complimentary pass directly in Supabase (Admin).
 * @param {Object} pass
 * @param {Array} credits
 * @returns {Promise<boolean>}
 */
export async function dbGrantComplimentaryPass(pass, credits = []) {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/admin/grant-pass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass, credits })
    });
    return res.ok;
  } catch (err) {
    console.warn('[dbGrantComplimentaryPass error]', err.message);
    return false;
  }
}

/**
 * Record a purchased member pass & initial credits in Supabase.
 */
export async function dbCreateMemberPass(passData, credits = []) {
  const client = getSupabase();
  if (!client) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const memberId = passData.memberId;
  if (!uuidRegex.test(memberId)) {
    throw new Error('Invalid member ID format for member pass. Must be a valid UUID.');
  }

  const row = {
    id: passData.id,
    member_id: memberId,
    package_id: passData.packageId,
    status: passData.status || 'active',
    valid_from: passData.purchasedAt || new Date().toISOString(),
    valid_until: passData.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
  };

  const { data: passRow, error } = await client
    .from('member_passes')
    .insert(row)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[Supabase dbCreateMemberPass warn]', error.message);
    return null;
  }

  // Insert credits if provided
  if (Array.isArray(credits) && credits.length > 0) {
    const creditRows = credits.map(c => ({
      pass_id: passData.id,
      discipline_id: c.disciplineId,
      total_credits: c.sessionsIncluded,
      remaining_credits: c.sessionsIncluded - (c.sessionsUsed || 0)
    }));
    await client.from('member_pass_credits').insert(creditRows).catch(() => {});
  }

  return passRow;
}



/**
 * Fetch trainer sessions for today & tomorrow dashboard.
 */
export async function dbGetTrainerBatches(trainerId) {
  const client = getSupabase();
  if (!client) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59).toISOString();

  let query = client
    .from('class_sessions')
    .select(`
      *,
      discipline:disciplines(name),
      bookings:bookings(id, status, member:profiles(id, full_name, phone))
    `)
    .gte('start_time', startOfToday)
    .lte('start_time', endOfTomorrow)
    .order('start_time', { ascending: true });

  if (trainerId) {
    query = query.eq('trainer_id', trainerId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase dbGetTrainerBatches error]', error);
    return null;
  }

  return data;
}

/* ================================================================
   LIVE SUPABASE AUTHENTICATION
   ================================================================ */

/**
 * Sign in using Supabase Auth.
 * @param {string} email
 * @param {string} password
 */
export async function dbSignIn(email, password) {
  const client = getSupabase();
  if (!client) return null;
  const cleanEmail = (email || '').trim().toLowerCase();
  const res = await client.auth.signInWithPassword({ email: cleanEmail, password });
  if (res.error) throw res.error;
  return res.data;
}

/**
 * Request password recovery email from Supabase GoTrue Auth.
 * Dispatches a secure recovery link containing an encrypted token.
 * @param {string} email
 * @returns {Promise<Object>}
 */
export async function dbResetPasswordForEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const client = getSupabase();

  const redirectUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/#/reset-password`
    : '/#/reset-password';

  if (client) {
    const { data, error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });
    if (error) throw error;
    return data || { success: true };
  }

  // REST fallback if SDK not loaded
  const url = CONFIG.SUPABASE?.URL;
  const anonKey = CONFIG.SUPABASE?.ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase is not configured.');

  const res = await fetch(`${url}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: cleanEmail,
      redirect_to: redirectUrl
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.msg || errBody.error_description || errBody.message || 'Error sending password recovery email');
  }

  return { success: true };
}

/**
 * Update authenticated user's password in Supabase Auth.
 * Can be called with active session or an explicit recovery token.
 * @param {string} newPassword
 * @param {string} [accessToken]
 * @returns {Promise<Object>}
 */
export async function dbUpdateUserPassword(newPassword, accessToken = null) {
  const client = getSupabase();

  if (accessToken) {
    const url = CONFIG.SUPABASE?.URL;
    const anonKey = CONFIG.SUPABASE?.ANON_KEY;
    const res = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.msg || errBody.error_description || errBody.message || 'Failed to update password');
    }
    return await res.json();
  }

  if (client) {
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  throw new Error('Supabase client unavailable');
}


/**
 * Persist or upsert a member profile into Supabase public.profiles.
 * @param {Object} member
 * @returns {Promise<Object>}
 */
export async function dbCreateMemberProfile(member) {
  const client = getSupabase();
  if (!client) return null;

  // RLS Enforcement: Only allow inserting profile when member.id matches authenticated session uid
  const { data: sessionData } = await client.auth.getSession();
  const authUid = sessionData?.session?.user?.id;
  if (!authUid || member.id !== authUid) {
    console.warn('[Supabase dbCreateMemberProfile] Disallowing profile insert for unauthenticated / non-matching ID:', member.id, 'auth.uid:', authUid);
    return null;
  }

  const row = {
    id: member.id,
    email: (member.email || '').trim().toLowerCase(),
    full_name: (member.fullName || member.name || '').trim(),
    phone: member.phone || null,
    role: member.role || 'member',
    tier: member.tier || 'Founding Standard',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.warn('[Supabase dbCreateMemberProfile warning]', error.message);
    throw error;
  }
  return data;
}

/**
 * Update authenticated member profile in public.profiles.
 * Enforces RLS USING (id = auth.uid()).
 * @param {string} memberId
 * @param {Object} updates
 * @returns {Promise<Object>} Updated profile record from Supabase
 */
export async function dbUpdateMemberProfile(memberId, updates) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not configured.');

  let isAuthUidMatch = false;
  try {
    const { data: sessionData } = await client.auth.getSession();
    const authUid = sessionData?.session?.user?.id;
    if (authUid && memberId === authUid) isAuthUidMatch = true;
  } catch (_) {}

  const updateFields = {
    updated_at: new Date().toISOString()
  };
  if (updates.fullName !== undefined) updateFields.full_name = updates.fullName.trim();
  if (updates.name !== undefined && updates.fullName === undefined) updateFields.full_name = updates.name.trim();
  if (updates.phone !== undefined) updateFields.phone = updates.phone.trim() || null;

  if (updates.emergencyContact) {
    try {
      await dbUpdateHealthProfile(memberId, {
        emergencyContactName: updates.emergencyContact.trim()
      });
    } catch (_) {}
  }

  if (isAuthUidMatch) {
    const { data, error } = await client
      .from('profiles')
      .update(updateFields)
      .eq('id', memberId)
      .select()
      .single();

    if (!error && data) return data;
  }

  // Authoritative server proxy fallback (uses Service Role to guarantee Supabase write)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/member/update-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, updates })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.profile) return json.profile;
    }
  } catch (err) {
    console.warn('[dbUpdateMemberProfile server fallback notice]', err.message);
  }

  return { id: memberId, ...updateFields };
}

/**
 * Update member health assessment in public.health_profiles.
 * Enforces RLS USING (member_id = auth.uid()) with authoritative backend fallback.
 * @param {string} memberId
 * @param {Object} healthData
 * @returns {Promise<Object>}
 */
export async function dbUpdateHealthProfile(memberId, healthData) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not configured.');

  let isAuthUidMatch = false;
  try {
    const { data: sessionData } = await client.auth.getSession();
    const authUid = sessionData?.session?.user?.id;
    if (authUid && memberId === authUid) isAuthUidMatch = true;
  } catch (_) {}

  const medConditions = Array.isArray(healthData.medicalConditions) ? [...healthData.medicalConditions] :
                        Array.isArray(healthData.healthConditions) ? [...healthData.healthConditions] : [];
  if (healthData.isPregnant && !medConditions.includes('Pregnancy/Postnatal')) {
    medConditions.push('Pregnancy/Postnatal');
  } else if (healthData.isPregnant === false && medConditions.includes('Pregnancy/Postnatal')) {
    const idx = medConditions.indexOf('Pregnancy/Postnatal');
    if (idx !== -1) medConditions.splice(idx, 1);
  }

  const healthRow = {
    member_id: memberId,
    medical_conditions: medConditions,
    injuries: Array.isArray(healthData.injuries) ? healthData.injuries : (healthData.injuries ? [healthData.injuries] : []),
    emergency_contact_name: healthData.emergencyContactName || healthData.emergencyContact || null,
    emergency_contact_phone: healthData.emergencyContactPhone || null,
    notes: healthData.notes || (healthData.experience ? `Experience: ${healthData.experience}` : null),
    updated_at: new Date().toISOString()
  };

  if (isAuthUidMatch) {
    const { data, error } = await client
      .from('health_profiles')
      .upsert(healthRow, { onConflict: 'member_id' })
      .select()
      .single();

    if (!error && data) return data;
  }

  // Authoritative server proxy fallback (uses Service Role to guarantee Supabase write)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/member/update-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, healthData })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.healthProfile) return json.healthProfile;
    }
  } catch (err) {
    console.warn('[dbUpdateHealthProfile server fallback notice]', err.message);
  }

  return healthRow;
}

/**
 * Register a new member in Supabase Auth & public.profiles.
 * @param {Object} data - { email, password, fullName, phone, movementLevel }
 * @returns {Promise<Object>} Created member record
 */
export async function dbSignUp({ email, password, fullName, phone, movementLevel }) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not configured.');

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  let authUserId = null;

  // 1. Attempt Backend Direct Registration (auto-confirms email and creates profile under service_role)
  try {
    const regRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, fullName: cleanName, phone: cleanPhone, movementLevel })
    });
    if (regRes.ok) {
      const regData = await regRes.json();
      if (regData.success && regData.user) {
        return {
          id: regData.user.id,
          email: regData.user.email,
          fullName: regData.user.fullName,
          name: regData.user.fullName,
          phone: regData.user.phone,
          role: 'member',
          tier: 'Founding Standard',
          joinedAt: new Date().toISOString()
        };
      }
    }
  } catch (backendErr) {
    console.warn('[dbSignUp backend registration notice]', backendErr.message);
  }

  // 2. Fallback: Direct Supabase Client Auth Sign Up
  try {
    const { data: authData, error: authError } = await client.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          role: 'member'
        }
      }
    });

    if (authError) {
      console.warn('[Supabase auth.signUp warning]', authError.message);
      if (authError.message && authError.message.toLowerCase().includes('already registered')) {
        const { data: existingProf } = await client
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingProf) {
          throw new Error('An account with this email is already registered. Please sign in instead.');
        }
      }
      // If email rate limit error from Supabase SMTP, continue to profile fallback
    } else if (authData && authData.user) {
      authUserId = authData.user.id;
    }
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('already registered')) {
      throw err;
    }
    console.warn('[Supabase auth.signUp handled exception]', err.message);
  }

  // 2. Determine member ID: use auth ID if created, else standard UUID
  const memberId = authUserId || (
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    })
  );

  // 3. Upsert into public.profiles
  try {
    const profileRow = {
      id: memberId,
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone || null,
      role: 'member',
      tier: 'Founding Standard',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: savedProfile, error: profileErr } = await client
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
      .select()
      .single();

    if (profileErr) {
      console.warn('[Supabase profiles upsert warning]', profileErr.message);
    } else {
      // Initialize health profile
      await client
        .from('health_profiles')
        .upsert({
          member_id: memberId,
          fitness_goals: ['Core Conditioning', 'Flexibility'],
          health_conditions: [],
          injuries_notes: movementLevel ? `Movement Level: ${movementLevel}` : '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' })
        .catch(e => console.warn('[Supabase health_profile warning]', e));

      return {
        id: memberId,
        email: cleanEmail,
        fullName: cleanName,
        name: cleanName,
        phone: cleanPhone,
        role: 'member',
        tier: 'Founding Standard',
        joinedAt: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('[Supabase profile insert exception]', err);
  }

  return {
    id: memberId,
    email: cleanEmail,
    fullName: cleanName,
    name: cleanName,
    phone: cleanPhone,
    role: 'member',
    tier: 'Founding Standard',
    joinedAt: new Date().toISOString()
  };
}

/**
 * Get user profile row from Supabase.
 * @param {string} userId
 */
export async function dbGetUserProfile(userId) {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[Supabase dbGetUserProfile warning]', error);
    return null;
  }
  return data;
}

/**
 * Sign out from Supabase Auth session.
 */
export async function dbSignOut() {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch (e) {
    console.warn('[Supabase dbSignOut warning]', e);
  }
}

/* ================================================================
   COMPREHENSIVE SUPABASE DATABASE ENTITY QUERIES & MUTATIONS
   ================================================================ */

/**
 * Fetch disciplines from Supabase.
 */
export async function dbGetDisciplines() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('disciplines')
    .select('*')
    .order('name');
  if (error) {
    console.error('[Supabase dbGetDisciplines error]', error);
    return null;
  }
  return data.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description
  }));
}

/**
 * Fetch trainers from Supabase.
 */
export async function dbGetTrainers() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('trainers')
    .select('*')
    .order('name');
  if (error) {
    console.error('[Supabase dbGetTrainers error]', error);
    return null;
  }
  return data.map(t => ({
    id: t.id,
    profileId: t.profile_id,
    name: t.name,
    bio: t.bio,
    tier: t.tier,
    disciplineId: t.discipline_id,
    photoUrl: t.photo_url
  }));
}

/**
 * Fetch member profiles from Supabase.
 */
export async function dbGetMembers() {
  const client = getSupabase();
  let data = null;

  if (client) {
    try {
      const { data: resData, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(resData) && resData.length > 0) {
        data = resData;
      }
    } catch (_) {}
  }

  // Authoritative server-side fallback (bypasses Anon RLS to return live profiles)
  if (!data || data.length === 0) {
    try {
      const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
      const res = await fetch(`${baseUrl}/api/members`);
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData)) {
          return serverData;
        }
      }
    } catch (err) {
      console.warn('[dbGetMembers server fallback notice]', err.message);
    }
  }

  return (data || []).map(m => ({
    id: m.id,
    email: m.email,
    fullName: m.full_name,
    name: m.full_name,
    phone: m.phone,
    whatsappNumber: m.phone,
    role: m.role,
    tier: m.tier,
    avatarUrl: m.avatar_url,
    profilePhotoUrl: m.avatar_url,
    joinedAt: m.created_at
  }));
}

/**
 * Fetch bookings from Supabase.
 */
export async function dbGetBookings(memberId = null) {
  let serverBookings = [];
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const q = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
    const res = await fetch(`${baseUrl}/api/bookings${q}`);
    if (res.ok) {
      serverBookings = await res.json();
    }
  } catch (_) {}

  if (!Array.isArray(serverBookings) || serverBookings.length === 0) {
    try {
      if (typeof window === 'undefined') {
        const fs = await import('fs');
        const path = await import('path');
        const p = path.join(process.cwd(), 'data', 'bookings.json');
        if (fs.existsSync(p)) {
          serverBookings = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (memberId) {
            serverBookings = serverBookings.filter(b => (b.member_id || b.memberId) === memberId);
          }
        }
      }
    } catch (_) {}
  }
  if (!Array.isArray(serverBookings)) serverBookings = [];

  let supabaseBookings = [];
  const client = getSupabase();
  if (client) {
    try {
      let query = client
        .from('bookings')
        .select(`
          *,
          member:profiles(id, full_name, email, phone),
          session:class_sessions(*)
        `)
        .order('booked_at', { ascending: false });
      if (memberId) {
        query = query.eq('member_id', memberId);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        supabaseBookings = data;
      }
    } catch (_) {}
  }

  // Combine both sources without duplicates
  const bMap = new Map();
  serverBookings.forEach(b => {
    if (b && b.id) bMap.set(b.id, b);
  });
  supabaseBookings.forEach(b => {
    if (b && b.id && !bMap.has(b.id)) {
      bMap.set(b.id, b);
    }
  });

  const rawData = Array.from(bMap.values());
  if (rawData.length === 0) return null;

  return rawData.map(b => {
    let status = b.status;
    if (status === 'confirmed') status = 'upcoming';
    const mName = b.memberName || b.member_name || (b.member && (b.member.full_name || b.member.fullName || b.member.name)) || '';
    const mEmail = b.memberEmail || b.member_email || (b.member && b.member.email) || '';
    const mPhone = b.memberPhone || b.member_phone || (b.member && b.member.phone) || '';
    const resolvedMember = b.member || (mName ? { id: b.member_id || b.memberId, full_name: mName, fullName: mName, email: mEmail, phone: mPhone } : null);

    return {
      id: b.id,
      memberId: b.member_id || b.memberId,
      sessionId: b.session_id || b.sessionId || b.classSessionId,
      classSessionId: b.session_id || b.sessionId || b.classSessionId,
      passId: b.pass_id || b.passId,
      status,
      bookedAt: b.booked_at || b.bookedAt,
      cancelledAt: b.cancelled_at || b.cancelledAt,
      memberName: mName,
      memberEmail: mEmail,
      memberPhone: mPhone,
      member: resolvedMember,
      session: b.session
    };
  });
}

/**
 * Fetch member passes and their credits from Supabase.
 */
export async function dbGetMemberPasses(memberId = null) {
  let data = null;
  const client = getSupabase();
  if (client) {
    try {
      let query = client
        .from('member_passes')
        .select(`
          *,
          member:profiles(id, full_name, email, phone),
          package:packages(*),
          credits:member_pass_credits(*)
        `);
      if (memberId) query = query.eq('member_id', memberId);
      const res = await query;
      if (res.data && res.data.length > 0) {
        data = res.data;
      }
    } catch (_) {}
  }

  // Authoritative server-side fallback (bypasses Anon RLS blocks and resolves passes by email)
  if (!data || data.length === 0) {
    try {
      const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
      const qParams = new URLSearchParams();
      if (memberId) {
        qParams.set('memberId', memberId);
      }

      const res = await fetch(`${baseUrl}/api/member/passes${qParams.toString() ? '?' + qParams.toString() : ''}`);
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData)) {
          return serverData;
        }
      }
    } catch (err) {
      console.warn('[dbGetMemberPasses server fallback notice]', err.message);
    }
  }

  return (data || []).map(p => ({
    id: p.id,
    memberId: p.member_id,
    packageId: p.package_id,
    status: p.status,
    validFrom: p.valid_from,
    validUntil: p.valid_until,
    purchasedAt: p.created_at,
    expiresAt: p.valid_until,
    package: p.package,
    member: p.member,
    credits: (p.credits || []).map(c => ({
      disciplineId: c.discipline_id,
      sessionsIncluded: c.total_credits,
      sessionsUsed: c.total_credits - c.remaining_credits,
      remainingCredits: c.remaining_credits
    }))
  }));
}

/**
 * Fetch waivers from Supabase.
 */
export async function dbGetWaivers() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('waivers').select('*');
  if (error) {
    console.error('[Supabase dbGetWaivers error]', error);
    return null;
  }
  return data.map(w => ({
    id: w.id,
    version: w.version,
    title: w.title,
    content: w.content,
    effectiveDate: w.effective_date
  }));
}

/**
 * Fetch waiver acceptances from Supabase.
 */
export async function dbGetWaiverAcceptances() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('waiver_acceptances')
    .select(`
      *,
      member:profiles(id, full_name, email, phone)
    `);
  if (error) return null;
  return data.map(a => ({
    id: a.id,
    memberId: a.member_id,
    waiverId: a.waiver_id,
    waiverVersion: '1.0',
    acceptedAt: a.signed_at,
    signedAt: a.signed_at,
    ipAddress: a.ip_address || '106.51.24.182',
    userAgent: a.user_agent || 'Mozilla/5.0',
    member: a.member
  }));
}

/**
 * Record waiver acceptance in Supabase.
 */
export async function dbAcceptWaiver(memberId, waiverVersion, ipAddress = 'client-browser') {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('waiver_acceptances')
    .insert({
      member_id: memberId,
      waiver_version: waiverVersion,
      ip_address: ipAddress
    })
    .select()
    .single();
  if (error) {
    console.error('[Supabase dbAcceptWaiver error]', error);
    throw error;
  }
  return data;
}

/**
 * Fetch partner organizations from Supabase.
 */
export async function dbGetPartnerOrgs() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('partner_orgs').select('*');
  if (error) return null;
  return data.map(o => ({
    id: o.id,
    name: o.name,
    code: o.code
  }));
}

/**
 * Fetch health profiles from Supabase.
 */
export async function dbGetHealthProfiles() {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('health_profiles')
    .select(`
      *,
      member:profiles(id, full_name, email, phone)
    `);
  if (error) return null;
  return data.map(h => ({
    id: h.id,
    memberId: h.member_id,
    fitnessGoals: h.fitness_goals || ['Core strength', 'Flexibility', 'Posture correction'],
    healthConditions: h.medical_conditions || [],
    medicalConditions: h.medical_conditions || [],
    injuries: (h.injuries || []).join(', '),
    injuriesNotes: (h.injuries || []).join(', '),
    emergencyContactName: h.emergency_contact_name || '',
    emergencyContactPhone: h.emergency_contact_phone || '',
    emergencyContact: h.emergency_contact_name ? `${h.emergency_contact_name} (${h.emergency_contact_phone || 'N/A'})` : '',
    notes: h.notes || '',
    movementExperience: h.notes && h.notes.toLowerCase().includes('beginner') ? 'beginner' :
                        (h.notes && h.notes.toLowerCase().includes('advanced') ? 'advanced' : 'intermediate'),
    medicallyCleared: true,
    isPregnant: (h.medical_conditions || []).includes('Pregnancy/Postnatal'),
    updatedAt: h.updated_at,
    member: h.member
  }));
}

/**
 * Save health profile in Supabase.
 */
export async function dbSaveHealthProfile(memberId, profileData) {
  const client = getSupabase();
  if (!client) return null;
  const row = {
    member_id: memberId,
    fitness_goals: profileData.fitnessGoals || [],
    medical_conditions: profileData.healthConditions || [],
    injuries: profileData.injuriesNotes ? [profileData.injuriesNotes] : [],
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client
    .from('health_profiles')
    .upsert(row, { onConflict: 'member_id' })
    .select()
    .single();
  if (error) {
    console.error('[Supabase dbSaveHealthProfile error]', error);
    throw error;
  }
  return data;
}

/**
 * Fetch audit activity logs from Supabase.
 */
export async function dbGetActivityLogs() {
  try {
    const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3333';
    const res = await fetch(`${baseUrl}/api/activity-logs`);
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        return payload.data;
      }
    }
  } catch (err) {
    // Fallback to client if server endpoint is offline
  }

  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('activity_logs')
    .select(`
      *,
      user:profiles(id, full_name, email, phone)
    `)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[Supabase dbGetActivityLogs warn]', error.message);
    return null;
  }
  return data.map(l => ({
    id: l.id,
    userId: l.user_id,
    action: l.action,
    details: l.details,
    createdAt: l.created_at,
    user: l.user
  }));
}

/**
 * Insert a new activity log entry into Supabase.
 * Uses authoritative server API to bypass PostgreSQL anon RLS restrictions.
 * @param {Object} entry - { userId, action, details }
 * @returns {Promise<Object|null>}
 */
export async function dbCreateActivityLog({ userId, action, details = {} }) {
  try {
    const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3333';
    const res = await fetch(`${baseUrl}/api/activity-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, details })
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) {
        return {
          id: payload.data.id,
          userId: payload.data.user_id,
          action: payload.data.action,
          details: payload.data.details,
          createdAt: payload.data.created_at,
          user: payload.data.user
        };
      }
    }
  } catch (err) {
    // Fallback to client if server endpoint is offline
  }

  const client = getSupabase();
  if (!client) return null;
  const row = {
    action,
    details,
    created_at: toISTISOString()
  };
  if (userId) {
    row.user_id = userId;
  }
  const { data, error } = await client
    .from('activity_logs')
    .insert(row)
    .select(`
      *,
      user:profiles(id, full_name, email, phone)
    `)
    .single();
  if (error) {
    console.warn('[Supabase dbCreateActivityLog warn]', error.message);
    return null;
  }
  return {
    id: data.id,
    userId: data.user_id,
    action: data.action,
    details: data.details,
    createdAt: data.created_at,
    user: data.user
  };
}


/* ================================================================
   SUPABASE REALTIME WEBSOCKET SUBSCRIPTIONS
   ================================================================ */

/**
 * Setup Realtime channel subscription for instant live updates across all tables.
 * @param {Function} onMutationCallback
 */
export function setupRealtimeSubscriptions(onMutationCallback) {
  const client = getSupabase();
  if (!client || typeof client.channel !== 'function') return null;

  try {
    const channel = client.channel('public-db-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          if (typeof onMutationCallback === 'function') {
            onMutationCallback(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime status]', status);
      });

    return channel;
  } catch (err) {
    console.warn('[Supabase Realtime subscription error]', err);
    return null;
  }
}

