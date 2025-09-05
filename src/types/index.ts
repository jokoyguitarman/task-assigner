export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'outlet';
  organizationId: string;
  isPrimaryAdmin?: boolean;
  currentStreak: number;
  longestStreak: number;
  lastClearBoardDate?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  staffId?: string;
  assignedDate: Date;
  dueDate: Date;
  outletId?: string;
  organizationId: string;
  status: 'pending' | 'completed' | 'overdue' | 'reschedule_requested';
  completedAt?: Date;
  completionProof?: string; // URL to photo/video
  minutesDeducted?: number;
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
  staff?: User;
  outlet?: Outlet;
}

export interface StaffWorkingHours {
  id: string;
  staffId: string;
  date: Date;
  totalMinutes: number;
  deductedMinutes: number;
  netMinutes: number;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface TaskFormData {
  title: string;
  description: string;
  estimatedMinutes: number;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  scheduledDate?: Date;
  isHighPriority: boolean;
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
  userId?: string; // Link to auth.users for outlet login
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  // Login credentials for outlet access
  username?: string;
  password?: string;
}

export interface StaffProfile {
  id: string;
  userId: string;
  positionId: string;
  employeeId: string;
  hireDate: Date;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  // Login credentials for staff access
  username?: string;
  password?: string;
  // Populated fields
  user?: User;
  position?: StaffPosition;
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
  email: string;
  phone?: string;
  positionId: string;
  customPositionName?: string;
  customPositionDescription?: string;
  employeeId?: string;
  hireDate: Date;
  username?: string;
  password?: string;
}

export interface OutletFormData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  username?: string;
  password?: string;
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
export interface Invitation {
  id: string;
  email: string;
  role: 'staff' | 'outlet';
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

export interface InvitationFormData {
  email: string;
  role: 'staff' | 'outlet';
  outletId?: string;
}

export interface SignupFormData {
  name: string;
  password: string;
  confirmPassword: string;
  role: 'staff' | 'outlet';
  outletId?: string;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  subscriptionTier: 'free' | 'standard' | 'professional';
  subscriptionStatus: 'active' | 'trial' | 'expired';
  maxAdmins: number;
  maxRestaurants: number;
  maxEmployees: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TierLimits {
  maxAdmins: number;
  maxRestaurants: number;
  maxEmployees: number;
  currentAdmins: number;
  currentRestaurants: number;
  currentEmployees: number;
  subscriptionTier: string;
}

export interface UsageStats {
  adminsUsed: number;
  adminsMax: number;
  restaurantsUsed: number;
  restaurantsMax: number;
  employeesUsed: number;
  employeesMax: number;
  subscriptionTier: string;
}

export interface RestaurantSignupData {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}
