import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Grid,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack,
  CameraAlt,
  Upload,
  CheckCircle,
  AccessTime,
  Person,
  LocationOn,
  PriorityHigh
} from '@mui/icons-material';
import { assignmentsAPI, tasksAPI, outletsAPI, usersAPI, taskCompletionProofsAPI } from '../../services/supabaseService';
import { TaskAssignment, Task, Outlet, User } from '../../types';

const TaskCompletion: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  
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
  const [conditionRating, setConditionRating] = useState<'fine' | 'attention' | 'bad' | ''>('');
  const [answerText, setAnswerText] = useState('');
  const [answerNumber, setAnswerNumber] = useState('');

  const loadAssignmentData = useCallback(async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);
      setError(null);

      const assignmentData = await assignmentsAPI.getById(assignmentId);
      setAssignment(assignmentData);

      // The assignment query already joins the task and the outlet; only fall
      // back to a second round trip if one is genuinely missing.
      const taskData = assignmentData.task ?? (await tasksAPI.getById(assignmentData.taskId));
      setTask(taskData);

      if (assignmentData.outlet) {
        setOutlet(assignmentData.outlet);
      } else if (assignmentData.outletId) {
        setOutlet(await outletsAPI.getById(assignmentData.outletId));
      }

      // Who assigned it. This used to fetch every user in the organization to
      // resolve one name. A missing name is not worth blocking a completion over,
      // so failing to resolve it must not reach the catch below and replace the
      // whole screen with an error.
      if (taskData.createdBy) {
        try {
          setAssignedBy(await usersAPI.getById(taskData.createdBy));
        } catch {
          setAssignedBy(null);
        }
      } else {
        setAssignedBy(null);
      }
    } catch (err: any) {
      console.error('Error loading assignment data:', err);
      setError(err.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

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

  // The database refuses anything that does not satisfy the task, so this exists
  // only to say so before the round trip rather than after it.
  const missingRequirement = (): string | null => {
    if (!task) return null;

    if (task.requiresPhoto && proofFiles.length === 0) {
      return 'This one needs a photo before you can mark it done.';
    }

    if (task.answerType === 'condition') {
      if (!conditionRating) return 'Say what condition you found it in.';
      if (conditionRating !== 'fine' && !completionNotes.trim()) {
        return 'Say briefly what was wrong.';
      }
    }

    if (task.answerType === 'text' && !answerText.trim()) {
      return 'This one needs an answer before you can mark it done.';
    }

    if (task.answerType === 'number') {
      if (answerNumber.trim() === '') return 'This one needs a reading.';

      const value = Number(answerNumber);
      if (Number.isNaN(value)) return 'That reading is not a number.';

      const low = task.answerMin !== undefined && value < task.answerMin;
      const high = task.answerMax !== undefined && value > task.answerMax;

      if ((low || high) && !completionNotes.trim()) {
        return 'That reading is outside the expected range. Say what you found.';
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!assignment || !task) return;

    const missing = missingRequirement();
    if (missing) {
      setError(missing);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Upload the evidence before marking the task done, so a storage failure
      // does not leave a task recorded as complete with nothing behind it. This
      // is the whole point of the feature: the owner needs to see the bins were
      // actually taken out, not just that someone tapped a button.
      const uploaded = await Promise.all(
        proofFiles.map(file => taskCompletionProofsAPI.upload(assignment.id, file))
      );

      await assignmentsAPI.update(assignment.id, {
        status: 'completed',
        completedAt: new Date(),
        minutesDeducted: task.estimatedMinutes,
        completionProof: uploaded[0]?.filePath,
        completionNotes: completionNotes.trim() || undefined,
        completedByStaffId: assignment.staffId,
        conditionRating: task.answerType === 'condition' && conditionRating ? conditionRating : undefined,
        answerText: task.answerType === 'text' ? answerText.trim() : undefined,
        answerNumber: task.answerType === 'number' ? Number(answerNumber) : undefined,
      });

      setSuccess(true);
      
      setTimeout(() => {
        navigate('/dashboard');
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
          <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
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
          <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Complete Task</Typography>
        </Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
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
          <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
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
        <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
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

              {/* Whatever this particular task asks for. Most ask for nothing and
                  this whole block is absent. */}
              {task?.answerType === 'condition' && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {task.answerPrompt || 'What condition did you find it in?'}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={conditionRating}
                    onChange={(_, value) => value && setConditionRating(value)}
                  >
                    <ToggleButton value="fine" color="success">Fine</ToggleButton>
                    <ToggleButton value="attention" color="warning">Needs attention</ToggleButton>
                    <ToggleButton value="bad" color="error">Bad</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )}

              {task?.answerType === 'text' && (
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label={task.answerPrompt || 'What did you find?'}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                  />
                </Box>
              )}

              {task?.answerType === 'number' && (
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={task.answerPrompt || 'Reading'}
                    value={answerNumber}
                    onChange={(e) => setAnswerNumber(e.target.value)}
                    helperText={
                      task.answerMin !== undefined || task.answerMax !== undefined
                        ? `Expected between ${task.answerMin ?? '—'} and ${task.answerMax ?? '—'}`
                        : undefined
                    }
                  />
                </Box>
              )}

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={
                    task?.answerType === 'condition' && conditionRating && conditionRating !== 'fine'
                      ? 'What was wrong? (required)'
                      : 'Completion Notes'
                  }
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