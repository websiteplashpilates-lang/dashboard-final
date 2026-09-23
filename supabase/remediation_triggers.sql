-- ==============================================================================
-- PLASH PILATES STUDIO — LIVE REMEDIATION: PAST-CLASS & 4-HOUR CANCELLATION
-- ==============================================================================

-- 1. UPDATE enforce_class_capacity_and_credits TO PREVENT PAST-CLASS BOOKINGS
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

    SELECT capacity, discipline_id, start_time 
    INTO max_cap, sess_disc_id, sess_start
    FROM public.class_sessions 
    WHERE id = NEW.session_id;

    IF sess_start IS NULL THEN
        RAISE EXCEPTION 'Class session % does not exist.', NEW.session_id
            USING ERRCODE = 'P0004';
    END IF;

    -- RULE 1: Strictly reject past or concluded sessions
    IF sess_start < NOW() THEN
        RAISE EXCEPTION 'Cannot book a class that has already started or concluded. Session start: %, Current time: %', sess_start, NOW()
            USING ERRCODE = 'P0003';
    END IF;

    -- RULE 2: Strict capacity enforcement (max 6)
    SELECT COUNT(*) INTO current_count 
    FROM public.bookings 
    WHERE session_id = NEW.session_id AND status = 'confirmed';

    IF current_count >= COALESCE(max_cap, 6) THEN
        RAISE EXCEPTION 'Class enrollment capped at strictly % members. Batch is full.', COALESCE(max_cap, 6)
            USING ERRCODE = 'P0001';
    END IF;

    -- RULE 3: Atomic credit deduction if pass_id is attached
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach capacity & past-class trigger
DROP TRIGGER IF EXISTS trg_check_class_capacity ON public.bookings;
CREATE TRIGGER trg_check_class_capacity
BEFORE INSERT ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION public.enforce_class_capacity_and_credits();


-- 2. CREATE BEFORE UPDATE TRIGGER FOR 4-HOUR CANCELLATION WINDOW
CREATE OR REPLACE FUNCTION public.enforce_booking_cancellation_window()
RETURNS TRIGGER AS $$
DECLARE
    sess_start TIMESTAMPTZ;
BEGIN
    -- Only evaluate when transitioning from confirmed to cancelled
    IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
        SELECT start_time INTO sess_start
        FROM public.class_sessions
        WHERE id = OLD.session_id;

        IF sess_start IS NULL THEN
            RAISE EXCEPTION 'Associated class session % not found.', OLD.session_id
                USING ERRCODE = 'P0004';
        END IF;

        -- Service role and admin override (studio emergencies)
        IF (auth.role() = 'service_role') THEN
            NULL;
        ELSIF (public.get_current_role() = 'admin') THEN
            NULL;
        ELSE
            -- Normal authenticated member checks
            IF sess_start < NOW() THEN
                RAISE EXCEPTION 'Cannot cancel a class that has already concluded.'
                    USING ERRCODE = 'P0006';
            END IF;

            -- Morning sessions (< 12:00 PM IST) require 12 hours notice; evening sessions require 6 hours notice
            IF EXTRACT(HOUR FROM sess_start AT TIME ZONE 'Asia/Kolkata') < 12 THEN
                IF sess_start - NOW() < interval '12 hours' THEN
                    RAISE EXCEPTION 'Cancellation window closed. Morning sessions cannot be cancelled within 12 hours of class start time. Session starts at %, Current time: %', sess_start, NOW()
                        USING ERRCODE = 'P0005';
                END IF;
            ELSE
                IF sess_start - NOW() < interval '6 hours' THEN
                    RAISE EXCEPTION 'Cancellation window closed. Evening sessions cannot be cancelled within 6 hours of class start time. Session starts at %, Current time: %', sess_start, NOW()
                        USING ERRCODE = 'P0005';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach 4-hour cancellation window trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_enforce_cancellation_window ON public.bookings;
CREATE TRIGGER trg_enforce_cancellation_window
BEFORE UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.enforce_booking_cancellation_window();


-- 3. ENSURE CREDIT RESTORATION TRIGGER IS ACTIVE (AFTER UPDATE)
CREATE OR REPLACE FUNCTION public.restore_booking_credit_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
    sess_disc_id TEXT;
BEGIN
    IF OLD.status = 'confirmed' AND (NEW.status = 'cancelled' OR NEW.status = 'no_show') AND OLD.pass_id IS NOT NULL THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_restore_booking_credit ON public.bookings;
CREATE TRIGGER trg_restore_booking_credit
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (OLD.status = 'confirmed' AND (NEW.status = 'cancelled' OR NEW.status = 'no_show'))
EXECUTE FUNCTION public.restore_booking_credit_on_cancel();

-- Clean up temporary audit probe
DROP FUNCTION IF EXISTS public.test_fn_123();

