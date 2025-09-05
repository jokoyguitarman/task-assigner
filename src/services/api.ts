import axios from 'axios';
import { 
  User, Task, TaskAssignment, StaffWorkingHours, 
  StaffPosition, Outlet, StaffProfile, MonthlySchedule, 
  DailySchedule, TaskCompletionProof,
  StaffEnrollmentFormData, OutletFormData, DailyScheduleFormData 
} from '../types';

// Mock data storage - replace with actual API endpoints
let mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@taskassigner.com',
    name: 'Admin User',
    role: 'admin',
    organizationId: '00000000-0000-0000-0000-000000000001',
    currentStreak: 0,
    longestStreak: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    email: 'staff1@taskassigner.com',
    name: 'Staff Member 1',
    role: 'staff',
    organizationId: '00000000-0000-0000-0000-000000000001',
    currentStreak: 0,
    longestStreak: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    email: 'staff2@taskassigner.com',
    name: 'Staff Member 2',
    role: 'staff',
    organizationId: '00000000-0000-0000-0000-000000000001',
    currentStreak: 0,
    longestStreak: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockTasks: Task[] = [];
let mockAssignments: TaskAssignment[] = [];
let mockWorkingHours: StaffWorkingHours[] = [];

// New mock data for staff management
let mockStaffPositions: StaffPosition[] = [
  { id: '1', name: 'Manager', description: 'Oversees operations', isCustom: false, createdAt: new Date() },
  { id: '2', name: 'Supervisor', description: 'Supervises staff', isCustom: false, createdAt: new Date() },
  { id: '3', name: 'Cashier', description: 'Handles transactions', isCustom: false, createdAt: new Date() },
  { id: '4', name: 'Cook/Chef', description: 'Prepares food', isCustom: false, createdAt: new Date() },
  { id: '5', name: 'Server/Waiter', description: 'Serves customers', isCustom: false, createdAt: new Date() },
  { id: '6', name: 'Cleaner/Janitor', description: 'Maintains cleanliness', isCustom: false, createdAt: new Date() },
  { id: '7', name: 'Security', description: 'Ensures safety', isCustom: false, createdAt: new Date() },
];

let mockOutlets: Outlet[] = [
  { id: '1', name: 'Main Branch', address: '123 Main St', phone: '+1234567890', organizationId: '00000000-0000-0000-0000-000000000001', isActive: true, createdAt: new Date() },
  { id: '2', name: 'Downtown Branch', address: '456 Downtown Ave', phone: '+1234567891', organizationId: '00000000-0000-0000-0000-000000000001', isActive: true, createdAt: new Date() },
];

let mockStaffProfiles: StaffProfile[] = [];
let mockMonthlySchedules: MonthlySchedule[] = [];
let mockDailySchedules: DailySchedule[] = [];
let mockTaskCompletionProofs: TaskCompletionProof[] = [];

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<User> => {
    // Mock authentication - replace with actual API call
    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  },
};

// Users API
export const usersAPI = {
  getAll: async (): Promise<User[]> => {
    return mockUsers.filter(user => user.role === 'staff');
  },
  getById: async (id: string): Promise<User> => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    return user;
  },
};

// Tasks API
export const tasksAPI = {
  getAll: async (): Promise<Task[]> => {
    return mockTasks;
  },
  getById: async (id: string): Promise<Task> => {
    const task = mockTasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found');
    return task;
  },
  create: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockTasks.push(newTask);
    return newTask;
  },
  update: async (id: string, updates: Partial<Task>): Promise<Task> => {
    const taskIndex = mockTasks.findIndex(t => t.id === id);
    if (taskIndex === -1) throw new Error('Task not found');
    
    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...updates,
      updatedAt: new Date(),
    };
    return mockTasks[taskIndex];
  },
  delete: async (id: string): Promise<void> => {
    const taskIndex = mockTasks.findIndex(t => t.id === id);
    if (taskIndex === -1) throw new Error('Task not found');
    mockTasks.splice(taskIndex, 1);
  },
};

