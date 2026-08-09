import { TaskAssignment } from '../types';
import { toDateOnly, zonedWallClockToInstant } from './dates';

// One definition of "late". Four slightly different ones used to be inlined in
// Dashboard, AssignmentList and StaffDashboard, which is why the same task could
// show as pending on one screen and overdue on another.

// The moment an assignment stops being on time. A task due at 23:00 is not late
// at 18:00, but it is late at 23:30 — the point of collecting a due time. With
// no due time the deadline is the end of the due day.
//
// Resolved in the restaurant's timezone, not the device's. This used to read the
// browser clock, which meant a tablet set to the wrong zone, or an owner abroad,
// would disagree with the database about whether work was late — and the database
// is the one that flips the status and sends the alert.
export const deadlineOf = (assignment: TaskAssignment): Date => {
  const day = toDateOnly(new Date(assignment.dueDate));
  const match = assignment.dueTime && /^(\d{1,2}):(\d{2})/.exec(assignment.dueTime);

  const time = match
    ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`
    : '23:59';

  const deadline = zonedWallClockToInstant(day, time);

  // Without a due time the deadline is the very end of the day, so that a task
  // finished at 23:59:30 is not counted late by half a minute.
  if (!match) deadline.setSeconds(59, 999);

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

// "Today" is the restaurant's today. Comparing formatted calendar days rather
// than date components keeps this consistent with how the deadline is resolved.
export const isDueToday = (assignment: TaskAssignment, now: Date = new Date()): boolean =>
  toDateOnly(new Date(assignment.dueDate)) === toDateOnly(now);
