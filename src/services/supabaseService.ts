import { supabase } from '../lib/supabase';
import { requireOrganizationId } from '../lib/authClaims';
import { toDateOnly, parseDateOnly, instantToLocalDate, addDays } from '../lib/dates';
import { 
  User, Task, TaskAssignment, Organization,
  StaffPosition, Outlet, StaffProfile, MonthlySchedule, 
  DailySchedule, TaskCompletionProof, Invitation, PublicInvitation, InvitationFormData,
  Reassignment, ShiftDefinition, Area, OutletShift, CoverageGap, RaisedItem, Reading,
  ScheduleProposal, ScheduleChange, ScheduleDayState, DayOffType
} from '../types';

// Helper function to check if Supabase is configured
const isSupabaseConfigured = () => {
  return process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY;
};

// Transform Supabase row to our app types
const transformUser = (row: any): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  organizationId: row.organization_id,
  isPrimaryAdmin: row.is_primary_admin || false,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const transformOrganization = (row: any): Organization => ({
  id: row.id,
  name: row.name,
  domain: row.domain,
  timezone: row.timezone || 'Asia/Manila',
  subscriptionTier: row.subscription_tier,
  subscriptionStatus: row.subscription_status,
  maxAdmins: row.max_admins,
  maxRestaurants: row.max_restaurants,
  maxEmployees: row.max_employees,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const transformTask = (row: any): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  estimatedMinutes: row.estimated_minutes,
  isRecurring: row.is_recurring || false,
  recurringPattern: row.recurring_pattern,
  scheduledDate: row.scheduled_date ? parseDateOnly(row.scheduled_date) : undefined,
  isHighPriority: row.is_high_priority || false,
  shiftId: row.shift_id,
  areaId: row.area_id,
  dueTimeOverride: row.due_time_override ? hhmm(row.due_time_override) : undefined,
  outletIds: row.task_outlets ? row.task_outlets.map((t: any) => t.outlet_id) : undefined,
  raisedByOutletId: row.raised_by_outlet_id || undefined,
  raisedByStaffId: row.raised_by_staff_id || undefined,
  photoPath: row.photo_path || undefined,
  answerType: row.answer_type || 'none',
  answerPrompt: row.answer_prompt || undefined,
  answerMin: row.answer_min ?? undefined,
  answerMax: row.answer_max ?? undefined,
  requiresPhoto: row.requires_photo || false,
  organizationId: row.organization_id,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  shift: row.shift ? transformShiftDefinition(row.shift) : undefined,
  area: row.area ? transformArea(row.area) : undefined,
});

// Postgres hands back TIME as HH:MM:SS; every input and comparison in the client
// works in HH:MM.
const hhmm = (value: string): string => value.slice(0, 5);

const transformShiftDefinition = (row: any): ShiftDefinition => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  sortOrder: row.sort_order ?? 0,
});

const transformArea = (row: any): Area => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  sortOrder: row.sort_order ?? 0,
});

const transformOutletShift = (row: any): OutletShift => ({
  id: row.id,
  outletId: row.outlet_id,
  shiftId: row.shift_id,
  startsAt: hhmm(row.starts_at),
  endsAt: hhmm(row.ends_at),
  shift: row.shift ? transformShiftDefinition(row.shift) : undefined,
});

const transformTaskAssignment = (row: any): TaskAssignment => ({
  id: row.id,
  taskId: row.task_id,
  staffId: row.staff_id || undefined,
  assignedDate: parseDateOnly(row.assigned_date),
  dueDate: parseDateOnly(row.due_date),
  dueTime: row.due_time || undefined,
  outletId: row.outlet_id || undefined,
  organizationId: row.organization_id,
  status: row.status,
  completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  completionProof: row.completion_proof,
  completionNotes: row.completion_notes || undefined,
  completedByStaffId: row.completed_by_staff_id || undefined,
  ownerWatching: row.owner_watching || false,
  conditionRating: row.condition_rating || undefined,
  answerText: row.answer_text || undefined,
  answerNumber: row.answer_number ?? undefined,
  minutesDeducted: row.minutes_deducted,
  // Reschedule fields
  rescheduleRequestedAt: row.reschedule_requested_at ? new Date(row.reschedule_requested_at) : undefined,
  rescheduleReason: row.reschedule_reason,
  rescheduleRequestedBy: row.reschedule_requested_by,
  rescheduleApprovedAt: row.reschedule_approved_at ? new Date(row.reschedule_approved_at) : undefined,
  rescheduleApprovedBy: row.reschedule_approved_by,
  rescheduleNewDueDate: row.reschedule_new_due_date ? new Date(row.reschedule_new_due_date) : undefined,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  // Populated fields. staff_id references the roster, not a login.
  task: row.task ? transformTask(row.task) : undefined,
  staff: row.staff ? transformStaffProfile(row.staff) : undefined,
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
});

const transformStaffPosition = (row: any): StaffPosition => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isCustom: row.is_custom,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
});

const transformOutlet = (row: any): Outlet => ({
  id: row.id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  email: row.email,
  managerId: row.manager_id,
  userId: row.user_id,
  organizationId: row.organization_id,
  isActive: row.is_active,
  createdAt: new Date(row.created_at),
});

const transformStaffProfile = (row: any): StaffProfile => ({
  id: row.id,
  name: row.name,
  positionId: row.position_id,
  employeeId: row.employee_id,
  hireDate: parseDateOnly(row.hire_date),
  outletId: row.outlet_id || undefined,
  organizationId: row.organization_id,
  isActive: row.is_active,
  currentStreak: row.current_streak || 0,
  longestStreak: row.longest_streak || 0,
  lastClearBoardDate: row.last_clear_board_date ? parseDateOnly(row.last_clear_board_date) : undefined,
  createdAt: new Date(row.created_at),
  position: row.position ? transformStaffPosition(row.position) : undefined,
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
});

const transformMonthlySchedule = (row: any): MonthlySchedule => ({
  id: row.id,
  staffId: row.staff_id,
  month: row.month,
  year: row.year,
  organizationId: row.organization_id,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  staff: row.staff ? transformStaffProfile(row.staff) : undefined,
  dailySchedules: row.daily_schedules ? row.daily_schedules.map(transformDailySchedule) : [],
});

const transformDailySchedule = (row: any): DailySchedule => ({
  id: row.id,
  monthlyScheduleId: row.monthly_schedule_id,
  // Parsed as a local calendar day. new Date('2025-09-01') would be treated as
  // UTC midnight and render as the previous day west of Greenwich.
  scheduleDate: parseDateOnly(row.schedule_date),
  outletId: row.outlet_id,
  organizationId: row.organization_id,
  timeIn: row.time_in,
  timeOut: row.time_out,
  isDayOff: row.is_day_off,
  dayOffType: row.day_off_type,
  notes: row.notes,
  createdAt: new Date(row.created_at),
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
});

