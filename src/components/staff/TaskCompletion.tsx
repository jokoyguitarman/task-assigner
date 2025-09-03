import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import {
  CameraAlt,
  Videocam,
  PhotoLibrary,
  Delete,
  CheckCircle,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { TaskAssignment, Task } from '../../types';
import { assignmentsAPI, tasksAPI } from '../../services/supabaseService';

const TaskCompletion: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const loadAssignment = async () => {
      try {
        const [assignmentData, taskData] = await Promise.all([
          assignmentsAPI.getById(assignmentId!),
          tasksAPI.getById(assignmentId!), // This should be taskId from assignment
        ]);
        setAssignment(assignmentData);
        setTask(taskData);
      } catch (error) {
        console.error('Error loading assignment:', error);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    if (assignmentId) {
      loadAssignment();
    }
  }, [assignmentId]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCapturedMedia(result);
        setMediaType(file.type.startsWith('video') ? 'video' : 'photo');
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please use file upload instead.');
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const dataURL = canvas.toDataURL('image/jpeg');
        setCapturedMedia(dataURL);
        setMediaType('photo');
        
        // Stop the video stream
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    }
  };



  const recordVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera for video:', error);
      setError('Unable to access camera for video recording.');
    }
  };

  const removeMedia = () => {
    setCapturedMedia(null);
    setMediaType(null);
  };

  const handleSubmit = async () => {
    if (!capturedMedia || !assignmentId) {
      setError('Please provide proof of completion (photo or video)');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // In a real app, you would upload the media to a server first
      // For now, we'll use the data URL directly
      await assignmentsAPI.complete(assignmentId, capturedMedia);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing task:', error);
      setError('Failed to complete task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!assignment || !task) {
    return (
      <Alert severity="error">
        Task not found or you don't have permission to access it.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Complete Task
      </Typography>

      <Grid container spacing={3}>
        {/* Task Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Details
              </Typography>
              <Typography variant="h5" gutterBottom>
                {task.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {task.description}
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Typography variant="body2">
                  <strong>Estimated Time:</strong> {task.estimatedMinutes} minutes
                </Typography>
                <Typography variant="body2">
                  <strong>Due Date:</strong> {new Date(assignment.dueDate).toLocaleDateString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Media Capture */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Proof of Completion
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Please provide photo or video proof that you have completed this task.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {!capturedMedia ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant="outlined"
                        startIcon={<CameraAlt />}
                        onClick={capturePhoto}
                        fullWidth
                      >
                        Take Photo
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant="outlined"
                        startIcon={<Videocam />}
                        onClick={recordVideo}
                        fullWidth
                      >
                        Record Video
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant="outlined"
                        startIcon={<PhotoLibrary />}
                        onClick={() => fileInputRef.current?.click()}
                        fullWidth
                      >
                        Upload File
                      </Button>
                    </Grid>
                  </Grid>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />

                  {/* Video Preview */}
                  <Box mt={2}>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', maxHeight: '300px', display: 'none' }}
                      controls
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <Button
                      variant="contained"
                      onClick={takePhoto}
                      sx={{ mt: 1 }}
                      style={{ display: 'none' }}
                    >
                      Capture Photo
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                    {mediaType === 'photo' ? (
                      <img
                        src={capturedMedia}
                        alt="Task completion proof"
                        style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }}
                      />
                    ) : (
                      <video
                        src={capturedMedia}
                        controls
                        style={{ width: '100%', maxHeight: '300px' }}
                      />
                    )}
                  </Paper>
                  
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      startIcon={<CheckCircle />}
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Complete Task'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Delete />}
                      onClick={removeMedia}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskCompletion;
