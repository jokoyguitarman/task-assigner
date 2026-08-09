import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { NotificationsActive, NotificationsOff } from '@mui/icons-material';
import { pushService, PushState } from '../../services/pushService';
import { useAuth } from '../../contexts/AuthContext';

// Turns this device into one the app can reach when it is closed.
//
// Deliberately explicit rather than asking for permission on first load: a
// browser prompt fired at someone who has not decided yet is usually dismissed
// forever, and there is no second chance once it is blocked.
const AlertToggle: React.FC = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(await pushService.getState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user || user.role !== 'admin') return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);

    try {
      setState(
        state === 'on'
          ? await pushService.disable()
          : await pushService.enable(user.id, user.organizationId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your alert setting.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'unsupported') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        This browser cannot send alerts. On an iPhone, add the app to your home screen first and
        open it from there.
      </Alert>
    );
  }

  if (state === 'blocked') {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Notifications are blocked for this site. Allow them in your browser settings, then reload.
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
          p: 2, borderRadius: 2,
          border: '1px solid', borderColor: state === 'on' ? '#bbf7d0' : '#e2e8f0',
          backgroundColor: state === 'on' ? '#f0fdf4' : '#fff',
        }}
      >
        {state === 'on' ? <NotificationsActive color="success" /> : <NotificationsOff color="action" />}
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {state === 'on' ? 'This device gets alerted' : 'Get alerted on this device'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {state === 'on'
              ? 'You will be told when work is still not done 30 minutes past its deadline.'
              : 'Without this you only find out by opening the app.'}
          </Typography>
        </Box>
        {state === 'on' && <Chip size="small" color="success" label="on" />}
        <Button
          variant={state === 'on' ? 'outlined' : 'contained'}
          onClick={toggle}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          {state === 'on' ? 'Turn off' : 'Turn on'}
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
};

export default AlertToggle;
