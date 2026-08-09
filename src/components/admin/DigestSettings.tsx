import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { digestAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';

// The morning summary of how last night went.
//
// Sent even when everything was fine, on purpose. A message that only ever arrives
// with bad news gets muted like any other alarm, and "all branches closed clean" is
// the one that makes opening it worthwhile.
const DigestSettings: React.FC = () => {
  const { user, organization } = useAuth();
  const [sendAt, setSendAt] = useState('07:00');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const existing = await digestAPI.get(user.id);
      if (existing) {
        setSendAt(existing.sendAt);
        setEnabled(existing.enabled);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your digest setting.');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || !organization) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await digestAPI.save(user.id, organization.id, sendAt, enabled);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your digest setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6">Morning summary</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How every branch closed the night before, sent once a day at the time you choose. It
          arrives even when nothing went wrong, so you can trust its silence the rest of the day.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }}
              />
            }
            label={enabled ? 'On' : 'Off'}
          />
          <TextField
            type="time"
            label="Send at"
            value={sendAt}
            disabled={!enabled}
            onChange={(e) => { setSendAt(e.target.value); setSaved(false); }}
            InputLabelProps={{ shrink: true }}
            helperText={`${organization.timezone || 'local'} time`}
            sx={{ width: 190 }}
          />
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && <Typography variant="body2" color="success.main">Saved</Typography>}
        </Box>

        {enabled && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This is delivered as a notification, so it needs alerts turned on for the device you
            want it on — the switch for that is at the top of your dashboard.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DigestSettings;
