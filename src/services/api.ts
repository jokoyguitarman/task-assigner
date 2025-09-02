import axios from 'axios';
import { User, Task, TaskAssignment, StaffWorkingHours } from '../types';

// Mock data storage - replace with actual API endpoints
let mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@taskassigner.com',
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    email: 'staff1@taskassigner.com',
    name: 'Staff Member 1',
    role: 'staff',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    email: 'staff2@taskassigner.com',
    name: 'Staff Member 2',
    role: 'staff',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockTasks: Task[] = [];
let mockAssignments: TaskAssignment[] = [];
let mockWorkingHours: StaffWorkingHours[] = [];

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

export default api;
