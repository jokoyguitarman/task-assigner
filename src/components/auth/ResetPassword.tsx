import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { supabase } from '../../lib/supabase';
import { authAPI } from '../../services/supabaseService';

// Where a recovery link lands. Supabase turns the token in the URL into a session
// before this renders, so setting the password is an ordinary update — but only
// while that session exists, which is why arriving here without one is its own
// case rather than a generic failure.
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setHasSession(!!data.session);
      setChecking(false);
    };

    // The session can appear a moment after mount, once the token in the URL has
    // been exchanged.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(!!session);
      setChecking(false);
    });

    check();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await authAPI.setPassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the new password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Choose a new password
          </Typography>

          {checking ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Checking your link…
              </Typography>
            </Box>
          ) : done ? (
            <>
              <Alert severity="success" sx={{ my: 2 }}>
                Password changed. You can sign in with it now.
              </Alert>
              <Button variant="contained" onClick={() => navigate('/login')}>
                Go to sign in
              </Button>
            </>
          ) : !hasSession ? (
            <>
              <Alert severity="warning" sx={{ my: 2 }}>
                This reset link is no longer valid. They expire, and each one can only be used
                once.
              </Alert>
              <Button variant="contained" onClick={() => navigate('/forgot-password')}>
                Send a new link
              </Button>
            </>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <TextField
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoFocus
                helperText="At least 6 characters"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Type it again"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                fullWidth
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {saving ? 'Saving…' : 'Set password'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default ResetPassword;
