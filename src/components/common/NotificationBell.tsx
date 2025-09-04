import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Paper,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Task as TaskIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { realtimeService, RealtimeNotification } from '../../services/realtimeService';

interface Notification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'task_overdue' | 'reschedule_requested' | 'schedule_updated' | 'assignment_created' | 'assignment_updated';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  taskId?: string;
  assignmentId?: string;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const open = Boolean(anchorEl);

  useEffect(() => {
    loadNotifications();
    
    // Set up real-time notifications
    realtimeService.setNotificationCallback(handleRealtimeNotification);
    
    return () => {
      realtimeService.cleanup();
    };
  }, []);

  const handleRealtimeNotification = (realtimeNotification: RealtimeNotification) => {
    console.log('🔔 NotificationBell received real-time notification:', realtimeNotification);
    const notification: Notification = {
      id: realtimeNotification.id,
      type: realtimeNotification.type,
      title: realtimeNotification.title,
      message: realtimeNotification.message,
      timestamp: realtimeNotification.timestamp,
      read: false,
      taskId: realtimeNotification.data?.taskId,
      assignmentId: realtimeNotification.data?.id,
    };
    
    setNotifications(prev => {
      const updated = [notification, ...prev];
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // Load recent notifications from localStorage or API
      const savedNotifications = localStorage.getItem('notifications');
      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications);
        setNotifications(parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }));
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };


  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_assigned':
      case 'assignment_created':
        return <AssignmentIcon color="primary" />;
      case 'task_completed':
        return <CheckCircleIcon color="success" />;
      case 'task_overdue':
        return <WarningIcon color="warning" />;
      case 'reschedule_requested':
        return <ScheduleIcon color="info" />;
      case 'schedule_updated':
        return <ScheduleIcon color="secondary" />;
      case 'assignment_updated':
        return <TaskIcon color="action" />;
      default:
        return <TaskIcon />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'task_assigned':
      case 'assignment_created':
        return 'primary';
      case 'task_completed':
        return 'success';
      case 'task_overdue':
        return 'warning';
      case 'reschedule_requested':
        return 'info';
      case 'schedule_updated':
        return 'secondary';
      case 'assignment_updated':
        return 'default';
      default:
        return 'default';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{
          color: 'text.primary',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>
              Notifications
            </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={markAllAsRead}
              sx={{ textTransform: 'none' }}
            >
              Mark all as read
            </Button>
          )}
        </Box>
          </Box>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                      borderLeft: notification.read ? 'none' : '3px solid #6366f1',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight={notification.read ? 500 : 600}>
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.type.replace('_', ' ')}
                            size="small"
                            color={getNotificationColor(notification.type) as any}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(notification.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;