const transformScheduleProposal = (row: any): ScheduleProposal => ({
  id: row.id,
  organizationId: row.organization_id,
  outletId: row.outlet_id,
  staffId: row.staff_id,
  scheduleDate: parseDateOnly(row.schedule_date),
  isDayOff: row.is_day_off,
  dayOffType: row.day_off_type || undefined,
  timeIn: row.time_in ? hhmm(row.time_in) : undefined,
  timeOut: row.time_out ? hhmm(row.time_out) : undefined,
  note: row.note || undefined,
  status: row.status,
  proposedBy: row.proposed_by || undefined,
  proposedAt: new Date(row.proposed_at),
  decidedBy: row.decided_by || undefined,
  decidedAt: row.decided_at ? new Date(row.decided_at) : undefined,
  decisionNote: row.decision_note || undefined,
  staff: row.staff ? transformStaffProfile(row.staff) : undefined,
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
});

const transformScheduleDayState = (value: any): ScheduleDayState | undefined =>
  value
    ? {
        isDayOff: value.is_day_off,
        dayOffType: value.day_off_type ?? null,
        timeIn: value.time_in ? hhmm(value.time_in) : null,
        timeOut: value.time_out ? hhmm(value.time_out) : null,
        outletId: value.outlet_id ?? null,
      }
    : undefined;

const transformScheduleChange = (row: any): ScheduleChange => ({
  id: row.id,
  organizationId: row.organization_id,
  outletId: row.outlet_id || undefined,
  staffId: row.staff_id || undefined,
  scheduleDate: parseDateOnly(row.schedule_date),
  was: transformScheduleDayState(row.was),
  // Never null in the database, so the fallback only guards a malformed row.
  became: transformScheduleDayState(row.became) ?? { isDayOff: false },
  reason: row.reason || undefined,
  changedBy: row.changed_by || undefined,
  changedRole: row.changed_role,
  changedAt: new Date(row.changed_at),
  staff: row.staff ? transformStaffProfile(row.staff) : undefined,
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
});

const transformTaskCompletionProof = (row: any): TaskCompletionProof => ({
  id: row.id,
  assignmentId: row.assignment_id,
  filePath: row.file_path,
  fileType: row.file_type,
  fileSize: row.file_size,
  uploadedAt: new Date(row.uploaded_at),
  createdBy: row.created_by,
});

const transformReassignment = (row: any): Reassignment => ({
  id: row.id,
  assignmentId: row.assignment_id,
  fromStaffId: row.from_staff_id || undefined,
  toStaffId: row.to_staff_id || undefined,
  reason: row.reason || undefined,
  reassignedBy: row.reassigned_by || undefined,
  reassignedAt: new Date(row.reassigned_at),
  fromStaff: row.from_staff ? transformStaffProfile(row.from_staff) : undefined,
  toStaff: row.to_staff ? transformStaffProfile(row.to_staff) : undefined,
});

const transformInvitation = (row: any): Invitation => ({
  id: row.id,
  email: row.email,
  role: row.role,
  outletId: row.outlet_id || undefined,
  organizationId: row.organization_id,
  token: row.token,
  expiresAt: new Date(row.expires_at),
  usedAt: row.used_at ? new Date(row.used_at) : undefined,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  // Populated fields
  outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
  createdByUser: row.created_by_user ? transformUser(row.created_by_user) : undefined,
});

const transformPublicInvitation = (row: any): PublicInvitation => ({
  id: row.id,
  email: row.email,
  role: row.role,
  outletId: row.outlet_id || undefined,
  organizationId: row.organization_id,
  token: row.token,
  expiresAt: new Date(row.expires_at),
  usedAt: row.used_at ? new Date(row.used_at) : undefined,
  outletName: row.outlet_name || undefined,
});

// Thrown when someone authenticates successfully but has no profile row, so
// they are not yet a principal of any organization. Not an error condition: it
// is the normal state of a new owner before they create their restaurant, and of
// an invited branch before it redeems its invitation. The caller routes to setup.
export class ProfileNotProvisionedError extends Error {
  constructor() {
    super('This account is not set up yet.');
    this.name = 'ProfileNotProvisionedError';
  }
}

// Auth API
export const authAPI = {
  async login(email: string, password: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (userError) throw userError;

    // A missing profile used to be silently repaired by inserting one with
    // role 'admin', which handed organization-wide access to anyone who could
    // create an account. Provisioning is server-side now: bootstrap_organization
    // for an owner, redeem_outlet_invitation for a branch.
    if (!userData) throw new ProfileNotProvisionedError();

    return transformUser(userData);
  },

  // Creates the auth account only. The profile that turns this account into a
  // principal is created afterwards by bootstrap_organization or
  // redeem_outlet_invitation, both of which decide the role server-side.
  async signup(email: string, password: string, name: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) throw error;
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    await supabase.auth.signOut();
  },

  // Sends the recovery link. Until this existed, forgetting the password on a
  // branch phone locked that branch out permanently, with no way back except an
  // administrator editing the database.
  async sendPasswordReset(email: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  },

  // Used both from a recovery link and by someone already signed in, because in
  // both cases Supabase has put a session in place first.
  async setPassword(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !userData) return null;

    return transformUser(userData);
  },

  async getUserById(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return null;
    }

    return transformUser(userData);
  },
};

// Users API
export const usersAPI = {
  async getAll(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformUser);
  },

  async getByIds(ids: string[]): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('id', ids);

    if (error) throw error;

    return data.map(transformUser);
  },

  async getById(id: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformUser(data);
  },

  // Only the display name is writable from a client session. The database
  // revokes UPDATE on every other column, so role, email and organization_id
  // cannot be changed here even by a crafted request. Enrolling a staff member
  // does not go through this API at all: see staffProfilesAPI.
  async updateName(id: string, name: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformUser(data);
  },
};

// Organizations API
export const organizationsAPI = {
  async getById(id: string): Promise<Organization | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return transformOrganization(data);
  },

  // Only the name and the timezone. The subscription tier and its limits are
  // deliberately not updatable here — column grants stop it at the database, so
  // an owner cannot award themselves a bigger plan.
  async update(id: string, changes: { name?: string; timezone?: string }): Promise<Organization | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const payload: Record<string, string> = {};
    if (changes.name !== undefined) payload.name = changes.name.trim();
    if (changes.timezone !== undefined) payload.timezone = changes.timezone;

    const { data, error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return data ? transformOrganization(data) : null;
  },

  // Turns a bare auth account into the owner of a new organization. Runs
  // server-side so the subscription tier and its limits are not client-supplied,
  // and refuses to run twice for the same account.
  async bootstrap(organizationName: string, adminName: string, timezone?: string): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('bootstrap_organization', {
      p_organization_name: organizationName,
      p_admin_name: adminName,
      p_timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila',
    });

    if (error) throw new Error(error.message);

    return data as string;
  },

  // Turns a bare auth account into a branch login, using an invitation issued by
  // the owner. Verifies server-side that the caller's own email matches the
  // invitation, so a leaked token alone is not enough to claim a branch.
  async redeemOutletInvitation(token: string): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('redeem_outlet_invitation', { p_token: token });

    if (error) throw new Error(error.message);

    return data as string;
  },
};

