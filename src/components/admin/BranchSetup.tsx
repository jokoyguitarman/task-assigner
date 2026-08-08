import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { shiftsAPI, areasAPI, branchSetupAPI } from '../../services/supabaseService';
import { ShiftDefinition, Area } from '../../types';

// What one branch actually has: which of the business's shifts it runs, at what
// times, and which of its areas exist on the floor.
//
// A task only lands here if this branch runs its shift and has its area, so
// unticking something is how you say "we do not do that here" - there is no
// separate exclusion list to maintain.
interface Props {
  outletId: string;
  outletName: string;
  onSaved?: () => void;
}

interface ShiftRow {
  shiftId: string;
  name: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
}

const DEFAULT_HOURS: Record<string, { startsAt: string; endsAt: string }> = {
  Opening: { startsAt: '09:00', endsAt: '12:00' },
  Mid: { startsAt: '12:00', endsAt: '18:00' },
  Closing: { startsAt: '18:00', endsAt: '23:00' },
};

const BranchSetup: React.FC<Props> = ({ outletId, outletName, onSaved }) => {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [allShifts, allAreas, mine, myAreaIds] = await Promise.all([
        shiftsAPI.getAll(),
        areasAPI.getAll(),
        branchSetupAPI.getShifts(outletId),
        branchSetupAPI.getAreaIds(outletId),
      ]);

      setRows(
        allShifts.map((shift: ShiftDefinition) => {
          const existing = mine.find(m => m.shiftId === shift.id);
          const fallback = DEFAULT_HOURS[shift.name] ?? { startsAt: '09:00', endsAt: '17:00' };
          return {
            shiftId: shift.id,
            name: shift.name,
            enabled: !!existing,
            startsAt: existing?.startsAt ?? fallback.startsAt,
            endsAt: existing?.endsAt ?? fallback.endsAt,
          };
        })
      );
      setAreas(allAreas);
      setSelectedAreas(myAreaIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this branch.');
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (shiftId: string, patch: Partial<ShiftRow>) => {
    setRows(prev => prev.map(r => (r.shiftId === shiftId ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await branchSetupAPI.save(
        outletId,
        rows.filter(r => r.enabled).map(r => ({
          shiftId: r.shiftId,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
        })),
        selectedAreas
      );
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this branch.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">Loading {outletName}…</Typography>
      </Box>
    );
  }

  const nothingEnabled = rows.every(r => !r.enabled);
  const noAreas = selectedAreas.length === 0;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="overline" color="text.secondary">Shifts this branch runs</Typography>

      {rows.map(row => {
        // Not an error to reject. A closing shift running to 02:00 is ordinary,
        // and the deadline simply belongs to the following day.
        const overnight = row.enabled && row.endsAt <= row.startsAt;

        return (
          <Box
            key={row.shiftId}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
              py: 1.25, borderBottom: '1px solid #f1f5f9',
            }}
          >
            <FormControlLabel
              sx={{ minWidth: 150, mr: 0 }}
              control={
                <Checkbox
                  checked={row.enabled}
                  onChange={(e) => update(row.shiftId, { enabled: e.target.checked })}
                />
              }
              label={row.name}
            />
            <TextField
              type="time"
              size="small"
              label="Starts"
              value={row.startsAt}
              disabled={!row.enabled}
              onChange={(e) => update(row.shiftId, { startsAt: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 130 }}
            />
            <TextField
              type="time"
              size="small"
              label="Ends"
              value={row.endsAt}
              disabled={!row.enabled}
              onChange={(e) => update(row.shiftId, { endsAt: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 130 }}
            />
            {overnight && <Chip size="small" color="warning" label="ends next day" />}
          </Box>
        );
      })}

      {nothingEnabled && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          With no shifts ticked this branch receives no work at all.
        </Alert>
      )}

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Areas this branch has
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {areas.map(area => (
          <FormControlLabel
            key={area.id}
            sx={{ minWidth: 180 }}
            control={
              <Checkbox
                checked={selectedAreas.includes(area.id)}
                onChange={() => toggleArea(area.id)}
              />
            }
            label={area.name}
          />
        ))}
      </Box>

      {noAreas && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          With no areas ticked this branch receives no work at all.
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save branch setup'}
        </Button>
        {saved && <Typography variant="body2" color="success.main">Saved</Typography>}
      </Box>
    </Box>
  );
};

export default BranchSetup;
