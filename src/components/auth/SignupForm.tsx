import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { invitationsAPI, organizationsAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { PublicInvitation, SignupFormData } from '../../types';

// Set when a branch signs up but has to confirm its email first, so the setup
// screen can finish redeeming after they come back and sign in.
export const PENDING_INVITATION_KEY = 'pendingInvitationToken';

// Redeeming a branch invitation. This screen used to also create staff logins,
// choosing the role from a dropdown and inserting the profile row itself; staff
// have no logins now, and roles are decided server-side.
const SignupForm: React.FC = () => {
  const navigate = useNavigate();
  const { refreshIdentity } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    password: '',
    confirmPassword: '',
    outletId: undefined,
  });

  const loadInvitationData = useCallback(async () => {
    if (!token) {
      setError('Invalid invitation link. Please contact your administrator.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Read through an RPC: the invitations table itself is not readable
      // before the invitee has an account.
      const invitationData = await invitationsAPI.getByToken(token);

      if (!invitationData) {
        setError('Invalid or expired invitation link.');
        setLoading(false);
        return;
      }

      if (invitationData.usedAt) {
        setError('This invitation has already been used.');
        setLoading(false);
        return;
      }

      if (new Date(invitationData.expiresAt) < new Date()) {
        setError('This invitation has expired. Please contact your administrator for a new invitation.');
        setLoading(false);
        return;
      }

      setInvitation(invitationData);

      setFormData({
        name: invitationData.outletName || '',
        password: '',
        confirmPassword: '',
        outletId: invitationData.outletId,
      });

    } catch (error) {
      console.error('Error loading invitation data:', error);
      setError('Failed to load invitation data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitationData();
  }, [loadInvitationData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation) {
      setError('No valid invitation found');
      return;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create the auth account. Everything that grants privilege - the profile
      // row, the role, the organization, the link to the branch - is done by
      // redeem_outlet_invitation below, which verifies server-side that this
      // account's own email matches the invitation.
      const { error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: { data: { name: formData.name } },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        // Email confirmation is required, so there is no session to redeem with
        // yet. Keep the token so the setup screen can finish once they sign in.
        sessionStorage.setItem(PENDING_INVITATION_KEY, invitation.token);
        alert('Account created. Please confirm your email, then sign in to finish joining.');
        navigate('/login');
        return;
      }

      await organizationsAPI.redeemOutletInvitation(invitation.token);

      // The token was issued before the profile existed and carries no claims.
      await supabase.auth.refreshSession();
      await refreshIdentity();

      // The root route forwards to whatever this account's home is, rather than
      // naming a screen here that only happens to be right for one role.
      navigate('/');

    } catch (error) {
      console.error('Error creating account:', error);
      setError(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !invitation) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Card sx={{ maxWidth: 500, width: '100%', mx: 2 }}>
          <CardContent>
            <Alert severity="error">
              {error}
            </Alert>
            <Box mt={2}>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ bgcolor: 'grey.50' }}>
      <Card sx={{ maxWidth: 500, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              Create Your Branch Login
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You've been invited to sign in for {invitation?.outletName || 'a branch'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            <TextField
              fullWidth
              label="Email Address"
              value={invitation?.email || ''}
              margin="normal"
              disabled
              helperText="This email was used for your invitation"
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              margin="normal"
              required
              helperText="Minimum 6 characters"
              InputProps={{
                startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              margin="normal"
              required
              InputProps={{
                startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            <TextField
              fullWidth
              label="Branch"
              value={invitation?.outletName || ''}
              margin="normal"
              disabled
              helperText="The branch this login will manage"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3, mb: 2 }}
              startIcon={submitting ? <CircularProgress size={20} /> : undefined}
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Divider sx={{ my: 2 }} />

            <Box textAlign="center">
              <Button 
                variant="text" 
                onClick={() => navigate('/login')}
                size="small"
              >
                Already have an account? Sign in
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignupForm;
