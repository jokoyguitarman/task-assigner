import React, { ReactNode, useEffect, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Avatar,
  Chip,
  IconButton,
  Fade,
  Slide,
} from '@mui/material';
import {
  Dashboard,
  Assignment,
  People,
  Logout,
  Menu as MenuIcon,
  AdminPanelSettings,
  Person,
  Business,
  GroupAdd,
  CalendarMonth,
  Assessment,
  Schedule,
} from '@mui/icons-material';
import NotificationBell from '../common/NotificationBell';
import UsageStats from './UsageStats';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { realtimeService } from '../../services/realtimeService';
import { notificationService } from '../../services/notificationService';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const realtimeInitialized = useRef(false);

  // Initialize real-time service and notification service
  useEffect(() => {
    if (user && !realtimeInitialized.current) {
      console.log('🔔 Initializing real-time service for user:', user.id);
      realtimeService.initialize();
      
      // Set current user context for notifications
      notificationService.setCurrentUser(user.id, user.role);
      
      realtimeInitialized.current = true;
    } else if (!user && realtimeInitialized.current) {
      console.log('🔔 Cleaning up real-time service (no user)');
      realtimeService.cleanup();
      realtimeInitialized.current = false;
    }
  }, [user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
    },
    // Only show Tasks menu for admin users (staff and outlet users see tasks on dashboard)
    ...(user?.role === 'admin' ? [
      {
        text: 'Tasks',
        icon: <Assignment />,
        path: '/tasks',
      },
    ] : []),
    // Show Schedules and Performance menus for staff and outlet users
    ...(user?.role === 'staff' || user?.role === 'outlet' ? [
      {
        text: 'Team Schedules',
        icon: <Schedule />,
        path: '/schedules',
      },
      {
        text: 'Performance',
        icon: <Assessment />,
        path: '/performance',
      },
    ] : []),
    ...(user?.role === 'admin' ? [
      {
        text: 'Staff Management',
        icon: <GroupAdd />,
        path: '/staff',
      },
      {
        text: 'Staff Accounts',
        icon: <Person />,
        path: '/staff-accounts',
      },
      {
        text: 'Outlet Management',
        icon: <Business />,
        path: '/outlets',
      },
      {
        text: 'Weekly Scheduler',
        icon: <CalendarMonth />,
        path: '/scheduler',
      },
      {
        text: 'Task Assignments',
        icon: <People />,
        path: '/assignments',
      },
      {
        text: 'Reports',
        icon: <Assessment />,
        path: '/reports',
      },
    ] : []),
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: 100,
            height: 100,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            transform: 'translate(30px, -30px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
          <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 48, height: 48 }}>
            {user?.role === 'admin' ? <AdminPanelSettings /> : <Person />}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700} noWrap>
              Task Assigner
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {user?.role === 'admin' ? 'Admin Panel' : 'Staff Portal'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: user?.role === 'admin' ? 'primary.main' : 'secondary.main', width: 40, height: 40 }}>
            {user?.role === 'admin' ? <AdminPanelSettings /> : <Person />}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {user?.name}
            </Typography>
            <Chip
              label={
                user?.role === 'admin' ? 'Administrator' : 
                user?.role === 'outlet' ? 'Outlet Manager' : 
                'Staff Member'
              }
              size="small"
              color={
                user?.role === 'admin' ? 'primary' : 
                user?.role === 'outlet' ? 'info' : 
                'secondary'
              }
              variant="outlined"
              sx={{ mt: 0.5, fontSize: '0.75rem' }}
            />
          </Box>
        </Box>
      </Box>

      {/* Usage Stats - Only show for admin users */}
      {user?.role === 'admin' && (
        <Box sx={{ p: 2 }}>
          <UsageStats />
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List sx={{ p: 1 }}>
          {menuItems.map((item, index) => (
            <Slide direction="right" in timeout={600 + index * 100} key={item.text}>
              <ListItem
                button
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  mx: 1,
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    backgroundColor: user?.role === 'admin' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(236, 72, 153, 0.1)',
                    borderLeft: `4px solid ${user?.role === 'admin' ? '#6366f1' : '#ec4899'}`,
                    '&:hover': {
                      backgroundColor: user?.role === 'admin' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path 
                      ? (user?.role === 'admin' ? 'primary.main' : 'secondary.main')
                      : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 600 : 500,
                    color: location.pathname === item.path 
                      ? (user?.role === 'admin' ? 'primary.main' : 'secondary.main')
                      : 'text.primary',
                  }}
                />
              </ListItem>
            </Slide>
          ))}
        </List>
      </Box>

      {/* Logout */}
      <Box sx={{ p: 1, borderTop: '1px solid #e2e8f0' }}>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            mx: 1,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              transform: 'translateX(4px)',
            },
          }}
        >
          <ListItemIcon sx={{ color: 'error.main', minWidth: 40 }}>
            <Logout />
          </ListItemIcon>
          <ListItemText 
            primary="Logout"
            primaryTypographyProps={{
              fontWeight: 500,
              color: 'error.main',
            }}
          />
        </ListItem>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - 240px)` },
          ml: { md: '240px' },
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              sx={{ 
                mr: 2,
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600} noWrap component="div">
                Welcome back, {user?.name}! 👋
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationBell />
            <Chip
              icon={user?.role === 'admin' ? <AdminPanelSettings /> : <Person />}
              label={user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
              color={user?.role === 'admin' ? 'primary' : 'secondary'}
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: 240 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 240,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - 240px)` },
          mt: 8,
          backgroundColor: '#f8fafc',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Fade in timeout={600}>
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

export default AppLayout;
