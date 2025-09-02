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
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Warning,
  Schedule,
  CameraAlt,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { TaskAssignment, Task } from '../../types';
import { assignmentsAPI, tasksAPI } from '../../services/api';

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        const [assignmentsData, tasksData] = await Promise.all([
          assignmentsAPI.getByStaff(user.id),
          tasksAPI.getAll(),
        ]);
        setAssignments(assignmentsData);
        setTasks(tasksData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.title : 'Unknown Task';
  };

  const getTaskEstimatedTime = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.estimatedMinutes : 0;
  };



  const pendingAssignments = assignments.filter(a => a.status === 'pending');
  const overdueAssignments = assignments.filter(a => a.status === 'overdue');
  const completedToday = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  const totalEstimatedTime = pendingAssignments.reduce((total, assignment) => {
    return total + getTaskEstimatedTime(assignment.taskId);
  }, 0);

  if (loading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Tasks
      </Typography>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Assignment color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Tasks
                  </Typography>
                  <Typography variant="h4">
                    {pendingAssignments.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Warning color="error" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Overdue
                  </Typography>
                  <Typography variant="h4">
                    {overdueAssignments.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircle color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Completed Today
                  </Typography>
                  <Typography variant="h4">
                    {completedToday.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Schedule color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Est. Time Remaining
                  </Typography>
                  <Typography variant="h4">
                    {totalEstimatedTime}m
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Tasks */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pending Tasks
              </Typography>
              {pendingAssignments.length > 0 ? (
                <List>
                  {pendingAssignments.map((assignment) => (
                    <ListItem key={assignment.id} divider>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <Assignment />
                      </Avatar>
                      <ListItemText
                        primary={getTaskTitle(assignment.taskId)}
                        secondary={`Due: ${new Date(assignment.dueDate).toLocaleDateString()} • ${getTaskEstimatedTime(assignment.taskId)} minutes`}
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="contained"
                          startIcon={<CameraAlt />}
                          size="small"
                          onClick={() => {
                            // Navigate to task completion
                            window.location.href = `/tasks/${assignment.id}/complete`;
                          }}
                        >
                          Complete
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box textAlign="center" py={4}>
                  <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No pending tasks
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Great job! You're all caught up.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today's Progress
              </Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Tasks Completed: {completedToday.length}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={assignments.length > 0 ? (completedToday.length / assignments.length) * 100 : 0}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Time Efficiency
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={75} // Mock value - calculate based on actual completion times
                  color="success"
                  sx={{ mt: 1 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StaffDashboard;
