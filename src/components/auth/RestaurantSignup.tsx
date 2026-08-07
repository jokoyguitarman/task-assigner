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
import { Restaurant, Business, Person } from '@mui/icons-material';
import { authAPI, organizationsAPI, outletsAPI } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { PENDING_SETUP_KEY } from './AccountSetup';

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
      // Create the auth account only. The organization, the admin profile and
      // the tier limits are all created server-side by bootstrap_organization,
      // so a signup cannot grant itself a higher tier or a role it did not earn.
      await authAPI.signup(formData.adminEmail, formData.adminPassword, formData.adminName);

      // Whether a session exists now depends on whether email confirmation is
      // required. Stash the restaurant details either way, so the setup screen
      // can prefill them once the owner is actually signed in.
      sessionStorage.setItem(
        PENDING_SETUP_KEY,
        JSON.stringify({
          restaurantName: formData.restaurantName,
          restaurantAddress: formData.restaurantAddress,
          restaurantPhone: formData.restaurantPhone,
          adminName: formData.adminName,
        })
      );

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        // Email confirmation is on. Finish after they confirm and sign in.
        setSuccess(true);
        return;
      }

      await organizationsAPI.bootstrap(formData.restaurantName, formData.adminName);

      // The token was issued before the profile existed, so it carries no
      // claims yet and every write would be denied. Reissue it first.
      await supabase.auth.refreshSession();

      await outletsAPI.create({
        name: formData.restaurantName,
        address: formData.restaurantAddress || undefined,
        phone: formData.restaurantPhone || undefined,
        organizationId: '',
        isActive: true,
      });

      sessionStorage.removeItem(PENDING_SETUP_KEY);
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
