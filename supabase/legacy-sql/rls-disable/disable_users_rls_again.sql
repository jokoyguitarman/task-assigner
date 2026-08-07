-- Temporarily disable RLS on users table again
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled on users table again. Staff names should work now.' as status;
