import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { EventAvailable, Check, Close, History } from '@mui/icons-material';
import { branchRosterAPI } from '../../services/supabaseService';
import { ScheduleChange, ScheduleDayState, ScheduleProposal } from '../../types';

// The roster, from the owner's side.
//
// Two different things, deliberately in one place. The requests at the top are the
// only part that waits on a decision — days far enough ahead that publishing them is
// planning rather than reacting. Everything below has already happened: a branch
// covering a sick call does not ask permission, but it never happens unrecorded.
interface Props {
  refreshKey?: number;
}

const displayTime = (time?: string | null): string => {
  if (!time) return '--';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const suffix = hour >= 12 ? 'pm' : 'am';
  return `${hour % 12 || 12}:${minutes}${suffix}`;
};

const describeState = (state?: ScheduleDayState): string => {
  if (!state) return 'nothing scheduled';
  if (state.isDayOff) return `off${state.dayOffType ? ` (${state.dayOffType})` : ''}`;
  return `${displayTime(state.timeIn)} – ${displayTime(state.timeOut)}`;
};

const describeDay = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const RosterRequests: React.FC<Props> = ({ refreshKey }) => {
  const [pending, setPending] = useState<ScheduleProposal[]>([]);
  const [changes, setChanges] = useState<ScheduleChange[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const [proposals, log] = await Promise.all([
        branchRosterAPI.getPending(),
        branchRosterAPI.getChanges(20),
      ]);

      setPending(proposals);
      setChanges(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load roster activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const decide = async (proposal: ScheduleProposal, approve: boolean) => {
    setBusy(proposal.id);
    setError(null);

    try {
      await branchRosterAPI.decide(proposal.id, approve, notes[proposal.id]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Checking the roster…</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>;
  if (pending.length === 0 && changes.length === 0) return null;

  return (
    <Card sx={{ mb: 3, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <EventAvailable sx={{ color: '#1d4ed8' }} />
          <Typography variant="h6" fontWeight={600}>Roster</Typography>
          {pending.length > 0 && (
            <Chip
              size="small"
              label={`${pending.length} waiting on you`}
              sx={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
            />
          )}
        </Box>

        {pending.length > 0 ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Days your branches have plotted far enough ahead that you publish them.
              Nobody is counted on for these until you do.
            </Typography>

            {pending.map(proposal => (
              <Box
                key={proposal.id}
                sx={{
                  display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap',
                  p: 2, mb: 1, borderRadius: 2, backgroundColor: '#fff', border: '1px solid #bfdbfe',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 240 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {proposal.staff?.name ?? 'Someone'} — {describeDay(proposal.scheduleDate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {proposal.outlet?.name ?? 'A branch'} · {describeState({
                      isDayOff: proposal.isDayOff,
                      dayOffType: proposal.dayOffType,
                      timeIn: proposal.timeIn,
                      timeOut: proposal.timeOut,
                    })}
                  </Typography>
                  {proposal.note && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>“{proposal.note}”</Typography>
                  )}
                  <TextField
                    size="small"
                    placeholder="Add a note (optional)"
                    value={notes[proposal.id] ?? ''}
                    onChange={(e) => setNotes(prev => ({ ...prev, [proposal.id]: e.target.value }))}
                    fullWidth
                    sx={{ mt: 1.5, maxWidth: 360 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Check />}
                    disabled={busy !== null}
                    onClick={() => decide(proposal, true)}
                  >
                    Publish
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<Close />}
                    disabled={busy !== null}
                    onClick={() => decide(proposal, false)}
                  >
                    Decline
                  </Button>
                </Box>
              </Box>
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nothing waiting on you.
          </Typography>
        )}

        {changes.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <History fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" fontWeight={600}>Recent changes</Typography>
            </Box>

            {changes.map(change => (
              <Box key={change.id} sx={{ py: 0.75, borderBottom: '1px solid #e0e7ff' }}>
                <Typography variant="body2">
                  <strong>{change.staff?.name ?? 'Someone'}</strong>
                  {' · '}{describeDay(change.scheduleDate)}
                  {' — '}{describeState(change.was)} → {describeState(change.became)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {change.changedRole === 'admin' ? 'you' : change.outlet?.name ?? 'a branch'}
                  {' · '}
                  {change.changedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {change.reason ? ` · “${change.reason}”` : ''}
                </Typography>
              </Box>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RosterRequests;
