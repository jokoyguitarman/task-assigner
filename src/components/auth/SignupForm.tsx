import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { invitationsAPI, outletsAPI } from '../../services/supabaseService';
import { Invitation, Outlet, SignupFormData } from '../../types';

const SignupForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    outletId: undefined,
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Please contact your administrator.');
      setLoading(false);
      return;
    }

    loadInvitationData();
  }, [token]);

  const loadInvitationData = async () => {
    try {
      setLoading(true);
      
      // Load invitation and outlets in parallel
      const [invitationData, outletsData] = await Promise.all([
        invitationsAPI.getByToken(token!),
        outletsAPI.getAll(),
      ]);

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
      setOutlets(outletsData);
      
      // Pre-fill form with invitation data
      setFormData({
        name: '',
        password: '',
        confirmPassword: '',
        role: invitationData.role,
        outletId: invitationData.outletId,
      });

    } catch (error) {
      console.error('Error loading invitation data:', error);
      setError('Failed to load invitation data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

    if (formData.role === 'staff' && !formData.outletId) {
      setError('Outlet is required for staff accounts');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create the user account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Create the public user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: invitation.email,
          name: formData.name,
          role: formData.role,
        });

      if (userError) {
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // Create outlet or staff profile based on role
      if (formData.role === 'outlet') {
        // Create outlet record
        const { error: outletError } = await supabase
          .from('outlets')
          .insert({
            name: formData.name,
            email: invitation.email,
            user_id: authData.user.id,
            is_active: true,
          });

        if (outletError) {
          throw new Error(`Failed to create outlet profile: ${outletError.message}`);
        }
      } else if (formData.role === 'staff' && formData.outletId) {
        // Create staff profile
        const { error: staffError } = await supabase
          .from('staff_profiles')
          .insert({
            user_id: authData.user.id,
            position_id: '1', // Default position - you might want to make this configurable
            employee_id: `EMP-${Date.now()}`, // Generate a simple employee ID
            hire_date: new Date().toISOString(),
            is_active: true,
          });

        if (staffError) {
          throw new Error(`Failed to create staff profile: ${staffError.message}`);
        }
      }

      // Mark invitation as used
      await invitationsAPI.markAsUsed(invitation.token);

      // Show success message and redirect
      setError(null);
      alert('Account created successfully! Please check your email to verify your account, then you can log in.');
      navigate('/login');

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
              Create Your Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You've been invited to join as a {invitation?.role}
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

            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  role: e.target.value as 'staff' | 'outlet',
                  outletId: e.target.value === 'outlet' ? undefined : formData.outletId
                })}
                label="Role"
                disabled
                startAdornment={
                  formData.role === 'outlet' ? 
                    <BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} /> :
                    <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }
              >
                <MenuItem value="staff">Staff Member</MenuItem>
                <MenuItem value="outlet">Outlet Manager</MenuItem>
              </Select>
            </FormControl>

            {formData.role === 'staff' && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Outlet</InputLabel>
                <Select
                  value={formData.outletId || ''}
                  onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                  label="Outlet"
                  required
                  disabled
                >
                  {outlets.map((outlet) => (
                    <MenuItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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




