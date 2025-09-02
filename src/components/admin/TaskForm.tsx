import React, { useState } from 'react';
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
  Switch,
  Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { TaskFormData } from '../../types';
import { tasksAPI } from '../../services/api';

interface TaskFormProps {
  taskId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ taskId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, watch, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      title: '',
      description: '',
      estimatedMinutes: 30,
      isRecurring: false,
      recurringPattern: 'daily',
    },
  });

  const isRecurring = watch('isRecurring');

  const onSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      if (taskId) {
        await tasksAPI.update(taskId, data);
      } else {
        await tasksAPI.create({
          ...data,
          createdBy: '1', // Mock admin ID
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

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
