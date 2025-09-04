import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  LinearProgress,
  Slide,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { TaskAssignment, User, StaffProfile, Outlet } from '../../types';
import { assignmentsAPI, usersAPI, staffProfilesAPI, outletsAPI } from '../../services/supabaseService';

interface StaffWithOutlet extends StaffProfile {
  user: User;
  primaryOutletId: string;
}

interface LeaderboardStats {
  staff: StaffWithOutlet;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  rescheduleRequests: number;
  overdueTasks: number;
  tasks: TaskAssignment[];
}

const Leaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardStats[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (assignments.length > 0) {
      generateLeaderboard();
    }
  }, [assignments, selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, usersData, staffProfilesData, outletsData] = await Promise.all([
        assignmentsAPI.getAll(),
        usersAPI.getAll(),
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      
      setAssignments(assignmentsData);
      setUsers(usersData);
      setStaffProfiles(staffProfilesData);
      setOutlets(outletsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLeaderboard = () => {
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    const allStaff = staffProfiles.map(staff => {
      const user = users.find(u => u.id === staff.userId);
      return { ...staff, user: user! };
    });

    const stats = allStaff.map(staff => {
      const allAssignedTasks = assignments.filter(a => {
        const assignmentDate = new Date(a.assignedDate);
        return a.staffId === staff.id && 
               assignmentDate >= startDate && 
               assignmentDate <= endDate;
      });

      const completedTasks = allAssignedTasks.filter(a => a.status === 'completed');
      const rescheduleRequests = allAssignedTasks.filter(a => a.status === 'reschedule_requested').length;
      const overdueTasks = completedTasks.filter(a => {
        if (!a.completedAt) return false;
        return new Date(a.completedAt) > new Date(a.dueDate);
      }).length;

      const completionRate = allAssignedTasks.length > 0 ? 
        Math.round((completedTasks.length / allAssignedTasks.length) * 100) : 0;

      // Get the most common outlet for this staff member from their assignments
      const outletCounts = allAssignedTasks.reduce((acc, assignment) => {
        if (assignment.outletId) {
          acc[assignment.outletId] = (acc[assignment.outletId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      const primaryOutletId = Object.keys(outletCounts).reduce((a, b) => 
        outletCounts[a] > outletCounts[b] ? a : b, Object.keys(outletCounts)[0] || '');

      return {
        staff: { ...staff, primaryOutletId },
        assignedCount: allAssignedTasks.length,
        completedCount: completedTasks.length,
        completionRate,
        rescheduleRequests,
        overdueTasks,
        tasks: completedTasks,
      };
    });

    // Sort by completion rate, then by completed count
    const sortedStats = stats
      .filter(stat => stat.assignedCount > 0) // Only show staff with assigned tasks
      .sort((a, b) => {
        if (b.completionRate !== a.completionRate) {
          return b.completionRate - a.completionRate;
        }
        return b.completedCount - a.completedCount;
      });

    setLeaderboardData(sortedStats);
  };

  const getOutletName = (outletId: string) => {
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown Outlet';
  };

  const getOutletColor = (outletId: string) => {
    // Generate a consistent color based on outlet ID
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    const hash = outletId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  const getRankColor = (index: number) => {
    if (index === 0) return '#ffd700';
    if (index === 1) return '#c0c0c0';
    if (index === 2) return '#cd7f32';
    return 'text.secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TrophyIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Performance Leaderboard
            </Typography>
          </Box>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  const totalAssigned = leaderboardData.reduce((sum, stat) => sum + stat.assignedCount, 0);
  const totalCompleted = leaderboardData.reduce((sum, stat) => sum + stat.completedCount, 0);
  const overallCompletionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TrophyIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Performance Leaderboard
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                label="Month"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                label="Year"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: 2 }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {overallCompletionRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall Completion Rate
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 2 }}>
              <Typography variant="h4" fontWeight={700} color="success.main">
                {totalCompleted}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tasks Completed
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 2 }}>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {leaderboardData.reduce((sum, stat) => sum + stat.rescheduleRequests, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reschedule Requests
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 2 }}>
              <Typography variant="h4" fontWeight={700} color="error.main">
                {leaderboardData.reduce((sum, stat) => sum + stat.overdueTasks, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overdue Tasks
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Leaderboard Table */}
        {leaderboardData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AssessmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No performance data available for this period
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
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
                {leaderboardData.map((stat, index) => (
                  <Slide key={stat.staff.id} direction="up" in timeout={300 + index * 50}>
                    <TableRow hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="h6"
                            fontWeight={700}
                            sx={{ color: getRankColor(index), minWidth: 24 }}
                          >
                            {getRankIcon(index)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar
                            sx={{
                              backgroundColor: getOutletColor(stat.staff.primaryOutletId),
                              color: 'white',
                              fontWeight: 'bold',
                            }}
                          >
                            {stat.staff.user?.name?.charAt(0) || 'U'}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {stat.staff.user?.name || 'Unknown User'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {getOutletName(stat.staff.primaryOutletId)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <Typography variant="h6" fontWeight={600} color="primary.main">
                            {stat.completionRate}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={stat.completionRate}
                            sx={{
                              width: 60,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: 'primary.main',
                                borderRadius: 3,
                              },
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={stat.rescheduleRequests}
                          size="small"
                          color={stat.rescheduleRequests > 0 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={stat.overdueTasks}
                          size="small"
                          color={stat.overdueTasks > 0 ? 'error' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  </Slide>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
