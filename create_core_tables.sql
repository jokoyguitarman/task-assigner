-- Create core tables that might be missing (tasks and task_assignments)

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR(20) CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly')),
    scheduled_date DATE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_assignments table
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.users(id),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_proof TEXT,
    minutes_deducted INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tasks
CREATE POLICY "Admin can manage all tasks" ON public.tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

CREATE POLICY "Staff can view tasks" ON public.tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'staff')
    );

-- Create RLS policies for task_assignments
CREATE POLICY "Admin can manage all assignments" ON public.task_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

CREATE POLICY "Staff can view own assignments" ON public.task_assignments
    FOR SELECT USING (staff_id = auth.uid());

CREATE POLICY "Staff can update own assignments" ON public.task_assignments
    FOR UPDATE USING (staff_id = auth.uid());

SELECT 'Core tables (tasks, task_assignments) created successfully!' as result;
