import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  CheckCircle,
  Warning,
  Schedule,
  Visibility,
} from '@mui/icons-material';
import { TaskAssignment, Task, User } from '../../types';
import { assignmentsAPI, tasksAPI, usersAPI } from '../../services/api';
import AssignmentForm from './AssignmentForm';

const AssignmentList: React.FC = () => {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<TaskAssignment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<TaskAssignment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, tasksData, staffData] = await Promise.all([
        assignmentsAPI.getAll(),
        tasksAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setAssignments(assignmentsData);
      setTasks(tasksData);
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (assignment: TaskAssignment) => {
    setSelectedAssignment(assignment);
    setFormOpen(true);
  };

  const handleDelete = (assignment: TaskAssignment) => {
    setAssignmentToDelete(assignment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (assignmentToDelete) {
      try {
        await assignmentsAPI.delete(assignmentToDelete.id);
        await loadData();
        setDeleteDialogOpen(false);
        setAssignmentToDelete(null);
      } catch (error) {
        console.error('Error deleting assignment:', error);
      }
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedAssignment(null);
    loadData();
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

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.title : 'Unknown Task';
  };

  const getStaffName = (staffId: string) => {
    const member = staff.find(s => s.id === staffId);
    return member ? member.name : 'Unknown Staff';
  };

  const getStaffEmail = (staffId: string) => {
    const member = staff.find(s => s.id === staffId);
    return member ? member.email : '';
  };

  if (loading) {
    return <Typography>Loading assignments...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Task Assignments
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setFormOpen(true)}
        >
          New Assignment
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Assigned Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {getTaskTitle(assignment.taskId)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                          {getStaffName(assignment.staffId).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {getStaffName(assignment.staffId)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getStaffEmail(assignment.staffId)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.assignedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(assignment.status)}
                        label={assignment.status}
                        color={getStatusColor(assignment.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {assignment.completedAt 
                        ? new Date(assignment.completedAt).toLocaleDateString()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small" color="info">
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(assignment)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(assignment)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {assignments.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                No assignments created yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create your first assignment to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setFormOpen(true)}
              >
                Create Assignment
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Assignment Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={handleFormClose}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <AssignmentForm
            assignmentId={selectedAssignment?.id}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this assignment?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentList;
