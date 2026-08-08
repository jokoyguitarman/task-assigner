import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Schedule, Place, Delete, Add } from '@mui/icons-material';
import { shiftsAPI, areasAPI } from '../../services/supabaseService';
import { ShiftDefinition, Area } from '../../types';

// The vocabulary the whole business shares. Branches then say which of these
// they run and at what times, which is what lets one task land at the right hour
// in every location without being written out per branch.
const BusinessSetup: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [newShift, setNewShift] = useState('');
  const [newArea, setNewArea] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([shiftsAPI.getAll(), areasAPI.getAll()]);
      setShifts(s);
      setAreas(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your setup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      // The database refuses to remove a shift or area that tasks still use.
      // Surfacing that plainly is more useful than a generic failure, because
      // the fix is to re-file those tasks first.
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={20} />
        <Typography>Loading your setup…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}><Schedule /></Avatar>
        <Box>
          <Typography variant="h4" fontWeight={700}>How your business runs</Typography>
          <Typography variant="body1" color="text.secondary">
            Name your shifts and areas once. Each branch then sets its own times and ticks what it has.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 3 }}>
        <Card sx={{ flex: '1 1 380px' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Schedule color="primary" fontSize="small" />
              <Typography variant="h6">Shifts</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A task is due by the end of its shift. Open around the clock? Name them whatever you
              call them and drop the ones you do not run.
            </Typography>

            {shifts.map(shift => (
              <Box
                key={shift.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid #f1f5f9' }}
              >
                <TextField
                  size="small"
                  defaultValue={shift.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== shift.name) run(() => shiftsAPI.rename(shift.id, value));
                  }}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  size="small"
                  color="error"
                  disabled={busy}
                  onClick={() => run(() => shiftsAPI.remove(shift.id))}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField
                size="small"
                placeholder="e.g. Graveyard"
                value={newShift}
                onChange={(e) => setNewShift(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                startIcon={<Add />}
                disabled={!newShift.trim() || busy}
                onClick={() => run(async () => {
                  await shiftsAPI.create(newShift, shifts.length + 1);
                  setNewShift('');
                })}
              >
                Add
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: '1 1 380px' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Place color="primary" fontSize="small" />
              <Typography variant="h6">Areas</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Work is grouped by these on the branch phone, so staff read one short list per area
              instead of one long list.
            </Typography>

            {areas.map(area => (
              <Box
                key={area.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid #f1f5f9' }}
              >
                <TextField
                  size="small"
                  defaultValue={area.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== area.name) run(() => areasAPI.rename(area.id, value));
                  }}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  size="small"
                  color="error"
                  disabled={busy}
                  onClick={() => run(() => areasAPI.remove(area.id))}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField
                size="small"
                placeholder="e.g. Storage"
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                startIcon={<Add />}
                disabled={!newArea.trim() || busy}
                onClick={() => run(async () => {
                  await areasAPI.create(newArea, areas.length + 1);
                  setNewArea('');
                })}
              >
                Add
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Alert severity="info" sx={{ mt: 3 }}>
        Changing a name here changes it everywhere at once.{' '}
        <Chip size="small" label="Removing" sx={{ mx: 0.5 }} />
        one is refused while any task still uses it, since that work would be left with no deadline
        or no checklist to appear in.
      </Alert>
    </Box>
  );
};

export default BusinessSetup;
