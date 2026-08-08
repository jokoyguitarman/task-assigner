// A principal: someone who signs in. There are exactly two kinds.
//
//   admin  - the owner, sees the whole organization
//   outlet - a branch, signing in on the shared store phone, sees itself
//
// Staff are NOT principals. They are roster entries (see StaffProfile) that own
// and complete tasks but never log in.
export interface User {
  id: string;
  email: string;
  name: string;
  role: PrincipalRole;
  organizationId: string;
  isPrimaryAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PrincipalRole = 'admin' | 'outlet';

// Stamped into the access token by the custom_access_token_hook and enforced by
// row-level security. This is the authoritative answer to who the caller is;
// anything derived from user_metadata is client-supplied and must not be trusted.
export interface AuthClaims {
  role?: PrincipalRole;
  organizationId?: string;
  outletId?: string;
}

// The business names its shifts once; each branch says which it runs and when.
// A shift whose end is not after its start runs past midnight, which is ordinary
// for a closing shift and means the deadline lands on the following day.
export interface ShiftDefinition {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
}

export interface Area {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
}

export interface OutletShift {
  id: string;
  outletId: string;
  shiftId: string;
  startsAt: string; // HH:MM
  endsAt: string;   // HH:MM
  shift?: ShiftDefinition;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  scheduledDate?: Date;
  isHighPriority: boolean;
  // Which shift the work belongs to, and which checklist it appears in. Both are
  // required: together they decide where and when the task lands.
  shiftId: string;
  areaId: string;
  // When set, this exact time wins at every branch instead of the shift's end.
  dueTimeOverride?: string; // HH:MM
  // Empty means every branch that runs the shift and has the area.
  outletIds?: string[];
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID
  // Populated fields
  shift?: ShiftDefinition;
  area?: Area;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  staffId?: string; // References StaffProfile, not User
  assignedDate: Date;
  dueDate: Date;
  dueTime?: string; // HH:MM, local to the organization timezone
  outletId?: string;
  organizationId: string;
  status: 'pending' | 'completed' | 'overdue' | 'reschedule_requested';
  completedAt?: Date;
  completionProof?: string; // URL to photo/video
  completionNotes?: string;
  // The store phone is shared, so whoever completed the task picks their name
  // from the roster. That is a different fact from who it was assigned to.
  completedByStaffId?: string;
  minutesDeducted?: number;
  // Write-only. Send it with a change of staffId; the database moves it into the
  // reassignment history and clears it, so it always reads back empty. A branch
  // must supply one to take work off someone who already owns it.
  reassignmentReason?: string;
  // Reschedule request fields
  rescheduleRequestedAt?: Date;
  rescheduleReason?: string;
  rescheduleRequestedBy?: string; // Staff member who requested reschedule
  rescheduleApprovedAt?: Date;
  rescheduleApprovedBy?: string; // Admin who approved reschedule
  rescheduleNewDueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  task?: Task;
  staff?: StaffProfile;
  outlet?: Outlet;
}

// Every change of ownership on an assignment, written by the database rather than
// the client so it cannot be edited or removed afterwards. The reason is required
// when a branch takes work off someone, and optional when the owner reassigns.
export interface Reassignment {
  id: string;
  assignmentId: string;
  fromStaffId?: string;
  toStaffId?: string;
  reason?: string;
  reassignedBy?: string;
  reassignedAt: Date;
  fromStaff?: StaffProfile;
  toStaff?: StaffProfile;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  // Outlet-specific data
  currentOutlet?: Outlet | null;
  isOutletUser: boolean;
  // Organization data
  organization?: Organization | null;
  // Signed in, but no profile row yet: a new owner who has not created their
  // organization, or an invited branch that has not redeemed its invitation.
  // Until this is resolved the access token carries no claims and row-level
  // security denies everything, so the app must route to setup rather than
  // render an empty dashboard.
  needsSetup: boolean;
  refreshIdentity: () => Promise<void>;
}

export interface TaskFormData {
  title: string;
  description: string;
  estimatedMinutes: number;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  scheduledDate?: Date;
  isHighPriority: boolean;
  shiftId: string;
  areaId: string;
  dueTimeOverride?: string;
  outletIds?: string[];
}

export interface AssignmentFormData {
  taskId: string;
  staffId?: string;
  dueDate: Date;
  dueTime?: string;
  outletId?: string;
}

// Staff Management Types
export interface StaffPosition {
  id: string;
  name: string;
  description?: string;
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
}

export interface Outlet {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  userId?: string; // The auth account this branch signs in with, if provisioned
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
}

// A roster entry. Owns and completes tasks, but has no login and no auth
// account: the name is stored here rather than reached through a users row.
export interface StaffProfile {
  id: string;
  name: string;
  positionId: string;
  employeeId: string;
  hireDate: Date;
  outletId?: string; // The branch this person works at
  organizationId: string;
  isActive: boolean;
  currentStreak: number;
  longestStreak: number;
  lastClearBoardDate?: Date;
  createdAt: Date;
  // Populated fields
  position?: StaffPosition;
  outlet?: Outlet;
}

export interface MonthlySchedule {
  id: string;
  staffId: string;
  month: number; // 1-12
  year: number;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  // Populated fields
  staff?: StaffProfile;
  dailySchedules?: DailySchedule[];
}

export interface DailySchedule {
  id: string;
  monthlyScheduleId: string;
  scheduleDate: Date;
  outletId: string;
  organizationId: string;
  timeIn?: string; // HH:MM format
  timeOut?: string; // HH:MM format
  isDayOff: boolean;
  dayOffType?: 'vacation' | 'sick' | 'personal' | 'other';
  notes?: string;
  createdAt: Date;
  // Populated fields
  outlet?: Outlet;
}

export interface TaskCompletionProof {
  id: string;
  assignmentId: string;
  filePath: string;
  fileType: 'image' | 'video';
  fileSize?: number;
  uploadedAt: Date;
  createdBy: string;
}

// Form Data Types
export interface StaffEnrollmentFormData {
  name: string;
  positionId: string;
  customPositionName?: string;
  customPositionDescription?: string;
  employeeId?: string;
  hireDate: Date;
  outletId?: string;
}

export interface OutletFormData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: string;
}

