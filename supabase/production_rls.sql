-- ==============================================================================
-- PLASH PILATES STUDIO — PRODUCTION ZERO-TRUST RLS & CONCURRENCY LOCKDOWN
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql
-- ==============================================================================

-- 1. Dynamic Cleanup: Drop ALL existing policies in public schema to eliminate rogue/legacy policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. Helper function: Drop first with CASCADE to prevent return-type mismatch error (42P13)
DROP FUNCTION IF EXISTS public.get_current_role() CASCADE;

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS app_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Ensure RLS is enabled on all tables
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


-- 4. PROFILES
DROP POLICY IF EXISTS "Users read their own profile" ON public.profiles;
CREATE POLICY "Users read their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR get_current_role() IN ('admin', 'trainer', 'partner'));

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid() OR get_current_role() = 'admin')
    WITH CHECK (id = auth.uid() OR get_current_role() = 'admin');

DROP POLICY IF EXISTS "Admins delete profile" ON public.profiles;
CREATE POLICY "Admins delete profile"
    ON public.profiles FOR DELETE
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

-- 5. PUBLIC CATALOG (Disciplines, Packages, Trainers, Class Sessions)
CREATE POLICY "Public read on disciplines" ON public.disciplines FOR SELECT USING (true);
CREATE POLICY "Admin CRUD on disciplines" ON public.disciplines FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public read on packages" ON public.packages FOR SELECT USING (true);
CREATE POLICY "Admin CRUD on packages" ON public.packages FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public read on trainers" ON public.trainers FOR SELECT USING (true);
CREATE POLICY "Admin CRUD on trainers" ON public.trainers FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Public read on class_sessions" ON public.class_sessions FOR SELECT USING (true);
CREATE POLICY "Admin full access on class_sessions" ON public.class_sessions FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

-- 6. SECURE BOOKINGS
CREATE POLICY "Members view own bookings"
    ON public.bookings FOR SELECT
    USING (member_id = auth.uid() OR get_current_role() IN ('admin', 'trainer', 'partner'));

CREATE POLICY "Members insert own bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (member_id = auth.uid() OR get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Members cancel own bookings"
    ON public.bookings FOR UPDATE
    USING (member_id = auth.uid() OR get_current_role() = 'admin' OR auth.role() = 'service_role')
    WITH CHECK (member_id = auth.uid() OR get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Admin delete bookings"
    ON public.bookings FOR DELETE
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

-- 7. SECURE PAYMENTS (Zero Trust: Anon / Client CANNOT insert or update payments)
CREATE POLICY "Members view own payments"
    ON public.payments FOR SELECT
    USING (member_id = auth.uid() OR get_current_role() = 'admin');

CREATE POLICY "Service role manages payments"
    ON public.payments FOR ALL
    USING (auth.role() = 'service_role');

-- 8. SECURE PASSES & CREDITS (Zero Trust: Anon / Client CANNOT grant passes or credits)
CREATE POLICY "Members view own passes"
    ON public.member_passes FOR SELECT
    USING (member_id = auth.uid() OR get_current_role() IN ('admin', 'trainer'));

CREATE POLICY "Service role manages passes"
    ON public.member_passes FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Members view own credits"
    ON public.member_pass_credits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.member_passes p
            WHERE p.id = pass_id
            AND (p.member_id = auth.uid() OR get_current_role() IN ('admin', 'trainer'))
        )
    );

CREATE POLICY "Service role manages credits"
    ON public.member_pass_credits FOR ALL
    USING (auth.role() = 'service_role');

