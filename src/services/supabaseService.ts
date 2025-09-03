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
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
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

const transformDailySchedule = (row: any): DailySchedule => ({
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
});

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

    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: taskData.title,
        description: taskData.description,
        estimated_minutes: taskData.estimatedMinutes,
        created_by: taskData.createdBy,
        updated_at: new Date().toISOString(),
      })
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

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

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
    if (assignmentData.staffId !== undefined) updateData.staff_id = assignmentData.staffId;
    if (assignmentData.assignedDate) updateData.assigned_date = assignmentData.assignedDate.toISOString();
    if (assignmentData.dueDate) updateData.due_date = assignmentData.dueDate.toISOString();
    if (assignmentData.outletId !== undefined) updateData.outlet_id = assignmentData.outletId;
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

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('outlets')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
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

    const { data, error } = await supabase
      .from('daily_schedules')
      .insert({
        monthly_schedule_id: scheduleData.monthlyScheduleId,
        schedule_date: scheduleData.scheduleDate.toISOString(),
        outlet_id: scheduleData.outletId,
        time_in: scheduleData.timeIn,
        time_out: scheduleData.timeOut,
        is_day_off: scheduleData.isDayOff,
        day_off_type: scheduleData.dayOffType,
        notes: scheduleData.notes,
      })
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
    if (scheduleData.scheduleDate) updateData.schedule_date = scheduleData.scheduleDate.toISOString();
    if (scheduleData.outletId) updateData.outlet_id = scheduleData.outletId;
    if (scheduleData.timeIn) updateData.time_in = scheduleData.timeIn;
    if (scheduleData.timeOut) updateData.time_out = scheduleData.timeOut;
    if (scheduleData.isDayOff !== undefined) updateData.is_day_off = scheduleData.isDayOff;
    if (scheduleData.dayOffType) updateData.day_off_type = scheduleData.dayOffType;
    if (scheduleData.notes) updateData.notes = scheduleData.notes;

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
