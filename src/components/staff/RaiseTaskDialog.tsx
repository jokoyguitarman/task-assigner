import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import {
  areasAPI,
  branchSetupAPI,
  raisedWorkAPI,
  staffProfilesAPI,
} from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Area, OutletShift, StaffProfile } from '../../types';

// Someone at the branch noticed something that needs doing.
//
// No approval step. The observation is perishable — a filthy extractor fan spotted
// at 9pm is worth capturing at 9pm — and in a business too small to employ a manager
// the owner is the bottleneck an approval queue would reintroduce. Instead the job
// appears immediately and is permanently attributed to whoever raised it.
interface Props {
  open: boolean;
  onClose: () => void;
  onRaised: () => void;
}

const RaiseTaskDialog: React.FC<Props> = ({ open, onClose, onRaised }) => {
  const { currentOutlet } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [shifts, setShifts] = useState<OutletShift[]>([]);
  const [roster, setRoster] = useState<StaffProfile[]>([]);

  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOutlet) return;

    try {
      const [allAreas, mineAreaIds, mineShifts, staff] = await Promise.all([
        areasAPI.getAll(),
        branchSetupAPI.getAreaIds(currentOutlet.id),
        branchSetupAPI.getShifts(currentOutlet.id),
        staffProfilesAPI.getAll(),
      ]);

      // Only what this branch actually has, because the database refuses anything
      // else and an option that always errors is worse than no option.
      setAreas(allAreas.filter(a => mineAreaIds.includes(a.id)));
      setShifts(mineShifts);
      setRoster(staff.filter(s => s.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this branch.');
    }
  }, [currentOutlet]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const reset = () => {
    setTitle('');
    setAreaId('');
    setShiftId('');
    setStaffId('');
    setNote('');
    setPhoto(null);
    setError(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      await raisedWorkAPI.raise({
        title,
        areaId,
        shiftId,
        staffId: staffId || undefined,
        note: note || undefined,
        photo: photo || undefined,
      });

      reset();
      onRaised();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this.');
    } finally {
      setSaving(false);
    }
  };

  const ready = title.trim().length > 2 && areaId && shiftId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>Something needs doing</Typography>
        <Typography variant="body2" color="text.secondary">
          This goes straight onto today's list and the owner can see it.
        </Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="What needs doing?"
          placeholder="e.g. Extractor fan above the fryer needs degreasing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mt: 1, mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            select
            label="Where?"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            sx={{ flex: '1 1 180px' }}
          >
            {areas.map(area => (
              <MenuItem key={area.id} value={area.id}>{area.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Done by end of"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            helperText="The deadline comes from this shift"
            sx={{ flex: '1 1 180px' }}
          >
            {shifts.map(shift => (
              <MenuItem key={shift.shiftId} value={shift.shiftId}>
                {shift.shift?.name ?? 'Shift'} ({shift.endsAt})
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          select
          label="Who noticed? (optional)"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          fullWidth
          helperText="Recorded against your name, so the owner knows who flagged it"
          sx={{ mb: 2 }}
        >
          <MenuItem value="">Nobody in particular</MenuItem>
          {roster.map(person => (
            <MenuItem key={person.id} value={person.id}>{person.name}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="Anything else? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mb: 2 }}
        />

        <Button component="label" startIcon={<PhotoCamera />} variant="outlined">
          {photo ? photo.name : 'Add a photo (optional)'}
          <input
            hidden
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!ready || saving}>
          {saving ? 'Adding…' : 'Add to the list'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RaiseTaskDialog;
