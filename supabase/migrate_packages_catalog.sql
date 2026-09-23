-- ================================================================
-- PLASH PILATES — OFFICIAL PACKAGES CATALOG MIGRATION
-- Inserts the 20 official brand-aligned studio membership packages.
-- ================================================================

INSERT INTO public.packages (id, name, discipline_id, duration_months, price_inr, first_circle_price_inr, session_allocations, is_popular) VALUES
-- 1. The Plash Studio Pass & Class Passes
('pkg-class-4', '4 Classes Pass', NULL, 1, 4200.00, 4200.00, '[{"disciplineId":"disc-pilates","sessionCount":2},{"disciplineId":"disc-barre","sessionCount":1},{"disciplineId":"disc-sculpt-yoga","sessionCount":1}]'::jsonb, false),
('pkg-class-8', '8 Classes Pass', NULL, 1, 8400.00, 8400.00, '[{"disciplineId":"disc-pilates","sessionCount":4},{"disciplineId":"disc-barre","sessionCount":2},{"disciplineId":"disc-sculpt-yoga","sessionCount":2}]'::jsonb, false),
('pkg-class-12', '12 Classes Pass', NULL, 2, 12600.00, 12600.00, '[{"disciplineId":"disc-pilates","sessionCount":6},{"disciplineId":"disc-barre","sessionCount":3},{"disciplineId":"disc-sculpt-yoga","sessionCount":3}]'::jsonb, false),
('pkg-studio-combo-8-4', 'Studio Pass: 8 Reformer + 4 Barre', NULL, 1, 12200.00, 12200.00, '[{"disciplineId":"disc-pilates","sessionCount":8},{"disciplineId":"disc-barre","sessionCount":4}]'::jsonb, false),
('pkg-studio-combo-12-4', 'Studio Pass: 12 Reformer + 4 Barre', NULL, 2, 16450.00, 16450.00, '[{"disciplineId":"disc-pilates","sessionCount":12},{"disciplineId":"disc-barre","sessionCount":4}]'::jsonb, false),
('pkg-studio-combo-16-8', 'Studio Pass: 16 Reformer + 8 Barre', NULL, 3, 23600.00, 23600.00, '[{"disciplineId":"disc-pilates","sessionCount":16},{"disciplineId":"disc-barre","sessionCount":8}]'::jsonb, false),
('pkg-studio-combo-24-8', 'Studio Pass: 24 Reformer + 8 Barre', NULL, 3, 31200.00, 31200.00, '[{"disciplineId":"disc-pilates","sessionCount":24},{"disciplineId":"disc-barre","sessionCount":8}]'::jsonb, false),
('pkg-studio-combo-24-12', 'Studio Pass: 24 Reformer + 12 Barre', NULL, 4, 35400.00, 35400.00, '[{"disciplineId":"disc-pilates","sessionCount":24},{"disciplineId":"disc-barre","sessionCount":12}]'::jsonb, false),
('pkg-studio-combo-36-12', 'Studio Pass: 36 Reformer + 12 Barre', NULL, 4, 45600.00, 45600.00, '[{"disciplineId":"disc-pilates","sessionCount":36},{"disciplineId":"disc-barre","sessionCount":12}]'::jsonb, false),

-- 2. Sessions at Plash (Reformer Pilates Dedicated)
('pkg-pilates-single', 'Single Session Drop-In', 'disc-pilates', 1, 1200.00, 1200.00, '[{"disciplineId":"disc-pilates","sessionCount":1}]'::jsonb, false),
('pkg-pilates-12', '1 Month (12 Sessions)', 'disc-pilates', 1, 12000.00, 12000.00, '[{"disciplineId":"disc-pilates","sessionCount":12}]'::jsonb, false),
('pkg-pilates-24', '2 Months (24 Sessions)', 'disc-pilates', 2, 21600.00, 21600.00, '[{"disciplineId":"disc-pilates","sessionCount":24}]'::jsonb, false),
('pkg-pilates-36', '3 Months (36 Sessions)', 'disc-pilates', 3, 27000.00, 27000.00, '[{"disciplineId":"disc-pilates","sessionCount":36}]'::jsonb, true),
('pkg-pilates-72', '6 Months (72 Sessions)', 'disc-pilates', 6, 50000.00, 50000.00, '[{"disciplineId":"disc-pilates","sessionCount":72}]'::jsonb, false),

-- 3. Physique 57 Signature Barre Workout
('pkg-barre-4', '4 Classes Barre Pass', 'disc-barre', 1, 4200.00, 4200.00, '[{"disciplineId":"disc-barre","sessionCount":4}]'::jsonb, false),
('pkg-barre-8', '8 Classes Barre Pass', 'disc-barre', 1, 8400.00, 8400.00, '[{"disciplineId":"disc-barre","sessionCount":8}]'::jsonb, false),
('pkg-barre-16', '16 Classes Barre Pass', 'disc-barre', 2, 16800.00, 16800.00, '[{"disciplineId":"disc-barre","sessionCount":16}]'::jsonb, false),
('pkg-barre-24', '24 Classes Barre Pass', 'disc-barre', 3, 25200.00, 25200.00, '[{"disciplineId":"disc-barre","sessionCount":24}]'::jsonb, false),

-- 4. Yoga at Plash
('pkg-yoga-dropin', 'Yoga Drop-In', 'disc-sculpt-yoga', 1, 1200.00, 1200.00, '[{"disciplineId":"disc-sculpt-yoga","sessionCount":1}]'::jsonb, false),
('pkg-yoga-monthly', 'Yoga Monthly Pass', 'disc-sculpt-yoga', 1, 8999.00, 8999.00, '[{"disciplineId":"disc-sculpt-yoga","sessionCount":20}]'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  discipline_id = EXCLUDED.discipline_id,
  duration_months = EXCLUDED.duration_months,
  price_inr = EXCLUDED.price_inr,
  first_circle_price_inr = EXCLUDED.first_circle_price_inr,
  session_allocations = EXCLUDED.session_allocations,
  is_popular = EXCLUDED.is_popular;