-- 9. HEALTH PROFILES (DPDPA Compliant)
CREATE POLICY "Members own health profile"
    ON public.health_profiles FOR ALL
    USING (member_id = auth.uid() OR get_current_role() = 'admin' OR auth.role() = 'service_role')
    WITH CHECK (member_id = auth.uid() OR get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Trainers read student health profile"
    ON public.health_profiles FOR SELECT
    USING (get_current_role() IN ('trainer', 'admin'));

-- 10. WAIVERS & ACCEPTANCES
CREATE POLICY "Public read on waivers"
    ON public.waivers FOR SELECT USING (true);

CREATE POLICY "Admin manage waivers"
    ON public.waivers FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

CREATE POLICY "Members view own waiver acceptances"
    ON public.waiver_acceptances FOR SELECT
    USING (member_id = auth.uid() OR get_current_role() = 'admin');

CREATE POLICY "Members sign waivers"
    ON public.waiver_acceptances FOR INSERT
    WITH CHECK (member_id = auth.uid() OR auth.role() = 'service_role');

-- 11. PARTNER ORGS
CREATE POLICY "Public read on partner_orgs"
    ON public.partner_orgs FOR SELECT USING (true);

CREATE POLICY "Admin manage partner_orgs"
    ON public.partner_orgs FOR ALL
    USING (get_current_role() = 'admin' OR auth.role() = 'service_role');

-- 12. ENFORCE UNIQUE PAYMENT REFERENCE (Idempotency at Engine Level)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_reference_key'
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT payments_reference_key UNIQUE (reference);
    END IF;
END $$;

-- 13. CONCURRENCY, SERIALIZATION LOCK & ATOMIC CREDIT MANAGEMENT
CREATE OR REPLACE FUNCTION public.enforce_class_capacity_and_credits()
RETURNS TRIGGER AS $$
DECLARE
    current_count INT;
    max_cap INT;
    sess_disc_id TEXT;
    sess_start TIMESTAMPTZ;
    credit_avail INT;
BEGIN
    -- ROW-LEVEL LOCK: Lock target session row to serialize concurrent requests
    PERFORM 1 FROM public.class_sessions WHERE id = NEW.session_id FOR UPDATE;

    SELECT capacity, discipline_id, start_time INTO max_cap, sess_disc_id, sess_start
    FROM public.class_sessions 
    WHERE id = NEW.session_id;

    IF sess_start < NOW() THEN
        RAISE EXCEPTION 'Cannot book a class that has already started or concluded.'
            USING ERRCODE = 'P0003';
    END IF;

    SELECT COUNT(*) INTO current_count 
    FROM public.bookings 
    WHERE session_id = NEW.session_id AND status = 'confirmed';

    IF current_count >= COALESCE(max_cap, 6) THEN
        RAISE EXCEPTION 'Class enrollment capped at strictly % members. Batch is full.', COALESCE(max_cap, 6)
            USING ERRCODE = 'P0001';
    END IF;

    -- Atomic credit deduction if pass_id is attached
    IF NEW.pass_id IS NOT NULL AND NEW.status = 'confirmed' THEN
        SELECT remaining_credits INTO credit_avail
        FROM public.member_pass_credits
        WHERE pass_id = NEW.pass_id AND discipline_id = sess_disc_id
        FOR UPDATE;

        IF credit_avail IS NOT NULL THEN
            IF credit_avail <= 0 THEN
                RAISE EXCEPTION 'No remaining credits for this discipline on the selected pass.'
                    USING ERRCODE = 'P0002';
            END IF;

            UPDATE public.member_pass_credits
            SET remaining_credits = remaining_credits - 1
            WHERE pass_id = NEW.pass_id AND discipline_id = sess_disc_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_class_capacity ON public.bookings;
CREATE TRIGGER trg_check_class_capacity
BEFORE INSERT ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION public.enforce_class_capacity_and_credits();

-- Restore credit automatically when booking is cancelled
CREATE OR REPLACE FUNCTION public.restore_booking_credit_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
    sess_disc_id TEXT;
BEGIN
    IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' AND OLD.pass_id IS NOT NULL THEN
        SELECT discipline_id INTO sess_disc_id
        FROM public.class_sessions
        WHERE id = OLD.session_id;

        IF sess_disc_id IS NOT NULL THEN
            UPDATE public.member_pass_credits
            SET remaining_credits = remaining_credits + 1
            WHERE pass_id = OLD.pass_id AND discipline_id = sess_disc_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restore_booking_credit ON public.bookings;
CREATE TRIGGER trg_restore_booking_credit
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.restore_booking_credit_on_cancel();
