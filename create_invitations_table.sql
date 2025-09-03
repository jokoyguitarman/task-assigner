-- Create invitations table for the invitation system
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('staff', 'outlet')),
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);

-- Add RLS policies
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all invitations
CREATE POLICY "Admins can manage invitations" ON public.invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Users can view their own invitation by token (for signup process)
CREATE POLICY "Users can view invitation by token" ON public.invitations
    FOR SELECT USING (true); -- We'll validate the token in the application logic

-- Add comments
COMMENT ON TABLE public.invitations IS 'Stores invitation tokens for staff and outlet signups';
COMMENT ON COLUMN public.invitations.email IS 'Email address to send invitation to';
COMMENT ON COLUMN public.invitations.role IS 'Role: staff or outlet';
COMMENT ON COLUMN public.invitations.outlet_id IS 'Outlet ID (only for staff invitations)';
COMMENT ON COLUMN public.invitations.token IS 'Unique token for invitation link';
COMMENT ON COLUMN public.invitations.expires_at IS 'When the invitation expires';
COMMENT ON COLUMN public.invitations.used_at IS 'When the invitation was used (NULL if unused)';
COMMENT ON COLUMN public.invitations.created_by IS 'Admin who created the invitation';
