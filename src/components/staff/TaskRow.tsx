import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { CheckCircle, PriorityHigh } from '@mui/icons-material';
import { TaskAssignment, Task, StaffProfile } from '../../types';
import { deadlineOf, effectiveStatus } from '../../lib/assignmentStatus';

// One job, as it appears on the branch phone. Lives on its own because both the
// area checklists inside the operations dashboard and the board that opens on
// launch show the same row, and two copies of it would drift.

// "in 20m", "in 3h 10m", "45m late". Precise enough to act on, without asking
// anyone to subtract times in their head mid-shift.
export const timeToDeadline = (assignment: TaskAssignment, now: Date): string => {
  const diffMinutes = Math.round((deadlineOf(assignment).getTime() - now.getTime()) / 60000);
  const late = diffMinutes < 0;
  const total = Math.abs(diffMinutes);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const span = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return late ? `${span} late` : `in ${span}`;
};

export const byDeadline = (a: TaskAssignment, b: TaskAssignment): number =>
  deadlineOf(a).getTime() - deadlineOf(b).getTime();

export const staffNameOf = (
  staffProfiles: StaffProfile[],
  staffId?: string
): string | undefined => (staffId ? staffProfiles.find(s => s.id === staffId)?.name : undefined);

interface Props {
  assignment: TaskAssignment;
  task?: Task;
  ownerName?: string;
  now: Date;
  onOpen: (assignment: TaskAssignment) => void;
  onClaim: (assignmentId: string) => void;
  onComplete: (assignmentId: string) => void;
}

const TaskRow: React.FC<Props> = ({
  assignment,
  task,
  ownerName,
  now,
  onOpen,
  onClaim,
  onComplete,
}) => {
  const status = effectiveStatus(assignment, now);
  const isDone = status === 'completed';
  const isLate = status === 'overdue';

  return (
    <Box
      onClick={() => onOpen(assignment)}
      sx={{
        display: 'flex', gap: 1.5, alignItems: 'flex-start',
        p: 1.5, mb: 1, borderRadius: 2, cursor: 'pointer',
        border: '1px solid',
        borderColor: isLate ? '#fecaca' : '#e2e8f0',
        backgroundColor: isLate ? '#fef2f2' : '#fff',
        opacity: isDone ? 0.6 : 1,
        '&:hover': { borderColor: isLate ? '#f87171' : '#c7d2fe' },
      }}
    >
      <Box
        sx={{
          width: 22, height: 22, mt: '2px', flex: 'none', borderRadius: 1,
          border: '2px solid',
          borderColor: isDone ? 'success.main' : '#cbd5e1',
          backgroundColor: isDone ? 'success.main' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isDone && <CheckCircle sx={{ fontSize: 16, color: '#fff' }} />}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography
            variant="body2"
            fontWeight={isDone ? 400 : 600}
            sx={{ textDecoration: isDone ? 'line-through' : 'none' }}
          >
            {task?.title ?? 'Unknown task'}
          </Typography>
          {task?.isHighPriority && !isDone && (
            <PriorityHigh sx={{ fontSize: 16, color: 'warning.main' }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
          {isDone ? (
            <Typography variant="caption" color="text.secondary">
              {assignment.completedAt
                ? new Date(assignment.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'done'}
              {ownerName ? ` by ${ownerName}` : ''}
            </Typography>
          ) : (
            <>
              <Chip
                size="small"
                color={isLate ? 'error' : 'default'}
                label={
                  assignment.dueTime
                    ? `due ${assignment.dueTime.slice(0, 5)}`
                    : 'due end of day'
                }
              />
              <Typography
                variant="caption"
                color={isLate ? 'error.main' : 'text.secondary'}
                fontWeight={isLate ? 700 : 400}
              >
                {timeToDeadline(assignment, now)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ownerName ? `· ${ownerName}` : '· unclaimed'}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {!isDone && (
        <Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }} onClick={(e) => e.stopPropagation()}>
          {!assignment.staffId && (
            <Button size="small" onClick={() => onClaim(assignment.id)}>
              Take
            </Button>
          )}
          <Button size="small" variant="contained" onClick={() => onComplete(assignment.id)}>
            Done
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default TaskRow;
