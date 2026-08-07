import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Restaurant, Storefront } from '@mui/icons-material';
import { organizationsAPI, outletsAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { PENDING_INVITATION_KEY } from './SignupForm';

export const PENDING_SETUP_KEY = 'pendingRestaurantSetup';

interface PendingSetup {
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  adminName?: string;
}

const readPendingSetup = (): PendingSetup => {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_SETUP_KEY) || '{}');
  } catch {
    return {};
  }
};

// Where an authenticated account that is not yet a principal lands.
//
// Two ways out: an owner creates their organization, or an invited branch
// redeems its invitation. Both are server-side functions that decide the role
// themselves; nothing on this screen chooses its own privileges.
//
// Until one of them succeeds the access token carries no claims and row-level
// security denies every read, so there is nothing else the app could usefully
// show.
const AccountSetup: React.FC = () => {
  const { logout, refreshIdentity } = useAuth();
  const pending = readPendingSetup();

  const [restaurantName, setRestaurantName] = useState(pending.restaurantName || '');
  const [restaurantAddress, setRestaurantAddress] = useState(pending.restaurantAddress || '');
  const [restaurantPhone, setRestaurantPhone] = useState(pending.restaurantPhone || '');
  const [adminName, setAdminName] = useState(pending.adminName || '');
  const [invitationToken, setInvitationToken] = useState('');
  const [busy, setBusy] = useState<'organization' | 'invitation' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRedeemed = useRef(false);

  const handleCreateOrganization = async () => {
    if (!restaurantName.trim()) {
      setError('Restaurant name is required');
      return;
    }

    setBusy('organization');
    setError(null);

    try {
      await organizationsAPI.bootstrap(restaurantName.trim(), adminName.trim());

      // The token issued at sign-in predates the profile, so it carries no
      // claims. Refresh before writing anything, or the first outlet insert
      // fails the organization check.
      await refreshIdentity();

      await outletsAPI.create({
        name: restaurantName.trim(),
        address: restaurantAddress.trim() || undefined,
        phone: restaurantPhone.trim() || undefined,
        organizationId: '',
        isActive: true,
      });

      sessionStorage.removeItem(PENDING_SETUP_KEY);
      await refreshIdentity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your restaurant');
    } finally {
      setBusy(null);
    }
  };

  const redeem = async (token: string) => {
    setBusy('invitation');
    setError(null);

    try {
      await organizationsAPI.redeemOutletInvitation(token);
      sessionStorage.removeItem(PENDING_INVITATION_KEY);
      await refreshIdentity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redeem that invitation');
    } finally {
      setBusy(null);
    }
  };

  const handleRedeemInvitation = () => {
    if (!invitationToken.trim()) {
      setError('Paste the invitation code from your email');
      return;
    }
    redeem(invitationToken.trim());
  };

  // A branch that had to confirm its email arrives here with the token already
  // stashed by the signup screen. Finish the job rather than asking them to
  // dig the code back out of the email.
  useEffect(() => {
    const stashed = sessionStorage.getItem(PENDING_INVITATION_KEY);
    if (!stashed || autoRedeemed.current) return;

    autoRedeemed.current = true;
    setInvitationToken(stashed);
    redeem(stashed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" gutterBottom>
            Finish setting up
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your account is signed in but not attached to a restaurant yet.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Restaurant color="primary" />
              I own the restaurant
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates your organization and your first branch.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Restaurant Name"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Your Name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={7}>
                <TextField
                  fullWidth
                  label="Address (Optional)"
                  value={restaurantAddress}
                  onChange={(e) => setRestaurantAddress(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Phone (Optional)"
                  value={restaurantPhone}
                  onChange={(e) => setRestaurantPhone(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleCreateOrganization}
                  disabled={busy !== null}
                  startIcon={busy === 'organization' ? <CircularProgress size={20} /> : <Restaurant />}
                >
                  {busy === 'organization' ? 'Creating...' : 'Create My Restaurant'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Divider sx={{ mb: 3 }}>or</Divider>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storefront color="primary" />
              I was invited as a branch
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Paste the code from your invitation email. It must have been sent to this
              same email address.
            </Typography>

            <TextField
              fullWidth
              label="Invitation Code"
              value={invitationToken}
              onChange={(e) => setInvitationToken(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleRedeemInvitation}
              disabled={busy !== null}
              startIcon={busy === 'invitation' ? <CircularProgress size={20} /> : <Storefront />}
            >
              {busy === 'invitation' ? 'Redeeming...' : 'Join as Branch'}
            </Button>
          </CardContent>
        </Card>

        <Box textAlign="center" mt={3}>
          <Button variant="text" onClick={logout}>
            Sign out
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AccountSetup;
