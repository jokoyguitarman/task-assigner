import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, AlertTitle, Slide } from '@mui/material';
import { RealtimeNotification } from '../../services/realtimeService';

interface ToastNotificationProps {
  notification: RealtimeNotification | null;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ notification, onClose }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (notification) {
      setOpen(true);
    }
  }, [notification]);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  const getSeverity = (type: string) => {
    switch (type) {
      case 'task_completed':
        return 'success';
      case 'task_overdue':
        return 'error';
      case 'assignment_created':
        return 'info';
      case 'assignment_updated':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (!notification) return null;

  const severity = getSeverity(notification.type);

  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      TransitionComponent={Slide}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        variant="filled"
        sx={{ width: '100%', minWidth: 300 }}
      >
        <AlertTitle>{notification.title}</AlertTitle>
        {notification.message}
      </Alert>
    </Snackbar>
  );
};

export default ToastNotification;