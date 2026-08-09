import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { organizationsAPI, usersAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { setAppTimeZone } from '../../lib/dates';

// The business name, its timezone, and the owner's own name.
//
// The timezone is the one that matters. Every deadline is a wall-clock time in the
// restaurant, and both the scheduled jobs and the screens resolve it against this
// value. Get it wrong and the app disagrees with itself about whether work is late.
const TIME_ZONES = [
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Dubai',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
];

const BusinessDetails: React.FC = () => {
  const { user, organization, refreshIdentity } = useAuth();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [ownerName, setOwnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setTimezone(organization.timezone || 'Asia/Manila');
    }
    if (user) setOwnerName(user.name);
  }, [organization, user]);

  if (!user || !organization) return null;

  const dirty =
    name !== organization.name ||
    timezone !== (organization.timezone || 'Asia/Manila') ||
    ownerName !== user.name;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      if (name !== organization.name || timezone !== organization.timezone) {
        await organizationsAPI.update(organization.id, { name, timezone });
        // Applied immediately rather than on next sign-in, so the screens agree
        // with the new setting straight away.
        setAppTimeZone(timezone);
      }

      if (ownerName !== user.name) {
        await usersAPI.updateName(user.id, ownerName.trim());
      }

      await refreshIdentity();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  // Shows the setting doing its job, which is more convincing than the zone name.
  const nowThere = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6">Business details</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your timezone decides when a task counts as late, so it should match where the
          restaurant is rather than where you are.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Business name"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            select
            label="Timezone"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}
            helperText={`It is ${nowThere} there now`}
            sx={{ flex: '1 1 240px' }}
          >
            {TIME_ZONES.map(zone => (
              <MenuItem key={zone} value={zone}>{zone.replace(/_/g, ' ')}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Your name"
            value={ownerName}
            onChange={(e) => { setOwnerName(e.target.value); setSaved(false); }}
            sx={{ flex: '1 1 200px' }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <Button variant="contained" onClick={handleSave} disabled={saving || !dirty || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && <Typography variant="body2" color="success.main">Saved</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
};

export default BusinessDetails;
