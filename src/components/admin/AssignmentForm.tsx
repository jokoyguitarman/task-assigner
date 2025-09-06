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
  Autocomplete,
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
import { useAuth } from '../../contexts/AuthContext';

interface AssignmentFormProps {
  assignmentId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({ assignmentId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [smartAssignment, setSmartAssignment] = useState(true);
  const [availableStaff, setAvailableStaff] = useState<StaffProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<AssignmentFormData>({
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

  // Load assignment data when editing
  useEffect(() => {
    if (assignmentId) {
      loadAssignmentData();
    }
  }, [assignmentId]);

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

  const loadAssignmentData = async () => {
    if (!assignmentId) return;
    
    try {
      setLoading(true);
      const assignment = await assignmentsAPI.getById(assignmentId);
      
      // Reset form with assignment data
      reset({
        taskId: assignment.taskId,
        staffId: assignment.staffId || '',
        dueDate: new Date(assignment.dueDate),
        dueTime: '', // dueTime is not stored in TaskAssignment, so we'll leave it empty
        outletId: assignment.outletId || '',
      });
      
      console.log('📝 Assignment data loaded for editing:', assignment);
    } catch (error) {
      console.error('Error loading assignment data:', error);
      setError('Failed to load assignment data');
    } finally {
      setLoading(false);
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
    console.log('🔄 Form errors:', errors);
    console.log('🔄 User organizationId:', user?.organizationId);
    
    setLoading(true);
    setError(null);
    
    try {
      // Clean up empty strings to undefined for UUID fields
      const cleanedData = {
        ...data,
        staffId: data.staffId && data.staffId.trim() !== '' ? data.staffId : undefined,
        outletId: data.outletId && data.outletId.trim() !== '' ? data.outletId : undefined,
      };
      
      console.log('🔄 Cleaned data:', cleanedData);
      
      if (assignmentId) {
        console.log('📝 Updating existing assignment...');
        await assignmentsAPI.update(assignmentId, cleanedData);
        console.log('✅ Assignment updated successfully');
      } else {
        console.log('📝 Creating new assignment...');
        await assignmentsAPI.create({
          taskId: cleanedData.taskId,
          staffId: cleanedData.staffId,
          assignedDate: new Date(),
          dueDate: cleanedData.dueDate,
          outletId: cleanedData.outletId,
          organizationId: user!.organizationId,
          status: 'pending',
        });
        console.log('✅ Assignment created successfully');
      }
      onSuccess();
    } catch (error) {
      console.error('❌ Error saving assignment:', error);
      setError(error instanceof Error ? error.message : 'Failed to save assignment');
    } finally {
      setLoading(false);
    }
  };

  const selectedTask = tasks.find(task => task.id === selectedTaskId);

  if (loadingData || loading) {
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
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
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
                    <Autocomplete
                      {...field}
                      options={staffProfiles}
                      getOptionLabel={(option) => option.user?.name || ''}
                      value={staffProfiles.find(staff => staff.id === field.value) || null}
                      onChange={(_, newValue) => {
                        field.onChange(newValue?.id || '');
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Assign to Staff (Optional)"
                          placeholder="Type to search staff members..."
                          error={!!errors.staffId}
                          helperText="Leave empty to allow all available staff at the outlet to take this task"
                        />
                      )}
                      renderOption={(props, option) => {
                        const availability = getStaffAvailabilityStatus(option);
                        return (
                          <Box component="li" {...props}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2">
                                  {option.user?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.position?.name} • {option.employeeId}
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
                          </Box>
                        );
                      }}
                      isOptionEqualToValue={(option, value) => option.id === value?.id}
                      noOptionsText="No staff members found"
                    />
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
                    onClick={() => {
                      console.log('🔍 Form Debug Info:');
                      console.log('Form values:', watch());
                      console.log('Form errors:', errors);
                      console.log('Selected outlet ID:', selectedOutletId);
                      console.log('User org ID:', user?.organizationId);
                    }}
                    disabled={loading}
                  >
                    Debug
                  </Button>
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
