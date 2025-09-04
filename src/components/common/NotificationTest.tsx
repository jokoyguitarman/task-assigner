import React from 'react';
import { Button, Box, Typography, Card, CardContent, Grid } from '@mui/material';
import { realtimeService } from '../../services/realtimeService';
import { audioService } from '../../services/audioService';

const NotificationTest: React.FC = () => {
  const testTaskNotification = () => {
    realtimeService.testNotification('task');
  };

  const testScheduleNotification = () => {
    realtimeService.testNotification('schedule');
  };

  const testAssignmentNotification = () => {
    realtimeService.testNotification('assignment');
  };

  const testTaskSound = () => {
    audioService.playTaskNotification();
  };

  const testScheduleSound = () => {
    audioService.playScheduleNotification();
  };

  const testAssignmentSound = () => {
    audioService.playAssignmentNotification();
  };

  return (
    <Card sx={{ p: 2, m: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Notification & Sound Test
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test the notification system and different sound types
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>
              Test Notifications (with sounds)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={testTaskNotification}
                color="primary"
              >
                Test Task Notification
              </Button>
              <Button 
                variant="outlined" 
                onClick={testScheduleNotification}
                color="secondary"
              >
                Test Schedule Notification
              </Button>
              <Button 
                variant="outlined" 
                onClick={testAssignmentNotification}
                color="info"
              >
                Test Assignment Notification
              </Button>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>
              Test Sounds Only
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={testTaskSound}
                color="primary"
              >
                Task Sound (High Pitch)
              </Button>
              <Button 
                variant="outlined" 
                onClick={testScheduleSound}
                color="secondary"
              >
                Schedule Sound (Medium Pitch)
              </Button>
              <Button 
                variant="outlined" 
                onClick={testAssignmentSound}
                color="info"
              >
                Assignment Sound (Low Pitch)
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default NotificationTest;
