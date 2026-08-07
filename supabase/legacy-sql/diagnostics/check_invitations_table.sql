-- Check invitations table structure and current RLS policies
-- Run this first to understand the current state

-- Check if invitations table exists
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invitations'
ORDER BY ordinal_position;

-- Check current RLS policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'invitations'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'invitations';

-- Check current user and role
SELECT 
    auth.uid() as current_user_id,
    u.email,
    u.role
FROM users u
WHERE u.id = auth.uid();
