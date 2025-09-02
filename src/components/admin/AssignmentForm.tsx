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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { AssignmentFormData, Task, User } from '../../types';
import { tasksAPI, usersAPI, assignmentsAPI } from '../../services/api';

interface AssignmentFormProps {
  assignmentId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({ assignmentId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<AssignmentFormData>({
    defaultValues: {
      taskId: '',
      staffId: '',
      dueDate: new Date(),
    },
  });

  const selectedTaskId = watch('taskId');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, staffData] = await Promise.all([
        tasksAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setTasks(tasksData);
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: AssignmentFormData) => {
    setLoading(true);
    try {
      if (assignmentId) {
        await assignmentsAPI.update(assignmentId, data);
      } else {
        await assignmentsAPI.create({
          ...data,
          assignedDate: new Date(),
          status: 'pending',
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving assignment:', error);
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
                <Controller
                  name="staffId"
                  control={control}
                  rules={{ required: 'Staff member is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.staffId}>
                      <InputLabel>Assign to Staff</InputLabel>
                      <Select
                        {...field}
                        label="Assign to Staff"
                      >
                        {staff.map((member) => (
                          <MenuItem key={member.id} value={member.id}>
                            {member.name} ({member.email})
                          </MenuItem>
                        ))}
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
