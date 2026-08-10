import React, { useState } from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { NotificationsActive, NotificationsNone } from '@mui/icons-material';
import { assignmentsAPI } from '../../services/supabaseService';

// Subscribing the owner to one particular job.
//
// The subscription belongs to the owner, never the branch. That is the whole point:
// branch-raised work stays out of the alert path by default, so that reporting a
// problem can never become a way to set off alarms — but the owner can opt in to
// anything they actually care about.
interface Props {
  assignmentId: string;
  watching: boolean;
  onChanged: () => void;
  size?: 'small' | 'medium';
}

const WatchToggle: React.FC<Props> = ({ assignmentId, watching, onChanged, size = 'small' }) => {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await assignmentsAPI.update(assignmentId, { ownerWatching: !watching });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip
      title={
        watching
          ? 'You will be told when this is done, and if it misses its deadline'
          : 'Be told when this is done, and if it misses its deadline'
      }
    >
      <span>
        <Button
          size={size}
          color={watching ? 'primary' : 'inherit'}
          variant={watching ? 'contained' : 'outlined'}
          disabled={busy}
          onClick={toggle}
          startIcon={
            busy ? <CircularProgress size={14} />
              : watching ? <NotificationsActive /> : <NotificationsNone />
          }
        >
          {watching ? 'Keeping you posted' : 'Keep me posted'}
        </Button>
      </span>
    </Tooltip>
  );
};

export default WatchToggle;
