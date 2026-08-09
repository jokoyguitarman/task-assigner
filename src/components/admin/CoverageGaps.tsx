import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { PersonOff } from '@mui/icons-material';
import { coverageAPI } from '../../services/supabaseService';
import { CoverageGap } from '../../types';

// Work assigned to somebody who will not be there.
//
// This is the case that started the whole idea: a task is owned by a name, that
// person is on leave, and nobody notices until the job is already missed. Catching
// it a day early is the difference between a decision and a post-mortem.
interface Props {
  onReassign: (assignmentId: string) => void;
  refreshKey?: number;
}

const CoverageGaps: React.FC<Props> = ({ onReassign, refreshKey }) => {
  const [gaps, setGaps] = useState<CoverageGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setGaps(await coverageAPI.getGaps());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check who is available.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Checking who is available…</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>;

  // Silence is the correct output when everyone assigned is actually coming in.
  if (gaps.length === 0) return null;

  const today = new Date().toDateString();

  return (
    <Card sx={{ mb: 3, border: '1px solid #fed7aa', backgroundColor: '#fffbeb' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <PersonOff color="warning" />
          <Typography variant="h6" fontWeight={600}>Nobody is coming in for this</Typography>
          <Chip size="small" color="warning" label={gaps.length} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The person who owns this work is not scheduled to be there. Hand it to somebody else
          before the deadline rather than after.
        </Typography>

        {gaps.map(gap => {
          const isToday = gap.businessDay.toDateString() === today;

          return (
            <Box
              key={gap.assignmentId}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                p: 2, mb: 1, borderRadius: 2,
                backgroundColor: '#fff', border: '1px solid #fed7aa',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {gap.taskTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {gap.outletName} · {gap.staffName} is {gap.reason}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                color={isToday ? 'error' : 'default'}
                label={
                  (isToday ? 'today' : 'tomorrow') +
                  (gap.dueTime ? ` · due ${gap.dueTime}` : '')
                }
              />
              <Button size="small" variant="contained" onClick={() => onReassign(gap.assignmentId)}>
                Hand it over
              </Button>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CoverageGaps;
