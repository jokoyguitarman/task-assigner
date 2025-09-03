import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
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
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { TaskAssignment, Task, StaffProfile } from '../../types';
import { assignmentsAPI, tasksAPI, staffProfilesAPI } from '../../services/supabaseService';

const StaffDashboard: React.FC = () => {
  const { user, currentOutlet, isOutletUser } = useAuth();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<TaskAssignment[]>([]);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [allStaffProfiles, setAllStaffProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      

      
      try {
        // First get the staff profile for this user and all staff profiles
        const staffProfiles = await staffProfilesAPI.getAll();
        const currentStaffProfile = staffProfiles.find(sp => sp.userId === user.id);
        setStaffProfile(currentStaffProfile || null);
        setAllStaffProfiles(staffProfiles);

        const [assignmentsData, tasksData, allAssignments] = await Promise.all([
          currentStaffProfile ? assignmentsAPI.getByStaff(currentStaffProfile.id) : Promise.resolve([]),
          tasksAPI.getAll(),
          assignmentsAPI.getAll(),
        ]);
        
        setAssignments(assignmentsData);
        setTasks(tasksData);
        
        // Filter tasks based on outlet for outlet users
        let unassigned = allAssignments.filter(assignment =>
          !assignment.staffId
        );

        if (isOutletUser && currentOutlet) {
          // For outlet users, show all tasks (assigned and unassigned) for their outlet
          const outletTasks = allAssignments.filter(assignment =>
            assignment.outletId === currentOutlet.id
          );
          
          // Show assigned tasks in the main assignments list
          setAssignments(outletTasks.filter(assignment => assignment.staffId));
          
          // Show unassigned tasks in the unassigned list
          unassigned = outletTasks.filter(assignment => !assignment.staffId);
        } else {
          // Staff users see all unassigned tasks
          unassigned = allAssignments.filter(assignment =>
            !assignment.staffId
          );
        }
        setUnassignedTasks(unassigned);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, currentOutlet, isOutletUser]);

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



  // For outlet users, calculate metrics based on all outlet tasks (assigned + unassigned)
  // For staff users, use only their assigned tasks
  const allOutletTasks = isOutletUser && currentOutlet 
    ? [...assignments, ...unassignedTasks] // All tasks for the outlet
    : assignments; // Only assigned tasks for staff

  const pendingAssignments = allOutletTasks.filter(a => a.status === 'pending');
  const overdueAssignments = allOutletTasks.filter(a => a.status === 'overdue');
  const completedToday = allOutletTasks.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  const totalEstimatedTime = pendingAssignments.reduce((total, assignment) => {
    return total + getTaskEstimatedTime(assignment.taskId);
  }, 0);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  const completionRate = assignments.length > 0 ? (completedToday.length / assignments.length) * 100 : 0;

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

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={800}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
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
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Pending Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {pendingAssignments.length}
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

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={1000}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
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

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={1200}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={1400}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
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
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Est. Time Remaining
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalEstimatedTime}m
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

        {/* Pending Tasks */}
        <Grid item xs={12} md={8}>
          <Fade in timeout={1600}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      Pending Tasks
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tasks waiting for your attention
                    </Typography>
                  </Box>
                  {pendingAssignments.length > 0 && (
                    <Chip 
                      label={`${pendingAssignments.length} tasks`} 
                      color="primary" 
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                </Box>
                
                {pendingAssignments.length > 0 ? (
                  <List sx={{ p: 0 }}>
                    {pendingAssignments.map((assignment, index) => (
                      <Fade in timeout={1800 + index * 200} key={assignment.id}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 2,
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#ec4899',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.15)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                              <Assignment sx={{ fontSize: 24 }} />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                {getTaskTitle(assignment.taskId)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                              </Box>
                            </Box>
                            <Button
                              variant="contained"
                              startIcon={<CameraAlt />}
                              onClick={() => {
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
                      Great job! You have no pending tasks at the moment.
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
                        {completedToday.length} / {assignments.length}
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

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Time Efficiency
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        85%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={85}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                        },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Above average performance
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
                        Total Time Today
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {totalEstimatedTime} min
                      </Typography>
                    </Box>
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
                      <Typography variant="body2" fontWeight={600}>
                        3 days
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Box>
        </Grid>

        {/* Available Tasks to Take */}
        {unassignedTasks.length > 0 && (
          <Grid item xs={12}>
            <Fade in timeout={1800}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'info.main', width: 40, height: 40 }}>
                      <TaskAlt />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Available Tasks
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {isOutletUser && currentOutlet 
                          ? `Tasks available for ${currentOutlet.name} team assignment`
                          : 'Tasks available for team assignment'
                        }
                      </Typography>
                    </Box>
                  </Box>

                  <List sx={{ width: '100%' }}>
                    {unassignedTasks.map((assignment, index) => (
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
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
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
            <FormControl fullWidth>
              <InputLabel>Select Team Member</InputLabel>
              <Select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                label="Select Team Member"
              >
                {allStaffProfiles
                  .filter(profile => {
                    if (!profile.isActive) return false;
                    // If outlet user, only show staff from the same outlet
                    // Note: We'll need to implement outlet assignment for staff later
                    // For now, show all active staff
                    return true;
                  })
                  .map((profile) => (
                    <MenuItem key={profile.id} value={profile.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {(profile.user?.name || profile.employeeId).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {profile.user?.name || 'Unknown Staff'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {profile.position?.name} • {profile.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
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
    </Box>
  );
};

export default StaffDashboard;
