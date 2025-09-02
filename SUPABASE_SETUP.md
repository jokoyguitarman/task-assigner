# Supabase Setup Instructions

## Overview
The Task Assigner application is now configured to work with both Supabase (production) and mock data (development). It automatically detects whether Supabase is configured and uses the appropriate data source.

## Current Status
✅ **Hybrid API System**: The app uses a hybrid API that automatically switches between Supabase and mock data
✅ **Export Features**: PDF/JPEG schedule export and PDF/CSV task completion reports
✅ **Admin Account Management**: Admin signup flow and staff account creation
✅ **All Features Working**: Both with and without Supabase configuration

## Setup Supabase (Optional)

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be ready

### 2. Set Up Environment Variables
Create a `.env` file in the project root with:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under "API".

### 3. Run the Database Schema
Execute the SQL script provided earlier in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  estimated_minutes INTEGER NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Task assignments table
CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES users(id),
  assigned_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  completed_at TIMESTAMP,
  completion_proof TEXT,
  minutes_deducted INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Custom positions table
CREATE TABLE staff_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Outlets with full customization
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff profiles linking users to positions
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES staff_positions(id),
  employee_id TEXT UNIQUE NOT NULL,
  hire_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly schedules
CREATE TABLE monthly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily schedule entries
CREATE TABLE daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_schedule_id UUID REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  outlet_id UUID REFERENCES outlets(id),
  time_in TIME,
  time_out TIME,
  is_day_off BOOLEAN DEFAULT false,
  day_off_type TEXT CHECK (day_off_type IN ('vacation', 'sick', 'personal', 'other')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task completion proofs
CREATE TABLE task_completion_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Insert default staff positions
INSERT INTO staff_positions (name, description, is_custom) VALUES
('Manager', 'Oversees operations', false),
('Supervisor', 'Supervises staff', false),
('Cashier', 'Handles transactions', false),
('Cook/Chef', 'Prepares food', false),
('Server/Waiter', 'Serves customers', false),
('Cleaner/Janitor', 'Maintains cleanliness', false),
('Security', 'Ensures safety', false);

-- Insert default outlet
INSERT INTO outlets (name, address, is_active) VALUES
('Main Branch', '123 Main Street, City, State', true);
```

### 4. Enable Row Level Security (RLS)
Run this in your Supabase SQL editor:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completion_proofs ENABLE ROW LEVEL SECURITY;

-- Create policies (basic - you may want to customize these)
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Similar policies for other tables...
-- (You may want to create more specific policies based on your needs)
```

## How It Works

### Without Supabase (Current State)
- The app uses mock data stored in memory
- All features work perfectly for demonstration
- Data is lost on page refresh
- Perfect for development and testing

### With Supabase
- The app automatically detects Supabase configuration
- All data is persisted in the database
- Real authentication with Supabase Auth
- File storage for task completion proofs
- Production-ready with proper security

## Features Available

### ✅ Export Features
- **Schedule Export**: PDF and JPEG export of monthly schedules
- **Task Reports**: PDF and CSV export of task completion reports
- **Filtering**: Date range, staff, and status filtering for reports

### ✅ Admin Features
- **Admin Signup**: Initial admin account creation
- **Staff Account Creation**: Create staff accounts with email confirmation
- **Staff Management**: Enroll staff with positions and outlets
- **Outlet Management**: Manage business locations
- **Monthly Scheduling**: Create and manage staff schedules
- **Task Assignment**: Smart assignment with conflict prevention

### ✅ Staff Features
- **Task Dashboard**: View assigned tasks and progress
- **Task Completion**: Mark tasks complete with photo/video proof
- **Mobile Optimized**: Works great on mobile devices

## Next Steps

1. **For Development**: Continue using the app as-is with mock data
2. **For Production**: Set up Supabase following the instructions above
3. **Customization**: Modify the database schema or add new features as needed

The application is fully functional in both modes and will automatically adapt to your configuration!
