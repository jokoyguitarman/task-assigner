import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { readingsAPI } from '../../services/supabaseService';
import { Reading } from '../../types';

// What the checks have been coming back as.
//
// This is the reason to collect a rating rather than a tick. A single reading tells
// you almost nothing; the same fridge coming back as Needs attention five times in a
// month is the thing worth knowing, and it only becomes countable because the scale
// is fixed rather than defined per task.
const ReadingsHistory: React.FC = () => {
  const [rows, setRows] = useState<Reading[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setRows(await readingsAPI.getHistory(days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the readings.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6">What the checks keep saying</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Only tasks that ask for a condition, a reading or a written answer appear here.
            </Typography>
          </Box>
          <TextField
            select
            size="small"
            label="Period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            sx={{ width: 150 }}
          >
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </TextField>
        </Box>

        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading…</Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Alert severity="info">
            Nothing recorded yet. Set a task to ask for a condition or a reading, and its history
            will build up here as people complete it.
          </Alert>
        ) : (
          rows.map(row => (
            <Box
              key={`${row.taskTitle}-${row.outletName}`}
              sx={{
                display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap',
                p: 2, mb: 1, borderRadius: 2, border: '1px solid #e2e8f0',
                // A task that keeps coming back bad should be visible without reading
                // the numbers.
                backgroundColor: row.bad > 0 ? '#fef2f2' : row.attention > 0 ? '#fffbeb' : '#fff',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography variant="subtitle2" fontWeight={600}>{row.taskTitle}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.outletName} · {row.areaName} · {row.readings} recorded
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {row.fine > 0 && <Chip size="small" color="success" label={`${row.fine} fine`} />}
                {row.attention > 0 && <Chip size="small" color="warning" label={`${row.attention} needs attention`} />}
                {row.bad > 0 && <Chip size="small" color="error" label={`${row.bad} bad`} />}
                {row.outOfRange > 0 && <Chip size="small" color="error" variant="outlined" label={`${row.outOfRange} out of range`} />}
              </Box>

              <Box sx={{ minWidth: 150, textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  last {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString() : '—'}
                </Typography>
                <Typography variant="body2">{row.lastValue ?? '—'}</Typography>
              </Box>
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ReadingsHistory;
