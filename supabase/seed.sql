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