// A task is only meaningful alongside its shift and area, and the branches it is
// limited to, so every read pulls them rather than leaving callers to join.
const TASK_SELECT = '*, shift:shift_id (*), area:area_id (*), task_outlets (outlet_id)';

// Targeting is a set, not a field, so it is replaced wholesale. An empty or
// absent list means every branch that runs the shift and has the area, which is
// why clearing the rows is the same as saying "everywhere".
const replaceTaskOutlets = async (taskId: string, outletIds?: string[]): Promise<void> => {
  const { error: clearError } = await supabase.from('task_outlets').delete().eq('task_id', taskId);
  if (clearError) throw clearError;

  if (!outletIds || outletIds.length === 0) return;

  const { error } = await supabase
    .from('task_outlets')
    .insert(outletIds.map(outletId => ({ task_id: taskId, outlet_id: outletId })));

  if (error) throw error;
};

// The business vocabulary. Everyone reads it, only the owner changes it, because
// these definitions decide when work is late at every branch.
export const shiftsAPI = {
  async getAll(): Promise<ShiftDefinition[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('shift_definitions')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return data.map(transformShiftDefinition);
  },

  async create(name: string, sortOrder: number): Promise<ShiftDefinition> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('shift_definitions')
      .insert({ name: name.trim(), sort_order: sortOrder, organization_id: await requireOrganizationId() })
      .select()
      .single();

    if (error) throw error;

    return transformShiftDefinition(data);
  },

  async rename(id: string, name: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('shift_definitions').update({ name: name.trim() }).eq('id', id);
    if (error) throw error;
  },

  // Refused by the database while any task still uses it, which is the right
  // answer: silently deleting the shift would leave that work with no deadline.
  async remove(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('shift_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};

export const areasAPI = {
  async getAll(): Promise<Area[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return data.map(transformArea);
  },

  async create(name: string, sortOrder: number): Promise<Area> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('areas')
      .insert({ name: name.trim(), sort_order: sortOrder, organization_id: await requireOrganizationId() })
      .select()
      .single();

    if (error) throw error;

    return transformArea(data);
  },

  async rename(id: string, name: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('areas').update({ name: name.trim() }).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) throw error;
  },
};

// What a given branch actually runs and has.
export const branchSetupAPI = {
  async getShifts(outletId: string): Promise<OutletShift[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('outlet_shifts')
      .select('*, shift:shift_id (*)')
      .eq('outlet_id', outletId);

    if (error) throw error;

    return data.map(transformOutletShift);
  },

  async getAreaIds(outletId: string): Promise<string[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('outlet_areas')
      .select('area_id')
      .eq('outlet_id', outletId);

    if (error) throw error;

    return data.map((row: any) => row.area_id);
  },

  // Replaces the branch's whole configuration in one go, which keeps the screen
  // simple: the owner ticks what is true and saves.
  async save(
    outletId: string,
    shifts: { shiftId: string; startsAt: string; endsAt: string }[],
    areaIds: string[]
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error: clearShifts } = await supabase.from('outlet_shifts').delete().eq('outlet_id', outletId);
    if (clearShifts) throw clearShifts;

    if (shifts.length > 0) {
      const { error } = await supabase.from('outlet_shifts').insert(
        shifts.map(s => ({
          outlet_id: outletId,
          shift_id: s.shiftId,
          starts_at: s.startsAt,
          ends_at: s.endsAt,
        }))
      );
      if (error) throw error;
    }

    const { error: clearAreas } = await supabase.from('outlet_areas').delete().eq('outlet_id', outletId);
    if (clearAreas) throw clearAreas;

    if (areaIds.length > 0) {
      const { error } = await supabase
        .from('outlet_areas')
        .insert(areaIds.map(areaId => ({ outlet_id: outletId, area_id: areaId })));
      if (error) throw error;
    }
  },

  // A new branch starts running every shift at default hours and having every
  // area, so it receives work immediately. Starting empty would mean a branch
  // that silently gets nothing until someone notices.
  async applyDefaults(outletId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const [shifts, areas] = await Promise.all([shiftsAPI.getAll(), areasAPI.getAll()]);

    const defaultHours: Record<string, { startsAt: string; endsAt: string }> = {
      Opening: { startsAt: '09:00', endsAt: '12:00' },
      Mid: { startsAt: '12:00', endsAt: '18:00' },
      Closing: { startsAt: '18:00', endsAt: '23:00' },
    };

    await branchSetupAPI.save(
      outletId,
      shifts.map(s => ({
        shiftId: s.id,
        ...(defaultHours[s.name] ?? { startsAt: '09:00', endsAt: '17:00' }),
      })),
      areas.map(a => a.id)
    );
  },
};

