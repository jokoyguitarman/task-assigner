import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginForm from './components/auth/LoginForm';
import AdminDashboard from './components/admin/Dashboard';
import TaskList from './components/admin/TaskList';
import AssignmentList from './components/admin/AssignmentList';
import StaffDashboard from './components/staff/StaffDashboard';
import TaskCompletion from './components/staff/TaskCompletion';

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// Create a client
const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: 'admin' | 'staff' }> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Admin Routes Component
const AdminRoutes: React.FC = () => (
  <Routes>
    <Route path="/dashboard" element={<AdminDashboard />} />
    <Route path="/tasks" element={<TaskList />} />
    <Route path="/assignments" element={<AssignmentList />} />
    <Route path="/schedule" element={<div>Schedule Management - Coming Soon</div>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

// Staff Routes Component
const StaffRoutes: React.FC = () => (
  <Routes>
    <Route path="/dashboard" element={<StaffDashboard />} />
    <Route path="/tasks/:assignmentId/complete" element={<TaskCompletion />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

// Main App Routes Component
const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminRoutes />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/staff/*" 
        element={
          <ProtectedRoute requiredRole="staff">
            <StaffRoutes />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            {user?.role === 'admin' ? <AdminRoutes /> : <StaffRoutes />}
          </ProtectedRoute>
        } 
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
