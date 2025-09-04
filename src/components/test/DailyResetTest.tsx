import React from 'react';
import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { TaskAssignment } from '../../types';

interface DailyResetTestProps {
  assignments: TaskAssignment[];
}

const DailyResetTest: React.FC<DailyResetTestProps> = ({ assignments }) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filter tasks by different days
  const completedToday = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === today.toDateString()
  );

  const completedYesterday = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === yesterday.toDateString()
  );

  const completedTomorrow = assignments.filter(a => 
    a.status === 'completed' && 
    a.completedAt && 
    new Date(a.completedAt).toDateString() === tomorrow.toDateString()
  );

  const simulateTomorrow = () => {
    // This would simulate what happens tomorrow
    console.log('Tomorrow, completedToday would be:', completedToday.length);
    console.log('Tomorrow, completedYesterday would be:', completedYesterday.length);
    alert(`Tomorrow's progress would be: ${completedToday.length} / ${assignments.length} (${((completedToday.length / assignments.length) * 100).toFixed(1)}%)`);
  };

  return (
    <Card sx={{ mb: 2, border: '2px solid #ff9800' }}>
      <CardContent>
        <Typography variant="h6" color="warning.main" gutterBottom>
          🧪 Daily Reset Test (Remove in production)
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Today ({today.toDateString()}):</Typography>
            <Typography variant="h6">{completedToday.length} completed</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Yesterday ({yesterday.toDateString()}):</Typography>
            <Typography variant="h6">{completedYesterday.length} completed</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Tomorrow ({tomorrow.toDateString()}):</Typography>
            <Typography variant="h6">{completedTomorrow.length} completed</Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The "Today's Progress" card only counts tasks completed on {today.toDateString()}
        </Typography>

        <Button 
          variant="outlined" 
          color="warning" 
          onClick={simulateTomorrow}
          size="small"
        >
          Simulate Tomorrow's Progress
        </Button>
      </CardContent>
    </Card>
  );
};

export default DailyResetTest;
