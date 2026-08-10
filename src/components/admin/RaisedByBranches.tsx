import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Typography,
} from '@mui/material';
import { Lightbulb, Repeat, Close } from '@mui/icons-material';
import { raisedWorkAPI, taskCompletionProofsAPI } from '../../services/supabaseService';
import { Task } from '../../types';

// What the branches have noticed themselves.
//
// Shown rather than gated. Approval was the obvious design and the wrong one: the
// business this is for cannot afford a manager, so the owner is the bottleneck an
// approval queue would reintroduce — and there is already evidence of what happens,
// in a reschedule request that sat unanswered for eleven months.
//
// The one decision worth keeping is promotion. Seeing the same thing raised three
// weeks running is the signal it belongs in the standard checklist, and that is a
// decision about standards rather than about whether someone may clean something.
interface Props {
  onPromoted: () => void;
}

const RaisedByBranches: React.FC<Props> = ({ onPromoted }) => {
  const [items, setItems] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const raised = await raisedWorkAPI.getRaised();
      setItems(raised);

      // The bucket is private, so each attachment needs a short-lived signed URL.
      const signed = await Promise.all(
        raised
          .filter(task => task.photoPath)
          .map(async task => [task.id, await taskCompletionProofsAPI.getSignedUrl(task.photoPath!)] as const)
      );

      setPhotos(Object.fromEntries(signed.filter(([, url]) => url) as [string, string][]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load what your branches raised.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (taskId: string, action: 'promote' | 'dismiss') => {
    setBusy(taskId);
    setError(null);

    try {
      if (action === 'promote') {
        await raisedWorkAPI.promoteToRecurring(taskId);
      } else {
        await raisedWorkAPI.dismiss(taskId);
      }
      await load();
      onPromoted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Checking what your branches raised…</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>;
  if (items.length === 0) return null;

  return (
    <Card sx={{ mb: 3, border: '1px solid #ddd6fe', backgroundColor: '#f5f3ff' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Lightbulb sx={{ color: '#7c3aed' }} />
          <Typography variant="h6" fontWeight={600}>Raised by your branches</Typography>
          <Chip size="small" label={items.length} sx={{ backgroundColor: '#ede9fe', color: '#5b21b6' }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your team spotted these and put them on their own list. They are already being dealt
          with — this is only here so you know, and so you can make one part of the routine.
        </Typography>

        {items.map(task => (
          <Box
            key={task.id}
            sx={{
              display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap',
              p: 2, mb: 1, borderRadius: 2, backgroundColor: '#fff', border: '1px solid #ddd6fe',
            }}
          >
            {photos[task.id] && (
              <Link href={photos[task.id]} target="_blank" rel="noopener noreferrer">
                <Box
                  component="img"
                  src={photos[task.id]}
                  alt=""
                  sx={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 1.5, display: 'block' }}
                />
              </Link>
            )}

            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="subtitle2" fontWeight={600}>{task.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {task.raisedByOutletName}
                {task.raisedByStaffName ? ` · noticed by ${task.raisedByStaffName}` : ''}
                {task.area?.name ? ` · ${task.area.name}` : ''}
              </Typography>
              {task.description && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>“{task.description}”</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Repeat />}
                disabled={busy !== null}
                onClick={() => act(task.id, 'promote')}
              >
                Make it routine
              </Button>
              <Button
                size="small"
                color="inherit"
                startIcon={<Close />}
                disabled={busy !== null}
                onClick={() => act(task.id, 'dismiss')}
              >
                Not needed
              </Button>
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

export default RaisedByBranches;
