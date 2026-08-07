import { TaskAssignment } from '../types';

// One definition of "late". Four slightly different ones used to be inlined in
// Dashboard, AssignmentList and StaffDashboard, which is why the same task could
// show as pending on one screen and overdue on another.

// The moment an assignment stops being on time. A task due at 23:00 is not late
// at 18:00, but it is late at 23:30 — the point of collecting a due time. With
// no due time the deadline is the end of the due day.
export const deadlineOf = (assignment: TaskAssignment): Date => {
  const due = new Date(assignment.dueDate);
  const deadline = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const match = assignment.dueTime && /^(\d{1,2}):(\d{2})/.exec(assignment.dueTime);
  if (match) {
    deadline.setHours(Number(match[1]), Number(match[2]), 0, 0);
  } else {
    deadline.setHours(23, 59, 59, 999);
  }

  return deadline;
};

// Whether the deadline has passed on something still outstanding. Completed work
// is never overdue, however late it was — lateness is recorded at completion.
export const isAssignmentOverdue = (assignment: TaskAssignment, now: Date = new Date()): boolean => {
  if (assignment.status === 'completed') return false;
  if (assignment.status === 'overdue') return true;

  return now > deadlineOf(assignment);
};

// What the screen should show, which is not always what the row says: the sweep
// that flips rows to 'overdue' has not run yet for anything that went late in
// the last few minutes.
export type EffectiveStatus = TaskAssignment['status'];

export const effectiveStatus = (assignment: TaskAssignment, now: Date = new Date()): EffectiveStatus => {
  if (assignment.status === 'completed' || assignment.status === 'reschedule_requested') {
    return assignment.status;
  }
  return isAssignmentOverdue(assignment, now) ? 'overdue' : 'pending';
};

export const statusColor = (status: EffectiveStatus): 'success' | 'error' | 'info' | 'warning' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'overdue':
      return 'error';
    case 'reschedule_requested':
      return 'info';
    default:
      return 'warning';
  }
};

export const statusLabel = (status: EffectiveStatus): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'overdue':
      return 'Overdue';
    case 'reschedule_requested':
      return 'Reschedule requested';
    default:
      return 'Pending';
  }
};

export const isDueToday = (assignment: TaskAssignment, now: Date = new Date()): boolean => {
  const due = new Date(assignment.dueDate);
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
};
