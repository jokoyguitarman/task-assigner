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

// Create a modern theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1', // Modern indigo
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ec4899', // Modern pink
      light: '#f472b6',
      dark: '#db2777',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6366f1',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6366f1',
              borderWidth: 2,
            },
          },
        },
      },
    },
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