// Tasks API
export const tasksAPI = {
  async getAll(): Promise<Task[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformTask);
  },

  async getById(id: string): Promise<Task> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformTask(data);
  },

  async create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description,
        estimated_minutes: taskData.estimatedMinutes,
        is_recurring: taskData.isRecurring,
        recurring_pattern: taskData.recurringPattern,
        scheduled_date: taskData.scheduledDate ? toDateOnly(taskData.scheduledDate) : null,
        is_high_priority: taskData.isHighPriority,
        shift_id: taskData.shiftId,
        area_id: taskData.areaId,
        due_time_override: taskData.dueTimeOverride || null,
        answer_type: taskData.answerType || 'none',
        answer_prompt: taskData.answerPrompt || null,
        answer_min: taskData.answerMin ?? null,
        answer_max: taskData.answerMax ?? null,
        requires_photo: taskData.requiresPhoto || false,
        created_by: taskData.createdBy,
        organization_id: taskData.organizationId || (await requireOrganizationId()),
      })
      .select(TASK_SELECT)
      .single();

    if (error) throw error;

    await replaceTaskOutlets(data.id, taskData.outletIds);

    return transformTask(data);
  },

  async update(id: string, taskData: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (taskData.title !== undefined) updateData.title = taskData.title;
    if (taskData.description !== undefined) updateData.description = taskData.description;
    if (taskData.estimatedMinutes !== undefined) updateData.estimated_minutes = taskData.estimatedMinutes;
    if (taskData.isRecurring !== undefined) updateData.is_recurring = taskData.isRecurring;
    if (taskData.recurringPattern !== undefined) updateData.recurring_pattern = taskData.recurringPattern;
    if (taskData.scheduledDate !== undefined) {
      updateData.scheduled_date = taskData.scheduledDate ? toDateOnly(taskData.scheduledDate) : null;
    }
    if (taskData.isHighPriority !== undefined) updateData.is_high_priority = taskData.isHighPriority;
    if (taskData.shiftId !== undefined) updateData.shift_id = taskData.shiftId;
    if (taskData.areaId !== undefined) updateData.area_id = taskData.areaId;
    if (taskData.dueTimeOverride !== undefined) updateData.due_time_override = taskData.dueTimeOverride || null;
    if (taskData.answerType !== undefined) updateData.answer_type = taskData.answerType;
    if (taskData.answerPrompt !== undefined) updateData.answer_prompt = taskData.answerPrompt || null;
    if (taskData.answerMin !== undefined) updateData.answer_min = taskData.answerMin ?? null;
    if (taskData.answerMax !== undefined) updateData.answer_max = taskData.answerMax ?? null;
    if (taskData.requiresPhoto !== undefined) updateData.requires_photo = taskData.requiresPhoto;
    if (taskData.createdBy !== undefined) updateData.created_by = taskData.createdBy;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select(TASK_SELECT)
      .single();

    if (error) throw error;

    if (taskData.outletIds !== undefined) {
      await replaceTaskOutlets(id, taskData.outletIds);
    }

    return transformTask(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Task Assignments API
export const assignmentsAPI = {
  async getAll(): Promise<TaskAssignment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformTaskAssignment);
  },

  async getById(id: string): Promise<TaskAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    console.log('🔍 Getting assignment by ID:', id);

    // First try with joins
    const { data, error } = await supabase
      .from('task_assignments')
      .select(`
        *,
        task:task_id (
          id,
          title,
          description,
          estimated_minutes,
          is_high_priority,
          created_by
        ),
        staff:staff_id (
          id,
          name,
          employee_id
        ),
        outlet:outlet_id (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error with joins, trying simple query:', error);
      
      // Fallback to simple query without joins
      const { data: simpleData, error: simpleError } = await supabase
        .from('task_assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (simpleError) {
        console.error('❌ Simple query also failed:', simpleError);
        throw simpleError;
      }

      console.log('✅ Simple query succeeded:', simpleData);
      return transformTaskAssignment(simpleData);
    }

    console.log('✅ Query with joins succeeded:', data);
    return transformTaskAssignment(data);
  },

  async create(assignmentData: Omit<TaskAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .insert({
        task_id: assignmentData.taskId,
        staff_id: assignmentData.staffId || null,
        // These are DATE columns holding a business day, not an instant. Sending
        // an ISO instant stores the UTC calendar day, which is yesterday for any
        // Date whose local clock reads before 08:00 in Asia/Manila — i.e. exactly
        // the closing shift this app exists to keep honest.
        assigned_date: toDateOnly(assignmentData.assignedDate),
        due_date: toDateOnly(assignmentData.dueDate),
        // Persisted so a task can be late the same evening rather than only
        // once the calendar rolls over. The form has always collected it.
        due_time: assignmentData.dueTime || null,
        // Required by the schema. Caught here so the failure names the missing
        // field rather than surfacing as a not-null violation.
        outlet_id: assignmentData.outletId || (() => {
          throw new Error('An assignment needs an outlet.');
        })(),
        organization_id: assignmentData.organizationId || (await requireOrganizationId()),
        status: assignmentData.status,
        completed_at: assignmentData.completedAt?.toISOString(),
        completion_proof: assignmentData.completionProof,
        completion_notes: assignmentData.completionNotes,
        minutes_deducted: assignmentData.minutesDeducted,
      })
      .select()
      .single();

    if (error) throw error;

    return transformTaskAssignment(data);
  },

  async update(id: string, assignmentData: Partial<Omit<TaskAssignment, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TaskAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (assignmentData.taskId) updateData.task_id = assignmentData.taskId;
    if (assignmentData.staffId !== undefined) updateData.staff_id = assignmentData.staffId || null;
    if (assignmentData.assignedDate) updateData.assigned_date = toDateOnly(assignmentData.assignedDate);
    if (assignmentData.dueDate) updateData.due_date = toDateOnly(assignmentData.dueDate);
    if (assignmentData.dueTime !== undefined) updateData.due_time = assignmentData.dueTime || null;
    if (assignmentData.outletId !== undefined) updateData.outlet_id = assignmentData.outletId || null;
    if (assignmentData.status) updateData.status = assignmentData.status;
    if (assignmentData.completedAt) updateData.completed_at = assignmentData.completedAt.toISOString();
    if (assignmentData.completionProof) updateData.completion_proof = assignmentData.completionProof;
    if (assignmentData.completionNotes !== undefined) updateData.completion_notes = assignmentData.completionNotes;
    if (assignmentData.completedByStaffId !== undefined) updateData.completed_by_staff_id = assignmentData.completedByStaffId || null;
    // Only ever sent, never read. The database records it against the change of
    // ownership and blanks the column, so a stale value cannot excuse a later
    // reassignment.
    if (assignmentData.reassignmentReason) updateData.reassignment_reason = assignmentData.reassignmentReason;
    if (assignmentData.ownerWatching !== undefined) updateData.owner_watching = assignmentData.ownerWatching;
    if (assignmentData.conditionRating !== undefined) updateData.condition_rating = assignmentData.conditionRating || null;
    if (assignmentData.answerText !== undefined) updateData.answer_text = assignmentData.answerText || null;
    if (assignmentData.answerNumber !== undefined) updateData.answer_number = assignmentData.answerNumber ?? null;
    if (assignmentData.minutesDeducted) updateData.minutes_deducted = assignmentData.minutesDeducted;

    const { data, error } = await supabase
      .from('task_assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformTaskAssignment(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getByStaff(staffId: string): Promise<TaskAssignment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformTaskAssignment);
  },

  async getByOutlet(outletId: string): Promise<TaskAssignment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformTaskAssignment);
  },

  async complete(
    id: string,
    options: { completionProof?: string; notes?: string; completedByStaffId?: string } = {}
  ): Promise<TaskAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_proof: options.completionProof,
        completion_notes: options.notes,
        completed_by_staff_id: options.completedByStaffId || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformTaskAssignment(data);
  },
};

// A branch noticing something that needs doing.
//
// One server-side call, because the deadline must not be client-supplied: given the
// chance, a branch could give itself until next week. The database derives it from
// the branch's own shift and refuses a shift or area the branch does not have.
export const raisedWorkAPI = {
  async raise(input: {
    title: string;
    areaId: string;
    shiftId: string;
    staffId?: string;
    note?: string;
    photo?: File;
    requiresPhoto?: boolean;
  }): Promise<string> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    let photoPath: string | undefined;

    // Uploaded first so the path can be handed to the function: the storage policy
    // matches the leading folder against the caller's organization, and a photo of
    // the problem is worth more than one of the aftermath.
    if (input.photo) {
      const organizationId = await requireOrganizationId();
      const extension = input.photo.name.includes('.') ? input.photo.name.split('.').pop() : 'jpg';
      photoPath = `${organizationId}/raised/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(photoPath, input.photo, { contentType: input.photo.type, upsert: false });

      if (uploadError) throw new Error(`Could not attach the photo: ${uploadError.message}`);
    }

    const { data, error } = await supabase.rpc('raise_branch_task', {
      p_title: input.title,
      p_area_id: input.areaId,
      p_shift_id: input.shiftId,
      p_staff_id: input.staffId ?? null,
      p_note: input.note ?? null,
      p_photo_path: photoPath ?? null,
      p_requires_photo: input.requiresPhoto ?? false,
    });

    if (error) throw new Error(error.message);

    return data as string;
  },

  // What the branches have raised, for the owner to promote, dismiss or subscribe to.
  // The single assignment behind each one comes along, since the owner acts on the job
  // rather than the template.
  async getRaised(): Promise<RaisedItem[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select(
        `${TASK_SELECT},
         raised_outlet:raised_by_outlet_id (id, name),
         raised_staff:raised_by_staff_id (id, name),
         assignments:task_assignments (id, status, owner_watching, due_date, due_time)`
      )
      .not('raised_by_outlet_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((row: any) => {
      const assignment = row.assignments?.[0];

      return {
        ...transformTask(row),
        raisedByOutletName: row.raised_outlet?.name,
        raisedByStaffName: row.raised_staff?.name,
        assignmentId: assignment?.id,
        assignmentStatus: assignment?.status,
        ownerWatching: assignment?.owner_watching ?? false,
      };
    });
  },

  // Turning an observation into a standard is the owner's decision, and the only one
  // worth keeping: from here it fans out to every branch that qualifies.
  async promoteToRecurring(taskId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('tasks')
      .update({
        is_recurring: true,
        recurring_pattern: 'daily',
        raised_by_outlet_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw error;
  },

  async dismiss(taskId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },
};

// What the repeated checks have been coming back as.
export const readingsAPI = {
  async getHistory(days = 30): Promise<Reading[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase.rpc('readings_history', { p_days: days });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      taskTitle: row.task_title,
      outletName: row.outlet_name,
      areaName: row.area_name,
      answerType: row.answer_type,
      readings: row.readings,
      fine: row.fine,
      attention: row.attention,
      bad: row.bad,
      outOfRange: row.out_of_range,
      lastSeen: row.last_seen ? parseDateOnly(row.last_seen) : undefined,
      lastValue: row.last_value ?? undefined,
    }));
  },
};

