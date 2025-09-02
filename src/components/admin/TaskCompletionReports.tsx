import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Fade,
  Slide,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Assessment as ReportIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { exportService, TaskCompletionReport } from '../../services/exportService';
import { assignmentsAPI, tasksAPI, usersAPI } from '../../services/supabaseService';
import { TaskAssignment, Task, User } from '../../types';

const TaskCompletionReports: React.FC = () => {
  const [reportData, setReportData] = useState<TaskCompletionReport[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter states
  const [dateRange, setDateRange] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Dialog states
  const [openPreview, setOpenPreview] = useState(false);
  const [previewData, setPreviewData] = useState<TaskCompletionReport[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (assignments.length > 0) {
      generateReport();
    }
  }, [assignments, dateRange, startDate, endDate, selectedStaff, selectedStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, tasksData, usersData] = await Promise.all([
        assignmentsAPI.getAll(),
        tasksAPI.getAll(),
        usersAPI.getAll(),
      ]);
      
      setAssignments(assignmentsData);
      setTasks(tasksData);
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    try {
      let filteredAssignments = [...assignments];

      // Filter by date range
      const now = new Date();
      let filterStartDate: Date;
      let filterEndDate: Date;

      switch (dateRange) {
        case 'daily':
          filterStartDate = new Date(now);
          filterEndDate = new Date(now);
          break;
        case 'weekly':
          filterStartDate = new Date(now);
          filterStartDate.setDate(now.getDate() - 7);
          filterEndDate = new Date(now);
          break;
        case 'monthly':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
          filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'custom':
          filterStartDate = startDate;
          filterEndDate = endDate;
          break;
        default:
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
          filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      filteredAssignments = filteredAssignments.filter(assignment => {
        const assignmentDate = new Date(assignment.assignedDate);
        return assignmentDate >= filterStartDate && assignmentDate <= filterEndDate;
      });

      // Filter by staff
      if (selectedStaff !== 'all') {
        filteredAssignments = filteredAssignments.filter(assignment => assignment.staffId === selectedStaff);
      }

      // Filter by status
      if (selectedStatus !== 'all') {
        filteredAssignments = filteredAssignments.filter(assignment => assignment.status === selectedStatus);
      }

      // Transform to report format
      const reportData: TaskCompletionReport[] = filteredAssignments.map(assignment => {
        const task = tasks.find(t => t.id === assignment.taskId);
        const user = users.find(u => u.id === assignment.staffId);
        
        return {
          taskId: assignment.id,
          taskName: task?.title || 'Unknown Task',
          assignedTo: user?.name || 'Unknown User',
          assignedAt: assignment.assignedDate.toISOString(),
          dueDate: assignment.dueDate.toISOString(),
          completedAt: assignment.completedAt?.toISOString(),
          status: assignment.status,
          estimatedMinutes: task?.estimatedMinutes || 0,
          actualMinutes: assignment.minutesDeducted,
          proofFiles: assignment.completionProof ? [assignment.completionProof] : [],
        };
      });

      setReportData(reportData);
    } catch (err) {
      setError('Failed to generate report');
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      await exportService.exportTaskCompletionToPDF(reportData, {
        format: 'pdf',
        filename: `task_completion_report_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`,
        title: `Task Completion Report - ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`,
      });
      setSuccess('Report exported to PDF successfully');
    } catch (err) {
      setError('Failed to export PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      exportService.exportTaskCompletionToCSV(reportData, {
        format: 'csv',
        filename: `task_completion_report_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`,
      });
      setSuccess('Report exported to CSV successfully');
    } catch (err) {
      setError('Failed to export CSV');
    }
  };

  const handlePreview = () => {
    setPreviewData(reportData);
    setOpenPreview(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'pending': return <PendingIcon />;
      case 'overdue': return <WarningIcon />;
      default: return <PendingIcon />;
    }
  };

  const getCompletionRate = () => {
    if (reportData.length === 0) return 0;
    const completed = reportData.filter(d => d.status === 'completed').length;
    return ((completed / reportData.length) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading report data...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Fade in timeout={600}>
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" component="h1" gutterBottom>
                    📊 Task Completion Reports
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Generate and export detailed task completion reports
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    startIcon={<ReportIcon />}
                    onClick={handlePreview}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PdfIcon />}
                    onClick={handleExportPDF}
                    disabled={exportLoading || reportData.length === 0}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                    }}
                  >
                    {exportLoading ? 'Exporting...' : 'Export PDF'}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CsvIcon />}
                    onClick={handleExportCSV}
                    disabled={reportData.length === 0}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                    }}
                  >
                    Export CSV
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

        {success && (
          <Slide direction="down" in timeout={300}>
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Slide>
        )}

        {/* Filters */}
        <Slide direction="up" in timeout={600}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                Report Filters
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Date Range</InputLabel>
                    <Select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as any)}
                      label="Date Range"
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="custom">Custom Range</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {dateRange === 'custom' && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={(date) => setStartDate(date || new Date())}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={(date) => setEndDate(date || new Date())}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                  </>
                )}

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Staff Member</InputLabel>
                    <Select
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                      label="Staff Member"
                    >
                      <MenuItem value="all">All Staff</MenuItem>
                      {users.filter(u => u.role === 'staff').map(user => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="overdue">Overdue</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Slide>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {reportData.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Tasks
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {reportData.filter(d => d.status === 'completed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="warning.main">
                  {reportData.filter(d => d.status === 'pending').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="error.main">
                  {reportData.filter(d => d.status === 'overdue').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overdue
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Report Table */}
        <Slide direction="up" in timeout={600}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Report Data ({reportData.length} tasks)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completion Rate: {getCompletionRate()}%
                </Typography>
              </Box>
              
              {reportData.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <ReportIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No data found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting your filters to see more results
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                        <TableCell><strong>Task</strong></TableCell>
                        <TableCell><strong>Assigned To</strong></TableCell>
                        <TableCell><strong>Due Date</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Est. Time</strong></TableCell>
                        <TableCell><strong>Actual Time</strong></TableCell>
                        <TableCell><strong>Proof Files</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.map((row, index) => (
                        <Slide key={row.taskId} direction="up" in timeout={300 + index * 50}>
                          <TableRow hover>
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {row.taskName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                                {row.assignedTo}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {new Date(row.dueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={getStatusIcon(row.status)}
                                label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                                color={getStatusColor(row.status) as any}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {row.estimatedMinutes}m
                            </TableCell>
                            <TableCell>
                              {row.actualMinutes ? `${row.actualMinutes}m` : '-'}
                            </TableCell>
                            <TableCell>
                              {row.proofFiles && row.proofFiles.length > 0 ? (
                                <Chip
                                  label={`${row.proofFiles.length} files`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              ) : (
                                '-'
                              )}
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
        </Slide>

        {/* Preview Dialog */}
        <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Report Preview
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This is a preview of the data that will be exported. The actual export may have different formatting.
            </Typography>
            
            <List>
              {previewData.slice(0, 10).map((item, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    {getStatusIcon(item.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.taskName}
                    secondary={`${item.assignedTo} • Due: ${new Date(item.dueDate).toLocaleDateString()} • Status: ${item.status}`}
                  />
                </ListItem>
              ))}
              {previewData.length > 10 && (
                <ListItem>
                  <ListItemText
                    primary={`... and ${previewData.length - 10} more items`}
                    sx={{ fontStyle: 'italic' }}
                  />
                </ListItem>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPreview(false)}>Close</Button>
            <Button onClick={handleExportPDF} variant="contained" startIcon={<PdfIcon />}>
              Export PDF
            </Button>
            <Button onClick={handleExportCSV} variant="contained" startIcon={<CsvIcon />}>
              Export CSV
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default TaskCompletionReports;
