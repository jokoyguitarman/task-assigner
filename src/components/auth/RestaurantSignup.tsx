import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  Container,
  Paper,
} from '@mui/material';
import { Restaurant, Business, Person, Email, Lock } from '@mui/icons-material';
import { authAPI } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';

interface RestaurantSignupData {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

const RestaurantSignup: React.FC = () => {
  const [formData, setFormData] = useState<RestaurantSignupData>({
    restaurantName: '',
    restaurantAddress: '',
    restaurantPhone: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.restaurantName.trim()) {
      return 'Restaurant name is required';
    }
    if (!formData.restaurantAddress.trim()) {
      return 'Restaurant address is required';
    }
    if (!formData.restaurantPhone.trim()) {
      return 'Restaurant phone is required';
    }
    if (!formData.adminName.trim()) {
      return 'Admin name is required';
    }
    if (!formData.adminEmail.trim()) {
      return 'Admin email is required';
    }
    if (!formData.adminPassword) {
      return 'Password is required';
    }
    if (formData.adminPassword.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (formData.adminPassword !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create organization first
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.restaurantName,
          subscription_tier: 'free',
          subscription_status: 'active',
          max_admins: 1,
          max_restaurants: 1,
          max_employees: 10,
        })
        .select()
        .single();

      if (orgError) {
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }

      // Create admin user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.adminEmail,
        password: formData.adminPassword,
        options: {
          data: {
            name: formData.adminName,
            organization_id: organization.id,
          },
        },
      });

      if (authError) {
        throw new Error(`Failed to create admin account: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Failed to create admin account');
      }

      // Create user profile in public.users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.adminEmail,
          name: formData.adminName,
          role: 'admin',
          organization_id: organization.id,
          is_primary_admin: true,
        });

      if (userError) {
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // Create first restaurant outlet
      const { error: outletError } = await supabase
        .from('outlets')
        .insert({
          name: formData.restaurantName,
          address: formData.restaurantAddress,
          phone: formData.restaurantPhone,
          organization_id: organization.id,
          is_active: true,
        });

      if (outletError) {
        throw new Error(`Failed to create restaurant outlet: ${outletError.message}`);
      }

      setSuccess(true);
    } catch (err) {
      console.error('Restaurant signup error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Box textAlign="center">
            <Restaurant sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Welcome to Task Assigner!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your restaurant account has been created successfully. Please check your email to verify your account.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => window.location.href = '/login'}
              sx={{ mt: 2 }}
            >
              Go to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Box textAlign="center" mb={4}>
          <Restaurant sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Start Your Restaurant Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create your restaurant account and start managing your team efficiently
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Restaurant Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Business color="primary" />
                    Restaurant Information
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Restaurant Name"
                    name="restaurantName"
                    value={formData.restaurantName}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Mario's Pizza"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    name="restaurantPhone"
                    value={formData.restaurantPhone}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., (555) 123-4567"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Restaurant Address"
                    name="restaurantAddress"
                    value={formData.restaurantAddress}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., 123 Main Street, City, State 12345"
                  />
                </Grid>

                {/* Admin Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <Person color="primary" />
                    Admin Account
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Your Name"
                    name="adminName"
                    value={formData.adminName}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., John Smith"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    name="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., john@mariospizza.com"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    name="adminPassword"
                    type="password"
                    value={formData.adminPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Minimum 6 characters"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Confirm your password"
                  />
                </Grid>

                {/* Error/Success Messages */}
                {error && (
                  <Grid item xs={12}>
                    <Alert severity="error">{error}</Alert>
                  </Grid>
                )}

                {/* Submit Button */}
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <Restaurant />}
                    sx={{ py: 1.5 }}
                  >
                    {loading ? 'Creating Your Account...' : 'Create Restaurant Account'}
                  </Button>
                </Grid>

                {/* Login Link */}
                <Grid item xs={12}>
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      Already have an account?{' '}
                      <Button
                        variant="text"
                        onClick={() => window.location.href = '/login'}
                        sx={{ textTransform: 'none' }}
                      >
                        Sign in here
                      </Button>
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  );
};

export default RestaurantSignup;
