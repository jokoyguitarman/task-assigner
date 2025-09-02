import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Using mock data.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (these should match your Supabase schema)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'admin' | 'staff';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          estimated_minutes: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          estimated_minutes: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          estimated_minutes?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_assignments: {
        Row: {
          id: string;
          task_id: string;
          staff_id: string;
          assigned_date: string;
          due_date: string;
          status: 'pending' | 'completed' | 'overdue';
          completed_at?: string;
          completion_proof?: string;
          minutes_deducted?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          staff_id: string;
          assigned_date: string;
          due_date: string;
          status?: 'pending' | 'completed' | 'overdue';
          completed_at?: string;
          completion_proof?: string;
          minutes_deducted?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          staff_id?: string;
          assigned_date?: string;
          due_date?: string;
          status?: 'pending' | 'completed' | 'overdue';
          completed_at?: string;
          completion_proof?: string;
          minutes_deducted?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_positions: {
        Row: {
          id: string;
          name: string;
          description?: string;
          is_custom: boolean;
          created_by?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          is_custom?: boolean;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          is_custom?: boolean;
          created_by?: string;
          created_at?: string;
        };
      };
      outlets: {
        Row: {
          id: string;
          name: string;
          address?: string;
          phone?: string;
          email?: string;
          manager_id?: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string;
          phone?: string;
          email?: string;
          manager_id?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          phone?: string;
          email?: string;
          manager_id?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      staff_profiles: {
        Row: {
          id: string;
          user_id: string;
          position_id: string;
          employee_id: string;
          hire_date: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          position_id: string;
          employee_id: string;
          hire_date: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          position_id?: string;
          employee_id?: string;
          hire_date?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      monthly_schedules: {
        Row: {
          id: string;
          staff_id: string;
          month: number;
          year: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          month: number;
          year: number;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          month?: number;
          year?: number;
          created_by?: string;
          created_at?: string;
        };
      };
      daily_schedules: {
        Row: {
          id: string;
          monthly_schedule_id: string;
          schedule_date: string;
          outlet_id?: string;
          time_in?: string;
          time_out?: string;
          is_day_off: boolean;
          day_off_type?: 'vacation' | 'sick' | 'personal' | 'other';
          notes?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          monthly_schedule_id: string;
          schedule_date: string;
          outlet_id?: string;
          time_in?: string;
          time_out?: string;
          is_day_off?: boolean;
          day_off_type?: 'vacation' | 'sick' | 'personal' | 'other';
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          monthly_schedule_id?: string;
          schedule_date?: string;
          outlet_id?: string;
          time_in?: string;
          time_out?: string;
          is_day_off?: boolean;
          day_off_type?: 'vacation' | 'sick' | 'personal' | 'other';
          notes?: string;
          created_at?: string;
        };
      };
      task_completion_proofs: {
        Row: {
          id: string;
          assignment_id: string;
          file_url: string;
          file_type: 'image' | 'video';
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          file_url: string;
          file_type: 'image' | 'video';
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          file_url?: string;
          file_type?: 'image' | 'video';
          uploaded_at?: string;
        };
      };
    };
  };
}
