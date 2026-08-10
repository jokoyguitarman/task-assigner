import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Autocomplete,
  TextField,
  CircularProgress,
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
  LocationOn,
  PersonAdd,
  PriorityHigh,
  Add,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { TaskAssignment, Task, StaffProfile, User, Outlet } from '../../types';
import { effectiveStatus } from '../../lib/assignmentStatus';
import { assignmentsAPI, tasksAPI, staffProfilesAPI, usersAPI, outletsAPI, monthlySchedulesAPI } from '../../services/supabaseService';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { realtimeService } from '../../services/realtimeService';
import ToastNotification from '../common/ToastNotification';
import RescheduleRequestDialog from './RescheduleRequestDialog';
import AreaChecklists from './AreaChecklists';
import RaiseTaskDialog from './RaiseTaskDialog';

const StaffDashboard: React.FC = () => {
  const { user, currentOutlet, isOutletUser } = useAuth();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<TaskAssignment[]>([]);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [allStaffProfiles, setAllStaffProfiles] = useState<StaffProfile[]>([]);
  const [taskCreators, setTaskCreators] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  // Name of whoever currently owns the task being reassigned, or null when the task
  // is unclaimed and no reason is needed.
  const [reassigningFrom, setReassigningFrom] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [availableStaffForAssignment, setAvailableStaffForAssignment] = useState<StaffProfile[]>([]);
  const [loadingAvailableStaff, setLoadingAvailableStaff] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignmentToView, setAssignmentToView] = useState<TaskAssignment | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [assignmentToReschedule, setAssignmentToReschedule] = useState<TaskAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<any>(null);

  // One loader, used by the first render, the realtime callback and the
  // auto-refresh hook alike. There used to be two near-identical copies that
  // had already drifted: only one of them refreshed the roster and the streaks.
  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [tasksData, allAssignments, outletsData, staffProfilesData] = await Promise.all([
        tasksAPI.getAll(),
        assignmentsAPI.getAll(),
        outletsAPI.getAll(),
        staffProfilesAPI.getAll(),
      ]);

      setTasks(tasksData);
      setOutlets(outletsData);
      setAllStaffProfiles(staffProfilesData);

      // Only the handful of accounts that actually created these tasks, so the
      // "assigned by" label can name them. This used to pull every user in the
      // organization on every refresh.
      const creatorIds = Array.from(
        new Set(tasksData.map(t => t.createdBy).filter(Boolean))
      );
      setTaskCreators(creatorIds.length > 0 ? await usersAPI.getByIds(creatorIds) : []);

      // Streaks belong to roster members, and the account signed in here is a
      // branch rather than a person. Show the best streak on the branch's
      // roster, which is at least meaningful; the personal streak this card
      // used to read was always zero because nothing ever wrote one to a
      // branch account.
      setCurrentStreak(Math.max(0, ...staffProfilesData.map(s => s.currentStreak)));
      setLongestStreak(Math.max(0, ...staffProfilesData.map(s => s.longestStreak)));

      if (isOutletUser && currentOutlet) {
        // Both assigned and unassigned work for this branch. Unassigned tasks
        // are picked out of `assignments` where they are needed, rather than
        // kept in a second list that the display would then show twice.
        setAssignments(allAssignments.filter(a => a.outletId === currentOutlet.id));
        setUnassignedTasks([]);
      } else {
        // Every principal that reaches this dashboard is a branch, and a
        // branch always has an outlet. Landing here means the session has no
        // outlet claim yet, so there is nothing this account can read.
        console.warn('Signed in without a branch; no assignments to show.');
        setStaffProfile(null);
        setAssignments([]);
        setUnassignedTasks([]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user, isOutletUser, currentOutlet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time updates for staff dashboard
  useEffect(() => {
    if (!user) return;

    const unsubscribe = realtimeService.subscribeToDashboardMetrics();
    realtimeService.setNotificationCallback(setToastNotification);
    realtimeService.setRefreshCallback(loadData);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, loadData]);

  // Auto-refresh when data changes
  useAutoRefresh({ 
    refreshFunction: loadData
  });

  const handleTakeTask = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setSelectedStaffId('');
    setReassignReason('');

    // Taking on unclaimed work is free. Taking it off a named person is a
    // reassignment, and the database will refuse one without a reason, so find out
    // which of the two this is before opening the dialog.
    const existing = [...assignments, ...unassignedTasks].find(a => a.id === assignmentId);
    const currentOwner = existing?.staffId
      ? allStaffProfiles.find(profile => profile.id === existing.staffId)
      : undefined;
    setReassigningFrom(currentOwner?.name || (existing?.staffId ? 'someone else' : null));

    setLoadingAvailableStaff(true);
    setAssignDialogOpen(true);
    
    try {
      const availableStaff = await getAvailableStaffForAssignment(assignmentId);
      setAvailableStaffForAssignment(availableStaff);
    } catch (error) {
      console.error('Error loading available staff:', error);
      // Fallback to all active staff
      setAvailableStaffForAssignment(allStaffProfiles.filter(profile => profile.isActive));
    } finally {
      setLoadingAvailableStaff(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!selectedStaffId || !selectedAssignmentId) return;

    if (reassigningFrom && reassignReason.trim().length < 5) {
      setError(`Taking this task off ${reassigningFrom} needs a reason of at least 5 characters.`);
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
      
      // Get the selected staff member's name for the success message
      const selectedStaff = availableStaffForAssignment.find(staff => staff.id === selectedStaffId);
      const staffName = selectedStaff?.name || 'Unknown Staff';
      
      await assignmentsAPI.update(selectedAssignmentId, {
        staffId: selectedStaffId,
        reassignmentReason: reassigningFrom ? reassignReason.trim() : undefined,
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
      
      // Show success message
      setSuccessMessage(`Task successfully assigned to ${staffName}!`);
      
      // Close dialog
      setAssignDialogOpen(false);
      setSelectedAssignmentId('');
      setSelectedStaffId('');
      setReassigningFrom(null);
      setReassignReason('');
      setAvailableStaffForAssignment([]);
      setLoadingAvailableStaff(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error assigning task:', error);
      // The database enforces the reassignment rules, so show what it actually
      // said rather than a generic failure the branch cannot act on.
      setError(error instanceof Error ? error.message : 'Failed to assign task. Please try again.');
    }
  };

  const handleCancelAssignment = () => {
    setAssignDialogOpen(false);
    setSelectedAssignmentId('');
    setSelectedStaffId('');
    setReassigningFrom(null);
    setReassignReason('');
    setAvailableStaffForAssignment([]);
    setLoadingAvailableStaff(false);
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
    return taskCreators.find(u => u.id === task.createdBy)?.name || 'Unknown';
  };

  const getAssignedTo = (assignment: TaskAssignment) => {
    if (!assignment.staffId) return 'Unassigned';
    const staffProfile = allStaffProfiles.find(sp => sp.id === assignment.staffId);
    return staffProfile ? (staffProfile.name || 'Unknown Staff') : 'Unknown Staff';
  };

  const getOutletName = (assignment: TaskAssignment) => {
    const outlet = outlets.find(o => o.id === assignment.outletId);
    return outlet ? outlet.name : 'Unknown Outlet';
  };

  // Filter available staff for assignment based on outlet and schedule
  const getAvailableStaffForAssignment = async (assignmentId: string) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        console.log('❌ No assignment found for ID:', assignmentId);
        return [];
      }

      console.log('🔍 Filtering staff for assignment:', {
        assignmentId,
        outletId: assignment.outletId,
        dueDate: assignment.dueDate
      });

      // Get staff profiles assigned to the same outlet
      const outletStaff = allStaffProfiles.filter(profile => {
        // For now, we'll assume all staff can work at any outlet
        // In the future, we can add outlet-specific staff assignments
        return profile.isActive;
      });

      console.log('👥 Total active staff profiles:', outletStaff.length);

      // If no due date, return all outlet staff
      if (!assignment.dueDate) {
        console.log('📅 No due date, returning all active staff');
        return outletStaff;
      }

      // Check schedule availability for the due date
      const dueDate = new Date(assignment.dueDate);
      const month = dueDate.getMonth() + 1;
      const year = dueDate.getFullYear();

      console.log('📅 Checking schedules for:', { dueDate: dueDate.toDateString(), month, year });

      const availableStaff = [];

      for (const staffProfile of outletStaff) {
        try {
          console.log(`👤 Checking availability for staff: ${staffProfile.name} (${staffProfile.id})`);
          
          // Get monthly schedule for this staff member
          const monthlySchedules = await monthlySchedulesAPI.getByStaff(staffProfile.id);
          const monthlySchedule = monthlySchedules.find((ms: any) => ms.month === month && ms.year === year);
          
          if (monthlySchedule) {
            console.log(`📅 Found monthly schedule for ${staffProfile.name}`);
            const dailySchedule = monthlySchedule.dailySchedules?.find((ds: any) => 
              new Date(ds.scheduleDate).toDateString() === dueDate.toDateString()
            );

            if (dailySchedule) {
              console.log(`📅 Found daily schedule for ${staffProfile.name}:`, {
                isDayOff: dailySchedule.isDayOff,
                outletId: dailySchedule.outletId,
                assignmentOutletId: assignment.outletId,
                timeIn: dailySchedule.timeIn,
                timeOut: dailySchedule.timeOut
              });
              
              // Check if staff is working at the correct outlet on this date
              if (!dailySchedule.isDayOff && 
                  dailySchedule.outletId === assignment.outletId) {
                
                // Include anyone working that day at that outlet
                console.log(`✅ Adding ${staffProfile.name} to available staff`);
                availableStaff.push(staffProfile);
              } else {
                console.log(`❌ ${staffProfile.name} not available - day off or wrong outlet`);
              }
            } else {
              console.log(`📅 No daily schedule for ${staffProfile.name} on ${dueDate.toDateString()}`);
              // No schedule for this date, assume available
              console.log(`✅ Adding ${staffProfile.name} to available staff (no schedule)`);
              availableStaff.push(staffProfile);
            }
          } else {
            console.log(`📅 No monthly schedule for ${staffProfile.name} for ${month}/${year}`);
            // No monthly schedule, assume available
            console.log(`✅ Adding ${staffProfile.name} to available staff (no monthly schedule)`);
            availableStaff.push(staffProfile);
          }
        } catch (error) {
          console.error('Error checking availability for staff:', staffProfile.id, error);
          // If we can't check availability, include them anyway
          console.log(`✅ Adding ${staffProfile.name} to available staff (error fallback)`);
          availableStaff.push(staffProfile);
        }
      }

      console.log(`🎯 Final available staff count: ${availableStaff.length}`);
      return availableStaff;
    } catch (error) {
      console.error('Error filtering available staff:', error);
      // Fallback to all active staff
      return allStaffProfiles.filter(profile => profile.isActive);
    }
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
    loadData();
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
        if (selectedStatus === 'priority') {
          return Boolean(tasks.find(t => t.id === assignment.taskId)?.isHighPriority);
        }
        // Was comparing the raw dueDate against now, which called a task due
        // later today overdue and disagreed with the chip next to it.
        if (effectiveStatus(assignment) !== selectedStatus) return false;
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

  // Recalculating streaks used to happen here, on every dashboard load, against
  // the signed-in account. That account is a branch, not a roster member, so the
  // write had nowhere valid to land. Recalculation belongs in the scheduled job
  // alongside the overdue sweep rather than in a render path.

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
    ? assignments // All outlet assignments (already includes both assigned and unassigned)
    : assignments; // Only assigned tasks for staff

  // Calculate stats from ALL tasks (not filtered)
  const allPendingAssignments = allOutletTasks.filter(a => a.status === 'pending');
  const allOverdueAssignments = allOutletTasks.filter(a => a.status === 'overdue');
  const allCompletedToday = allOutletTasks.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  // Apply filters to the task lists for display
  // For the main display, only show pending and overdue tasks (not completed)
  const activeAssignments = allOutletTasks.filter(a => a.status === 'pending' || a.status === 'overdue');
  const filteredAssignments = getFilteredAssignments(activeAssignments);
  
  // For outlet users, filter unassigned tasks from allOutletTasks
  // For staff users, use the separate unassignedTasks array
  const unassignedTasksToShow = isOutletUser && currentOutlet 
    ? allOutletTasks.filter(a => !a.staffId)
    : unassignedTasks;
  const filteredUnassignedTasks = getFilteredAssignments(unassignedTasksToShow);
  const allUnassignedTasks = unassignedTasksToShow;
  
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
  

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  // Reloading the page threw away the session restore and the realtime
  // subscription to retry four queries. Just run them again.
  const handleRetry = () => {
    setError(null);
    loadData();
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={handleRetry}
          sx={{
            background: 'linear-gradient(45deg, #9c27b0 30%, #3f51b5 90%)',
            color: 'white',
            borderRadius: 2,
            px: 3,
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          Retry
        </Button>
      </Box>
    );
  }


  const completionRate = activeTasksForToday > 0 ? (completedToday.length / activeTasksForToday) * 100 : 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Success Message */}
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}
      
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
                            {staff.name || 'Unknown Staff'}
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
                
                <AreaChecklists
                  assignments={[...overdueAssignments, ...pendingAssignments]}
                  tasks={tasks}
                  staffProfiles={allStaffProfiles}
                  onOpen={handleViewAssignment}
                  onClaim={handleTakeTask}
                  onComplete={(id) => { window.location.href = `/tasks/${id}/complete`; }}
                />

                {isOutletUser && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={() => setRaiseOpen(true)}
                      sx={{ borderRadius: 2, borderStyle: 'dashed', py: 1.25 }}
                    >
                      Something needs doing
                    </Button>
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
            {reassigningFrom ? 'Reassign Task' : 'Assign Task to Team Member'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {reassigningFrom
              ? `${reassigningFrom} currently owns this task. Moving it is recorded, so say why.`
              : 'Who will be responsible for completing this task?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {loadingAvailableStaff ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Checking staff availability...
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Autocomplete
                options={availableStaffForAssignment}
                getOptionLabel={(option) => option.name || 'Unknown Staff'}
                value={availableStaffForAssignment.find(profile => profile.id === selectedStaffId) || null}
                onChange={(_, newValue) => {
                  setSelectedStaffId(newValue?.id || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                label="Select Team Member"
                    placeholder="Type to search available team members..."
                    helperText={`${availableStaffForAssignment.length} team members available for this task`}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {(option.name || option.employeeId).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {option.name || 'Unknown Staff'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.position?.name} • {option.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                }}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                noOptionsText="No available team members found for this task"
              />
            )}

            {reassigningFrom && !loadingAvailableStaff && (
              <TextField
                label="Why is this moving?"
                placeholder="e.g. called in sick, sent to the other branch, shift swapped"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                required
                multiline
                minRows={2}
                fullWidth
                sx={{ mt: 3 }}
                helperText="Kept as a permanent record on this task and cannot be edited later."
              />
            )}
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
            disabled={!selectedStaffId || (!!reassigningFrom && reassignReason.trim().length < 5)}
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
          {assignmentToView && assignmentToView.status !== 'completed' && (
            <Button
              onClick={() => {
                handleCloseView();
                handleRequestReschedule(assignmentToView);
              }}
              color="inherit"
            >
              Ask for more time
            </Button>
          )}
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

      <RaiseTaskDialog
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        onRaised={loadData}
      />

      {/* Reschedule Request Dialog */}
      <RescheduleRequestDialog
        open={rescheduleDialogOpen}
        onClose={handleCloseReschedule}
        assignment={assignmentToReschedule}
        onSuccess={handleRescheduleSuccess}
        taskTitle={assignmentToReschedule ? getTaskTitle(assignmentToReschedule.taskId) : undefined}
        outletName={assignmentToReschedule ? getOutletName(assignmentToReschedule) : undefined}
      />

      {/* Toast Notification */}
      <ToastNotification 
        notification={toastNotification}
        onClose={() => setToastNotification(null)}
      />
    </Box>
  );
};

export default StaffDashboard;
