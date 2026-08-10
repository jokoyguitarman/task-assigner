import React, { useEffect, useState } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { branchRosterAPI } from '../../services/supabaseService';
import { DailySchedule, DayOffType, ScheduleProposal, StaffProfile } from '../../types';

// The branch setting one person's day.
//
// Which of the two things this does — publish now, or ask the owner — is decided by
// the database from the date. This dialog only says which it will be, so nobody is
// surprised by where their change went.
interface Props {
  open: boolean;
  staff: StaffProfile | null;
  date: Date | null;
  existing?: DailySchedule | null;
  pending?: ScheduleProposal | null;
  withinHorizon: boolean;
  onClose: () => void;
  onSaved: (outcome: 'published' | 'proposed') => void;
}

const DAY_OFF_TYPES: { value: DayOffType; label: string }[] = [
  { value: 'sick', label: 'Off sick' },
  { value: 'vacation', label: 'On leave' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
];

const EditRosterDayDialog: React.FC<Props> = ({
  open, staff, date, existing, pending, withinHorizon, onClose, onSaved,
}) => {
  const [isDayOff, setIsDayOff] = useState(false);
  const [timeIn, setTimeIn] = useState('08:00');
  const [timeOut, setTimeOut] = useState('17:00');
  const [dayOffType, setDayOffType] = useState<DayOffType>('sick');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded from whatever is already there, so opening a day and saving it unchanged
  // is a no-op rather than a silent reset to the defaults.
  useEffect(() => {
    if (!open) return;

    const source = pending ?? existing;
    setIsDayOff(source?.isDayOff ?? false);
    setTimeIn(source && !source.isDayOff ? (source.timeIn ?? '08:00').slice(0, 5) : '08:00');
    setTimeOut(source && !source.isDayOff ? (source.timeOut ?? '17:00').slice(0, 5) : '17:00');
    setDayOffType((source?.dayOffType as DayOffType) ?? 'sick');
    setReason('');
    setError(null);
  }, [open, existing, pending]);

  // Taking somebody off a shift they already had is the change with consequences, and
  // the only one the database insists on a reason for.
  const clearingAShift = Boolean(existing && !existing.isDayOff && isDayOff);
  const reasonReady = !clearingAShift || reason.trim().length >= 5;
  const timesReady = isDayOff || (Boolean(timeIn) && Boolean(timeOut));

  const handleSubmit = async () => {
    if (!staff || !date) return;

    setSaving(true);
    setError(null);

    try {
      const { outcome } = await branchRosterAPI.setDay({
        staffId: staff.id,
        date,
        isDayOff,
        timeIn: isDayOff ? undefined : timeIn,
        timeOut: isDayOff ? undefined : timeOut,
        dayOffType: isDayOff ? dayOffType : undefined,
        reason: reason.trim() || undefined,
      });

      onSaved(outcome);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this day.');
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = date?.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>{staff?.name}</Typography>
        <Typography variant="body2" color="text.secondary">{dayLabel}</Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!withinHorizon && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is far enough ahead that the owner publishes it. It will show as
            pending on the calendar until they do.
          </Alert>
        )}

        {pending && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            There is already a request for this day waiting on the owner. Saving
            replaces it.
          </Alert>
        )}

        <ToggleButtonGroup
          exclusive
          fullWidth
          value={isDayOff ? 'off' : 'working'}
          onChange={(_, value) => value && setIsDayOff(value === 'off')}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="working">Working</ToggleButton>
          <ToggleButton value="off">Not in</ToggleButton>
        </ToggleButtonGroup>

        {isDayOff ? (
          <TextField
            select
            label="Why are they not in?"
            value={dayOffType}
            onChange={(e) => setDayOffType(e.target.value as DayOffType)}
            fullWidth
            sx={{ mb: 2 }}
          >
            {DAY_OFF_TYPES.map(option => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Starts"
              type="time"
              value={timeIn}
              onChange={(e) => setTimeIn(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Ends"
              type="time"
              value={timeOut}
              onChange={(e) => setTimeOut(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
          </Box>
        )}

        <TextField
          label={clearingAShift ? 'Why are they off this shift?' : 'Note (optional)'}
          placeholder={clearingAShift ? 'e.g. Called in sick this morning' : undefined}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          required={clearingAShift}
          helperText={
            clearingAShift
              ? 'Recorded permanently against this change, so the owner can see what happened'
              : undefined
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !reasonReady || !timesReady}
        >
          {saving ? 'Saving…' : withinHorizon ? 'Save' : 'Ask the owner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditRosterDayDialog;
