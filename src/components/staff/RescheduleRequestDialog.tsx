import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { rescheduleAPI } from '../../services/supabaseService';
import { TaskAssignment } from '../../types';

interface RescheduleRequestDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: TaskAssignment | null;
  onSuccess: () => void;
  taskTitle?: string;
  outletName?: string;
}

const RescheduleRequestDialog: React.FC<RescheduleRequestDialogProps> = ({
  open,
  onClose,
  assignment,
  onSuccess,
  taskTitle,
  outletName
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!assignment || !reason.trim()) {
      setError('Please provide a reason for rescheduling');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get current user ID from localStorage or context
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('User not found');
      }
      
      const user = JSON.parse(userData);
      await rescheduleAPI.requestReschedule(assignment.id, reason.trim(), user.id);
      
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error requesting reschedule:', err);
      setError(err.message || 'Failed to request reschedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  if (!assignment) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Request Reschedule
      </DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Task: <strong>{taskTitle || 'Unknown Task'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Current Due Date: <strong>{assignment.dueDate.toLocaleDateString()}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Outlet: <strong>{outletName || 'Unknown Outlet'}</strong>
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Reason for Rescheduling"
          placeholder="Please explain why this task needs to be rescheduled..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          error={!reason.trim() && reason.length > 0}
          helperText={!reason.trim() && reason.length > 0 ? 'Reason is required' : ''}
          disabled={isSubmitting}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Your reschedule request will be sent to administrators for approval.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!reason.trim() || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
        >
          {isSubmitting ? 'Submitting...' : 'Request Reschedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RescheduleRequestDialog;
