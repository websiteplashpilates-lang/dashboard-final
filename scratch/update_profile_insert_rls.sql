DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK ((id = auth.uid()) OR (auth.role() = 'service_role'::text));