// When the owner wants their morning summary, in the restaurant's own time.
export const digestAPI = {
  async get(userId: string): Promise<{ sendAt: string; enabled: boolean } | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('digest_preferences')
      .select('send_at, enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return { sendAt: hhmm(data.send_at), enabled: data.enabled };
  },

  async save(userId: string, organizationId: string, sendAt: string, enabled: boolean): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.from('digest_preferences').upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        send_at: sendAt,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) throw error;
  },
};

// Work assigned to somebody who will not be there — on a day off, or rostered at a
// different branch that day. Computed in the database rather than the browser so
// the same answer is available to the scheduled job that raises the warning.
export const coverageAPI = {
  async getGaps(): Promise<CoverageGap[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase.rpc('coverage_gaps');

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      assignmentId: row.id,
      outletName: row.outlet_name,
      taskTitle: row.task_title,
      staffName: row.staff_name,
      businessDay: parseDateOnly(row.business_day),
      dueTime: row.due_time ? hhmm(row.due_time) : undefined,
      reason: row.reason,
    }));
  },
};

// The ownership trail on an assignment. Read-only by design: the rows are written
// by a database trigger, and the client has no insert, update or delete privilege,
// so a branch cannot quietly rewrite why work changed hands.
export const reassignmentsAPI = {
  async getByAssignment(assignmentId: string): Promise<Reassignment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('assignment_reassignments')
      .select('*, from_staff:from_staff_id (id, name, employee_id), to_staff:to_staff_id (id, name, employee_id)')
      .eq('assignment_id', assignmentId)
      .order('reassigned_at', { ascending: true });

    if (error) throw error;

    return data.map(transformReassignment);
  },
};

// Staff Positions API
export const staffPositionsAPI = {
  async getAll(): Promise<StaffPosition[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('staff_positions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformStaffPosition);
  },

  async getById(id: string): Promise<StaffPosition> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_positions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformStaffPosition(data);
  },

  async create(positionData: Omit<StaffPosition, 'id' | 'createdAt'>): Promise<StaffPosition> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_positions')
      .insert({
        name: positionData.name,
        description: positionData.description,
        is_custom: positionData.isCustom,
        created_by: positionData.createdBy,
        // Custom positions belong to one organization. The built-in positions
        // seeded with the schema have a null organization_id and are shared.
        organization_id: await requireOrganizationId(),
      })
      .select()
      .single();

    if (error) throw error;

    return transformStaffPosition(data);
  },

  async update(id: string, positionData: Partial<Omit<StaffPosition, 'id' | 'createdAt'>>): Promise<StaffPosition> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_positions')
      .update({
        name: positionData.name,
        description: positionData.description,
        is_custom: positionData.isCustom,
        created_by: positionData.createdBy,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformStaffPosition(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('staff_positions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Outlets API
export const outletsAPI = {
  async getAll(): Promise<Outlet[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .eq('is_active', true)  // Only fetch active outlets
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformOutlet);
  },

  async getById(id: string): Promise<Outlet> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformOutlet(data);
  },

  async create(outletData: Omit<Outlet, 'id' | 'createdAt'>): Promise<Outlet> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    // A branch's login is not created here. Credentials live in Supabase Auth,
    // reached by inviting the branch; the invitation redemption links the
    // resulting account back to this row.
    const { data, error } = await supabase
      .from('outlets')
      .insert({
        name: outletData.name,
        address: outletData.address,
        phone: outletData.phone,
        email: outletData.email,
        manager_id: outletData.managerId,
        is_active: outletData.isActive ?? true,
        organization_id: outletData.organizationId || (await requireOrganizationId()),
      })
      .select()
      .single();

    if (error) throw error;

    // Without this the branch runs no shifts and has no areas, so it would
    // quietly receive no work at all until someone thought to configure it.
    await branchSetupAPI.applyDefaults(data.id);

    return transformOutlet(data);
  },

  async update(id: string, outletData: Partial<Omit<Outlet, 'id' | 'createdAt'>>): Promise<Outlet> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {};
    if (outletData.name !== undefined) updateData.name = outletData.name;
    if (outletData.address !== undefined) updateData.address = outletData.address;
    if (outletData.phone !== undefined) updateData.phone = outletData.phone;
    if (outletData.email !== undefined) updateData.email = outletData.email;
    if (outletData.managerId !== undefined) updateData.manager_id = outletData.managerId || null;
    if (outletData.isActive !== undefined) updateData.is_active = outletData.isActive;

    const { data, error } = await supabase
      .from('outlets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformOutlet(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    try {
      // Check what tables actually reference outlets by running a query first
      // For now, just try to soft delete the outlet directly
      const { error } = await supabase
        .from('outlets')
        .update({ 
          is_active: false
        })
        .eq('id', id);

      if (error) {
        console.error('Outlet delete error:', error);
        throw new Error(`Failed to delete outlet: ${error.message}`);
      }
    } catch (err) {
      console.error('Error deleting outlet:', err);
      throw new Error(`Failed to delete outlet: ${(err as any)?.message || 'Unknown error'}`);
    }
  },
};

// Staff Profiles API
//
// The roster. A staff member is a row here and nothing else: no auth account, no
// users row, no credentials. Their name lives on this row, so the extra lookup
// that used to be needed to display it is gone.
const STAFF_SELECT = `
        *,
        position:staff_positions(*),
        outlet:outlets(*)
      `;

