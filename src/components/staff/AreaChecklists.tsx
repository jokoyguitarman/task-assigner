import React from 'react';
import { Box, Button, Chip, Typography, Avatar } from '@mui/material';
import { CheckCircle, PriorityHigh } from '@mui/icons-material';
import { TaskAssignment, Task, StaffProfile } from '../../types';
import { deadlineOf, effectiveStatus } from '../../lib/assignmentStatus';

// The branch phone. One short checklist per area, closest deadline first.
//
// This replaces a list split by status, which meant whoever was working the
// kitchen had to read past every other job in the building to find theirs. A
// person standing at one station wants the jobs at that station.
interface Props {
  assignments: TaskAssignment[];
  tasks: Task[];
  staffProfiles: StaffProfile[];
  onOpen: (assignment: TaskAssignment) => void;
  onClaim: (assignmentId: string) => void;
  onComplete: (assignmentId: string) => void;
}

// "in 20m", "in 3h 10m", "45m late". Precise enough to act on, without asking
// anyone to subtract times in their head mid-shift.
const timeToDeadline = (assignment: TaskAssignment, now: Date): string => {
  const diffMinutes = Math.round((deadlineOf(assignment).getTime() - now.getTime()) / 60000);
  const late = diffMinutes < 0;
  const total = Math.abs(diffMinutes);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const span = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return late ? `${span} late` : `in ${span}`;
};

const AreaChecklists: React.FC<Props> = ({
  assignments,
  tasks,
  staffProfiles,
  onOpen,
  onClaim,
  onComplete,
}) => {
  const now = new Date();
  const taskOf = (assignment: TaskAssignment) => tasks.find(t => t.id === assignment.taskId);
  const staffName = (staffId?: string) =>
    staffId ? staffProfiles.find(s => s.id === staffId)?.name : undefined;

  // Grouped by the task's area. Anything whose task has not loaded yet falls
  // under a heading rather than vanishing from the list.
  const groups = new Map<string, TaskAssignment[]>();
  assignments.forEach(assignment => {
    const name = taskOf(assignment)?.area?.name ?? 'Other';
    groups.set(name, [...(groups.get(name) ?? []), assignment]);
  });

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (assignments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Avatar sx={{ bgcolor: 'success.main', width: 72, height: 72, mx: 'auto', mb: 2 }}>
          <CheckCircle sx={{ fontSize: 36 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={600}>Nothing outstanding</Typography>
        <Typography variant="body2" color="text.secondary">
          Every job for today is done.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {sortedGroups.map(([areaName, items]) => {
        const ordered = [...items].sort(
          (a, b) => deadlineOf(a).getTime() - deadlineOf(b).getTime()
        );
        const done = ordered.filter(a => a.status === 'completed').length;

        return (
          <Box key={areaName} sx={{ mb: 3 }}>
            <Box
              sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                mb: 1, px: 0.5,
              }}
            >
              <Typography
                variant="overline"
                fontWeight={700}
                color="text.secondary"
                sx={{ letterSpacing: '0.06em' }}
              >
                {areaName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {done} of {ordered.length} done
              </Typography>
            </Box>

            {ordered.map(assignment => {
              const status = effectiveStatus(assignment, now);
              const isDone = status === 'completed';
              const isLate = status === 'overdue';
              const task = taskOf(assignment);
              const owner = staffName(assignment.staffId);

              return (
                <Box
                  key={assignment.id}
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
                          {owner ? ` by ${owner}` : ''}
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
                            {owner ? `· ${owner}` : '· unclaimed'}
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
            })}
          </Box>
        );
      })}
    </Box>
  );
};

export default AreaChecklists;
