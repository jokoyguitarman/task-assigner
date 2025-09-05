import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  Avatar,
  LinearProgress,
  Fade,
  Slide,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Warning,
  Schedule,
  CameraAlt,
  Person,
  AccessTime,
  TaskAlt,
  TrendingUp,
  Visibility,
  LocationOn,
  PersonAdd,
  PriorityHigh,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { TaskAssignment, Task, StaffProfile, User, Outlet } from '../../types';
import { assignmentsAPI, tasksAPI, staffProfilesAPI, usersAPI, outletsAPI, streakAPI } from '../../services/supabaseService';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import RescheduleRequestDialog from './RescheduleRequestDialog';

const StaffDashboard: React.FC = () => {
  console.log('🏗️ StaffDashboard component mounting/rendering');
  const { user, currentOutlet, isOutletUser } = useAuth();
  console.log('🔐 Auth context values:', { user: !!user, currentOutlet: !!currentOutlet, isOutletUser });
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<TaskAssignment[]>([]);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [allStaffProfiles, setAllStaffProfiles] = useState<StaffProfile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignmentToView, setAssignmentToView] = useState<TaskAssignment | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [assignmentToReschedule, setAssignmentToReschedule] = useState<TaskAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚀 StaffDashboard useEffect triggered');
    console.log('🔍 Current state:', { 
      user: !!user, 
      userEmail: user?.email,
      isOutletUser, 
      currentOutlet: currentOutlet?.id,
      loading 
    });
    
    const loadData = async () => {
      if (!user) {
        console.log('❌ No user found, skipping data load');
        return;
      }
      
      console.log('🔄 Starting data load for user:', user.id);
      console.log('🔍 User details:', { 
        id: user.id, 
        email: user.email, 
        isOutletUser, 
        currentOutlet: currentOutlet?.id 
      });
      
      try {
        setError(null);
        setLoading(true);
        
        console.log('📊 Loading main data...');
        console.log('🔐 Staff user:', user?.id, user?.email, user?.role);
        const [tasksData, allAssignments, usersData, outletsData, streakData, staffProfilesData] = await Promise.all([
          tasksAPI.getAll(),
          assignmentsAPI.getAll(),
          usersAPI.getAll(),
          outletsAPI.getAll(),
          streakAPI.getStreakData(user.id),
          staffProfilesAPI.getAll(),
        ]);
        
        console.log('✅ Main data loaded successfully:', {
          tasksCount: tasksData.length,
          assignmentsCount: allAssignments.length,
          usersCount: usersData.length,
          outletsCount: outletsData.length,
          staffProfilesCount: staffProfilesData.length,
          streakData
        });
        
        
        setTasks(tasksData);
        setUsers(usersData);
        setOutlets(outletsData);
        setAllStaffProfiles(staffProfilesData);
        setCurrentStreak(streakData.currentStreak);
        setLongestStreak(streakData.longestStreak);
        
        // Handle outlet users vs staff users
        if (isOutletUser && currentOutlet) {
          console.log('🏪 Loading data for outlet user, outlet:', currentOutlet.id);
          
          // Show ALL assignments for this outlet (both assigned and unassigned)
          const outletAssignments = allAssignments.filter(assignment => 
            assignment.outletId === currentOutlet.id
          );
          
          console.log('🏪 All outlet assignments found:', outletAssignments.length);
          setAssignments(outletAssignments);
          
          // Filter unassigned tasks for this outlet
          const unassigned = outletAssignments.filter(assignment => !assignment.staffId);
          console.log('🏪 Unassigned tasks found:', unassigned.length);
          setUnassignedTasks(unassigned);
          
        } else {
          // For staff users, get their profile first
          console.log('👤 Loading data for staff user');
          let currentStaffProfile = null;
          try {
            const staffProfiles = await staffProfilesAPI.getAll();
            console.log('🔍 Staff profiles loaded:', staffProfiles);
            console.log('🔍 Staff profiles count:', staffProfiles.length);
            currentStaffProfile = staffProfiles.find(sp => sp.userId === user.id);
            setStaffProfile(currentStaffProfile || null);
            setAllStaffProfiles(staffProfiles);
          } catch (error) {
            console.error('❌ Error loading staff profiles:', error);
            setAllStaffProfiles([]);
          }

          if (!currentStaffProfile) {
            throw new Error('No staff profile found for this user. Please contact an administrator.');
          }

          const assignmentsData = await assignmentsAPI.getByStaff(currentStaffProfile.id);
          console.log('👤 Staff assignments found:', assignmentsData.length);
          setAssignments(assignmentsData);
          
          // Filter unassigned tasks
          const unassigned = allAssignments.filter(assignment =>
            !assignment.staffId
          );
          console.log('👤 Unassigned tasks found:', unassigned.length);
        setUnassignedTasks(unassigned);
        }
        
        console.log('🎯 Streak data loaded:', streakData);
        
        // Update streak after loading data (but don't await it to avoid blocking)
        updateStreak().catch(error => {
          console.error('❌ Error updating streak:', error);
        });
        
      } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Error details:', {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          user: user?.id,
          userRole: user?.role,
          isOutletUser,
          currentOutlet: currentOutlet?.id
        });
      } finally {
        console.log('🏁 Data loading complete, setting loading to false');
        setLoading(false);
      }
    };

    if (user) {
      console.log('👤 User exists, calling loadData()');
      loadData();
    } else {
      console.log('❌ No user, not calling loadData()');
    }
  }, [user, currentOutlet, isOutletUser]);
  
  console.log('🔄 StaffDashboard render - assignments:', assignments.length, 'unassigned:', unassignedTasks.length);
  console.log('🔍 useEffect dependencies:', { user: !!user, currentOutlet: !!currentOutlet, isOutletUser });

  // Auto-refresh when data changes
  useAutoRefresh({ 
    refreshFunction: async () => {
      if (user) {
        // Re-run the same data loading logic
        const [tasksData, allAssignments, usersData, outletsData, streakData] = await Promise.all([
          tasksAPI.getAll(),
          assignmentsAPI.getAll(),
          usersAPI.getAll(),
          outletsAPI.getAll(),
          streakAPI.getStreakData(user.id),
        ]);
        
        setTasks(tasksData);
        setUsers(usersData);
        setOutlets(outletsData);
        setCurrentStreak(streakData.currentStreak);
        setLongestStreak(streakData.longestStreak);
        
        if (isOutletUser && currentOutlet) {
          // Show ALL assignments for this outlet (both assigned and unassigned)
          const outletAssignments = allAssignments.filter(assignment => 
            assignment.outletId === currentOutlet.id
          );
          setAssignments(outletAssignments);
          const unassigned = outletAssignments.filter(assignment => !assignment.staffId);
          setUnassignedTasks(unassigned);
        } else {
          let currentStaffProfile = null;
          try {
            const staffProfiles = await staffProfilesAPI.getAll();
            console.log('🔍 Staff profiles loaded (outlet user):', staffProfiles);
            console.log('🔍 Staff profiles count (outlet user):', staffProfiles.length);
            currentStaffProfile = staffProfiles.find(sp => sp.userId === user.id);
            setStaffProfile(currentStaffProfile || null);
            setAllStaffProfiles(staffProfiles);
          } catch (error) {
            console.error('❌ Error loading staff profiles (outlet user):', error);
            setAllStaffProfiles([]);
          }
          
          if (currentStaffProfile) {
            const assignmentsData = await assignmentsAPI.getByStaff(currentStaffProfile.id);
            setAssignments(assignmentsData);
            const unassigned = allAssignments.filter(assignment => !assignment.staffId);
            setUnassignedTasks(unassigned);
          }
        }
      }
    }
  });

  const handleTakeTask = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setSelectedStaffId('');
    setAssignDialogOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedStaffId || !selectedAssignmentId) return;
    
    try {
      await assignmentsAPI.update(selectedAssignmentId, {
        staffId: selectedStaffId,
      });
      
      // Reload data to reflect changes
      const [assignmentsData, allAssignments] = await Promise.all([
        staffProfile ? assignmentsAPI.getByStaff(staffProfile.id) : Promise.resolve([]),
        assignmentsAPI.getAll(),
      ]);
      
      if (isOutletUser && currentOutlet) {
        // For outlet users, filter by outlet
        const outletTasks = allAssignments.filter(assignment =>
          assignment.outletId === currentOutlet.id
        );
        setAssignments(outletTasks.filter(assignment => assignment.staffId));
        setUnassignedTasks(outletTasks.filter(assignment => !assignment.staffId));
      } else {
        // For staff users, show all tasks
        setAssignments(assignmentsData);
        const unassigned = allAssignments.filter(assignment => !assignment.staffId);
        setUnassignedTasks(unassigned);
      }
      
      // Close dialog
      setAssignDialogOpen(false);
      setSelectedAssignmentId('');
      setSelectedStaffId('');
    } catch (error) {
      console.error('Error assigning task:', error);
    }
  };

  const handleCancelAssignment = () => {
    setAssignDialogOpen(false);
    setSelectedAssignmentId('');
    setSelectedStaffId('');
  };

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.title : 'Unknown Task';
  };

  const getTaskEstimatedTime = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.estimatedMinutes : 0;
  };

  const getTaskPriority = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.isHighPriority : false;
  };

  const getAssignedBy = (assignment: TaskAssignment) => {
    const task = tasks.find(t => t.id === assignment.taskId);
    if (!task) return 'Unknown';
    const user = users.find(u => u.id === task.createdBy);
    return user ? user.name : 'Unknown';
  };

  const getAssignedTo = (assignment: TaskAssignment) => {
    if (!assignment.staffId) return 'Unassigned';
    const staffProfile = allStaffProfiles.find(sp => sp.id === assignment.staffId);
    return staffProfile ? (staffProfile.user?.name || 'Unknown Staff') : 'Unknown Staff';
  };

  const getOutletName = (assignment: TaskAssignment) => {
    const outlet = outlets.find(o => o.id === assignment.outletId);
    return outlet ? outlet.name : 'Unknown Outlet';
  };

  const handleViewAssignment = (assignment: TaskAssignment) => {
    setAssignmentToView(assignment);
    setViewDialogOpen(true);
  };

  const handleCloseView = () => {
    setViewDialogOpen(false);
    setAssignmentToView(null);
  };

  const handleRequestReschedule = (assignment: TaskAssignment) => {
    setAssignmentToReschedule(assignment);
    setRescheduleDialogOpen(true);
  };

  const handleCloseReschedule = () => {
    setRescheduleDialogOpen(false);
    setAssignmentToReschedule(null);
  };

  const handleRescheduleSuccess = () => {
    // Reload data to reflect the reschedule request
    if (user) {
      window.location.reload(); // Simple reload for now
    }
  };

  // Filter helper functions
  const getFilteredAssignments = (assignments: TaskAssignment[]) => {
    return assignments.filter(assignment => {
      // Filter by assignee
      if (selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned') {
          if (assignment.staffId) return false;
        } else {
          if (assignment.staffId !== selectedAssignee) return false;
        }
      }

      // Filter by status
      if (selectedStatus !== 'all') {
        const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
        const isCompleted = assignment.status === 'completed';
        const isPending = assignment.status === 'pending';
        const isPriority = tasks.find(t => t.id === assignment.taskId)?.isHighPriority;

        if (selectedStatus === 'overdue' && !isOverdue) return false;
        if (selectedStatus === 'pending' && !isPending) return false;
        if (selectedStatus === 'completed' && !isCompleted) return false;
        if (selectedStatus === 'priority' && !isPriority) return false;
      }

      return true;
    });
  };

  const handleAssigneeFilter = (assignee: string) => {
    setSelectedAssignee(assignee);
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
  };

  const clearFilters = () => {
    setSelectedAssignee('all');
    setSelectedStatus('all');
  };

  // Update streak when tasks are completed
  const updateStreak = async () => {
    if (!user) return;
    
    try {
      const newStreak = await streakAPI.checkAndUpdateStreak(user.id);
      setCurrentStreak(newStreak);
      
      // Update longest streak if current is higher
      if (newStreak > longestStreak) {
        setLongestStreak(newStreak);
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const handleCardClick = (filterType: string, value: string) => {
    if (filterType === 'status') {
      setSelectedStatus(value);
      setSelectedAssignee('all'); // Reset assignee filter when clicking status
    } else if (filterType === 'assignee') {
      setSelectedAssignee(value);
      setSelectedStatus('all'); // Reset status filter when clicking assignee
    }
  };

  const isCardActive = (filterType: string, value: string) => {
    if (filterType === 'status') {
      return selectedStatus === value;
    } else if (filterType === 'assignee') {
      return selectedAssignee === value;
    }
    return false;
  };



  // For outlet users, calculate metrics based on all outlet tasks (assigned + unassigned)
  // For staff users, use only their assigned tasks
  const allOutletTasks = isOutletUser && currentOutlet 
    ? [...assignments, ...unassignedTasks] // All tasks for the outlet
    : assignments; // Only assigned tasks for staff

  // Calculate stats from ALL tasks (not filtered)
  const allPendingAssignments = allOutletTasks.filter(a => a.status === 'pending');
  const allOverdueAssignments = allOutletTasks.filter(a => a.status === 'overdue');
  const allCompletedToday = allOutletTasks.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );
  const allUnassignedTasks = unassignedTasks;


  // Apply filters to the task lists for display
  // For the main display, only show pending and overdue tasks (not completed)
  const activeAssignments = allOutletTasks.filter(a => a.status === 'pending' || a.status === 'overdue');
  const filteredAssignments = getFilteredAssignments(activeAssignments);
  const filteredUnassignedTasks = getFilteredAssignments(unassignedTasks);
  const pendingAssignments = filteredAssignments.filter(a => a.status === 'pending');
  const overdueAssignments = filteredAssignments.filter(a => a.status === 'overdue');
  
  // For progress tracking, use tasks assigned to the current user (not all outlet tasks)
  const userAssignedTasks = isOutletUser ? 
    allOutletTasks.filter(a => a.staffId) : // For outlet users, show tasks assigned to staff
    assignments; // For staff users, show their assigned tasks

  // For "Today's Progress", count pending/overdue tasks + tasks completed today
  const pendingOverdueTasks = userAssignedTasks.filter(a => 
    a.status === 'pending' || a.status === 'overdue'
  );

  const completedToday = userAssignedTasks.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  // Today's work = pending/overdue tasks + tasks completed today
  const activeTasksForToday = pendingOverdueTasks.length + completedToday.length;
  
  // Debug logging (can be removed later)
  console.log('🔍 Progress Debug:', {
    isOutletUser,
    totalTasks: userAssignedTasks.length,
    pendingOverdueTasks: pendingOverdueTasks.length,
    completedToday: completedToday.length,
    activeTasksForToday: activeTasksForToday,
    allCompleted: userAssignedTasks.filter(a => a.status === 'completed').length
  });

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const completionRate = activeTasksForToday > 0 ? (completedToday.length / activeTasksForToday) * 100 : 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700} color="text.primary">
                My Tasks
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Welcome back, {user?.name}! Here's your task overview for today.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Fade>

      <Grid container spacing={1.5}>
        {/* Stats Cards */}
        {/* Unassigned Tasks Count */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={800}>
            <Card
              onClick={() => handleCardClick('assignee', 'unassigned')}
              sx={{
                background: isCardActive('assignee', 'unassigned') 
                  ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCardActive('assignee', 'unassigned') ? '2px solid #ffffff' : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
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
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Unassigned Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {allUnassignedTasks.length}
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

        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1000}>
            <Card
              onClick={() => handleCardClick('status', 'pending')}
              sx={{
                background: isCardActive('status', 'pending') 
                  ? 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)'
                  : 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCardActive('status', 'pending') ? '2px solid #ffffff' : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
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
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Pending Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {allPendingAssignments.length}
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
          <Slide direction="up" in timeout={1200}>
            <Card
              onClick={() => handleCardClick('status', 'overdue')}
              sx={{
                background: isCardActive('status', 'overdue') 
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCardActive('status', 'overdue') ? '2px solid #ffffff' : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
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
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Overdue
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {allOverdueAssignments.length}
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
              onClick={() => handleCardClick('status', 'completed')}
              sx={{
                background: isCardActive('status', 'completed') 
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCardActive('status', 'completed') ? '2px solid #ffffff' : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
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
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Completed Today
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {allCompletedToday.length}
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

        {/* Priority Tasks Count */}
        <Grid item xs={12} sm={6} md={2.4}>
          <Slide direction="up" in timeout={1600}>
            <Card
              onClick={() => handleCardClick('status', 'priority')}
              sx={{
                background: isCardActive('status', 'priority') 
                  ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCardActive('status', 'priority') ? '2px solid #ffffff' : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
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
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Priority Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {allOutletTasks.filter(assignment => {
                        const task = tasks.find(t => t.id === assignment.taskId);
                        return task?.isHighPriority && (assignment.status === 'pending' || assignment.status === 'overdue');
                      }).length}
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

        {/* Filter Controls */}
        <Grid item xs={12}>
          <Slide direction="up" in timeout={1800}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Filter Tasks
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Assignee</InputLabel>
                      <Select
                        value={selectedAssignee}
                        onChange={(e) => handleAssigneeFilter(e.target.value)}
                        label="Assignee"
                      >
                        <MenuItem value="all">All Assignees</MenuItem>
                        <MenuItem value="unassigned">Unassigned</MenuItem>
                        {allStaffProfiles.map((staff) => (
                          <MenuItem key={staff.id} value={staff.id}>
                            {staff.user?.name || 'Unknown Staff'}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={selectedStatus}
                        onChange={(e) => handleStatusFilter(e.target.value)}
                        label="Status"
                      >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="overdue">Overdue</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="priority">Priority</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Button
                      variant="outlined"
                      onClick={clearFilters}
                      size="small"
                      sx={{ height: '40px' }}
                    >
                      Clear Filters
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Typography variant="body2" color="text.secondary">
                      {filteredAssignments.length > 0 
                        ? `Showing ${filteredAssignments.length} of ${activeAssignments.length} tasks`
                        : 'No tasks to display'
                      }
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        {/* Pending & Overdue Tasks */}
        <Grid item xs={12} md={8}>
          <Fade in timeout={1600}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      Tasks Requiring Attention
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending and overdue tasks that need your attention
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {(pendingAssignments.length + overdueAssignments.length) > 0 && (
                    <Chip 
                        label={`${pendingAssignments.length + overdueAssignments.length} tasks`} 
                      color="primary" 
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                    {filteredUnassignedTasks.length > 0 && (
                      <Chip 
                        label={`${filteredUnassignedTasks.length} unassigned`} 
                        color="warning" 
                        variant="filled"
                        sx={{ fontWeight: 500 }}
                      />
                    )}
                  </Box>
                </Box>
                
                {(pendingAssignments.length + overdueAssignments.length) > 0 ? (
                  <List sx={{ p: 0 }}>
                    {/* Show overdue tasks first */}
                    {overdueAssignments.map((assignment, index) => (
                      <Fade in timeout={1800 + index * 200} key={`overdue-${assignment.id}`}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 2,
                            border: '2px solid #ef4444',
                            backgroundColor: '#fef2f2',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            '&:hover': {
                              borderColor: '#dc2626',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                            },
                          }}
                          onClick={() => handleViewAssignment(assignment)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'error.main', width: 48, height: 48 }}>
                              <Warning sx={{ fontSize: 24 }} />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                  {getTaskTitle(assignment.taskId)}
                                </Typography>
                                <Chip
                                  label="OVERDUE"
                                  size="small"
                                  color="error"
                                  sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                />
                                {getTaskPriority(assignment.taskId) && (
                                  <Chip
                                    icon={<PriorityHigh />}
                                    label="HIGH PRIORITY"
                                    size="small"
                                    color="warning"
                                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                  />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  icon={<Schedule />}
                                  label={`Due: ${new Date(assignment.dueDate).toLocaleDateString()}`}
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                />
                                <Chip
                                  icon={<AccessTime />}
                                  label={`${getTaskEstimatedTime(assignment.taskId)} min`}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                />
                                <Chip
                                  icon={<LocationOn />}
                                  label={getOutletName(assignment)}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<PersonAdd />}
                                  label={`Assigned by: ${getAssignedBy(assignment)}`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<Person />}
                                  label={assignment.staffId ? `Assigned to: ${getAssignedTo(assignment)}` : 'Unassigned'}
                                  size="small"
                                  variant="outlined"
                                  color={assignment.staffId ? 'success' : 'warning'}
                                />
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewAssignment(assignment);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Request Reschedule">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestReschedule(assignment);
                                  }}
                                  sx={{ color: 'warning.main' }}
                                >
                                  <Schedule />
                                </IconButton>
                              </Tooltip>
                              <Button
                                variant="contained"
                                startIcon={<CameraAlt />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/tasks/${assignment.id}/complete`;
                                }}
                                sx={{
                                  borderRadius: 2,
                                  px: 3,
                                  py: 1,
                                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                  },
                                }}
                              >
                                Complete Now
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      </Fade>
                    ))}
                    
                    {/* Then show pending tasks */}
                    {pendingAssignments.map((assignment, index) => (
                      <Fade in timeout={1800 + (overdueAssignments.length + index) * 200} key={`pending-${assignment.id}`}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 2,
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            '&:hover': {
                              borderColor: '#ec4899',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.15)',
                            },
                          }}
                          onClick={() => handleViewAssignment(assignment)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                              <Assignment sx={{ fontSize: 24 }} />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                {getTaskTitle(assignment.taskId)}
                              </Typography>
                                {getTaskPriority(assignment.taskId) && (
                                  <Chip
                                    icon={<PriorityHigh />}
                                    label="HIGH PRIORITY"
                                    size="small"
                                    color="warning"
                                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                  />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  icon={<Schedule />}
                                  label={`Due: ${new Date(assignment.dueDate).toLocaleDateString()}`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<AccessTime />}
                                  label={`${getTaskEstimatedTime(assignment.taskId)} min`}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                />
                                <Chip
                                  icon={<LocationOn />}
                                  label={getOutletName(assignment)}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<PersonAdd />}
                                  label={`Assigned by: ${getAssignedBy(assignment)}`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<Person />}
                                  label={assignment.staffId ? `Assigned to: ${getAssignedTo(assignment)}` : 'Unassigned'}
                                  size="small"
                                  variant="outlined"
                                  color={assignment.staffId ? 'success' : 'warning'}
                                />
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewAssignment(assignment);
                                  }}
                                  sx={{ color: 'primary.main' }}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Request Reschedule">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestReschedule(assignment);
                                  }}
                                  sx={{ color: 'warning.main' }}
                                >
                                  <Schedule />
                                </IconButton>
                              </Tooltip>
                            <Button
                              variant="contained"
                              startIcon={<CameraAlt />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                window.location.href = `/tasks/${assignment.id}/complete`;
                              }}
                              sx={{
                                borderRadius: 2,
                                px: 3,
                                py: 1,
                                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
                                },
                              }}
                            >
                              Complete
                            </Button>
                            </Box>
                          </Box>
                        </Paper>
                      </Fade>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 80, height: 80, mx: 'auto', mb: 3 }}>
                      <CheckCircle sx={{ fontSize: 40 }} />
                    </Avatar>
                    <Typography variant="h5" fontWeight={600} color="text.primary" gutterBottom>
                      All caught up! 🎉
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Great job! You have no pending or overdue tasks at the moment.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Progress Overview */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            {/* Today's Progress */}
            <Fade in timeout={1600}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                      <TrendingUp />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Today's Progress
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Your completion rate
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Tasks Completed
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {completedToday.length} / {activeTasksForToday}
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
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {completionRate.toFixed(1)}% completion rate
                    </Typography>
                  </Box>

                </CardContent>
              </Card>
            </Fade>

            {/* Quick Stats */}
            <Fade in timeout={1800}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Quick Stats
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Overdue Tasks
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color={overdueAssignments.length > 0 ? 'error.main' : 'success.main'}>
                        {overdueAssignments.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Completion Streak
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color={currentStreak > 0 ? 'success.main' : 'text.secondary'}>
                        {currentStreak === 0 ? 'No streak' : `${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Longest Streak
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {longestStreak} day{longestStreak === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Box>
        </Grid>

        {/* Unassigned Tasks */}
        {filteredUnassignedTasks.length > 0 && (
          <Grid item xs={12}>
            <Fade in timeout={1800}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 40, height: 40 }}>
                      <TaskAlt />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Unassigned Tasks
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {isOutletUser && currentOutlet 
                          ? `${filteredUnassignedTasks.length} tasks available for ${currentOutlet.name} team assignment`
                          : `${filteredUnassignedTasks.length} tasks available for team assignment`
                        }
                      </Typography>
                    </Box>
                    <Chip 
                      label={`${filteredUnassignedTasks.length} unassigned`} 
                      color="warning" 
                      variant="filled"
                      sx={{ fontWeight: 600, ml: 'auto' }}
                    />
                  </Box>

                  <List sx={{ width: '100%' }}>
                    {filteredUnassignedTasks.map((assignment, index) => (
                      <Fade in timeout={2000 + index * 100} key={assignment.id}>
                        <Paper
                          elevation={2}
                          sx={{
                            mb: 2,
                            p: 3,
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              borderColor: 'info.main',
                              transform: 'translateY(-2px)',
                              boxShadow: 6,
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" fontWeight={600} gutterBottom>
                                {getTaskTitle(assignment.taskId)}
                              </Typography>
                              
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                                <Chip
                                  icon={<Schedule />}
                                  label={`Due: ${assignment.dueDate.toLocaleDateString()}`}
                                  variant="outlined"
                                  size="small"
                                />
                                <Chip
                                  icon={<AccessTime />}
                                  label={`${getTaskEstimatedTime(assignment.taskId)} min`}
                                  variant="outlined"
                                  size="small"
                                />
                                <Chip
                                  icon={<LocationOn />}
                                  label={getOutletName(assignment)}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<PersonAdd />}
                                  label={`Assigned by: ${getAssignedBy(assignment)}`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                                <Chip
                                  icon={<Person />}
                                  label="Unassigned"
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                />
                                {assignment.status === 'reschedule_requested' && (
                                  <Chip
                                    icon={<Schedule />}
                                    label="Reschedule Requested"
                                    size="small"
                                    variant="filled"
                                    color="info"
                                    sx={{
                                      backgroundColor: '#e3f2fd',
                                      color: '#1976d2',
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                            </Box>

                            <Button
                              variant="contained"
                              color="info"
                              onClick={() => handleTakeTask(assignment.id)}
                              sx={{
                                borderRadius: 2,
                                px: 3,
                                py: 1,
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                },
                              }}
                            >
                              Assign to Team
                            </Button>
                          </Box>
                        </Paper>
                      </Fade>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        )}
      </Grid>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={handleCancelAssignment} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Assign Task to Team Member
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Who will be responsible for completing this task?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Autocomplete
              options={allStaffProfiles.filter(profile => {
                console.log('🔍 Debug - checking profile:', profile.id, 'isActive:', profile.isActive, 'user:', profile.user);
                if (!profile.isActive) return false;
                // If outlet user, only show staff from the same outlet
                // Note: We'll need to implement outlet assignment for staff later
                // For now, show all active staff
                return true;
              })}
              getOptionLabel={(option) => option.user?.name || 'Unknown Staff'}
              value={allStaffProfiles.find(profile => profile.id === selectedStaffId) || null}
              onChange={(_, newValue) => {
                setSelectedStaffId(newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Team Member"
                  placeholder="Type to search team members..."
                  helperText="Search by name, position, or employee ID"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {(option.user?.name || option.employeeId).charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">
                        {option.user?.name || 'Unknown Staff'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.position?.name} • {option.employeeId}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              noOptionsText="No team members found"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAssignment} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmAssignment} 
            variant="contained" 
            color="info"
            disabled={!selectedStaffId}
            sx={{
              borderRadius: 2,
              px: 3,
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          >
            Assign Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assignment Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={handleCloseView} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Task Assignment Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete information about this task assignment
          </Typography>
        </DialogTitle>
        <DialogContent>
          {assignmentToView && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                      <Assignment sx={{ fontSize: 24 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {getTaskTitle(assignmentToView.taskId)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                        {assignmentToView.status === 'overdue' && (
                          <Chip
                            label="OVERDUE"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                        {getTaskPriority(assignmentToView.taskId) && (
                          <Chip
                            icon={<PriorityHigh />}
                            label="HIGH PRIORITY"
                            size="small"
                            color="warning"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assignment Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <PersonAdd color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Assigned by
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {getAssignedBy(assignmentToView)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Person color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Assigned to
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {getAssignedTo(assignmentToView)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LocationOn color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Location
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {getOutletName(assignmentToView)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Task Details
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Schedule color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Due Date
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {new Date(assignmentToView.dueDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <AccessTime color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Estimated Time
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {getTaskEstimatedTime(assignmentToView.taskId)} minutes
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Assignment color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body1" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                          {assignmentToView.status}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                {assignmentToView.completedAt && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Completion Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CheckCircle color="success" />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Completed at
                          </Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {new Date(assignmentToView.completedAt).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                      {assignmentToView.completionProof && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <CameraAlt color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Completion Proof
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                              Photo provided
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {assignmentToView.minutesDeducted && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <AccessTime color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Time Deducted
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                              {assignmentToView.minutesDeducted} minutes
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseView} color="inherit">
            Close
          </Button>
          <Button 
            onClick={() => {
              if (assignmentToView) {
                window.location.href = `/tasks/${assignmentToView.id}/complete`;
              }
            }}
            variant="contained" 
            color="primary"
            startIcon={<CameraAlt />}
            sx={{
              borderRadius: 2,
              px: 3,
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          >
            Complete Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reschedule Request Dialog */}
      <RescheduleRequestDialog
        open={rescheduleDialogOpen}
        onClose={handleCloseReschedule}
        assignment={assignmentToReschedule}
        onSuccess={handleRescheduleSuccess}
        taskTitle={assignmentToReschedule ? getTaskTitle(assignmentToReschedule.taskId) : undefined}
        outletName={assignmentToReschedule ? getOutletName(assignmentToReschedule) : undefined}
      />
    </Box>
  );
};

export default StaffDashboard;
