export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
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
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  staffId: string;
  assignedDate: Date;
  dueDate: Date;
  status: 'pending' | 'completed' | 'overdue';
  completedAt?: Date;
  completionProof?: string; // URL to photo/video
  minutesDeducted?: number;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface TaskFormData {
  title: string;
  description: string;
  estimatedMinutes: number;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  scheduledDate?: Date;
}

export interface AssignmentFormData {
  taskId: string;
  staffId: string;
  dueDate: Date;
}
