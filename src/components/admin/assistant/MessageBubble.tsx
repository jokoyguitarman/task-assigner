import React from 'react';
import { Avatar, Box, Button, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import {
  AutoAwesome,
  CameraAlt,
  CheckCircle,
  PriorityHigh,
  QuestionAnswer,
  Repeat,
  Schedule,
  Store,
} from '@mui/icons-material';
import { ChatMessage, ProposedTask, recurrenceLabel } from '../../../services/assistantService';

// The owner on the right, the assistant on the left. Nothing clever: a chat that
// does not look like a chat makes people write to it like a search box.

interface Props {
  message: ChatMessage;
  onConfirm: (messageId: string) => void;
  onDiscard: (messageId: string) => void;
}

const MessageBubble: React.FC<Props> = ({ message, onConfirm, onDiscard }) => {
  const mine = message.role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        gap: 1.5,
        mb: 2.5,
      }}
    >
      {!mine && (
        <Avatar
          sx={{
            width: 32, height: 32, flex: 'none', mt: 0.5,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          }}
        >
          <AutoAwesome sx={{ fontSize: 18 }} />
        </Avatar>
      )}

      <Box sx={{ maxWidth: { xs: '85%', md: '72%' }, minWidth: 0 }}>
        <Box
          sx={{
            px: 2, py: 1.25,
            borderRadius: 3,
            borderTopRightRadius: mine ? 4 : 12,
            borderTopLeftRadius: mine ? 12 : 4,
            background: mine
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : '#ffffff',
            color: mine ? '#fff' : 'text.primary',
            border: mine ? 'none' : '1px solid #e2e8f0',
            boxShadow: mine ? 'none' : '0 1px 2px rgba(15,23,42,.04)',
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
            {message.content}
          </Typography>
        </Box>

        {message.proposal && (
          <ProposalCard
            proposal={message.proposal}
            state={message.proposalState ?? 'pending'}
            onConfirm={() => onConfirm(message.id)}
            onDiscard={() => onDiscard(message.id)}
          />
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5, textAlign: mine ? 'right' : 'left', px: 0.5 }}
        >
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Box>
  );
};

// Nothing is written until the owner taps Schedule. One misread instruction
// otherwise creates work at every branch, every day, and somebody has to go and
// undo it by hand.
const ProposalCard: React.FC<{
  proposal: NonNullable<ChatMessage['proposal']>;
  state: NonNullable<ChatMessage['proposalState']>;
  onConfirm: () => void;
  onDiscard: () => void;
}> = ({ proposal, state, onConfirm, onDiscard }) => (
  <Card sx={{ mt: 1.5, '&:hover': { transform: 'none', boxShadow: 'inherit' } }}>
    <CardContent sx={{ pb: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {proposal.summary}
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      {proposal.tasks.map((task, index) => (
        <ProposedTaskRow key={index} task={task} last={index === proposal.tasks.length - 1} />
      ))}

      {state === 'confirmed' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, color: 'success.main' }}>
          <CheckCircle sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight={600}>Scheduled</Typography>
        </Box>
      ) : state === 'discarded' ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Discarded — nothing was saved.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" size="small" onClick={onConfirm}>
            Schedule it
          </Button>
          <Button size="small" color="inherit" onClick={onDiscard}>
            Discard
          </Button>
        </Box>
      )}
    </CardContent>
  </Card>
);

const ProposedTaskRow: React.FC<{ task: ProposedTask; last: boolean }> = ({ task, last }) => {
  const repeats = recurrenceLabel(task);

  return (
    <Box sx={{ mb: last ? 0 : 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography variant="body2" fontWeight={600}>{task.title}</Typography>
        {task.isHighPriority && <PriorityHigh sx={{ fontSize: 16, color: 'warning.main' }} />}
      </Box>

      {task.description && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {task.description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
        {task.areaName && <Chip size="small" variant="outlined" label={task.areaName} />}
        {task.shiftName && (
          <Chip size="small" variant="outlined" icon={<Schedule />} label={task.shiftName} />
        )}
        {task.dueTime && <Chip size="small" variant="outlined" label={`due ${task.dueTime}`} />}
        {repeats && <Chip size="small" variant="outlined" icon={<Repeat />} label={repeats} />}
        {task.requiresPhoto && (
          <Chip size="small" variant="outlined" icon={<CameraAlt />} label="photo" />
        )}
        {task.answerType && task.answerType !== 'none' && (
          <Chip
            size="small"
            variant="outlined"
            icon={<QuestionAnswer />}
            label={task.answerType === 'condition' ? 'condition check' : `records a ${task.answerType}`}
          />
        )}
      </Box>

      {/* Where it lands. An empty list is not "nowhere" — it is every branch that
          runs the shift and has the area, which is worth saying out loud rather
          than leaving the owner to infer from an absence. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
        <Store sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {task.outletNames && task.outletNames.length > 0
            ? task.outletNames.join(', ')
            : 'every branch that runs this shift and has this area'}
        </Typography>
      </Box>
    </Box>
  );
};

export default MessageBubble;