export interface DailyScheduleFormData {
  scheduleDate: Date;
  outletId: string;
  timeIn?: string;
  timeOut?: string;
  isDayOff: boolean;
  dayOffType?: string;
  notes?: string;
}

// Invitation System Types
//
// Invitations only ever provision branch logins now. Staff are enrolled onto the
// roster by the owner or the branch and never receive one.
export interface Invitation {
  id: string;
  email: string;
  role: 'outlet';
  outletId?: string;
  organizationId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  outlet?: Outlet;
  createdByUser?: User;
}

// What an invitee can see before they have an account. The invitations table is
// not readable pre-auth; this comes back from the get_invitation_by_token and
// find_pending_invitation RPCs, which return only these fields.
export interface PublicInvitation {
  id: string;
  email: string;
  role: 'outlet';
  outletId?: string;
  organizationId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  outletName?: string;
}

export interface InvitationFormData {
  email: string;
  role: 'outlet';
  outletId?: string;
}

export interface SignupFormData {
  name: string;
  password: string;
  confirmPassword: string;
  outletId?: string;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  // IANA zone. Defines when "today" ends for a restaurant whose day runs past
  // midnight, and when the daily digest fires.
  timezone: string;
  subscriptionTier: 'free' | 'standard' | 'professional';
  subscriptionStatus: 'active' | 'trial' | 'expired';
  maxAdmins: number;
  maxRestaurants: number;
  maxEmployees: number;
  createdAt: Date;
  updatedAt: Date;
}

// TierLimits and UsageStats live in services/tierLimitsService.ts, in the
// snake_case shape the RPCs actually return. Camel-cased copies used to sit here
// as well and matched nothing that came back from the database.

export interface RestaurantSignupData {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}
