import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  Lock as LockIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { invitationsAPI } from '../../services/supabaseService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const StaffOutletAuth: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'staff' as 'staff' | 'outlet',
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!data.user) {
        throw new Error('Login failed');
      }

      // Get user data from public.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to load user data');
      }

      // Check if user is staff or outlet
      if (userData.role === 'staff' || userData.role === 'outlet') {
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Redirect to appropriate dashboard
        navigate('/dashboard');
      } else {
        throw new Error('Access denied. This portal is for staff and outlets only.');
      }

    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupData.email || !signupData.name || !signupData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (signupData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if user has a valid invitation
      const invitations = await invitationsAPI.getAll();
      const invitation = invitations.find(inv => 
        inv.email === signupData.email && 
        inv.role === signupData.role &&
        !inv.usedAt &&
        new Date(inv.expiresAt) > new Date()
      );

      if (!invitation) {
        throw new Error('No valid invitation found for this email and role. Please contact your administrator.');
      }

      // Create the user account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            name: signupData.name,
            role: signupData.role,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Create the public user record (handle duplicates gracefully)
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: signupData.email,
          name: signupData.name,
          role: signupData.role,
        });

      // If user already exists, that's fine - just continue
      if (userError && !userError.message.includes('duplicate key')) {
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // Create outlet or staff profile based on role
      if (signupData.role === 'outlet') {
        // Create outlet record
        const { error: outletError } = await supabase
          .from('outlets')
          .insert({
            name: signupData.name,
            email: signupData.email,
            user_id: authData.user.id,
            is_active: true,
          });

        if (outletError) {
          throw new Error(`Failed to create outlet profile: ${outletError.message}`);
        }
      } else if (signupData.role === 'staff') {
        // Create staff profile
        const { error: staffError } = await supabase
          .from('staff_profiles')
          .insert({
            user_id: authData.user.id,
            position_id: '1', // Default position
            employee_id: `EMP-${Date.now()}`,
            hire_date: new Date().toISOString(),
            is_active: true,
          });

        if (staffError) {
          throw new Error(`Failed to create staff profile: ${staffError.message}`);
        }
      }

      // Mark invitation as used
      await invitationsAPI.markAsUsed(invitation.token);

      setSuccess('Account created successfully! Please check your email to verify your account, then you can log in.');
      
      // Reset form
      setSignupData({
        email: '',
        name: '',
        password: '',
        confirmPassword: '',
        role: 'staff',
      });

    } catch (error) {
      console.error('Signup error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ bgcolor: 'grey.50' }}>
      <Card sx={{ maxWidth: 500, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              Staff & Outlet Portal
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to your account or create a new one
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="auth tabs">
              <Tab label="Sign In" />
              <Tab label="Sign Up" />
            </Tabs>
          </Box>

          {/* Login Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
                startIcon={loading ? <CircularProgress size={20} /> : undefined}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </Box>
          </TabPanel>

          {/* Signup Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box component="form" onSubmit={handleSignup}>
              <TextField
                fullWidth
                label="Full Name"
                value={signupData.name}
                onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
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
                value={signupData.confirmPassword}
                onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                margin="normal"
                required
                InputProps={{
                  startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Account Type:
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    variant={signupData.role === 'staff' ? 'contained' : 'outlined'}
                    startIcon={<PersonIcon />}
                    onClick={() => setSignupData({ ...signupData, role: 'staff' })}
                    size="small"
                  >
                    Staff Member
                  </Button>
                  <Button
                    variant={signupData.role === 'outlet' ? 'contained' : 'outlined'}
                    startIcon={<BusinessIcon />}
                    onClick={() => setSignupData({ ...signupData, role: 'outlet' })}
                    size="small"
                  >
                    Outlet Manager
                  </Button>
                </Box>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 2, mb: 2 }}
                startIcon={loading ? <CircularProgress size={20} /> : undefined}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </Box>
          </TabPanel>

          <Divider sx={{ my: 2 }} />

          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary">
              Admin access?{' '}
              <Button 
                variant="text" 
                onClick={() => navigate('/login')}
                size="small"
              >
                Go to Admin Login
              </Button>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StaffOutletAuth;
