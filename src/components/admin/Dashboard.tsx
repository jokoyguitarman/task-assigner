import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  LinearProgress,
  Fade,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Assignment,
  People,
  Schedule,
  CheckCircle,
  Warning,
  Add,
  TrendingUp,
  AccessTime,
  TaskAlt,
  Dashboard as DashboardIcon,
  Email as EmailIcon,
  PriorityHigh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { TaskAssignment, Task, User, StaffProfile, Outlet } from '../../types';
import { assignmentsAPI, tasksAPI, usersAPI, staffProfilesAPI, outletsAPI } from '../../services/supabaseService';
import Leaderboard from './Leaderboard';
import AssignmentForm from './AssignmentForm';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { realtimeService } from '../../services/realtimeService';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentDetailsOpen, setAssignmentDetailsOpen] = useState(false);
  const [selectedAssignmentForDetails, setSelectedAssignmentForDetails] = useState<TaskAssignment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      await loadData();
      await updateOverdueAssignments();
    };
    initializeDashboard();
  }, []);

  // Set up real-time dashboard metrics updates and notifications
  useEffect(() => {
    console.log('🔄 Admin Dashboard: Setting up real-time subscriptions...');
    const unsubscribe = realtimeService.subscribeToDashboardMetrics();
    
    // Set up notification callback for admin
    realtimeService.setNotificationCallback((notification: any) => {    
      console.log('🔔 Admin received notification:', notification);
    });
    
    // Set up refresh callback for dashboard updates
    realtimeService.setRefreshCallback(() => {
      console.log('🔄 Admin dashboard refresh callback triggered!');
      console.log('🔄 Calling loadData...');
      loadData();
    });
    
    console.log('🔄 Admin Dashboard: Real-time subscriptions set up successfully');
    
    return () => {
      console.log('🔄 Admin Dashboard: Cleaning up real-time subscriptions...');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Test function for debugging
  const testRealtime = () => {
    console.log('🧪 Testing real-time connection...');
    realtimeService.testRealtimeConnection();
  };

  // Periodic check for overdue assignments (every 5 minutes) - DISABLED: Using realtime instead
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     updateOverdueAssignments();
  //   }, 5 * 60 * 1000); // 5 minutes

  //   return () => clearInterval(interval);
  // }, []); // Remove assignments dependency to prevent infinite loop

  const updateOverdueAssignments = async () => {
    try {
      const today = new Date();
      const overdueAssignments = assignments.filter(assignment => {
        const dueDate = new Date(assignment.dueDate);
        
        // Set both dates to start of day for comparison (ignore time)
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        
        const isOverdue = assignment.status === 'pending' && todayStart > dueDateStart;
        
        // Debug logging for overdue updates
        if (assignment.taskId && (assignment.taskId.includes('Inventory') || assignment.taskId.includes('Clean'))) {
          console.log('🔄 Update Overdue Debug for task:', assignment.taskId, {
            originalDueDate: assignment.dueDate,
            parsedDueDate: dueDate,
            dueDateStart: dueDateStart,
            today: today,
            todayStart: todayStart,
            isOverdue: isOverdue,
            status: assignment.status
          });
        }
        
        return isOverdue;
      });

      // Update overdue assignments in the database
      for (const assignment of overdueAssignments) {
        console.log('📝 Updating assignment to overdue:', assignment.id, assignment.taskId);
        await assignmentsAPI.update(assignment.id, { status: 'overdue' });
      }

      if (overdueAssignments.length > 0) {
        console.log(`Updated ${overdueAssignments.length} assignments to overdue status`);
        // The auto-refresh will handle reloading the data
      }
    } catch (error) {
      console.error('Error updating overdue assignments:', error);
    }
  };

  const loadData = useCallback(async () => {
    try {
      console.log('🔄 Admin Dashboard loadData starting...');
      setLoading(true);
      
      
      const [assignmentsData, tasksData, staffData, staffProfilesData, outletsData] = await Promise.all([
        assignmentsAPI.getAll(),
        tasksAPI.getAll(),
        usersAPI.getAll(),
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      
              console.log('✅ Admin Dashboard data loaded:', {
          assignmentsCount: assignmentsData.length,
          tasksCount: tasksData.length,
          staffCount: staffData.length,
          staffProfilesCount: staffProfilesData.length,
          outletsCount: outletsData.length
        });
        
      
      setAssignments(assignmentsData);
      setTasks(tasksData);
      setStaff(staffData);
      setStaffProfiles(staffProfilesData);
      setOutlets(outletsData);
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh when data changes
  useAutoRefresh({ refreshFunction: loadData });

  const getStatusColor = (assignment: TaskAssignment) => {
    if (assignment.status === 'completed') return 'success';
    if (assignment.status === 'overdue' || isAssignmentOverdue(assignment)) return 'error';
    return 'warning';
  };

  const getStatusIcon = (assignment: TaskAssignment) => {
    if (assignment.status === 'completed') return <CheckCircle />;
    if (assignment.status === 'overdue' || isAssignmentOverdue(assignment)) return <Warning />;
    return <Schedule />;
  };

  const getDisplayStatus = (assignment: TaskAssignment) => {
    if (assignment.status === 'completed') return 'completed';
    if (assignment.status === 'overdue' || isAssignmentOverdue(assignment)) return 'overdue';
    return 'pending';
  };

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.title : 'Unknown Task';
  };

  const getTaskDescription = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.description : 'No description available';
  };

  const getTaskPriority = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.isHighPriority : false;
  };

  const getStaffName = (staffId?: string) => {
    if (!staffId) return 'Unassigned';
    const staffProfile = staffProfiles.find(sp => sp.id === staffId);
    const user = staffProfile ? staff.find(u => u.id === staffProfile.userId) : null;
    return user?.name || staffProfile?.user?.name || 'Unknown Staff';
  };

  const getStaffEmail = (staffId?: string) => {
    if (!staffId) return 'Available for self-assignment';
    const staffProfile = staffProfiles.find(sp => sp.id === staffId);
    const user = staffProfile ? staff.find(u => u.id === staffProfile.userId) : null;
    return user?.email || staffProfile?.user?.email || '';
  };

  const getOutletName = (outletId?: string) => {
    if (!outletId) return 'No specific outlet';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown Outlet';
  };

  const handleAssignmentClick = (assignment: TaskAssignment) => {
    setSelectedAssignmentForDetails(assignment);
    setAssignmentDetailsOpen(true);
  };

  const handleAssignmentDetailsClose = () => {
    setAssignmentDetailsOpen(false);
    setSelectedAssignmentForDetails(null);
  };

  const handleStatusFilter = (status: string | null) => {
    setStatusFilter(status);
  };

  const handleClearFilter = () => {
    setStatusFilter(null);
  };

  // Helper function to check if an assignment is overdue
  const isAssignmentOverdue = (assignment: TaskAssignment) => {
    const today = new Date();
    const dueDate = new Date(assignment.dueDate);
    
    // Set both dates to start of day for comparison (ignore time)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    // Debug logging for overdue detection
    if (assignment.taskId && assignment.taskId.includes('Inventory') || assignment.taskId.includes('Clean')) {
      console.log('🔍 Overdue Debug for task:', assignment.taskId, {
        originalDueDate: assignment.dueDate,
        parsedDueDate: dueDate,
        dueDateStart: dueDateStart,
        today: today,
        todayStart: todayStart,
        isOverdue: todayStart > dueDateStart,
        status: assignment.status
      });
    }
    
    return assignment.status === 'pending' && todayStart > dueDateStart;
  };

  const pendingAssignments = assignments.filter(a => a.status === 'pending' && !isAssignmentOverdue(a));
  const overdueAssignments = assignments.filter(a => a.status === 'overdue' || isAssignmentOverdue(a));
  const completedToday = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  // Today's due tasks (tasks due today + overdue tasks from previous dates)
  const todayDueTasks = assignments.filter(a => {
    const today = new Date();
    const dueDate = new Date(a.dueDate);
    const isDueToday = dueDate.toDateString() === today.toDateString();
    const isOverdue = a.status === 'overdue' || isAssignmentOverdue(a);
    return isDueToday || isOverdue;
  });

  // Active assignments (pending + rescheduled tasks that need to be completed)
  const activeAssignments = assignments.filter(a => 
    a.status === 'pending' || a.status === 'reschedule_requested'
  );

  // Priority tasks due today or overdue
  const priorityTasksToday = assignments.filter(a => {
    const task = tasks.find(t => t.id === a.taskId);
    if (!task?.isHighPriority) return false;
    
    const today = new Date();
    const dueDate = new Date(a.dueDate);
    const isDueToday = dueDate.toDateString() === today.toDateString();
    const isOverdue = a.status === 'overdue' || isAssignmentOverdue(a);
    return isDueToday || isOverdue;
  });

  // Debug logging
  console.log('Dashboard Debug:', {
    totalAssignments: assignments.length,
    todayDueTasks: todayDueTasks.length,
    activeAssignments: activeAssignments.length,
    completedToday: completedToday.length,
    totalTasks: tasks.length,
    todayDueTasksCount: todayDueTasks.length,
    priorityTasks: priorityTasksToday.length,
    tasksWithPriority: tasks.filter(t => t.isHighPriority).length,
    assignmentsWithPriorityTasks: assignments.filter(a => {
      const task = tasks.find(t => t.id === a.taskId);
      return task?.isHighPriority;
    }).length,
    overdueAssignments: overdueAssignments.length,
    pendingAssignments: pendingAssignments.length,
    overdueByDate: assignments.filter(a => isAssignmentOverdue(a)).length
  });

  // Filtered assignments based on status filter
  const filteredAssignments = statusFilter 
    ? statusFilter === 'priority' 
      ? assignments.filter(a => {
          const task = tasks.find(t => t.id === a.taskId);
          return task?.isHighPriority;
        })
      : statusFilter === 'overdue'
      ? assignments.filter(a => a.status === 'overdue' || isAssignmentOverdue(a))
      : statusFilter === 'pending'
      ? assignments.filter(a => a.status === 'pending' && !isAssignmentOverdue(a))
      : assignments.filter(a => a.status === statusFilter)
    : assignments;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  const completionRate = todayDueTasks.length > 0 ? (completedToday.length / todayDueTasks.length) * 100 : 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <DashboardIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700} color="text.primary">
                Admin Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Welcome back! Here's what's happening with your tasks today.
              </Typography>
               
              {/* Test Button */}
              <Button 
                variant="outlined" 
                onClick={testRealtime}
                size="small"
                sx={{ mt: 2 }}
              >
                🧪 Test Real-time
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>


      <Grid container spacing={2}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={800}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)',
                },
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
              onClick={() => handleClearFilter()}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Total Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {todayDueTasks.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <Assignment sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1000}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(245, 158, 11, 0.3)',
                },
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
              onClick={() => handleStatusFilter('pending')}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Pending
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {pendingAssignments.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <AccessTime sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1200}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(239, 68, 68, 0.3)',
                },
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
              onClick={() => handleStatusFilter('overdue')}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Overdue
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {overdueAssignments.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <Warning sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1400}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                },
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
              onClick={() => handleStatusFilter('completed')}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Completed Today
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {completedToday.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <TaskAlt sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        {/* Priority Tasks Card */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1600}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(139, 92, 246, 0.3)',
                },
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
              onClick={() => handleStatusFilter('priority')}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      High Priority Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {priorityTasksToday.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <PriorityHigh sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        {/* Recent Assignments */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={1600}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      {statusFilter ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Assignments` : 'Recent Assignments'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {statusFilter ? `Task assignments with ${statusFilter} status` : 'Latest task assignments and their status'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {statusFilter && (
                      <Chip
                        label={`Filtered by: ${statusFilter}`}
                        onDelete={handleClearFilter}
                        color="primary"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                    )}
                    <Button
                      variant="outlined"
                      onClick={updateOverdueAssignments}
                      sx={{ borderRadius: 2 }}
                    >
                      Update Overdue
                    </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                      onClick={() => setShowAssignmentForm(true)}
                    sx={{ borderRadius: 2 }}
                  >
                    New Assignment
                  </Button>
                  </Box>
                </Box>
                
                {filteredAssignments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Avatar sx={{ bgcolor: 'grey.100', width: 64, height: 64, mx: 'auto', mb: 2 }}>
                      <Assignment sx={{ fontSize: 32, color: 'grey.400' }} />
                    </Avatar>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {statusFilter ? `No ${statusFilter} assignments found` : 'No assignments yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {statusFilter ? 'Try selecting a different filter or create a new assignment' : 'Create your first task assignment to get started'}
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {filteredAssignments.slice(0, 5).map((assignment, index) => (
                      <Fade in timeout={1800 + index * 200} key={assignment.id}>
                        <ListItem 
                          sx={{ 
                            borderRadius: 2, 
                            mb: 1,
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#6366f1',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                            },
                          }}
                          onClick={() => handleAssignmentClick(assignment)}
                        >
                          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 40, height: 40 }}>
                            <Assignment sx={{ fontSize: 20 }} />
                          </Avatar>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                  {getTaskTitle(assignment.taskId)}
                              </Typography>
                                {getTaskPriority(assignment.taskId) && (
                                  <Chip
                                    label="High Priority"
                                    size="small"
                                    color="error"
                                    icon={<PriorityHigh />}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary">
                                Due: {new Date(assignment.dueDate).toLocaleDateString()}
                              </Typography>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Chip
                              icon={getStatusIcon(assignment)}
                              label={getDisplayStatus(assignment)}
                              color={getStatusColor(assignment) as any}
                              size="small"
                              sx={{ fontWeight: 500 }}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      </Fade>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Quick Actions & Progress */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {/* Progress Card */}
            <Fade in timeout={1600}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                      <TrendingUp />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Today's Progress
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Task completion rate
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Completion Rate
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {completionRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={completionRate} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                        },
                      }} 
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {completedToday.length} of {todayDueTasks.length} tasks completed
                  </Typography>
                </CardContent>
              </Card>
            </Fade>

            {/* Quick Actions */}
            <Fade in timeout={1800}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Quick Actions
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Common administrative tasks
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Assignment />}
                      onClick={() => navigate('/tasks/new')}
                      fullWidth
                      sx={{ 
                        borderRadius: 2,
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        '&:hover': {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        },
                      }}
                    >
                      Create Task
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<People />}
                      onClick={() => navigate('/assignments')}
                      fullWidth
                      sx={{ 
                        borderRadius: 2,
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        '&:hover': {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        },
                      }}
                    >
                      Manage Assignments
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Schedule />}
                      onClick={() => navigate('/schedule')}
                      fullWidth
                      sx={{ 
                        borderRadius: 2,
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        '&:hover': {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        },
                      }}
                    >
                      Schedule Tasks
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EmailIcon />}
                      onClick={() => navigate('/invitations')}
                      fullWidth
                      sx={{ 
                        borderRadius: 2,
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        '&:hover': {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        },
                      }}
                    >
                      Send Invitations
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Box>
        </Grid>
      </Grid>

      {/* Performance Leaderboard */}
      <Box sx={{ mt: 4 }}>
        <Leaderboard />
      </Box>

      {/* Assignment Details Dialog */}
      <Dialog
        open={assignmentDetailsOpen}
        onClose={handleAssignmentDetailsClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Assignment Details
        </DialogTitle>
        <DialogContent>
          {selectedAssignmentForDetails && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  {getTaskTitle(selectedAssignmentForDetails.taskId)}
                </Typography>
                <Chip
                  icon={getStatusIcon(selectedAssignmentForDetails)}
                  label={getDisplayStatus(selectedAssignmentForDetails)}
                  color={getStatusColor(selectedAssignmentForDetails) as any}
                  size="small"
                />
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Task Description
                </Typography>
                <Typography variant="body1">
                  {getTaskDescription(selectedAssignmentForDetails.taskId)}
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" mb={3}>
                <Avatar sx={{ 
                  width: 40, 
                  height: 40, 
                  mr: 2,
                  bgcolor: selectedAssignmentForDetails.staffId ? 'primary.main' : 'grey.400'
                }}>
                  {getStaffName(selectedAssignmentForDetails.staffId).charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {getStaffName(selectedAssignmentForDetails.staffId)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getStaffEmail(selectedAssignmentForDetails.staffId)}
                  </Typography>
                </Box>
              </Box>

              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={3}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Location
                  </Typography>
                  <Typography variant="body1">
                    {getOutletName(selectedAssignmentForDetails.outletId)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assigned Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedAssignmentForDetails.assignedDate).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Due Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedAssignmentForDetails.dueDate).toLocaleDateString()}
                  </Typography>
                </Box>
                {selectedAssignmentForDetails.completedAt && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Completed Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedAssignmentForDetails.completedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                {selectedAssignmentForDetails.minutesDeducted && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Minutes Deducted
                    </Typography>
                    <Typography variant="body1">
                      {selectedAssignmentForDetails.minutesDeducted} minutes
                    </Typography>
                  </Box>
                )}
              </Box>

              {selectedAssignmentForDetails.completionProof && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Completion Proof
                  </Typography>
                  <Typography variant="body1">
                    {selectedAssignmentForDetails.completionProof}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAssignmentDetailsClose}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              handleAssignmentDetailsClose();
              navigate('/assignments');
            }}
          >
            View All Assignments
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assignment Form Dialog */}
      <Dialog 
        open={showAssignmentForm} 
        onClose={() => setShowAssignmentForm(false)}
        maxWidth="md"
        fullWidth
      >
        <AssignmentForm
          onCancel={() => setShowAssignmentForm(false)}
          onSuccess={() => {
            setShowAssignmentForm(false);
            loadData(); // Refresh the assignments list
          }}
        />
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;
