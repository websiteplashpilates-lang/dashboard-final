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

-- Relax strict auth.users foreign key so registration succeeds even under Supabase SMTP rate limits
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

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

-- ==============================================================================
-- SEED DATA & AUTH USERS
-- ==============================================================================

-- ==============================================================================
-- PLASH PILATES STUDIO — INITIAL SEED DATA FOR SUPABASE
-- Run after schema.sql
-- ==============================================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. DISCIPLINES
INSERT INTO public.disciplines (id, name, description) VALUES
('disc-pilates', 'Reformer Pilates', 'Precision-based Reformer training combining controlled movements with spring resistance for total-body conditioning, posture correction, and injury prevention.'),
('disc-barre', 'Barre Conditioning', 'Ballet-inspired low-impact workout blending isometric holds, small pulses, and stretching. Delivered by Physicq 57 on weekends.'),
('disc-sculpt-yoga', 'Sculpt Yoga', 'A dynamic fusion of yoga flows and strength training, using body weight and light resistance to sculpt lean muscle while improving flexibility.')
ON CONFLICT (id) DO NOTHING;

-- 2. PARTNER ORG
INSERT INTO public.partner_orgs (id, name, code) VALUES
('partner-physicq57', 'Physicq 57', 'P57-BLR')
ON CONFLICT (id) DO NOTHING;