export const staffProfilesAPI = {
  async getAll(): Promise<StaffProfile[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .select(STAFF_SELECT)
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(transformStaffProfile);
  },

  async getById(id: string): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .select(STAFF_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformStaffProfile(data);
  },

  async create(profileData: Omit<StaffProfile, 'id' | 'createdAt' | 'currentStreak' | 'longestStreak'>): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .insert({
        name: profileData.name,
        position_id: profileData.positionId,
        employee_id: profileData.employeeId,
        hire_date: toDateOnly(profileData.hireDate),
        outlet_id: profileData.outletId || null,
        is_active: profileData.isActive ?? true,
        organization_id: profileData.organizationId || (await requireOrganizationId()),
      })
      .select(STAFF_SELECT)
      .single();

    if (error) throw error;

    return transformStaffProfile(data);
  },

  async update(id: string, profileData: Partial<Omit<StaffProfile, 'id' | 'createdAt'>>): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {};
    if (profileData.name !== undefined) updateData.name = profileData.name;
    if (profileData.positionId) updateData.position_id = profileData.positionId;
    if (profileData.employeeId) updateData.employee_id = profileData.employeeId;
    if (profileData.hireDate) updateData.hire_date = toDateOnly(profileData.hireDate);
    if (profileData.outletId !== undefined) updateData.outlet_id = profileData.outletId || null;
    if (profileData.isActive !== undefined) updateData.is_active = profileData.isActive;

    const { data, error } = await supabase
      .from('staff_profiles')
      .update(updateData)
      .eq('id', id)
      .select(STAFF_SELECT)
      .single();

    if (error) throw error;

    return transformStaffProfile(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('staff_profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};

// Monthly Schedules API
export const monthlySchedulesAPI = {
  async getAll(): Promise<MonthlySchedule[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('monthly_schedules')
      .select(`
        *,
        staff:staff_profiles(
          *,
          position:staff_positions(*)
        ),
        daily_schedules(
          *,
          outlet:outlets(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformMonthlySchedule);
  },

  async getByMonth(month: number, year: number): Promise<MonthlySchedule[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('monthly_schedules')
      .select(`
        *,
        staff:staff_profiles(
          *,
          position:staff_positions(*)
        ),
        daily_schedules(
          *,
          outlet:outlets(*)
        )
      `)
      .eq('month', month)
      .eq('year', year)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformMonthlySchedule);
  },

  async getByStaff(staffId: string): Promise<MonthlySchedule[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('monthly_schedules')
      .select(`
        *,
        staff:staff_profiles(
          *,
          position:staff_positions(*)
        ),
        daily_schedules(
          *,
          outlet:outlets(*)
        )
      `)
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformMonthlySchedule);
  },

  async create(scheduleData: Omit<MonthlySchedule, 'id' | 'createdAt' | 'staff' | 'dailySchedules'>): Promise<MonthlySchedule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    // Upsert, not insert. There is now a unique constraint on
    // (staff_id, month, year); its absence is why the scheduler managed to
    // create 41 surplus duplicate rows. Re-opening a month must reuse the
    // existing row rather than fail.
    const { data, error } = await supabase
      .from('monthly_schedules')
      .upsert({
        staff_id: scheduleData.staffId,
        month: scheduleData.month,
        year: scheduleData.year,
        created_by: scheduleData.createdBy,
        organization_id: scheduleData.organizationId || (await requireOrganizationId()),
      }, { onConflict: 'staff_id,month,year' })
      .select(`
        *,
        staff:staff_profiles(
          *,
          position:staff_positions(*)
        ),
        daily_schedules(
          *,
          outlet:outlets(*)
        )
      `)
      .single();

    if (error) throw error;

    return transformMonthlySchedule(data);
  },

  async update(id: string, scheduleData: Partial<Omit<MonthlySchedule, 'id' | 'createdAt' | 'staff' | 'dailySchedules'>>): Promise<MonthlySchedule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {};
    if (scheduleData.staffId) updateData.staff_id = scheduleData.staffId;
    if (scheduleData.month) updateData.month = scheduleData.month;
    if (scheduleData.year) updateData.year = scheduleData.year;
    if (scheduleData.createdBy) updateData.created_by = scheduleData.createdBy;

    const { data, error } = await supabase
      .from('monthly_schedules')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        staff:staff_profiles(
          *,
          position:staff_positions(*)
        ),
        daily_schedules(
          *,
          outlet:outlets(*)
        )
      `)
      .single();

    if (error) throw error;

    return transformMonthlySchedule(data);
  },
};

// Daily Schedules API
export const dailySchedulesAPI = {
  async getByMonthlySchedule(monthlyScheduleId: string): Promise<DailySchedule[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('daily_schedules')
      .select(`
        *,
        outlet:outlets(*)
      `)
      .eq('monthly_schedule_id', monthlyScheduleId)
      .order('schedule_date', { ascending: true });

    if (error) throw error;

    return data.map(transformDailySchedule);
  },

  async create(scheduleData: Omit<DailySchedule, 'id' | 'createdAt' | 'outlet'>): Promise<DailySchedule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    // A day off cannot also be a shift: the database now rejects a row that
    // claims both, so normalise here rather than surfacing a constraint error.
    const isDayOff = scheduleData.isDayOff;

    const upsertData = {
      monthly_schedule_id: scheduleData.monthlyScheduleId,
      // Business date in the organization's timezone, not an instant. Sending a
      // UTC ISO string here is what shifted schedules by a day for evening edits.
      schedule_date: toDateOnly(scheduleData.scheduleDate),
      outlet_id: isDayOff ? null : scheduleData.outletId || null,
      time_in: isDayOff ? null : scheduleData.timeIn || null,
      time_out: isDayOff ? null : scheduleData.timeOut || null,
      is_day_off: isDayOff,
      day_off_type: isDayOff ? scheduleData.dayOffType || null : null,
      notes: scheduleData.notes,
      organization_id: scheduleData.organizationId || (await requireOrganizationId()),
    };

    const { data, error } = await supabase
      .from('daily_schedules')
      .upsert(upsertData, { onConflict: 'monthly_schedule_id,schedule_date' })
      .select(`
        *,
        outlet:outlets(*)
      `)
      .single();

    if (error) throw error;

    return transformDailySchedule(data);
  },

  async update(id: string, scheduleData: Partial<Omit<DailySchedule, 'id' | 'createdAt' | 'outlet'>>): Promise<DailySchedule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {};
    if (scheduleData.monthlyScheduleId) updateData.monthly_schedule_id = scheduleData.monthlyScheduleId;
    if (scheduleData.scheduleDate) updateData.schedule_date = toDateOnly(scheduleData.scheduleDate);

    if (scheduleData.isDayOff) {
      // Marking a day off clears the shift, or the row would violate the check.
      updateData.is_day_off = true;
      updateData.outlet_id = null;
      updateData.time_in = null;
      updateData.time_out = null;
      updateData.day_off_type = scheduleData.dayOffType || null;
    } else {
      if (scheduleData.isDayOff !== undefined) {
        updateData.is_day_off = false;
        updateData.day_off_type = null;
      }
      if ('outletId' in scheduleData) updateData.outlet_id = scheduleData.outletId || null;
      if (scheduleData.timeIn !== undefined) updateData.time_in = scheduleData.timeIn || null;
      if (scheduleData.timeOut !== undefined) updateData.time_out = scheduleData.timeOut || null;
    }

    if (scheduleData.notes !== undefined) updateData.notes = scheduleData.notes;

    const { data, error } = await supabase
      .from('daily_schedules')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        outlet:outlets(*)
      `)
      .single();

    if (error) throw error;

    return transformDailySchedule(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('daily_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// The branch keeping its own roster.
//
// Every write goes through a database function rather than the tables: a branch has
// no INSERT or UPDATE on daily_schedules and none of these calls give it any. The
// function decides whether a date is near enough to publish or has to be proposed,
// so the horizon cannot be moved by editing a request.
export const branchRosterAPI = {
  async setDay(input: {
    staffId: string;
    date: Date;
    isDayOff: boolean;
    timeIn?: string;
    timeOut?: string;
    dayOffType?: DayOffType;
    reason?: string;
  }): Promise<{ outcome: 'published' | 'proposed'; id: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase.rpc('set_branch_schedule', {
      p_staff_id: input.staffId,
      // A calendar day in the restaurant's zone. Handing over a Date serialises to
      // UTC and lands on the previous day for anyone east of Greenwich.
      p_date: toDateOnly(input.date),
      p_is_day_off: input.isDayOff,
      p_time_in: input.isDayOff ? null : input.timeIn ?? null,
      p_time_out: input.isDayOff ? null : input.timeOut ?? null,
      p_day_off_type: input.isDayOff ? input.dayOffType ?? null : null,
      p_reason: input.reason ?? null,
    });

    if (error) throw new Error(error.message);

    return data as { outcome: 'published' | 'proposed'; id: string };
  },

  // Requests still waiting on the owner. RLS narrows this to the caller's own
  // branch when a branch asks, and to the organization when the owner does.
  async getPending(): Promise<ScheduleProposal[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('schedule_proposals')
      .select(`
        *,
        staff:staff_profiles(*, position:staff_positions(*)),
        outlet:outlets(*)
      `)
      .eq('status', 'pending')
      .order('schedule_date', { ascending: true });

    if (error) throw error;

    return data.map(transformScheduleProposal);
  },

  async decide(proposalId: string, approve: boolean, note?: string): Promise<'approved' | 'rejected'> {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase.rpc('decide_schedule_proposal', {
      p_proposal_id: proposalId,
      p_approve: approve,
      p_note: note ?? null,
    });

    if (error) throw new Error(error.message);

    return (data as { outcome: 'approved' | 'rejected' }).outcome;
  },

  // What has actually been changed, newest first. Read-only for everybody: the
  // table grants no INSERT, UPDATE or DELETE to authenticated at all.
  async getChanges(limit = 50): Promise<ScheduleChange[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('schedule_changes')
      .select(`
        *,
        staff:staff_profiles(*, position:staff_positions(*)),
        outlet:outlets(*)
      `)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(transformScheduleChange);
  },
};

export const PROOF_BUCKET = 'task-proofs';

// Task Completion Proofs API
export const taskCompletionProofsAPI = {
  // Uploads the evidence and records it.
  //
  // Paths are <organization_id>/<assignment_id>/<file>, because the storage
  // policies match the first path segment against the caller's organization
  // claim. There is deliberately no update or delete policy on the bucket, so
  // proof cannot be swapped out or removed from a client session after the fact.
  async upload(assignmentId: string, file: File): Promise<TaskCompletionProof> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const organizationId = await requireOrganizationId();
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${organizationId}/${assignmentId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(`Could not upload proof: ${uploadError.message}`);

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('task_completion_proofs')
      .insert({
        assignment_id: assignmentId,
        file_path: path,
        file_type: file.type.startsWith('video/') ? 'video' : 'image',
        file_size: file.size,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return transformTaskCompletionProof(data);
  },

  // The bucket is private, so viewing proof needs a short-lived signed URL
  // rather than a public link.
  async getSignedUrl(filePath: string, expiresInSeconds = 3600): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data, error } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.error('Could not sign proof URL:', error);
      return null;
    }

    return data.signedUrl;
  },

  async getByAssignment(assignmentId: string): Promise<TaskCompletionProof[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('task_completion_proofs')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return data.map(transformTaskCompletionProof);
  },

  async create(proofData: Omit<TaskCompletionProof, 'id' | 'uploadedAt'>): Promise<TaskCompletionProof> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('task_completion_proofs')
      .insert({
        assignment_id: proofData.assignmentId,
        file_path: proofData.filePath,
        file_type: proofData.fileType,
        file_size: proofData.fileSize,
        created_by: proofData.createdBy,
      })
      .select()
      .single();

    if (error) throw error;

    return transformTaskCompletionProof(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('task_completion_proofs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Invitations API
export const invitationsAPI = {
  async getAll(): Promise<Invitation[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        outlet:outlets(*),
        created_by_user:users!invitations_created_by_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      throw new Error(`Failed to fetch invitations: ${error.message}`);
    }

    return data.map(transformInvitation);
  },

  async getByToken(token: string): Promise<PublicInvitation | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase
      .rpc('get_invitation_by_token', { p_token: token })
      .maybeSingle();

    if (error) {
      console.error('Error fetching invitation by token:', error);
      throw new Error(`Failed to fetch invitation: ${error.message}`);
    }

    return data ? transformPublicInvitation(data) : null;
  },

  async findPending(email: string, role: 'outlet' = 'outlet'): Promise<PublicInvitation | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase
      .rpc('find_pending_invitation', { p_email: email, p_role: role })
      .maybeSingle();

    if (error) {
      console.error('Error looking up invitation:', error);
      throw new Error(`Failed to look up invitation: ${error.message}`);
    }

    return data ? transformPublicInvitation(data) : null;
  },

  async create(invitationData: InvitationFormData & { createdBy: string }): Promise<Invitation> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    // Generate a unique token
    const token = crypto.randomUUID();
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: invitationData.email,
        role: invitationData.role,
        outlet_id: invitationData.outletId || null,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: invitationData.createdBy,
        organization_id: await requireOrganizationId(),
      })
      .select(`
        *,
        outlet:outlets(*),
        created_by_user:users!invitations_created_by_fkey(*)
      `)
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return transformInvitation(data);
  },

  // Returns false when the invitation was already redeemed or has expired. The
  // database enforces that, so two people racing the same link cannot both win.
  async markAsUsed(token: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase.rpc('mark_invitation_used', { p_token: token });

    if (error) {
      console.error('Error marking invitation as used:', error);
      throw new Error(`Failed to mark invitation as used: ${error.message}`);
    }

    return data === true;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invitation:', error);
      throw new Error(`Failed to delete invitation: ${error.message}`);
    }
  },
};

// Reschedule request functions
export const rescheduleAPI = {
  // Request reschedule for a task assignment
  requestReschedule: async (assignmentId: string, reason: string, requestedBy: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping reschedule request');
      return;
    }

    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'reschedule_requested',
          reschedule_requested_at: new Date().toISOString(),
          reschedule_reason: reason,
          reschedule_requested_by: requestedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        console.error('Error requesting reschedule:', error);
        throw new Error(`Failed to request reschedule: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in requestReschedule:', error);
      throw error;
    }
  },

  // Approve reschedule request (admin only)
  approveReschedule: async (assignmentId: string, newDueDate: Date, approvedBy: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping reschedule approval');
      return;
    }

    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'pending',
          due_date: toDateOnly(newDueDate),
          reschedule_approved_at: new Date().toISOString(),
          reschedule_approved_by: approvedBy,
          reschedule_new_due_date: newDueDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        console.error('Error approving reschedule:', error);
        throw new Error(`Failed to approve reschedule: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in approveReschedule:', error);
      throw error;
    }
  },

  // Reject reschedule request (admin only)
  rejectReschedule: async (assignmentId: string, rejectedBy: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping reschedule rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'pending',
          reschedule_approved_at: new Date().toISOString(),
          reschedule_approved_by: rejectedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        console.error('Error rejecting reschedule:', error);
        throw new Error(`Failed to reject reschedule: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in rejectReschedule:', error);
      throw error;
    }
  },

  // Get reschedule requests (admin only)
  getRescheduleRequests: async (): Promise<TaskAssignment[]> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty array');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          task:task_id (
            id,
            title,
            description,
            estimated_minutes,
            is_high_priority
          ),
          staff:staff_id (
            id,
            name,
            employee_id
          ),
          outlet:outlet_id (
            id,
            name
          )
        `)
        .eq('status', 'reschedule_requested')
        .order('reschedule_requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching reschedule requests:', error);
        throw new Error(`Failed to fetch reschedule requests: ${error.message}`);
      }

      return data?.map(transformTaskAssignment) || [];
    } catch (error: any) {
      console.error('Error in getRescheduleRequests:', error);
      throw error;
    }
  }
};

// Streak calculation functions.
//
// Streaks belong to roster members, so every id here is a staff_profiles.id.
// task_assignments.staff_id references the same table.
export const streakAPI = {
  // Check if a roster member had any tasks assigned on a given date
  hadTasksOnDate: async (staffId: string, date: Date): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false for task check');
      return false;
    }

    try {
      // assigned_date is a DATE, so compare it to one, not to an instant either
      // side of local midnight.
      const day = toDateOnly(date);

      const { data, error } = await supabase
        .from('task_assignments')
        .select('id')
        .eq('staff_id', staffId)
        .eq('assigned_date', day)
        .limit(1);

      if (error) throw error;

      return (data && data.length > 0) || false;
    } catch (error: any) {
      console.error('Error checking if user had tasks on date:', error);
      return false;
    }
  },

  // Does this roster member have anything already past its due date? A task that
  // is pending but not yet due does not count: the day is not over.
  hasOverdueTasks: async (staffId: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('status, due_date')
        .eq('staff_id', staffId)
        .in('status', ['pending', 'overdue']);

      if (error) throw error;

      const today = toDateOnly(new Date());

      return (data || []).some(task => {
        if (task.status === 'overdue') return true;
        return Boolean(task.due_date) && toDateOnly(parseDateOnly(task.due_date)) < today;
      });
    } catch (error: any) {
      console.error('Error checking overdue tasks:', error);
      return false; // Do not break a streak because a query failed.
    }
  },

  // Calculate current streak for a roster member
  calculateCurrentStreak: async (staffId: string): Promise<number> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning 0 for streak');
      return 0;
    }

    try {
      const { data: completedTasks, error } = await supabase
        .from('task_assignments')
        .select('completed_at')
        .eq('staff_id', staffId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      if (!completedTasks || completedTasks.length === 0) {
        return 0;
      }

      // Bin completions by the local calendar day they happened on. Binning by
      // the UTC day credits a task finished during a Manila closing shift after
      // midnight to the day before.
      const completedDates = new Set<string>();
      completedTasks.forEach(task => {
        if (task.completed_at) {
          completedDates.add(instantToLocalDate(task.completed_at));
        }
      });

      // Today is still in progress, so an empty today does not break a streak —
      // it just does not extend it yet. Counting from today unconditionally made
      // every streak read zero each morning until the first task was ticked off.
      const today = new Date();
      let cursor = completedDates.has(toDateOnly(today)) ? today : addDays(today, -1);

      let streak = 0;
      // Bounded so a clock skew cannot spin this forever.
      for (let i = 0; i < 365; i++) {
        if (!completedDates.has(toDateOnly(cursor))) break;
        streak++;
        cursor = addDays(cursor, -1);
      }

      return streak;
    } catch (error: any) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  },

  // Update a roster member's streak
  updateStreak: async (staffId: string, newStreak: number): Promise<void> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping streak update');
      return;
    }

    try {
      const { data: staffData, error: staffError } = await supabase
        .from('staff_profiles')
        .select('longest_streak')
        .eq('id', staffId)
        .single();

      if (staffError) throw staffError;

      const longestStreak = Math.max(staffData?.longest_streak || 0, newStreak);

      const { error } = await supabase
        .from('staff_profiles')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_clear_board_date: toDateOnly(new Date()),
        })
        .eq('id', staffId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating streak:', error);
      throw new Error(`Failed to update streak: ${error.message}`);
    }
  },

  // Check and update streak for a roster member
  checkAndUpdateStreak: async (staffId: string): Promise<number> => {
    try {
      const hasUnfinishedTasks = await streakAPI.hasOverdueTasks(staffId);

      if (hasUnfinishedTasks) {
        await streakAPI.updateStreak(staffId, 0);
        return 0;
      } else {
        const newStreak = await streakAPI.calculateCurrentStreak(staffId);
        await streakAPI.updateStreak(staffId, newStreak);
        return newStreak;
      }
    } catch (error: any) {
      console.error('Error checking and updating streak:', error);
      return 0;
    }
  },

  // Get streak data for a roster member
  getStreakData: async (staffId: string): Promise<{ currentStreak: number; longestStreak: number; lastClearBoardDate?: Date }> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning default streak data');
      return { currentStreak: 0, longestStreak: 0 };
    }

    try {
      const { data: staffData, error } = await supabase
        .from('staff_profiles')
        .select('current_streak, longest_streak, last_clear_board_date')
        .eq('id', staffId)
        .maybeSingle();

      if (error) throw error;

      return {
        currentStreak: staffData?.current_streak || 0,
        longestStreak: staffData?.longest_streak || 0,
        lastClearBoardDate: staffData?.last_clear_board_date
          ? parseDateOnly(staffData.last_clear_board_date)
          : undefined,
      };
    } catch (error: any) {
      console.error('Error getting streak data:', error);
      return { currentStreak: 0, longestStreak: 0 };
    }
  }
};
