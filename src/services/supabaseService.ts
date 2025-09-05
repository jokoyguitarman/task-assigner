import { supabase } from '../lib/supabase';
import { 
  User, Task, TaskAssignment, StaffWorkingHours, 
  StaffPosition, Outlet, StaffProfile, MonthlySchedule, 
  DailySchedule, TaskCompletionProof, Invitation, InvitationFormData
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
  currentStreak: row.current_streak || 0,
  longestStreak: row.longest_streak || 0,
  lastClearBoardDate: row.last_clear_board_date ? new Date(row.last_clear_board_date) : undefined,
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
  scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : undefined,
  isHighPriority: row.is_high_priority || false,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const transformTaskAssignment = (row: any): TaskAssignment => ({
  id: row.id,
  taskId: row.task_id,
  staffId: row.staff_id || undefined,
  assignedDate: new Date(row.assigned_date),
  dueDate: new Date(row.due_date),
  outletId: row.outlet_id || undefined,
  status: row.status,
  completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  completionProof: row.completion_proof,
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
  // Populated fields
  task: row.task ? transformTask(row.task) : undefined,
  staff: row.staff ? transformUser(row.staff) : undefined,
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
  isActive: row.is_active,
  createdAt: new Date(row.created_at),
  username: row.username,
  password: row.password,
});

const transformStaffProfile = (row: any): StaffProfile => ({
  id: row.id,
  userId: row.user_id,
  positionId: row.position_id,
  employeeId: row.employee_id,
  hireDate: new Date(row.hire_date),
  isActive: row.is_active,
  createdAt: new Date(row.created_at),
  user: row.user ? transformUser(row.user) : undefined,
  position: row.position ? transformStaffPosition(row.position) : undefined,
});

const transformMonthlySchedule = (row: any): MonthlySchedule => ({
  id: row.id,
  staffId: row.staff_id,
  month: row.month,
  year: row.year,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  staff: row.staff ? transformStaffProfile(row.staff) : undefined,
  dailySchedules: row.daily_schedules ? row.daily_schedules.map(transformDailySchedule) : [],
});

const transformDailySchedule = (row: any): DailySchedule => {
  const transformed = {
    id: row.id,
    monthlyScheduleId: row.monthly_schedule_id,
    scheduleDate: new Date(row.schedule_date),
    outletId: row.outlet_id,
    timeIn: row.time_in,
    timeOut: row.time_out,
    isDayOff: row.is_day_off,
    dayOffType: row.day_off_type,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    outlet: row.outlet ? transformOutlet(row.outlet) : undefined,
  };
  
  // Debug logging for outlet assignments
  if (row.outlet_id) {
    console.log(`🔄 transformDailySchedule - Schedule ${row.id} has outlet ${row.outlet_id}`, {
      outletId: transformed.outletId,
      outletName: transformed.outlet?.name || 'No outlet name',
      outletData: row.outlet
    });
  }
  
  return transformed;
};

const transformTaskCompletionProof = (row: any): TaskCompletionProof => ({
  id: row.id,
  assignmentId: row.assignment_id,
  filePath: row.file_url,
  fileType: row.file_type,
  fileSize: row.file_size,
  uploadedAt: new Date(row.uploaded_at),
  createdBy: row.created_by || row.assignment_id, // Use assignment_id as fallback
});

const transformInvitation = (row: any): Invitation => ({
  id: row.id,
  email: row.email,
  role: row.role,
  outletId: row.outlet_id || undefined,
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

    // Get user profile
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If user profile doesn't exist, create it
    if (userError && userError.code === 'PGRST116') {
      // Create a default user profile
      const { data: newUserData, error: createError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          role: 'admin', // Default to admin for now, you might want to make this configurable
        })
        .select()
        .single();

      if (createError) throw createError;
      userData = newUserData;
    } else if (userError) {
      throw userError;
    }

    console.log('🔍 Final user data from database:', userData);
    console.log('🔍 Transformed user:', transformUser(userData));
    return transformUser(userData);
  },

  async signup(email: string, password: string, name: string, role: 'admin' | 'staff'): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: data.user?.id,
        email,
        name,
        role,
      })
      .select()
      .single();

    if (userError) throw userError;

    return transformUser(userData);
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    await supabase.auth.signOut();
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
      .single();

    if (error) return null;

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

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        current_streak: userData.currentStreak,
        longest_streak: userData.longestStreak,
        last_clear_board_date: userData.lastClearBoardDate?.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    return transformUser(data);
  },

  async update(id: string, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformUser(data);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
      .select('*')
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
      .select('*')
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
        scheduled_date: taskData.scheduledDate,
        is_high_priority: taskData.isHighPriority,
        created_by: taskData.createdBy,
      })
      .select()
      .single();

    if (error) throw error;

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
    if (taskData.scheduledDate !== undefined) updateData.scheduled_date = taskData.scheduledDate;
    if (taskData.isHighPriority !== undefined) updateData.is_high_priority = taskData.isHighPriority;
    if (taskData.createdBy !== undefined) updateData.created_by = taskData.createdBy;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

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
          email
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
        assigned_date: assignmentData.assignedDate.toISOString(),
        due_date: assignmentData.dueDate.toISOString(),
        outlet_id: assignmentData.outletId || null,
        status: assignmentData.status,
        completed_at: assignmentData.completedAt?.toISOString(),
        completion_proof: assignmentData.completionProof,
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
    if (assignmentData.assignedDate) updateData.assigned_date = assignmentData.assignedDate.toISOString();
    if (assignmentData.dueDate) updateData.due_date = assignmentData.dueDate.toISOString();
    if (assignmentData.outletId !== undefined) updateData.outlet_id = assignmentData.outletId || null;
    if (assignmentData.status) updateData.status = assignmentData.status;
    if (assignmentData.completedAt) updateData.completed_at = assignmentData.completedAt.toISOString();
    if (assignmentData.completionProof) updateData.completion_proof = assignmentData.completionProof;
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

  async complete(id: string, completionProof?: string): Promise<TaskAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_proof: completionProof,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return transformTaskAssignment(data);
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

    const { data, error } = await supabase
      .from('outlets')
      .insert({
        name: outletData.name,
        address: outletData.address,
        phone: outletData.phone,
        email: outletData.email,
        manager_id: outletData.managerId,
        is_active: outletData.isActive,
        username: outletData.username,
        password: outletData.password,
      })
      .select()
      .single();

    if (error) throw error;

    return transformOutlet(data);
  },

  async update(id: string, outletData: Partial<Omit<Outlet, 'id' | 'createdAt'>>): Promise<Outlet> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('outlets')
      .update({
        name: outletData.name,
        address: outletData.address,
        phone: outletData.phone,
        email: outletData.email,
        manager_id: outletData.managerId,
        is_active: outletData.isActive,
        username: outletData.username,
        password: outletData.password,
      })
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
export const staffProfilesAPI = {
  async getAll(): Promise<StaffProfile[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .select(`
        *,
        user:users(*),
        position:staff_positions(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(transformStaffProfile);
  },

  async getById(id: string): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .select(`
        *,
        user:users(*),
        position:staff_positions(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return transformStaffProfile(data);
  },

  async create(profileData: Omit<StaffProfile, 'id' | 'createdAt'>): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .insert({
        user_id: profileData.userId,
        position_id: profileData.positionId,
        employee_id: profileData.employeeId,
        hire_date: profileData.hireDate.toISOString(),
        is_active: profileData.isActive,
      })
      .select(`
        *,
        user:users(*),
        position:staff_positions(*)
      `)
      .single();

    if (error) throw error;

    return transformStaffProfile(data);
  },

  async update(id: string, profileData: Partial<Omit<StaffProfile, 'id' | 'createdAt'>>): Promise<StaffProfile> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const updateData: any = {};
    if (profileData.userId) updateData.user_id = profileData.userId;
    if (profileData.positionId) updateData.position_id = profileData.positionId;
    if (profileData.employeeId) updateData.employee_id = profileData.employeeId;
    if (profileData.hireDate) updateData.hire_date = profileData.hireDate.toISOString();
    if (profileData.isActive !== undefined) updateData.is_active = profileData.isActive;

    const { data, error } = await supabase
      .from('staff_profiles')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        user:users(*),
        position:staff_positions(*)
      `)
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
          user:users(*),
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
          user:users(*),
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
          user:users(*),
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

    const { data, error } = await supabase
      .from('monthly_schedules')
      .insert({
        staff_id: scheduleData.staffId,
        month: scheduleData.month,
        year: scheduleData.year,
        created_by: scheduleData.createdBy,
      })
      .select(`
        *,
        staff:staff_profiles(
          *,
          user:users(*),
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
          user:users(*),
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

    console.log('🔄 dailySchedulesAPI.create called with:', scheduleData);

    const insertData = {
      monthly_schedule_id: scheduleData.monthlyScheduleId,
      schedule_date: scheduleData.scheduleDate.toISOString(),
      outlet_id: scheduleData.outletId || null,
      time_in: scheduleData.timeIn,
      time_out: scheduleData.timeOut,
      is_day_off: scheduleData.isDayOff,
      day_off_type: scheduleData.dayOffType,
      notes: scheduleData.notes,
    };

    console.log('🔄 Insert data being sent to Supabase:', insertData);

    const { data, error } = await supabase
      .from('daily_schedules')
      .insert(insertData)
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

    console.log('🔄 dailySchedulesAPI.update called with:', { id, scheduleData });

    const updateData: any = {};
    if (scheduleData.monthlyScheduleId) updateData.monthly_schedule_id = scheduleData.monthlyScheduleId;
    if (scheduleData.scheduleDate) updateData.schedule_date = scheduleData.scheduleDate.toISOString();
    
    // Fix: Always update outlet_id, even if it's null/undefined/empty string
    if (scheduleData.hasOwnProperty('outletId')) {
      updateData.outlet_id = scheduleData.outletId || null;
    }
    
    if (scheduleData.timeIn) updateData.time_in = scheduleData.timeIn;
    if (scheduleData.timeOut) updateData.time_out = scheduleData.timeOut;
    if (scheduleData.isDayOff !== undefined) updateData.is_day_off = scheduleData.isDayOff;
    if (scheduleData.dayOffType) updateData.day_off_type = scheduleData.dayOffType;
    if (scheduleData.notes) updateData.notes = scheduleData.notes;

    console.log('🔄 Update data being sent to Supabase:', updateData);

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

// Task Completion Proofs API
export const taskCompletionProofsAPI = {
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
        file_url: proofData.filePath,
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

// Working Hours API (for backward compatibility)
export const workingHoursAPI = {
  async getAll(): Promise<StaffWorkingHours[]> {
    // This would need to be implemented based on your specific requirements
    // For now, returning empty array
    return [];
  },

  async getByStaff(staffId: string): Promise<StaffWorkingHours[]> {
    // This would need to be implemented based on your specific requirements
    // For now, returning empty array
    return [];
  },

  async create(workingHoursData: Omit<StaffWorkingHours, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffWorkingHours> {
    // This would need to be implemented based on your specific requirements
    throw new Error('Not implemented yet');
  },

  async update(id: string, workingHoursData: Partial<Omit<StaffWorkingHours, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StaffWorkingHours> {
    // This would need to be implemented based on your specific requirements
    throw new Error('Not implemented yet');
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

  async getByToken(token: string): Promise<Invitation | null> {
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
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No invitation found
      }
      console.error('Error fetching invitation by token:', error);
      throw new Error(`Failed to fetch invitation: ${error.message}`);
    }

    return transformInvitation(data);
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

  async markAsUsed(token: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please set environment variables.');
    }

    const { error } = await supabase
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      console.error('Error marking invitation as used:', error);
      throw new Error(`Failed to mark invitation as used: ${error.message}`);
    }
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
          due_date: newDueDate.toISOString(),
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
            email
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

// Streak calculation functions
export const streakAPI = {
  // Check if user had any tasks assigned on a given date
  hadTasksOnDate: async (userId: string, date: Date): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false for task check');
      return false;
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('task_assignments')
        .select('id')
        .eq('staff_id', userId)
        .gte('assigned_date', startOfDay.toISOString())
        .lte('assigned_date', endOfDay.toISOString())
        .limit(1);

      if (error) throw error;

      return (data && data.length > 0) || false;
    } catch (error: any) {
      console.error('Error checking if user had tasks on date:', error);
      return false;
    }
  },

  // Check if user has any pending or overdue tasks for a given date
  hasPendingOrOverdueTasks: async (userId: string, date: Date): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning false for streak check');
      return false;
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('task_assignments')
        .select('status, due_date')
        .eq('staff_id', userId)
        .or('status.eq.pending,status.eq.overdue');

      if (error) throw error;

      // Check if any tasks are overdue based on due date
      const hasOverdueTasks = data?.some(task => {
        if (task.status === 'overdue') return true;
        if (task.due_date && new Date(task.due_date) < endOfDay && task.status !== 'completed') {
          return true;
        }
        return false;
      });

      return hasOverdueTasks || false;
    } catch (error: any) {
      console.error('Error checking pending/overdue tasks:', error);
      return false; // Default to false to avoid breaking streaks
    }
  },

  // Calculate current streak for a user
  calculateCurrentStreak: async (userId: string): Promise<number> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning 0 for streak');
      return 0;
    }

    try {
      // For now, return 0 to avoid the 365-day bug
      // TODO: Implement proper streak calculation based on actual task completion history
      console.log('🔍 Calculating streak for user:', userId, '- returning 0 for now');
      return 0;
    } catch (error: any) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  },

  // Update user's streak
  updateStreak: async (userId: string, newStreak: number): Promise<void> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping streak update');
      return;
    }

    try {
      // Get current user data to check longest streak
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('longest_streak')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const longestStreak = Math.max(userData?.longest_streak || 0, newStreak);
      const lastClearBoardDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const { error } = await supabase
        .from('users')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_clear_board_date: lastClearBoardDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating streak:', error);
      throw new Error(`Failed to update streak: ${error.message}`);
    }
  },

  // Check and update streak for a user
  checkAndUpdateStreak: async (userId: string): Promise<number> => {
    try {
      const hasUnfinishedTasks = await streakAPI.hasPendingOrOverdueTasks(userId, new Date());
      
      if (hasUnfinishedTasks) {
        // User has unfinished tasks - reset streak
        await streakAPI.updateStreak(userId, 0);
        return 0;
      } else {
        // User cleared the board - calculate new streak
        const newStreak = await streakAPI.calculateCurrentStreak(userId);
        await streakAPI.updateStreak(userId, newStreak);
        return newStreak;
      }
    } catch (error: any) {
      console.error('Error checking and updating streak:', error);
      return 0;
    }
  },

  // Get streak data for a user
  getStreakData: async (userId: string): Promise<{ currentStreak: number; longestStreak: number; lastClearBoardDate?: Date }> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning default streak data');
      return { currentStreak: 0, longestStreak: 0 };
    }

    try {
      console.log('🔍 Getting streak data for user:', userId);
      
      // For now, always return 0 to avoid the 365-day bug
      // TODO: Implement proper streak data retrieval once database is properly set up
      console.log('🔍 Returning 0 for both streaks to avoid 365-day bug');
      return { currentStreak: 0, longestStreak: 0 };
    } catch (error: any) {
      console.error('Error getting streak data:', error);
      return { currentStreak: 0, longestStreak: 0 };
    }
  }
};