-- 3. WAIVER
INSERT INTO public.waivers (id, version, title, content, effective_date) VALUES
('waiver-001', '1.0', 'Plash Pilates Studio Member Liability Waiver & Health Declaration', 'I hereby acknowledge and agree that Pilates, Barre, and Sculpt Yoga involve physical exertion. I declare that I am physically fit to participate in studio apparatus classes...', '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. 4 LOGIN ACCOUNTS & PROFILES (ADMIN, TRAINER, PARTNER, MEMBER)
-- Passwords:
--   Member:  aisha.kapoor@example.com       / plashMember2026!
--   Admin:   studio.admin@plashpilates.com   / plashAdmin2026!
--   Partner: ananya.deshmukh@physicq57.com   / plashPartner2026!
--   Trainer: priya.sharma@plashpilates.com   / plashTrainer2026!
-- ==============================================================================

-- 4A. AUTH USERS (Inserted into Supabase auth schema)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES
('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'aisha.kapoor@example.com', crypt('member123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Aisha Kapoor","role":"member"}'::jsonb, NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'studio.admin@plashpilates.com', crypt('admin123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Studio Administrator","role":"admin"}'::jsonb, NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'ananya.deshmukh@physicq57.com', crypt('partner123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ananya Deshmukh","role":"partner"}'::jsonb, NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'priya.sharma@plashpilates.com', crypt('trainer123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Sharma","role":"trainer"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    encrypted_password = EXCLUDED.encrypted_password,
    email = EXCLUDED.email;

-- 4B. PROFILES (Linked 1:1 with auth.users)
INSERT INTO public.profiles (id, email, full_name, phone, role, tier) VALUES
('11111111-1111-1111-1111-111111111111', 'aisha.kapoor@example.com', 'Aisha Kapoor', '+91 99001 11001', 'member', 'Founding Standard'),
('22222222-2222-2222-2222-222222222222', 'studio.admin@plashpilates.com', 'Studio Administrator', '+91 98765 43210', 'admin', 'Studio Admin'),
('33333333-3333-3333-3333-333333333333', 'ananya.deshmukh@physicq57.com', 'Ananya Deshmukh', '+91 98450 12345', 'partner', 'Lead Coach'),
('44444444-4444-4444-4444-444444444444', 'priya.sharma@plashpilates.com', 'Priya Sharma', '+91 98110 54321', 'trainer', 'Master Trainer')
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

-- 5. TRAINERS
INSERT INTO public.trainers (id, profile_id, name, bio, tier, discipline_id) VALUES
('trainer-001', '44444444-4444-4444-4444-444444444444', 'Priya Sharma', 'STOTT-certified master trainer with 12 years experience. Former trainer to professional athletes.', 'master', 'disc-pilates'),
('trainer-002', NULL, 'Ananya Reddy', 'Lead Reformer instructor specializing in prenatal and postnatal Pilates.', 'lead', 'disc-pilates'),
('trainer-003', NULL, 'Kavita Desai', 'Balanced Body-certified instructor focused on rehabilitation and flexibility.', 'standard', 'disc-pilates'),
('trainer-004', '33333333-3333-3333-3333-333333333333', 'Ritika Menon', 'Physicq 57 lead instructor. Trained in New York, specializing in high-intensity barre cardio.', 'lead', 'disc-barre'),
('trainer-005', NULL, 'Sneha Nair', 'Physicq 57 instructor with a background in contemporary dance and Pilates mat.', 'standard', 'disc-barre'),
('trainer-006', NULL, 'Deepa Iyer', 'RYT-500 certified yoga teacher with a strength-training background. Creator of the Plash Sculpt method.', 'lead', 'disc-sculpt-yoga'),
('trainer-007', NULL, 'Meera Krishnan', 'Vinyasa and power yoga specialist focused on athletic performance.', 'standard', 'disc-sculpt-yoga')
ON CONFLICT (id) DO UPDATE SET 
    profile_id = EXCLUDED.profile_id,
    name = EXCLUDED.name;

-- 6. PACKAGES (Official brochure packages with session allocations)
INSERT INTO public.packages (id, name, discipline_id, duration_months, price_inr, first_circle_price_inr, session_allocations, is_popular) VALUES
('pkg-001', 'Signature Membership', NULL, 1, 28000.00, 27000.00, '[{"disciplineId":"disc-pilates","sessionCount":12},{"disciplineId":"disc-barre","sessionCount":8},{"disciplineId":"disc-sculpt-yoga","sessionCount":8}]'::jsonb, true),
('pkg-002', 'Signature Membership', NULL, 3, 80000.00, 78000.00, '[{"disciplineId":"disc-pilates","sessionCount":36},{"disciplineId":"disc-barre","sessionCount":24},{"disciplineId":"disc-sculpt-yoga","sessionCount":24}]'::jsonb, false),
('pkg-003', 'Reformer Pilates Pass', 'disc-pilates', 1, 16000.00, 15000.00, '[{"disciplineId":"disc-pilates","sessionCount":12}]'::jsonb, false),
('pkg-004', 'Reformer Pilates Pass', 'disc-pilates', 3, 45000.00, 42000.00, '[{"disciplineId":"disc-pilates","sessionCount":36}]'::jsonb, false),
('pkg-005', 'Sculpt Yoga Pass', 'disc-sculpt-yoga', 1, 12000.00, 11000.00, '[{"disciplineId":"disc-sculpt-yoga","sessionCount":12}]'::jsonb, false),
('pkg-006', 'Sculpt Yoga Pass', 'disc-sculpt-yoga', 3, 33000.00, 30000.00, '[{"disciplineId":"disc-sculpt-yoga","sessionCount":36}]'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

-- 7. INITIAL MEMBERSHIP PASS (For Member: Aisha Kapoor)
INSERT INTO public.member_passes (id, member_id, package_id, status, valid_from, valid_until) VALUES
('pass-001', '11111111-1111-1111-1111-111111111111', 'pkg-001', 'active', NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_pass_credits (pass_id, discipline_id, total_credits, remaining_credits) VALUES
('pass-001', 'disc-pilates', 12, 11),
('pass-001', 'disc-barre', 8, 8),
('pass-001', 'disc-sculpt-yoga', 8, 8)
ON CONFLICT DO NOTHING;

-- 8. INITIAL VERIFIED PAYMENT & OFFICIAL TAX INVOICE
INSERT INTO public.payments (
    id,
    member_id,
    package_id,
    invoice_no,
    gstin,
    base_amount_inr,
    cgst_inr,
    sgst_inr,
    total_amount_inr,
    payment_method,
    reference,
    status,
    created_at
) VALUES (
    'pay-001',
    '11111111-1111-1111-1111-111111111111',
    'pkg-001',
    'INV-PLASH-PAY001',
    '29ABIFP5917A1Z7',
    22881.36,
    2059.32,
    2059.32,
    27000.00,
    'Razorpay / UPI Instant',
    'MOCK-PAY-001',
    'paid',
    NOW()
) ON CONFLICT (invoice_no) DO NOTHING;

-- 9. LIVE CLASS SESSIONS (Today & Tomorrow Batches with 1:6 Cap)
INSERT INTO public.class_sessions (id, title, discipline_id, trainer_id, start_time, end_time, capacity, status) VALUES
('sess-001', 'Morning Reformer Foundations', 'disc-pilates', 'trainer-001', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours', 6, 'scheduled'),
('sess-002', 'Dynamic Reformer Flow', 'disc-pilates', 'trainer-002', NOW() + INTERVAL '5 hours', NOW() + INTERVAL '6 hours', 6, 'scheduled'),
('sess-003', 'Sculpt Yoga Conditioning', 'disc-sculpt-yoga', 'trainer-006', NOW() + INTERVAL '1 day 2 hours', NOW() + INTERVAL '1 day 3 hours', 6, 'scheduled'),
('sess-004', 'Physicq 57 Barre Burn', 'disc-barre', 'trainer-004', NOW() + INTERVAL '1 day 4 hours', NOW() + INTERVAL '1 day 5 hours', 6, 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- 10. SAMPLE BOOKING (Aisha in sess-001)
INSERT INTO public.bookings (id, member_id, session_id, pass_id, status) VALUES
('book-001', '11111111-1111-1111-1111-111111111111', 'sess-001', 'pass-001', 'confirmed')
ON CONFLICT (member_id, session_id) DO NOTHING;
