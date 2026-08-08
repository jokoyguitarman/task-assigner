import React from 'react';
import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { TaskAssignment, Task, Outlet, StaffProfile } from '../../types';
import { deadlineOf, effectiveStatus } from '../../lib/assignmentStatus';

// Answers "is anything wrong" before "what is everything".
//
// The old dashboard led with organization-wide totals, which cannot tell you
// which of four restaurants needs you. Branches that are fine collapse to one
// line here on purpose: on a good day this screen should take four seconds.
interface Props {
  assignments: TaskAssignment[];
  tasks: Task[];
  outlets: Outlet[];
  staffProfiles: StaffProfile[];
  graceMinutes?: number;
  onOpen: (assignment: TaskAssignment) => void;
}

interface BranchState {
  outlet: Outlet;
  needsYou: TaskAssignment[];
  finishedLate: number;
  done: number;
  total: number;
}

const minutesLate = (assignment: TaskAssignment, at: Date): number =>
  Math.round((at.getTime() - deadlineOf(assignment).getTime()) / 60000);

const describeLateness = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day late' : `${days} days late`;
  }
  return hours > 0 ? `${hours}h ${rest}m late` : `${rest}m late`;
};

const BranchExceptions: React.FC<Props> = ({
  assignments,
  tasks,
  outlets,
  staffProfiles,
  graceMinutes = 30,
  onOpen,
}) => {
  const now = new Date();
  const taskTitle = (id: string) => tasks.find(t => t.id === id)?.title ?? 'Unknown task';
  const staffName = (id?: string) => (id ? staffProfiles.find(s => s.id === id)?.name : undefined);

  const states: BranchState[] = outlets
    .filter(outlet => outlet.isActive)
    .map(outlet => {
      const mine = assignments.filter(a => a.outletId === outlet.id);
      const done = mine.filter(a => a.status === 'completed');

      return {
        outlet,
        // The grace window is the whole point. Work finished a few minutes over
        // was handled by the branch and is none of the owner's business; an
        // alert they learn to ignore is worse than no alert.
        needsYou: mine
          .filter(a => effectiveStatus(a, now) === 'overdue' && minutesLate(a, now) >= graceMinutes)
          .sort((a, b) => minutesLate(b, now) - minutesLate(a, now)),
        finishedLate: done.filter(a => a.completedAt && new Date(a.completedAt) > deadlineOf(a)).length,
        done: done.length,
        total: mine.length,
      };
    });

  const problems = states.filter(s => s.needsYou.length > 0);
  const fine = states.filter(s => s.needsYou.length === 0);

  const dot = (colour: string) => (
    <Box sx={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: colour, flex: 'none' }} />
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            {problems.length === 0
              ? 'Your restaurants are okay'
              : problems.length === 1
              ? '1 branch needs attention'
              : `${problems.length} branches need attention`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fine.length} operating normally
            {problems.length > 0 ? ` · ${problems.length} needing you` : ''}
          </Typography>
        </CardContent>
      </Card>

      {problems.map(state => (
        <Box key={state.outlet.id} sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 2,
              border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: 2,
            }}
          >
            {dot('#dc2626')}
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700}>{state.outlet.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.needsYou.length === 1
                  ? '1 task past its deadline'
                  : `${state.needsYou.length} tasks past their deadline`}
              </Typography>
            </Box>
            <Chip size="small" color="error" label="needs you" />
          </Box>

          {state.needsYou.slice(0, 4).map(assignment => {
            const late = minutesLate(assignment, now);
            const owner = staffName(assignment.staffId);

            return (
              <Box
                key={assignment.id}
                sx={{
                  ml: 4, mt: 1, p: 2, borderRadius: 2,
                  border: '1px solid #fecaca', backgroundColor: '#fff',
                  display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography variant="subtitle2" color="error" fontWeight={700}>
                    {taskTitle(assignment.taskId)} — {describeLateness(late)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {owner ?? 'Nobody claimed it'}
                    {assignment.dueTime ? ` · was due ${assignment.dueTime.slice(0, 5)}` : ''}
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => onOpen(assignment)}>
                  Look into it
                </Button>
              </Box>
            );
          })}

          {state.needsYou.length > 4 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              and {state.needsYou.length - 4} more
            </Typography>
          )}
        </Box>
      ))}

      {fine.map(state => (
        <Box
          key={state.outlet.id}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, p: 2, mb: 1,
            border: '1px solid #e2e8f0', borderRadius: 2, backgroundColor: '#fff',
          }}
        >
          {dot(state.finishedLate > 0 ? '#d97706' : '#16a34a')}
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={700}>{state.outlet.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {state.total === 0
                ? 'Nothing scheduled'
                : `${state.done} of ${state.total} done, nothing overdue`}
              {state.finishedLate > 0
                ? ` · ${state.finishedLate} finished late`
                : ''}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={state.finishedLate > 0 ? 'warning' : 'success'}
            label={state.finishedLate > 0 ? 'worth a look' : 'on track'}
          />
        </Box>
      ))}
    </Box>
  );
};

export default BranchExceptions;
