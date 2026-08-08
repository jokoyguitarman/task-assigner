import React, { useState } from 'react';
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
import { authAPI } from '../../services/supabaseService';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      await authAPI.sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Reset your password
          </Typography>

          {sent ? (
            <>
              <Alert severity="success" sx={{ my: 2 }}>
                If an account exists for {email}, a reset link is on its way. The link opens a
                page where you choose a new password.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Nothing arrived? Check the spam folder. If it still does not turn up, whoever
                administers this restaurant's account can set a new password directly.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/login')}>
                Back to sign in
              </Button>
            </>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Enter the email this account signs in with and we will send a link to set a new
                password.
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoFocus
                sx={{ mb: 3 }}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={sending || !email.trim()}
                  startIcon={sending ? <CircularProgress size={18} color="inherit" /> : undefined}
                >
                  {sending ? 'Sending…' : 'Send reset link'}
                </Button>
                <Button color="inherit" onClick={() => navigate('/login')}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default ForgotPassword;
