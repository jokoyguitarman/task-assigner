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
  Select,
  MenuItem,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  CheckCircle,
  Warning,
  Schedule,
  Visibility,
  ArrowUpward,
  ArrowDownward,
  PriorityHigh,
} from '@mui/icons-material';
import { TaskAssignment, Task, User, StaffProfile, Outlet } from '../../types';
import { assignmentsAPI, tasksAPI, usersAPI, staffProfilesAPI, outletsAPI } from '../../services/supabaseService';
import AssignmentForm from './AssignmentForm';

const AssignmentList: React.FC = () => {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<TaskAssignment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<TaskAssignment | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignmentToView, setAssignmentToView] = useState<TaskAssignment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, tasksData, staffData, staffProfilesData, outletsData] = await Promise.all([
        assignmentsAPI.getAll(),
        tasksAPI.getAll(),
        usersAPI.getAll(),
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      setAssignments(assignmentsData);
      setTasks(tasksData);
      setStaff(staffData);
      setStaffProfiles(staffProfilesData);
      setOutlets(outletsData);
      
      console.log('📊 Assignment List Data:');
      console.log('Assignments:', assignmentsData);
      console.log('Staff Profiles:', staffProfilesData);
      console.log('Users:', staffData);
      console.log('Outlets:', outletsData);
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

  // Helper function to check if an assignment is overdue
  const isAssignmentOverdue = (assignment: TaskAssignment) => {
    const today = new Date();
    const dueDate = new Date(assignment.dueDate);
    return assignment.status === 'pending' && today > dueDate;
  };

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

  const getOutletName = (outletId?: string): string => {
    if (!outletId) return 'No location assigned';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown location';
  };

  const getActiveAssignments = () => {
    return assignments.filter(assignment => 
      assignment.status !== 'completed'
    );
  };

  const getFilteredAssignments = () => {
    const activeAssignments = getActiveAssignments();
    let filtered = activeAssignments;
    
    // Filter by outlet
    if (selectedOutlet !== null) {
      filtered = filtered.filter(assignment => 
        assignment.outletId === selectedOutlet
      );
    }
    
    // Filter by status
    if (selectedStatus !== null) {
      filtered = filtered.filter(assignment => {
        if (selectedStatus === 'overdue') {
          return assignment.status === 'overdue' || isAssignmentOverdue(assignment);
        } else if (selectedStatus === 'pending') {
          return assignment.status === 'pending' && !isAssignmentOverdue(assignment);
        } else {
          return assignment.status === selectedStatus;
        }
      });
    }
    
    // Filter by staff
    if (selectedStaff !== null) {
      filtered = filtered.filter(assignment => 
        assignment.staffId === selectedStaff
      );
    }
    
    return filtered;
  };

  const getTaskCountByOutlet = (outletId: string | null) => {
    const activeAssignments = getActiveAssignments();
    if (outletId === null) {
      return activeAssignments.length;
    }
    return activeAssignments.filter(assignment => 
      assignment.outletId === outletId
    ).length;
  };

  const handleOutletFilter = (outletId: string | null) => {
    setSelectedOutlet(outletId);
  };

  const getTaskCountByStatus = (status: string | null) => {
    const activeAssignments = getActiveAssignments();
    if (status === null) {
      return activeAssignments.length;
    }
    return activeAssignments.filter(assignment => 
      assignment.status === status
    ).length;
  };

  const handleStatusFilter = (status: string | null) => {
    setSelectedStatus(status);
  };

  const handleStaffFilter = (staffId: string | null) => {
    setSelectedStaff(staffId);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedAssignments = () => {
    const filtered = getFilteredAssignments();
    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'task':
          aValue = getTaskTitle(a.taskId).toLowerCase();
          bValue = getTaskTitle(b.taskId).toLowerCase();
          break;
        case 'staff':
          aValue = getStaffName(a.staffId).toLowerCase();
          bValue = getStaffName(b.staffId).toLowerCase();
          break;
        case 'location':
          aValue = getOutletName(a.outletId).toLowerCase();
          bValue = getOutletName(b.outletId).toLowerCase();
          break;
        case 'assignedDate':
          aValue = new Date(a.assignedDate).getTime();
          bValue = new Date(b.assignedDate).getTime();
          break;
        case 'dueDate':
          aValue = new Date(a.dueDate).getTime();
          bValue = new Date(b.dueDate).getTime();
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case 'completed':
          aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleView = (assignment: TaskAssignment) => {
    setAssignmentToView(assignment);
    setViewDialogOpen(true);
  };

  const handleViewClose = () => {
    setViewDialogOpen(false);
    setAssignmentToView(null);
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

      {/* Outlet Task Counters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        {/* All Active Tasks Card */}
        <Card 
          sx={{ 
            cursor: 'pointer',
            minWidth: 200,
            border: selectedOutlet === null ? '2px solid #1976d2' : '1px solid #e0e0e0',
            '&:hover': { 
              boxShadow: 3,
              transform: 'translateY(-2px)',
              transition: 'all 0.2s ease-in-out'
            }
          }}
          onClick={() => handleOutletFilter(null)}
        >
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="primary" fontWeight="bold">
              {getTaskCountByOutlet(null)}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              All Active Tasks
            </Typography>
          </CardContent>
        </Card>

        {/* Individual Outlet Cards */}
        {outlets.map((outlet) => (
          <Card 
            key={outlet.id}
            sx={{ 
              cursor: 'pointer',
              minWidth: 200,
              border: selectedOutlet === outlet.id ? '2px solid #1976d2' : '1px solid #e0e0e0',
              '&:hover': { 
                boxShadow: 3,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s ease-in-out'
              }
            }}
            onClick={() => handleOutletFilter(outlet.id)}
          >
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {getTaskCountByOutlet(outlet.id)}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {outlet.name}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Filter Dropdowns */}
      <Box display="flex" gap={3} mb={3} flexWrap="wrap">
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Status
          </Typography>
          <Select
            value={selectedStatus || 'all'}
            onChange={(e) => handleStatusFilter(e.target.value === 'all' ? null : e.target.value)}
            displayEmpty
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
          </Select>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Staff Member
          </Typography>
          <Select
            value={selectedStaff || 'all'}
            onChange={(e) => handleStaffFilter(e.target.value === 'all' ? null : e.target.value)}
            displayEmpty
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Staff</MenuItem>
            {staffProfiles.map((staff) => (
              <MenuItem key={staff.id} value={staff.id}>
                {getStaffName(staff.id)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {/* Filter Indicators */}
      {(selectedOutlet !== null || selectedStatus !== null || selectedStaff !== null) && (
        <Box mb={2} display="flex" gap={1} flexWrap="wrap">
          {selectedOutlet !== null && (
            <Chip
              label={`Outlet: ${getOutletName(selectedOutlet)}`}
              onDelete={() => handleOutletFilter(null)}
              color="primary"
              variant="outlined"
            />
          )}
          {selectedStatus !== null && (
            <Chip
              label={`Status: ${selectedStatus}`}
              onDelete={() => handleStatusFilter(null)}
              color="secondary"
              variant="outlined"
            />
          )}
          {selectedStaff !== null && (
            <Chip
              label={`Staff: ${getStaffName(selectedStaff)}`}
              onDelete={() => handleStaffFilter(null)}
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('task')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Task
                      {sortField === 'task' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('staff')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Assigned To
                      {sortField === 'staff' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('location')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Location
                      {sortField === 'location' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('assignedDate')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Assigned Date
                      {sortField === 'assignedDate' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('dueDate')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Due Date
                      {sortField === 'dueDate' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('status')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Status
                      {sortField === 'status' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('completed')}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      Completed
                      {sortField === 'completed' && (
                        sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getSortedAssignments().map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2">
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
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          mr: 1,
                          bgcolor: assignment.staffId ? 'primary.main' : 'grey.400'
                        }}>
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
                      <Typography variant="subtitle2" color="primary">
                        {assignment.outletId ? getOutletName(assignment.outletId) : 'No location assigned'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.assignedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(assignment)}
                        label={getDisplayStatus(assignment)}
                        color={getStatusColor(assignment) as any}
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
                        <IconButton 
                          size="small" 
                          color="info"
                          onClick={() => handleView(assignment)}
                        >
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

          {getSortedAssignments().length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                {(() => {
                  const filters = [];
                  if (selectedOutlet !== null) filters.push(`outlet: ${getOutletName(selectedOutlet)}`);
                  if (selectedStatus !== null) filters.push(`status: ${selectedStatus}`);
                  if (selectedStaff !== null) filters.push(`staff: ${getStaffName(selectedStaff)}`);
                  
                  if (filters.length > 0) {
                    return `No assignments found with ${filters.join(', ')}`;
                  } else {
                    return 'No active assignments found';
                  }
                })()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {(() => {
                  if (selectedOutlet !== null || selectedStatus !== null || selectedStaff !== null) {
                    return 'Try adjusting your filters or create a new assignment';
                  } else {
                    return 'Create your first assignment to get started';
                  }
                })()}
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

      {/* View Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={handleViewClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Task Assignment Details
        </DialogTitle>
        <DialogContent>
          {assignmentToView && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  {getTaskTitle(assignmentToView.taskId)}
                </Typography>
                <Chip
                  icon={getStatusIcon(assignmentToView)}
                  label={getDisplayStatus(assignmentToView)}
                  color={getStatusColor(assignmentToView) as any}
                  size="small"
                />
              </Box>

              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ 
                  width: 40, 
                  height: 40, 
                  mr: 2,
                  bgcolor: assignmentToView.staffId ? 'primary.main' : 'grey.400'
                }}>
                  {getStaffName(assignmentToView.staffId).charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {getStaffName(assignmentToView.staffId)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getStaffEmail(assignmentToView.staffId)}
                  </Typography>
                </Box>
              </Box>

              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Location
                  </Typography>
                  <Typography variant="body1">
                    {getOutletName(assignmentToView.outletId)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assigned Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(assignmentToView.assignedDate).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Due Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(assignmentToView.dueDate).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Completed Date
                  </Typography>
                  <Typography variant="body1">
                    {assignmentToView.completedAt 
                      ? new Date(assignmentToView.completedAt).toLocaleDateString()
                      : 'Not completed'
                    }
                  </Typography>
                </Box>
              </Box>


              {assignmentToView.completionProof && assignmentToView.completionProof.trim() !== '' && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Completion Proof
                  </Typography>
                  <Typography variant="body1">
                    {assignmentToView.completionProof}
                  </Typography>
                </Box>
              )}

              {assignmentToView.minutesDeducted !== undefined && assignmentToView.minutesDeducted !== null && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Minutes Deducted
                  </Typography>
                  <Typography variant="body1">
                    {assignmentToView.minutesDeducted} minutes
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleViewClose}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              handleViewClose();
              handleEdit(assignmentToView!);
            }}
            startIcon={<Edit />}
          >
            Edit Assignment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentList;
