import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Schedule, Check, Close } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { rescheduleAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { TaskAssignment, Task, StaffProfile } from '../../types';
import { addDays } from '../../lib/dates';

// A branch can ask for more time, and until now nothing could answer. Requests
// sat at status 'reschedule_requested' forever, counted as neither pending nor
// overdue, so the dashboard never mentioned them — the exact silence this app
// exists to break.
interface Props {
  assignments: TaskAssignment[];
  tasks: Task[];
  staffProfiles: StaffProfile[];
  onResolved: () => void;
}

const RescheduleRequests: React.FC<Props> = ({ assignments, tasks, staffProfiles, onResolved }) => {
  const { user } = useAuth();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<TaskAssignment | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);

  const requests = assignments.filter(a => a.status === 'reschedule_requested');

  if (requests.length === 0) return null;

  const taskTitle = (assignment: TaskAssignment) =>
    tasks.find(t => t.id === assignment.taskId)?.title || 'Unknown task';

  const staffName = (assignment: TaskAssignment) =>
    staffProfiles.find(s => s.id === assignment.staffId)?.name || 'Unassigned';

  const daysWaiting = (assignment: TaskAssignment) => {
    if (!assignment.rescheduleRequestedAt) return null;
    const days = Math.floor(
      (Date.now() - new Date(assignment.rescheduleRequestedAt).getTime()) / 86400000
    );
    return days;
  };

  const openApprove = (assignment: TaskAssignment) => {
    setError(null);
    setApproving(assignment);
    setNewDueDate(addDays(new Date(), 1));
  };

  const confirmApprove = async () => {
    if (!approving || !newDueDate || !user) return;

    setWorking(approving.id);
    setError(null);

    try {
      await rescheduleAPI.approveReschedule(approving.id, newDueDate, user.id);
      setApproving(null);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve the request.');
    } finally {
      setWorking(null);
    }
  };

  const reject = async (assignment: TaskAssignment) => {
    if (!user) return;

    setWorking(assignment.id);
    setError(null);

    try {
      await rescheduleAPI.rejectReschedule(assignment.id, user.id);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject the request.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <>
      <Card sx={{ mb: 3, border: '1px solid #bbdefb', backgroundColor: '#f5faff' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Schedule color="info" />
            <Typography variant="h6" fontWeight={600}>
              Waiting on you
            </Typography>
            <Chip label={requests.length} size="small" color="info" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A branch asked for more time on {requests.length === 1 ? 'this task' : 'these tasks'}.
            Nothing happens until you answer.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {requests.map(request => {
            const waiting = daysWaiting(request);
            return (
              <Box
                key={request.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 2,
                  p: 2,
                  mb: 1,
                  borderRadius: 2,
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ minWidth: 240, flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {taskTitle(request)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {staffName(request)} • was due {new Date(request.dueDate).toLocaleDateString()}
                  </Typography>
                  {request.rescheduleReason && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      “{request.rescheduleReason}”
                    </Typography>
                  )}
                  {waiting !== null && waiting > 0 && (
                    <Chip
                      label={waiting === 1 ? 'waiting 1 day' : `waiting ${waiting} days`}
                      size="small"
                      color={waiting > 2 ? 'error' : 'warning'}
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={working === request.id ? <CircularProgress size={14} /> : <Check />}
                    disabled={working !== null}
                    onClick={() => openApprove(request)}
                  >
                    Give more time
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Close />}
                    disabled={working !== null}
                    onClick={() => reject(request)}
                  >
                    Keep the deadline
                  </Button>
                </Box>
              </Box>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!approving} onClose={() => setApproving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>When is it due instead?</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="New due date"
                value={newDueDate}
                onChange={(date) => setNewDueDate(date as Date | null)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproving(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmApprove}
            disabled={!newDueDate || working !== null}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RescheduleRequests;
