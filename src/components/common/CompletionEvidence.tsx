import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Link,
  Chip,
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { taskCompletionProofsAPI, reassignmentsAPI } from '../../services/supabaseService';
import { TaskCompletionProof, Reassignment } from '../../types';

// The evidence attached to one assignment: the photo or video the branch uploaded,
// the note they typed, and every time the task changed hands.
//
// The bucket is private, so each file needs a short-lived signed URL. Until this
// existed the app could upload proof and then never show it, which defeats the
// point of asking for it.
interface Props {
  assignmentId: string;
  completionNotes?: string;
}

interface SignedProof extends TaskCompletionProof {
  url: string | null;
}

const CompletionEvidence: React.FC<Props> = ({ assignmentId, completionNotes }) => {
  const [proofs, setProofs] = useState<SignedProof[]>([]);
  const [history, setHistory] = useState<Reassignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [files, moves] = await Promise.all([
        taskCompletionProofsAPI.getByAssignment(assignmentId),
        reassignmentsAPI.getByAssignment(assignmentId),
      ]);

      const signed = await Promise.all(
        files.map(async (proof) => ({
          ...proof,
          url: await taskCompletionProofsAPI.getSignedUrl(proof.filePath),
        }))
      );

      setProofs(signed);
      setHistory(moves);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the evidence for this task.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          Loading proof…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>;
  }

  const nameOf = (staff?: { name?: string; employeeId?: string }) =>
    staff?.name || staff?.employeeId || 'nobody';

  return (
    <>
      {completionNotes && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            What they said
          </Typography>
          <Typography variant="body1">{completionNotes}</Typography>
        </Box>
      )}

      {proofs.length > 0 && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Proof ({proofs.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {proofs.map((proof) => (
              <Box key={proof.id}>
                {!proof.url ? (
                  <Typography variant="body2" color="text.secondary">
                    Could not open this file.
                  </Typography>
                ) : proof.fileType === 'video' ? (
                  <video
                    src={proof.url}
                    controls
                    style={{ maxWidth: 280, borderRadius: 8, display: 'block' }}
                  />
                ) : (
                  <Link href={proof.url} target="_blank" rel="noopener noreferrer">
                    <Box
                      component="img"
                      src={proof.url}
                      alt="Completion proof"
                      sx={{
                        maxWidth: 280,
                        borderRadius: 2,
                        display: 'block',
                        border: '1px solid #e2e8f0',
                      }}
                    />
                  </Link>
                )}
                <Typography variant="caption" color="text.secondary">
                  {new Date(proof.uploadedAt).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {history.length > 0 && (
        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Changed hands
          </Typography>
          {history.map((move) => (
            <Box
              key={move.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: 1,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <SwapHoriz fontSize="small" color="action" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="body2">
                  {nameOf(move.fromStaff)} → {nameOf(move.toStaff)}
                </Typography>
                {move.reason ? (
                  <Typography variant="body2" color="text.primary">
                    “{move.reason}”
                  </Typography>
                ) : (
                  <Chip label="No reason given" size="small" variant="outlined" sx={{ mt: 0.5 }} />
                )}
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(move.reassignedAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {proofs.length === 0 && history.length === 0 && !completionNotes && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No proof, notes or reassignments recorded for this task.
        </Typography>
      )}
    </>
  );
};

export default CompletionEvidence;
