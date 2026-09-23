-- ==============================================================================
-- UNLOCK HEALTH PROFILES & WAIVERS RLS FOR LIVE CLIENT ACCESS
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. HEALTH PROFILES
DROP POLICY IF EXISTS "Members own health profile" ON public.health_profiles;
DROP POLICY IF EXISTS "Trainers read student health profile" ON public.health_profiles;
DROP POLICY IF EXISTS "Public read on health_profiles" ON public.health_profiles;
CREATE POLICY "Public read on health_profiles" ON public.health_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client manage health_profiles" ON public.health_profiles;
CREATE POLICY "Client manage health_profiles" ON public.health_profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. WAIVERS & ACCEPTANCES
DROP POLICY IF EXISTS "Public read on waivers" ON public.waivers;
CREATE POLICY "Public read on waivers" ON public.waivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client manage waivers" ON public.waivers;
CREATE POLICY "Client manage waivers" ON public.waivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read on waiver_acceptances" ON public.waiver_acceptances;
CREATE POLICY "Public read on waiver_acceptances" ON public.waiver_acceptances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client manage waiver_acceptances" ON public.waiver_acceptances;
CREATE POLICY "Client manage waiver_acceptances" ON public.waiver_acceptances FOR ALL USING (true) WITH CHECK (true);

-- 3. PARTNER ORGS
DROP POLICY IF EXISTS "Public read on partner_orgs" ON public.partner_orgs;
CREATE POLICY "Public read on partner_orgs" ON public.partner_orgs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Client manage partner_orgs" ON public.partner_orgs;
CREATE POLICY "Client manage partner_orgs" ON public.partner_orgs FOR ALL USING (true) WITH CHECK (true);

-- 4. INSERT AISHA KAPOOR SAMPLE HEALTH & WAIVER DATA DIRECTLY
INSERT INTO public.waivers (id, version, title, content, effective_date) VALUES (
    'waiver-001',
    '1.0',
    'Plash Pilates Studio Member Liability Waiver & Health Declaration',
    'I hereby acknowledge and agree that Pilates, Barre, and Sculpt Yoga involve physical exertion. I declare that I am physically fit to participate in studio apparatus classes...',
    '2026-01-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.health_profiles (
    member_id,
    medical_conditions,
    injuries,
    emergency_contact_name,
    emergency_contact_phone,
    notes,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    ARRAY['Mild lower back tightness', 'Cleared for Reformer'],
    ARRAY['Left ankle sprain (resolved 2024)', 'No current contraindications'],
    'Rahul Kapoor (Spouse)',
    '+91 98450 99887',
    'Prefers medium spring tension on footwork; certified STOTT Pilates regular.',
    NOW()
) ON CONFLICT (member_id) DO UPDATE SET
    medical_conditions = EXCLUDED.medical_conditions,
    injuries = EXCLUDED.injuries,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    notes = EXCLUDED.notes;

INSERT INTO public.waiver_acceptances (member_id, waiver_id, signed_at, ip_address, user_agent) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'waiver-001',
    NOW(),
    '106.51.24.182',
    'Mozilla/5.0'
) ON CONFLICT DO NOTHING;
