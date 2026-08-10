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
  Divider,
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
      answerType: 'none',
      answerPrompt: '',
      requiresPhoto: false,
    },
  });

  const isRecurring = watch('isRecurring');
  const selectedShiftId = watch('shiftId');
  const selectedOutletIds = watch('outletIds') || [];
  const answerType = watch('answerType');

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
            answerType: task.answerType || 'none',
            answerPrompt: task.answerPrompt || '',
            answerMin: task.answerMin,
            answerMax: task.answerMax,
            requiresPhoto: task.requiresPhoto || false,
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

              {/* What finishing this has to produce. Everything defaults to a plain
                  tick, so a task the owner does not care much about still takes
                  seconds to create. */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    WHAT FINISHING THIS NEEDS
                  </Typography>
                </Divider>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="answerType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Ask for</InputLabel>
                      <Select {...field} label="Ask for">
                        <MenuItem value="none">Just a tick</MenuItem>
                        <MenuItem value="condition">A condition: Fine, Needs attention, Bad</MenuItem>
                        <MenuItem value="text">A written answer</MenuItem>
                        <MenuItem value="number">A reading (a number)</MenuItem>
                      </Select>
                      <FormHelperText>
                        {answerType === 'condition'
                          ? 'Fixed three levels, so you can compare them over time'
                          : answerType === 'text'
                          ? 'For checks with no instrument, where a demanded number would only be invented'
                          : answerType === 'number'
                          ? 'Out-of-range readings are allowed, but have to be explained'
                          : 'Done or not done, nothing to fill in'}
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="requiresPhoto"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={!!field.value} onChange={field.onChange} />}
                      label="A photo is required"
                    />
                  )}
                />
                <FormHelperText>
                  Worth it where the photo is the point. Demand one everywhere and people
                  photograph the floor to get past the form.
                </FormHelperText>
              </Grid>

              {answerType !== 'none' && (
                <Grid item xs={12}>
                  <Controller
                    name="answerPrompt"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="What should they be asked?"
                        placeholder="e.g. How did the freezer feel? Any frost building up?"
                        helperText="Shown on the branch phone in place of a blank box"
                      />
                    )}
                  />
                </Grid>
              )}

              {answerType === 'number' && (
                <>
                  <Grid item xs={6} sm={3}>
                    <Controller
                      name="answerMin"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          fullWidth
                          type="number"
                          label="Expected from"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Controller
                      name="answerMax"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          fullWidth
                          type="number"
                          label="to"
                        />
                      )}
                    />
                  </Grid>
                </>
              )}

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
                          {/* Weekly and monthly are deliberately absent. Neither
                              has a day to anchor to in the schema, so the job that
                              creates each day's work would never produce them —
                              and a task that silently never appears is worse than
                              one the form refuses to promise. */}
                        </Select>
                        <FormHelperText>
                          Only daily repeats for now. For anything else, create it when you need it.
                        </FormHelperText>
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
