-- Fix email confirmation issues for signup process
-- This script provides solutions for handling unconfirmed users

-- Check current auth configuration
-- Note: These settings are typically configured in Supabase Dashboard, not via SQL

-- 1. Check if there are any unconfirmed users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    CASE 
        WHEN email_confirmed_at IS NULL THEN 'UNCONFIRMED'
        ELSE 'CONFIRMED'
    END as status
FROM auth.users 
ORDER BY created_at DESC;

-- 2. Check if there are any users in public.users that correspond to unconfirmed auth users
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    au.email_confirmed_at,
    CASE 
        WHEN au.email_confirmed_at IS NULL THEN 'UNCONFIRMED'
        ELSE 'CONFIRMED'
    END as auth_status
FROM users u
JOIN auth.users au ON au.id = u.id
ORDER BY u.created_at DESC;

-- 3. If you want to manually confirm users (for testing purposes only)
-- WARNING: This bypasses email confirmation - only use for testing!
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;

-- 4. Check current auth settings (these are usually set in Supabase Dashboard)
-- The following settings should be configured in Supabase Dashboard > Authentication > Settings:
-- - "Enable email confirmations" should be set to your preference
-- - "Enable email change confirmations" should be set to your preference
-- - "Enable phone confirmations" should be set to your preference