// Assignments API
export const assignmentsAPI = {
  getAll: async (): Promise<TaskAssignment[]> => {
    return mockAssignments;
  },
  getByStaff: async (staffId: string): Promise<TaskAssignment[]> => {
    return mockAssignments.filter(a => a.staffId === staffId);
  },
  getById: async (id: string): Promise<TaskAssignment> => {
    const assignment = mockAssignments.find(a => a.id === id);
    if (!assignment) throw new Error('Assignment not found');
    return assignment;
  },
  create: async (assignment: Omit<TaskAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskAssignment> => {
    const newAssignment: TaskAssignment = {
      ...assignment,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAssignments.push(newAssignment);
    return newAssignment;
  },
  update: async (id: string, updates: Partial<TaskAssignment>): Promise<TaskAssignment> => {
    const assignmentIndex = mockAssignments.findIndex(a => a.id === id);
    if (assignmentIndex === -1) throw new Error('Assignment not found');
    
    mockAssignments[assignmentIndex] = {
      ...mockAssignments[assignmentIndex],
      ...updates,
      updatedAt: new Date(),
    };
    return mockAssignments[assignmentIndex];
  },
  delete: async (id: string): Promise<void> => {
    const assignmentIndex = mockAssignments.findIndex(a => a.id === id);
    if (assignmentIndex === -1) throw new Error('Assignment not found');
    mockAssignments.splice(assignmentIndex, 1);
  },
  complete: async (id: string, proofUrl: string): Promise<TaskAssignment> => {
    const assignment = await assignmentsAPI.getById(id);
    const task = await tasksAPI.getById(assignment.taskId);
    
    const now = new Date();
    const isOverdue = now > assignment.dueDate;
    
    return assignmentsAPI.update(id, {
      status: 'completed',
      completedAt: now,
      completionProof: proofUrl,
      minutesDeducted: isOverdue ? task.estimatedMinutes : 0,
    });
  },
};

// Working Hours API
export const workingHoursAPI = {
  getByStaff: async (staffId: string, date: Date): Promise<StaffWorkingHours | null> => {
    const dateStr = date.toISOString().split('T')[0];
    return mockWorkingHours.find(wh => 
      wh.staffId === staffId && 
      wh.date.toISOString().split('T')[0] === dateStr
    ) || null;
  },
  create: async (workingHours: Omit<StaffWorkingHours, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffWorkingHours> => {
    const newWorkingHours: StaffWorkingHours = {
      ...workingHours,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockWorkingHours.push(newWorkingHours);
    return newWorkingHours;
  },
  update: async (id: string, updates: Partial<StaffWorkingHours>): Promise<StaffWorkingHours> => {
    const workingHoursIndex = mockWorkingHours.findIndex(wh => wh.id === id);
    if (workingHoursIndex === -1) throw new Error('Working hours not found');
    
    mockWorkingHours[workingHoursIndex] = {
      ...mockWorkingHours[workingHoursIndex],
      ...updates,
      updatedAt: new Date(),
    };
    return mockWorkingHours[workingHoursIndex];
  },
};

// Staff Positions API
export const staffPositionsAPI = {
  getAll: async (): Promise<StaffPosition[]> => {
    return mockStaffPositions;
  },
  getById: async (id: string): Promise<StaffPosition> => {
    const position = mockStaffPositions.find(p => p.id === id);
    if (!position) throw new Error('Position not found');
    return position;
  },
  create: async (position: Omit<StaffPosition, 'id' | 'createdAt'>): Promise<StaffPosition> => {
    const newPosition: StaffPosition = {
      ...position,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    mockStaffPositions.push(newPosition);
    return newPosition;
  },
  update: async (id: string, updates: Partial<StaffPosition>): Promise<StaffPosition> => {
    const positionIndex = mockStaffPositions.findIndex(p => p.id === id);
    if (positionIndex === -1) throw new Error('Position not found');
    
    mockStaffPositions[positionIndex] = {
      ...mockStaffPositions[positionIndex],
      ...updates,
    };
    return mockStaffPositions[positionIndex];
  },
  delete: async (id: string): Promise<void> => {
    const positionIndex = mockStaffPositions.findIndex(p => p.id === id);
    if (positionIndex === -1) throw new Error('Position not found');
    mockStaffPositions.splice(positionIndex, 1);
  },
};

// Outlets API
export const outletsAPI = {
  getAll: async (): Promise<Outlet[]> => {
    return mockOutlets.filter(outlet => outlet.isActive);
  },
  getById: async (id: string): Promise<Outlet> => {
    const outlet = mockOutlets.find(o => o.id === id);
    if (!outlet) throw new Error('Outlet not found');
    return outlet;
  },
  create: async (outlet: Omit<Outlet, 'id' | 'createdAt'>): Promise<Outlet> => {
    const newOutlet: Outlet = {
      ...outlet,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    mockOutlets.push(newOutlet);
    return newOutlet;
  },
  update: async (id: string, updates: Partial<Outlet>): Promise<Outlet> => {
    const outletIndex = mockOutlets.findIndex(o => o.id === id);
    if (outletIndex === -1) throw new Error('Outlet not found');
    
    mockOutlets[outletIndex] = {
      ...mockOutlets[outletIndex],
      ...updates,
    };
    return mockOutlets[outletIndex];
  },
  delete: async (id: string): Promise<void> => {
    const outletIndex = mockOutlets.findIndex(o => o.id === id);
    if (outletIndex === -1) throw new Error('Outlet not found');
    mockOutlets[outletIndex].isActive = false;
  },
};

// Staff Profiles API
export const staffProfilesAPI = {
  getAll: async (): Promise<StaffProfile[]> => {
    return mockStaffProfiles.map(profile => ({
      ...profile,
      user: mockUsers.find(u => u.id === profile.userId),
      position: mockStaffPositions.find(p => p.id === profile.positionId),
    }));
  },
  getById: async (id: string): Promise<StaffProfile> => {
    const profile = mockStaffProfiles.find(p => p.id === id);
    if (!profile) throw new Error('Staff profile not found');
    return {
      ...profile,
      user: mockUsers.find(u => u.id === profile.userId),
      position: mockStaffPositions.find(p => p.id === profile.positionId),
    };
  },
  create: async (profile: Omit<StaffProfile, 'id' | 'createdAt'>): Promise<StaffProfile> => {
    const newProfile: StaffProfile = {
      ...profile,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    mockStaffProfiles.push(newProfile);
    return newProfile;
  },
  update: async (id: string, updates: Partial<StaffProfile>): Promise<StaffProfile> => {
    const profileIndex = mockStaffProfiles.findIndex(p => p.id === id);
    if (profileIndex === -1) throw new Error('Staff profile not found');
    
    mockStaffProfiles[profileIndex] = {
      ...mockStaffProfiles[profileIndex],
      ...updates,
    };
    return mockStaffProfiles[profileIndex];
  },
  delete: async (id: string): Promise<void> => {
    const profileIndex = mockStaffProfiles.findIndex(p => p.id === id);
    if (profileIndex === -1) throw new Error('Staff profile not found');
    mockStaffProfiles[profileIndex].isActive = false;
  },
};

// Monthly Schedules API
export const monthlySchedulesAPI = {
  getByMonth: async (month: number, year: number): Promise<MonthlySchedule[]> => {
    return mockMonthlySchedules
      .filter(schedule => schedule.month === month && schedule.year === year)
      .map(schedule => ({
        ...schedule,
        staff: mockStaffProfiles.find(s => s.id === schedule.staffId),
        dailySchedules: mockDailySchedules.filter(ds => ds.monthlyScheduleId === schedule.id),
      }));
  },
  getByStaff: async (staffId: string, month: number, year: number): Promise<MonthlySchedule | null> => {
    const schedule = mockMonthlySchedules.find(s => 
      s.staffId === staffId && s.month === month && s.year === year
    );
    if (!schedule) return null;
    
    return {
      ...schedule,
      staff: mockStaffProfiles.find(s => s.id === schedule.staffId),
      dailySchedules: mockDailySchedules.filter(ds => ds.monthlyScheduleId === schedule.id),
    };
  },
  create: async (schedule: Omit<MonthlySchedule, 'id' | 'createdAt'>): Promise<MonthlySchedule> => {
    const newSchedule: MonthlySchedule = {
      ...schedule,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    mockMonthlySchedules.push(newSchedule);
    return newSchedule;
  },
  update: async (id: string, updates: Partial<MonthlySchedule>): Promise<MonthlySchedule> => {
    const scheduleIndex = mockMonthlySchedules.findIndex(s => s.id === id);
    if (scheduleIndex === -1) throw new Error('Monthly schedule not found');
    
    mockMonthlySchedules[scheduleIndex] = {
      ...mockMonthlySchedules[scheduleIndex],
      ...updates,
    };
    return mockMonthlySchedules[scheduleIndex];
  },
};

// Daily Schedules API
export const dailySchedulesAPI = {
  getByMonthlySchedule: async (monthlyScheduleId: string): Promise<DailySchedule[]> => {
    return mockDailySchedules
      .filter(ds => ds.monthlyScheduleId === monthlyScheduleId)
      .map(ds => ({
        ...ds,
        outlet: mockOutlets.find(o => o.id === ds.outletId),
      }));
  },
  create: async (schedule: Omit<DailySchedule, 'id' | 'createdAt'>): Promise<DailySchedule> => {
    const newSchedule: DailySchedule = {
      ...schedule,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    mockDailySchedules.push(newSchedule);
    return newSchedule;
  },
  update: async (id: string, updates: Partial<DailySchedule>): Promise<DailySchedule> => {
    const scheduleIndex = mockDailySchedules.findIndex(ds => ds.id === id);
    if (scheduleIndex === -1) throw new Error('Daily schedule not found');
    
    mockDailySchedules[scheduleIndex] = {
      ...mockDailySchedules[scheduleIndex],
      ...updates,
    };
    return mockDailySchedules[scheduleIndex];
  },
  delete: async (id: string): Promise<void> => {
    const scheduleIndex = mockDailySchedules.findIndex(ds => ds.id === id);
    if (scheduleIndex === -1) throw new Error('Daily schedule not found');
    mockDailySchedules.splice(scheduleIndex, 1);
  },
};

// Task Completion Proofs API
export const taskCompletionProofsAPI = {
  getByAssignment: async (assignmentId: string): Promise<TaskCompletionProof[]> => {
    return mockTaskCompletionProofs.filter(proof => proof.assignmentId === assignmentId);
  },
  create: async (proof: Omit<TaskCompletionProof, 'id' | 'uploadedAt'>): Promise<TaskCompletionProof> => {
    const newProof: TaskCompletionProof = {
      ...proof,
      id: Date.now().toString(),
      uploadedAt: new Date(),
    };
    mockTaskCompletionProofs.push(newProof);
    return newProof;
  },
  delete: async (id: string): Promise<void> => {
    const proofIndex = mockTaskCompletionProofs.findIndex(p => p.id === id);
    if (proofIndex === -1) throw new Error('Task completion proof not found');
    mockTaskCompletionProofs.splice(proofIndex, 1);
  },
};

// Export mock data for hybrid API
export { mockUsers, mockTasks, mockAssignments, mockWorkingHours };

export default api;
