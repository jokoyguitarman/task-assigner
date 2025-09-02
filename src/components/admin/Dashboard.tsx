import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Assignment,
  People,
  Schedule,
  CheckCircle,
  Warning,
  Add,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { TaskAssignment, Task } from '../../types';
import { assignmentsAPI, tasksAPI } from '../../services/api';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, tasksData] = await Promise.all([
        assignmentsAPI.getAll(),
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'overdue':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'overdue':
        return <Warning />;
      default:
        return <Schedule />;
    }
  };

  const pendingAssignments = assignments.filter(a => a.status === 'pending');
  const overdueAssignments = assignments.filter(a => a.status === 'overdue');
  const completedToday = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
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
                    Total Tasks
                  </Typography>
                  <Typography variant="h4">
                    {tasks.length}
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
                <Schedule color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending
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

        {/* Recent Assignments */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Recent Assignments
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => navigate('/assignments/new')}
                >
                  New Assignment
                </Button>
              </Box>
              <List>
                {assignments.slice(0, 5).map((assignment) => (
                  <ListItem key={assignment.id} divider>
                    <ListItemText
                      primary={`Task #${assignment.taskId}`}
                      secondary={`Due: ${new Date(assignment.dueDate).toLocaleDateString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        icon={getStatusIcon(assignment.status)}
                        label={assignment.status}
                        color={getStatusColor(assignment.status) as any}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<Assignment />}
                  onClick={() => navigate('/tasks/new')}
                  fullWidth
                >
                  Create Task
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<People />}
                  onClick={() => navigate('/assignments')}
                  fullWidth
                >
                  Manage Assignments
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Schedule />}
                  onClick={() => navigate('/schedule')}
                  fullWidth
                >
                  Schedule Tasks
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
