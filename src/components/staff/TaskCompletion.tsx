import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Grid,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack,
  CameraAlt,
  Upload,
  CheckCircle,
  Warning,
  AccessTime,
  Person,
  LocationOn,
  PriorityHigh
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { assignmentsAPI, tasksAPI, outletsAPI, usersAPI } from '../../services/supabaseService';
import { TaskAssignment, Task, Outlet, User } from '../../types';

const TaskCompletion: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [assignedBy, setAssignedBy] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [completionNotes, setCompletionNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);

  useEffect(() => {
    if (assignmentId) {
      loadAssignmentData();
    }
  }, [assignmentId]);

  const loadAssignmentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load assignment data with related information
      const assignmentData = await assignmentsAPI.getById(assignmentId!);
      setAssignment(assignmentData);

      // Extract task and outlet data from the assignment
      if (assignmentData.task) {
        setTask(assignmentData.task);
      } else {
        // If task data not included, fetch it separately
        const taskData = await tasksAPI.getById(assignmentData.taskId);
        setTask(taskData);
      }
      
      if (assignmentData.outlet) {
        setOutlet(assignmentData.outlet);
      } else if (assignmentData.outletId) {
        // If outlet data not included, fetch it separately
        const outletData = await outletsAPI.getById(assignmentData.outletId);
        setOutlet(outletData);
      }

      // Load users to find who assigned the task
      const usersData = await usersAPI.getAll();
      const taskToUse = assignmentData.task || await tasksAPI.getById(assignmentData.taskId);
      const assigner = usersData.find(u => u.id === taskToUse.createdBy);
      setAssignedBy(assigner || null);

    } catch (err: any) {
      console.error('Error loading assignment data:', err);
      setError(err.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setProofFiles(prev => [...prev, ...files]);
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleCameraUpload = () => {
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    if (input) {
      // For mobile devices, set capture attribute to open camera first
      if (isMobile()) {
        input.setAttribute('capture', 'environment'); // Use back camera
      }
      input.click();
    }
  };

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!assignment || !task) return;

    setSubmitting(true);
    setError(null);

    try {
      // For now, just mark as completed without file upload
      // TODO: Implement file upload to Supabase storage
      await assignmentsAPI.update(assignment.id, {
        status: 'completed',
        completedAt: new Date(),
        minutesDeducted: task.estimatedMinutes,
        // completionProof: 'placeholder' // Will be updated when file upload is implemented
      });

      setSuccess(true);
      
      // Redirect back to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/staff-dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Error completing task:', err);
      setError(err.message || 'Failed to complete task');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/staff-dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Complete Task</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/staff-dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Complete Task</Typography>
        </Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/staff-dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/staff-dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Complete Task</Typography>
        </Box>
        <Alert severity="success" sx={{ mb: 2 }}>
          Task completed successfully! Redirecting to dashboard...
        </Alert>
      </Box>
    );
  }

  if (!assignment || !task) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/staff-dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Complete Task</Typography>
        </Box>
        <Alert severity="error">
          Task not found
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/staff-dashboard')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Complete Task</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Task Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Details
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {task.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {task.description}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {task.isHighPriority && (
                  <Chip
                    icon={<PriorityHigh />}
                    label="High Priority"
                    color="error"
                    size="small"
                  />
                )}
                <Chip
                  icon={<AccessTime />}
                  label={`${task.estimatedMinutes} min estimated`}
                  color="primary"
                  size="small"
                />
                <Chip
                  icon={<LocationOn />}
                  label={outlet?.name || 'Unknown Outlet'}
                  color="default"
                  size="small"
                />
                <Chip
                  icon={<Person />}
                  label={`Assigned by: ${assignedBy?.name || 'Unknown'}`}
                  color="default"
                  size="small"
                />
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Due Date:</strong> {assignment.dueDate.toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Assigned Date:</strong> {assignment.assignedDate.toLocaleDateString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Completion Form */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mark as Complete
              </Typography>

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Completion Notes"
                  placeholder="Add any notes about the task completion..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Upload Proof (Photos/Videos)
                </Typography>
                <input
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  id="proof-upload"
                  multiple
                  type="file"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outlined"
                  startIcon={<CameraAlt />}
                  onClick={handleCameraUpload}
                  sx={{ mr: 2 }}
                >
                  {isMobile() ? 'Take Photo/Video' : 'Choose Files'}
                </Button>
                {isMobile() && (
                  <Button
                    variant="outlined"
                    startIcon={<Upload />}
                    onClick={() => {
                      const input = document.getElementById('proof-upload') as HTMLInputElement;
                      if (input) {
                        input.removeAttribute('capture'); // Remove capture to open gallery
                        input.click();
                      }
                    }}
                  >
                    Choose from Gallery
                  </Button>
                )}
                
                {proofFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {proofFiles.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => removeFile(index)}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={submitting ? <CircularProgress size={20} /> : <CheckCircle />}
                onClick={handleSubmit}
                disabled={submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? 'Completing...' : 'Mark as Complete'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskCompletion;