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
  FormControlLabel,
  FormHelperText,
  Switch,
  Grid,
  Checkbox,
  ListItemText,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { TaskFormData, ShiftDefinition, Area, Outlet } from '../../types';
import { tasksAPI, shiftsAPI, areasAPI, outletsAPI } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';

interface TaskFormProps {
  taskId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ taskId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      title: '',
      description: '',
      estimatedMinutes: 30,
      isRecurring: false,
      recurringPattern: 'daily',
      isHighPriority: false,
      shiftId: '',
      areaId: '',
      dueTimeOverride: '',
      outletIds: [],
    },
  });

  const isRecurring = watch('isRecurring');
  const selectedShiftId = watch('shiftId');
  const selectedOutletIds = watch('outletIds') || [];

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [shiftData, areaData, outletData] = await Promise.all([
          shiftsAPI.getAll(),
          areasAPI.getAll(),
          outletsAPI.getAll(),
        ]);
        setShifts(shiftData);
        setAreas(areaData);
        setOutlets(outletData.filter(o => o.isActive));
      } catch (error) {
        console.error('Error loading shifts and areas:', error);
      }
    };

    loadOptions();
  }, []);

  // Load task data when editing
  useEffect(() => {
    const loadTask = async () => {
      if (taskId) {
        setFormLoading(true);
        try {
          const task = await tasksAPI.getById(taskId);
          reset({
            title: task.title,
            description: task.description,
            estimatedMinutes: task.estimatedMinutes,
            isRecurring: task.isRecurring,
            recurringPattern: task.recurringPattern || 'daily',
            scheduledDate: task.scheduledDate,
            isHighPriority: task.isHighPriority,
            shiftId: task.shiftId,
            areaId: task.areaId,
            dueTimeOverride: task.dueTimeOverride || '',
            outletIds: task.outletIds || [],
          });
        } catch (error) {
          console.error('Error loading task:', error);
        } finally {
          setFormLoading(false);
        }
      }
    };

    loadTask();
  }, [taskId, reset]);

  // A new task lands on the last shift of the day, which is the answer for
  // anything that only has to happen before closing. It is the lazy path, and it
  // is why the shift dropdown rarely needs touching.
  useEffect(() => {
    if (!taskId && !selectedShiftId && shifts.length > 0) {
      setValue('shiftId', shifts[shifts.length - 1].id);
    }
  }, [taskId, selectedShiftId, shifts, setValue]);

  const onSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      if (taskId) {
        await tasksAPI.update(taskId, data);
      } else {
        if (!user?.id) {
          throw new Error('User not authenticated');
        }
        
        await tasksAPI.create({
          ...data,
          createdBy: user.id,
          organizationId: user.organizationId,
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  if (formLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Loading task data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {taskId ? 'Edit Task' : 'Create New Task'}
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="title"
                  control={control}
                  rules={{ required: 'Title is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Task Title"
                      error={!!errors.title}
                      helperText={errors.title?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  rules={{ required: 'Description is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Description"
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="estimatedMinutes"
                  control={control}
                  rules={{ 
                    required: 'Estimated minutes is required',
                    min: { value: 1, message: 'Must be at least 1 minute' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="Estimated Minutes"
                      error={!!errors.estimatedMinutes}
                      helperText={errors.estimatedMinutes?.message}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="scheduledDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Scheduled Date (Optional)"
                      renderInput={(params) => (
                        <TextField {...params} fullWidth />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="shiftId"
                  control={control}
                  rules={{ required: 'Choose which shift this belongs to' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.shiftId}>
                      <InputLabel>Shift</InputLabel>
                      <Select {...field} label="Shift">
                        {shifts.map(shift => (
                          <MenuItem key={shift.id} value={shift.id}>{shift.name}</MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {errors.shiftId?.message || "Due by the end of this shift, at each branch's own time"}
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="areaId"
                  control={control}
                  rules={{ required: 'Choose an area' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.areaId}>
                      <InputLabel>Area</InputLabel>
                      <Select {...field} label="Area">
                        {areas.map(area => (
                          <MenuItem key={area.id} value={area.id}>{area.name}</MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {errors.areaId?.message || 'Which checklist it appears in on the branch phone'}
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="dueTimeOverride"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="time"
                      label="Exact time (optional)"
                      InputLabelProps={{ shrink: true }}
                      helperText="Overrides the shift end at every branch. Leave empty unless the hour matters."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="outletIds"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Branches</InputLabel>
                      <Select
                        {...field}
                        multiple
                        label="Branches"
                        value={field.value || []}
                        renderValue={(selected) =>
                          (selected as string[]).length === 0
                            ? 'Everywhere it applies'
                            : outlets.filter(o => (selected as string[]).includes(o.id)).map(o => o.name).join(', ')
                        }
                      >
                        {outlets.map(outlet => (
                          <MenuItem key={outlet.id} value={outlet.id}>
                            <Checkbox checked={selectedOutletIds.includes(outlet.id)} />
                            <ListItemText primary={outlet.name} />
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        Leave empty and shift plus area already decide where it lands.
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="isRecurring"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Recurring Task"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="isHighPriority"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="High Priority Task"
                    />
                  )}
                />
              </Grid>

              {isRecurring && (
                <Grid item xs={12}>
                  <Controller
                    name="recurringPattern"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Recurring Pattern</InputLabel>
                        <Select
                          {...field}
                          label="Recurring Pattern"
                        >
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}

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
                    {loading ? 'Saving...' : (taskId ? 'Update' : 'Create')}
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

export default TaskForm;
