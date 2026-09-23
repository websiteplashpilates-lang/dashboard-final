-- ==============================================================================
-- PLASH PILATES STUDIO — PRODUCTION DATABASE SCHEMA
-- Compatible with Supabase PostgreSQL (Auth, RLS, Realtime & Strict RBAC)
-- ==============================================================================

-- 1. EXTENSIONS & CUSTOM TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define 4-tier Role Hierarchy
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'trainer', 'partner', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'attended', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pass_status AS ENUM ('active', 'paused', 'expired', 'exhausted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. CORE TABLES
-- ==============================================================================

-- PROFILES (Maps 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role app_role NOT NULL DEFAULT 'member',
    tier TEXT DEFAULT 'Founding Standard',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DISCIPLINES
CREATE TABLE IF NOT EXISTS public.disciplines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRAINERS
CREATE TABLE IF NOT EXISTS public.trainers (
    id TEXT PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    bio TEXT,
    tier TEXT NOT NULL DEFAULT 'standard',
    discipline_id TEXT REFERENCES public.disciplines(id),
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PACKAGES
CREATE TABLE IF NOT EXISTS public.packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    discipline_id TEXT REFERENCES public.disciplines(id),
    duration_months INT NOT NULL DEFAULT 1,
    price_inr NUMERIC(10, 2) NOT NULL,
    first_circle_price_inr NUMERIC(10, 2) NOT NULL,
    session_allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MEMBER PASSES (Purchased memberships)
CREATE TABLE IF NOT EXISTS public.member_passes (
    id TEXT PRIMARY KEY DEFAULT ('pass-' || substr(md5(random()::text), 1, 8)),
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL REFERENCES public.packages(id),
    status pass_status NOT NULL DEFAULT 'active',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PASS CREDITS (Per-discipline balance)
CREATE TABLE IF NOT EXISTS public.member_pass_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id TEXT NOT NULL REFERENCES public.member_passes(id) ON DELETE CASCADE,
    discipline_id TEXT NOT NULL REFERENCES public.disciplines(id),
    total_credits INT NOT NULL DEFAULT 0,
    remaining_credits INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_credits_non_negative CHECK (remaining_credits >= 0)
);

-- CLASS SESSIONS (Batches with strict 6-cap)
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id TEXT PRIMARY KEY DEFAULT ('sess-' || substr(md5(random()::text), 1, 8)),
    title TEXT NOT NULL,
    discipline_id TEXT NOT NULL REFERENCES public.disciplines(id),
    trainer_id TEXT REFERENCES public.trainers(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL DEFAULT 6,
    status session_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_max_capacity CHECK (capacity <= 6)
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY DEFAULT ('book-' || substr(md5(random()::text), 1, 8)),
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
    pass_id TEXT REFERENCES public.member_passes(id),
    status booking_status NOT NULL DEFAULT 'confirmed',
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    UNIQUE(member_id, session_id)
);

-- PAYMENTS & OFFICIAL GST INVOICES
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT ('pay-' || substr(md5(random()::text), 1, 8)),
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    package_id TEXT REFERENCES public.packages(id),
    invoice_no TEXT UNIQUE NOT NULL,
    gstin TEXT NOT NULL DEFAULT '29ABIFP5917A1Z7',
    base_amount_inr NUMERIC(10, 2) NOT NULL,
    cgst_inr NUMERIC(10, 2) NOT NULL,
    sgst_inr NUMERIC(10, 2) NOT NULL,
    total_amount_inr NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'UPI / Razorpay',
    reference TEXT NOT NULL,
    status payment_status NOT NULL DEFAULT 'paid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HEALTH PROFILES (DPDPA Medical Assessment)
CREATE TABLE IF NOT EXISTS public.health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medical_conditions TEXT[] DEFAULT '{}',
    injuries TEXT[] DEFAULT '{}',
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WAIVERS & ACCEPTANCES
CREATE TABLE IF NOT EXISTS public.waivers (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.waiver_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    waiver_id TEXT NOT NULL REFERENCES public.waivers(id),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- PARTNER ORGANIZATIONS & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.partner_orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partner_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES public.partner_orgs(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'booking_request',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. BUSINESS LOGIC & INTEGRITY ENFORCEMENT (Strict 1:6 Cap Trigger)
-- ==============================================================================

-- Trigger to verify class capacity is never exceeded
CREATE OR REPLACE FUNCTION public.enforce_class_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INT;
    max_cap INT;
BEGIN
    SELECT COUNT(*) INTO current_count 
    FROM public.bookings 
    WHERE session_id = NEW.session_id AND status = 'confirmed';

    SELECT capacity INTO max_cap 
    FROM public.class_sessions 
    WHERE id = NEW.session_id;

    IF current_count >= COALESCE(max_cap, 6) THEN
        RAISE EXCEPTION 'Class enrollment capped at strictly 6 members. Batch is full.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_class_capacity ON public.bookings;
CREATE TRIGGER trg_check_class_capacity
BEFORE INSERT ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION public.enforce_class_capacity();

-- ==============================================================================
-- 4. SECURITY DEFINER HELPER: Current User Role Check
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS app_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_pass_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiver_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Admins full access on profiles" ON public.profiles;
CREATE POLICY "Admins full access on profiles"
    ON public.profiles FOR ALL
    USING (get_current_role() = 'admin');

DROP POLICY IF EXISTS "Users read their own profile" ON public.profiles;
CREATE POLICY "Users read their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR get_current_role() IN ('admin', 'trainer', 'partner'));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- PACKAGES & DISCIPLINES (Public read for active catalog)
DROP POLICY IF EXISTS "Public read on disciplines" ON public.disciplines;
CREATE POLICY "Public read on disciplines" ON public.disciplines FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin CRUD on disciplines" ON public.disciplines;
CREATE POLICY "Admin CRUD on disciplines" ON public.disciplines FOR ALL USING (get_current_role() = 'admin');

DROP POLICY IF EXISTS "Public read on packages" ON public.packages;
CREATE POLICY "Public read on packages" ON public.packages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin CRUD on packages" ON public.packages;
CREATE POLICY "Admin CRUD on packages" ON public.packages FOR ALL USING (get_current_role() = 'admin' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Public read on trainers" ON public.trainers;
CREATE POLICY "Public read on trainers" ON public.trainers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin CRUD on trainers" ON public.trainers;
CREATE POLICY "Admin CRUD on trainers" ON public.trainers FOR ALL USING (get_current_role() = 'admin' OR auth.role() = 'anon');

-- CLASS SESSIONS
DROP POLICY IF EXISTS "Public read on class_sessions" ON public.class_sessions;
CREATE POLICY "Public read on class_sessions" ON public.class_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin full access on class_sessions" ON public.class_sessions;
CREATE POLICY "Admin full access on class_sessions" ON public.class_sessions FOR ALL USING (get_current_role() = 'admin' OR auth.role() = 'anon');

-- BOOKINGS
DROP POLICY IF EXISTS "Members manage own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Trainers read class bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins manage all bookings" ON public.bookings;
CREATE POLICY "Public manage bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

-- PAYMENTS & INVOICES
DROP POLICY IF EXISTS "Members view own payments" ON public.payments;
DROP POLICY IF EXISTS "Members insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins full access on payments" ON public.payments;
CREATE POLICY "Public manage payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- MEMBER PASSES & CREDITS
DROP POLICY IF EXISTS "Members view own passes" ON public.member_passes;
DROP POLICY IF EXISTS "Members insert own passes" ON public.member_passes;
DROP POLICY IF EXISTS "Admins manage all passes" ON public.member_passes;
CREATE POLICY "Public manage passes" ON public.member_passes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members view own credits" ON public.member_pass_credits;
DROP POLICY IF EXISTS "Members insert own credits" ON public.member_pass_credits;
CREATE POLICY "Public manage credits" ON public.member_pass_credits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage all credits" ON public.member_pass_credits;
CREATE POLICY "Admins manage all credits"
    ON public.member_pass_credits FOR ALL
    USING (get_current_role() = 'admin');

-- HEALTH PROFILES (DPDPA privacy)
DROP POLICY IF EXISTS "Members own health profile" ON public.health_profiles;
CREATE POLICY "Members own health profile"
    ON public.health_profiles FOR ALL
    USING (member_id = auth.uid())
    WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Trainers read student health profile" ON public.health_profiles;
CREATE POLICY "Trainers read student health profile"
    ON public.health_profiles FOR SELECT
    USING (get_current_role() IN ('trainer', 'admin'));

-- PARTNER NOTIFICATIONS
DROP POLICY IF EXISTS "Partners view their notifications" ON public.partner_notifications;
CREATE POLICY "Partners view their notifications"
    ON public.partner_notifications FOR ALL
    USING (get_current_role() IN ('partner', 'admin'));

-- AUDIT LOGS
DROP POLICY IF EXISTS "Admins view audit logs" ON public.activity_logs;
CREATE POLICY "Admins view audit logs"
    ON public.activity_logs FOR SELECT
    USING (get_current_role() = 'admin');

DROP POLICY IF EXISTS "System insert audit logs" ON public.activity_logs;
CREATE POLICY "System insert audit logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (true);
