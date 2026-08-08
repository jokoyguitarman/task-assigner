import React, { useState, useEffect, useCallback } from 'react';
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
  Autocomplete,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { AssignmentFormData, Task, StaffProfile, Outlet } from '../../types';
import { toDateOnly } from '../../lib/dates';
import { 
  tasksAPI, 
  assignmentsAPI, 
  staffProfilesAPI, 
  outletsAPI, 
  monthlySchedulesAPI,
  branchSetupAPI
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
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [smartAssignment, setSmartAssignment] = useState(true);
  const [availableStaff, setAvailableStaff] = useState<StaffProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<AssignmentFormData>({
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

  const loadData = useCallback(async () => {
    try {
      const [tasksData, staffProfilesData, outletsData] = await Promise.all([
        tasksAPI.getAll(),
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      setTasks(tasksData);
      setStaffProfiles(staffProfilesData);
      setOutlets(outletsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadAssignmentData = useCallback(async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);
      const assignment = await assignmentsAPI.getById(assignmentId);

      reset({
        taskId: assignment.taskId,
        staffId: assignment.staffId || '',
        dueDate: new Date(assignment.dueDate),
        dueTime: assignment.dueTime || '',
        outletId: assignment.outletId || '',
      });
    } catch (error) {
      console.error('Error loading assignment data:', error);
      setError('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, reset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

  // A task already knows which shift it belongs to, and a branch already knows
  // when that shift ends, so the deadline is a lookup rather than something to
  // retype. Only prefills an empty field: a time typed by hand is a deliberate
  // override and must not be overwritten.
  useEffect(() => {
    if (assignmentId || selectedDueTime || !selectedTaskId || !selectedOutletId) return;

    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    if (task.dueTimeOverride) {
      setValue('dueTime', task.dueTimeOverride);
      return;
    }

    let cancelled = false;

    branchSetupAPI
      .getShifts(selectedOutletId)
      .then(shifts => {
        if (cancelled) return;
        const match = shifts.find(s => s.shiftId === task.shiftId);
        if (match) setValue('dueTime', match.endsAt);
      })
      .catch(() => {
        // A missing deadline is recoverable; the field stays empty and the owner
        // can type one.
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId, selectedTaskId, selectedOutletId, selectedDueTime, tasks, setValue]);

  // Who is rostered at that outlet, on that day, across that hour. One query for
  // the whole month rather than one per staff member — this used to issue a
  // request per person and await them one at a time.
  const checkStaffAvailability = useCallback(async () => {
    if (!selectedDueDate || !selectedOutletId || !selectedDueTime) return;

    try {
      const schedules = await monthlySchedulesAPI.getByMonth(
        selectedDueDate.getMonth() + 1,
        selectedDueDate.getFullYear()
      );

      const day = toDateOnly(selectedDueDate);
      // Postgres hands back HH:MM:SS while the form produces HH:MM, and these
      // are compared as strings.
      const hhmm = (time: string) => time.slice(0, 5);
      const dueAt = hhmm(selectedDueTime);
      const onShift = new Set<string>();

      schedules.forEach(schedule => {
        const daily = schedule.dailySchedules?.find(ds => toDateOnly(ds.scheduleDate) === day);
        if (!daily || daily.isDayOff) return;
        if (daily.outletId !== selectedOutletId) return;
        if (!daily.timeIn || !daily.timeOut) return;
        if (dueAt < hhmm(daily.timeIn) || dueAt > hhmm(daily.timeOut)) return;

        onShift.add(schedule.staffId);
      });

      setAvailableStaff(staffProfiles.filter(staff => onShift.has(staff.id)));
    } catch (error) {
      console.error('Error checking staff availability:', error);
      // Show everyone rather than an empty list: an unanswered question is not
      // the same as "nobody is available".
      setAvailableStaff(staffProfiles);
    }
  }, [selectedDueDate, selectedOutletId, selectedDueTime, staffProfiles]);

  useEffect(() => {
    if (smartAssignment && selectedDueDate && selectedOutletId && selectedDueTime) {
      checkStaffAvailability();
    } else {
      setAvailableStaff(staffProfiles);
    }
  }, [
    smartAssignment,
    selectedDueDate,
    selectedOutletId,
    selectedDueTime,
    staffProfiles,
    checkStaffAvailability,
  ]);

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
    setLoading(true);
    setError(null);

    try {
      // Empty strings are not valid UUIDs or times; send nothing instead.
      const cleanedData = {
        ...data,
        staffId: data.staffId?.trim() || undefined,
        outletId: data.outletId?.trim() || undefined,
        dueTime: data.dueTime?.trim() || undefined,
      };

      if (assignmentId) {
        await assignmentsAPI.update(assignmentId, cleanedData);
      } else {
        await assignmentsAPI.create({
          taskId: cleanedData.taskId,
          staffId: cleanedData.staffId,
          assignedDate: new Date(),
          dueDate: cleanedData.dueDate,
          dueTime: cleanedData.dueTime,
          outletId: cleanedData.outletId,
          organizationId: user!.organizationId,
          status: 'pending',
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving assignment:', error);
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
                      getOptionLabel={(option) => option.name || ''}
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
                                  {option.name}
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
