import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  LinearProgress,
  Fade,
  Slide,
  Alert,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Person,
  CalendarToday,
  FilterList,
  Refresh,
  Assignment,
  AccessTime,
  LocationOn,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { 
  assignmentsAPI, 
  staffProfilesAPI, 
  outletsAPI,
  tasksAPI 
} from '../../services/supabaseService';
import { TaskAssignment, StaffProfile, Outlet, Task } from '../../types';

const PerformanceTracker: React.FC = () => {
  const { user, currentOutlet, isOutletUser } = useAuth();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const [assignmentsData, staffData, outletsData, tasksData] = await Promise.all([
          assignmentsAPI.getAll(),
          staffProfilesAPI.getAll(),
          outletsAPI.getAll(),
          tasksAPI.getAll(),
        ]);
        
        setAssignments(assignmentsData);
        setStaffProfiles(staffData);
        setOutlets(outletsData);
        setTasks(tasksData);
        
        console.log('🔍 PerformanceTracker - Loaded data:', {
          assignments: assignmentsData.length,
          staffProfiles: staffData.length,
          outlets: outletsData.length,
          tasks: tasksData.length
        });
      } catch (error) {
        console.error('Error loading performance data:', error);
        setError('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // Filter completed tasks for the selected month/year
  const getCompletedTasksForPeriod = () => {
    return assignments.filter(assignment => {
      if (assignment.status !== 'completed' || !assignment.completedAt) return false;
      
      const completedDate = new Date(assignment.completedAt);
      const isCorrectMonth = completedDate.getMonth() + 1 === selectedMonth;
      const isCorrectYear = completedDate.getFullYear() === selectedYear;
      
      return isCorrectMonth && isCorrectYear;
    });
  };

  // Filter by selected staff member
  const getFilteredCompletedTasks = () => {
    const completedTasks = getCompletedTasksForPeriod();
    
    if (selectedStaff === 'all') {
      return completedTasks;
    }
    
    return completedTasks.filter(assignment => assignment.staffId === selectedStaff);
  };

  // Get performance statistics
  const getPerformanceStats = () => {
    const completedTasks = getFilteredCompletedTasks();
    const allStaff = selectedStaff === 'all' ? staffProfiles : staffProfiles.filter(s => s.id === selectedStaff);
    
    const stats = allStaff.map(staff => {
      // Get all tasks assigned to this staff member in the selected month/year
      const allAssignedTasks = assignments.filter(a => {
        const assignedDate = new Date(a.assignedDate);
        return a.staffId === staff.id && 
               assignedDate.getMonth() + 1 === selectedMonth && 
               assignedDate.getFullYear() === selectedYear;
      });
      
      const staffCompletedTasks = completedTasks.filter(a => a.staffId === staff.id);
      
      // Count reschedule requests for this staff member in the selected month/year
      const rescheduleRequests = assignments.filter(a => {
        const assignedDate = new Date(a.assignedDate);
        return a.staffId === staff.id && 
               a.status === 'reschedule_requested' &&
               assignedDate.getMonth() + 1 === selectedMonth && 
               assignedDate.getFullYear() === selectedYear;
      }).length;
      
      // Count overdue tasks (tasks that were overdue before being completed)
      const overdueTasks = staffCompletedTasks.filter(a => {
        if (!a.completedAt) return false;
        const completedDate = new Date(a.completedAt);
        const dueDate = new Date(a.dueDate);
        return completedDate > dueDate;
      }).length;
      
      // Calculate completion rate (completed / assigned)
      const completionRate = allAssignedTasks.length > 0 ? 
        Math.round((staffCompletedTasks.length / allAssignedTasks.length) * 100) : 0;
      
      return {
        staff,
        assignedCount: allAssignedTasks.length,
        completedCount: staffCompletedTasks.length,
        completionRate,
        rescheduleRequests,
        overdueTasks,
        tasks: staffCompletedTasks
      };
    });

    return stats.sort((a, b) => b.completionRate - a.completionRate);
  };

  const getStaffName = (staffId?: string): string => {
    if (!staffId) return 'Unassigned';
    const staff = staffProfiles.find(s => s.id === staffId);
    return staff?.user?.name || 'Unknown Staff';
  };

  const getTaskTitle = (taskId: string): string => {
    const task = tasks.find(t => t.id === taskId);
    return task?.title || 'Unknown Task';
  };

  const getOutletName = (outletId?: string): string => {
    if (!outletId) return 'No location';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown location';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMonthName = (month: number): string => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const performanceStats = getPerformanceStats();
  const totalCompleted = getFilteredCompletedTasks().length;
  const totalAssigned = performanceStats.reduce((sum, stat) => sum + stat.assignedCount, 0);
  const totalRescheduleRequests = performanceStats.reduce((sum, stat) => sum + stat.rescheduleRequests, 0);
  const totalOverdue = performanceStats.reduce((sum, stat) => sum + stat.overdueTasks, 0);
  
  // Calculate overall team completion rate
  const overallCompletionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading performance data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  📊 Performance Tracker
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Track completed tasks and team performance for {getMonthName(selectedMonth)} {selectedYear}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={() => window.location.reload()}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                  }}
                >
                  Refresh
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {error && (
        <Slide direction="down" in timeout={300}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </Slide>
      )}

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={800}>
            <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Completion Rate
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {overallCompletionRate}%
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <TrendingUp sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={900}>
            <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Reschedule Requests
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalRescheduleRequests}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <CalendarToday sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={1000}>
            <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Overdue Tasks
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalOverdue}
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

        <Grid item xs={12} sm={6} md={3}>
          <Slide direction="up" in timeout={1100}>
            <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Tasks Completed
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalCompleted}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 56, height: 56 }}>
                    <CheckCircle sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Slide>
        </Grid>
      </Grid>

      {/* Filters */}
      <Slide direction="up" in timeout={1200}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList />
              Filters
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Staff Member</InputLabel>
                  <Select
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    label="Staff Member"
                  >
                    <MenuItem value="all">All Staff Members</MenuItem>
                    {staffProfiles.map((staff) => (
                      <MenuItem key={staff.id} value={staff.id}>
                        {staff.user?.name || 'Unknown Staff'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    label="Month"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <MenuItem key={month} value={month}>
                        {getMonthName(month)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    label="Year"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Slide>

      {/* Performance Leaderboard */}
      <Slide direction="up" in timeout={1400}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Leaderboard
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                    <TableCell><strong>Rank</strong></TableCell>
                    <TableCell><strong>Staff Member</strong></TableCell>
                    <TableCell align="center"><strong>Completion Rate</strong></TableCell>
                    <TableCell align="center"><strong>Reschedule Requests</strong></TableCell>
                    <TableCell align="center"><strong>Overdue Tasks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performanceStats.map((stat, index) => (
                    <TableRow key={stat.staff.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {index < 3 && (
                            <Chip
                              label={index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              size="small"
                              sx={{ fontSize: '1rem' }}
                            />
                          )}
                          <Typography variant="body2" fontWeight="bold">
                            #{index + 1}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                            {stat.staff.user?.name?.charAt(0) || stat.staff.id.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {stat.staff.user?.name || 'Unknown Staff'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stat.staff.position?.name || 'Staff Member'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          {stat.completionRate}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stat.completedCount}/{stat.assignedCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={stat.rescheduleRequests > 0 ? 'warning.main' : 'text.secondary'}>
                          {stat.rescheduleRequests}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={stat.overdueTasks > 0 ? 'error.main' : 'text.secondary'}>
                          {stat.overdueTasks}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Slide>

      {/* Completed Tasks Details */}
      <Slide direction="up" in timeout={1600}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Completed Tasks Details
            </Typography>
            {getFilteredCompletedTasks().length === 0 ? (
              <Box textAlign="center" py={4}>
                <Assignment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No completed tasks found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No tasks were completed in {getMonthName(selectedMonth)} {selectedYear}
                  {selectedStaff !== 'all' && ` by ${getStaffName(selectedStaff)}`}
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                      <TableCell><strong>Task</strong></TableCell>
                      <TableCell><strong>Completed By</strong></TableCell>
                      <TableCell><strong>Outlet</strong></TableCell>
                      <TableCell align="center"><strong>Completed At</strong></TableCell>
                      <TableCell align="center"><strong>Duration</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getFilteredCompletedTasks()
                      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
                      .map((assignment) => {
                        const task = tasks.find(t => t.id === assignment.taskId);
                        return (
                          <TableRow key={assignment.id} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {getTaskTitle(assignment.taskId)}
                                </Typography>
                                {task?.isHighPriority && (
                                  <Chip
                                    label="High Priority"
                                    size="small"
                                    color="error"
                                    sx={{ fontSize: '0.6rem', height: 20, mt: 0.5 }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 24, height: 24 }}>
                                  {getStaffName(assignment.staffId).charAt(0)}
                                </Avatar>
                                <Typography variant="body2">
                                  {getStaffName(assignment.staffId)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2">
                                  {getOutletName(assignment.outletId)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {formatDate(assignment.completedAt!)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {task?.estimatedMinutes || 0} min
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Slide>
    </Box>
  );
};

export default PerformanceTracker;
