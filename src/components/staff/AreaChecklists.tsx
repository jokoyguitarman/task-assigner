import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { TaskAssignment, Task, StaffProfile } from '../../types';
import TaskRow, { byDeadline, staffNameOf } from './TaskRow';

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
        const ordered = [...items].sort(byDeadline);
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

            {ordered.map(assignment => (
              <TaskRow
                key={assignment.id}
                assignment={assignment}
                task={taskOf(assignment)}
                ownerName={staffNameOf(staffProfiles, assignment.staffId)}
                now={now}
                onOpen={onOpen}
                onClaim={onClaim}
                onComplete={onComplete}
              />
            ))}
          </Box>
        );
      })}
    </Box>
  );
};

export default AreaChecklists;
