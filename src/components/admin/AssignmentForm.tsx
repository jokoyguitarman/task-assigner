import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  FormControlLabel,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { AssignmentFormData, Task, User, StaffProfile, Outlet, DailySchedule } from '../../types';
import { 
  tasksAPI, 
  usersAPI, 
  assignmentsAPI, 
  staffProfilesAPI, 
  outletsAPI, 
  monthlySchedulesAPI 
} from '../../services/supabaseService';

interface AssignmentFormProps {
  assignmentId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({ assignmentId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [smartAssignment, setSmartAssignment] = useState(true);
  const [availableStaff, setAvailableStaff] = useState<StaffProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<AssignmentFormData>({
    defaultValues: {
      taskId: '',
      staffId: '',
      dueDate: new Date(),
      dueTime: '',
      outletId: '',
    },
  });

  const selectedTaskId = watch('taskId');
  const selectedDueDate = watch('dueDate');
  const selectedOutletId = watch('outletId');
  const selectedDueTime = watch('dueTime');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, staffData, staffProfilesData, outletsData] = await Promise.all([
        tasksAPI.getAll(),
        usersAPI.getAll(),
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      setTasks(tasksData);
      setStaff(staffData);
      setStaffProfiles(staffProfilesData);
      setOutlets(outletsData);
      
      console.log('📊 Assignment Form Data Loaded:');
      console.log('Tasks:', tasksData.length, tasksData);
      console.log('Staff:', staffData.length, staffData);
      console.log('Staff Profiles:', staffProfilesData.length, staffProfilesData);
      console.log('Outlets:', outletsData.length, outletsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Check staff availability for smart assignment
  useEffect(() => {
    if (smartAssignment && selectedDueDate && selectedOutletId && selectedDueTime) {
      checkStaffAvailability();
    } else {
      setAvailableStaff(staffProfiles);
    }
  }, [selectedDueDate, selectedOutletId, selectedDueTime, smartAssignment, staffProfiles]);

  const checkStaffAvailability = async () => {
    if (!selectedDueDate || !selectedOutletId || !selectedDueTime) return;

    const month = selectedDueDate.getMonth() + 1;
    const year = selectedDueDate.getFullYear();
    
    const availableStaffList: StaffProfile[] = [];

    for (const staffProfile of staffProfiles) {
      try {
        const monthlySchedules = await monthlySchedulesAPI.getByStaff(staffProfile.id);
        const monthlySchedule = monthlySchedules.find(ms => ms.month === month && ms.year === year);
        
        if (monthlySchedule) {
          const dailySchedule = monthlySchedule.dailySchedules?.find(ds => 
            new Date(ds.scheduleDate).toDateString() === selectedDueDate.toDateString()
          );

          if (dailySchedule) {
            // Check if staff is available
            if (!dailySchedule.isDayOff && 
                dailySchedule.outletId === selectedOutletId &&
                dailySchedule.timeIn && 
                dailySchedule.timeOut) {
              
              const scheduleStart = new Date(`${selectedDueDate.toDateString()} ${dailySchedule.timeIn}`);
              const scheduleEnd = new Date(`${selectedDueDate.toDateString()} ${dailySchedule.timeOut}`);
              const taskTime = new Date(`${selectedDueDate.toDateString()} ${selectedDueTime}`);
              
              if (taskTime >= scheduleStart && taskTime <= scheduleEnd) {
                availableStaffList.push(staffProfile);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking availability for staff:', staffProfile.id, error);
      }
    }

    setAvailableStaff(availableStaffList);
  };

  const getStaffAvailabilityStatus = (staffProfile: StaffProfile) => {
    if (!smartAssignment || !selectedDueDate || !selectedOutletId || !selectedDueTime) {
      return { status: 'unknown', message: 'Availability not checked' };
    }

    const isAvailable = availableStaff.some(staff => staff.id === staffProfile.id);
    
    if (isAvailable) {
      return { status: 'available', message: 'Available at this time and outlet' };
    } else {
      return { status: 'unavailable', message: 'Not available at this time or outlet' };
    }
  };

  const onSubmit = async (data: AssignmentFormData) => {
    console.log('🔄 AssignmentForm onSubmit called with data:', data);
    console.log('🔄 AssignmentId:', assignmentId);
    console.log('🔄 SelectedOutletId:', selectedOutletId);
    
    setLoading(true);
    try {
      if (assignmentId) {
        console.log('📝 Updating existing assignment...');
        await assignmentsAPI.update(assignmentId, data);
        console.log('✅ Assignment updated successfully');
      } else {
        console.log('📝 Creating new assignment...');
        await assignmentsAPI.create({
          taskId: data.taskId,
          staffId: data.staffId || undefined,
          assignedDate: new Date(),
          dueDate: data.dueDate,
          outletId: selectedOutletId || undefined,
          status: 'pending',
        });
        console.log('✅ Assignment created successfully');
      }
      onSuccess();
    } catch (error) {
      console.error('❌ Error saving assignment:', error);
      // TODO: Add error state to show user feedback
    } finally {
      setLoading(false);
    }
  };

  const selectedTask = tasks.find(task => task.id === selectedTaskId);

  if (loadingData) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {assignmentId ? 'Edit Assignment' : 'Create New Assignment'}
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="taskId"
                  control={control}
                  rules={{ required: 'Task is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.taskId}>
                      <InputLabel>Select Task</InputLabel>
                      <Select
                        {...field}
                        label="Select Task"
                      >
                        {tasks.map((task) => (
                          <MenuItem key={task.id} value={task.id}>
                            <Box>
                              <Typography variant="subtitle2">
                                {task.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {task.estimatedMinutes} minutes
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              {selectedTask && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Task Details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedTask.description}
                      </Typography>
                      <Box mt={1}>
                        <Typography variant="caption">
                          Estimated Time: {selectedTask.estimatedMinutes} minutes
                        </Typography>
                        {selectedTask.isRecurring && (
                          <Typography variant="caption" display="block">
                            Recurring: {selectedTask.recurringPattern}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={smartAssignment}
                      onChange={(e) => setSmartAssignment(e.target.checked)}
                    />
                  }
                  label="🎯 Smart Assignment (Check availability and outlet match)"
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="outletId"
                  control={control}
                  rules={{ required: 'Outlet is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.outletId}>
                      <InputLabel>Outlet</InputLabel>
                      <Select
                        {...field}
                        label="Outlet"
                      >
                        {outlets.map((outlet) => (
                          <MenuItem key={outlet.id} value={outlet.id}>
                            {outlet.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="dueTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Due Time (Optional)"
                      type="time"
                      error={!!errors.dueTime}
                      helperText={errors.dueTime?.message || "Leave empty to allow all available staff at the outlet to take this task"}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="staffId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.staffId}>
                      <InputLabel>Assign to Staff (Optional)</InputLabel>
                      <Select
                        {...field}
                        label="Assign to Staff (Optional)"
                      >
                        {staffProfiles.map((staffProfile) => {
                          const availability = getStaffAvailabilityStatus(staffProfile);
                          return (
                            <MenuItem key={staffProfile.id} value={staffProfile.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2">
                                    {staffProfile.user?.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {staffProfile.position?.name} • {staffProfile.employeeId}
                                  </Typography>
                                </Box>
                                <Box sx={{ ml: 2 }}>
                                  {availability.status === 'available' && (
                                    <Chip
                                      icon={<CheckCircleIcon />}
                                      label="Available"
                                      color="success"
                                      size="small"
                                    />
                                  )}
                                  {availability.status === 'unavailable' && (
                                    <Chip
                                      icon={<CancelIcon />}
                                      label="Unavailable"
                                      color="error"
                                      size="small"
                                    />
                                  )}
                                  {availability.status === 'unknown' && (
                                    <Chip
                                      icon={<WarningIcon />}
                                      label="Unknown"
                                      color="warning"
                                      size="small"
                                    />
                                  )}
                                </Box>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>





              <Grid item xs={12}>
                <Controller
                  name="dueDate"
                  control={control}
                  rules={{ required: 'Due date is required' }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Due Date"
                      minDate={new Date()}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.dueDate}
                          helperText={errors.dueDate?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (assignmentId ? 'Update' : 'Assign')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default AssignmentForm;
