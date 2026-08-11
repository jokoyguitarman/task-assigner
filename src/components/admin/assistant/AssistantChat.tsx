import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AddComment,
  AutoAwesome,
  DeleteOutline,
  Logout,
  Menu as MenuIcon,
  Send,
  SpaceDashboard,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import {
  assistantService,
  ChatMessage,
  Conversation,
} from '../../../services/assistantService';
import MessageBubble from './MessageBubble';

// The owner's front door.
//
// Deliberately outside AppLayout: this is the whole screen, not a panel inside an
// admin console. The console is one tap away and is still where anything fiddly
// gets done — the point of the chat is that most days it should not be needed.

const SIDEBAR_WIDTH = 264;

const SUGGESTIONS = [
  'Bathrooms checked and signed off before close, every day',
  'Deep clean the walk-in freezer every Monday',
  'Check the fridge temperature at open and record the reading',
  'How much is outstanding across the branches right now?',
];

const AssistantChat: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await assistantService.listConversations());
    } catch (err) {
      console.error('Could not load past chats:', err);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const title = useMemo(
    () => conversations.find(c => c.id === conversationId)?.title,
    [conversations, conversationId]
  );

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;

    setDraft('');
    setError(null);
    setThinking(true);

    // Shown immediately so the screen reacts to the tap, then replaced by the row
    // the function actually saved — the confirm step is keyed on that id, so the
    // placeholder must not survive.
    const pending: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(current => [...current, pending]);

    try {
      const result = await assistantService.send(content, conversationId ?? undefined);

      setConversationId(result.conversationId);
      setMessages(current => [
        ...current.filter(m => m.id !== pending.id),
        result.userMessage,
        result.reply,
      ]);

      refreshConversations();
    } catch (err) {
      console.error('The assistant did not reply:', err);
      setMessages(current => current.filter(m => m.id !== pending.id));
      setDraft(content);
      setError(err instanceof Error ? err.message : 'The assistant could not be reached.');
    } finally {
      setThinking(false);
    }
  };

  const settle = async (messageId: string, state: 'confirmed' | 'discarded') => {
    setError(null);

    try {
      if (state === 'confirmed') {
        const { taskIds, assignmentsCreated } = await assistantService.confirm(messageId);
        setToast(
          assignmentsCreated > 0
            ? `Scheduled. ${taskIds.length} task${taskIds.length === 1 ? '' : 's'} created, ` +
              `${assignmentsCreated} already on the boards.`
            : `Scheduled. ${taskIds.length} task${taskIds.length === 1 ? '' : 's'} created; ` +
              'the branches get their copies on the next run.'
        );
      } else {
        await assistantService.discard(messageId);
      }

      setMessages(current =>
        current.map(m =>
          m.id === messageId && m.proposal ? { ...m, proposalState: state } : m
        )
      );
    } catch (err) {
      console.error('Could not settle the proposal:', err);
      setError(err instanceof Error ? err.message : 'That did not go through.');
    }
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setError(null);
    if (isMobile) setSidebarOpen(false);
  };

  const open = async (conversation: Conversation) => {
    setConversationId(conversation.id);
    setError(null);
    if (isMobile) setSidebarOpen(false);

    try {
      setMessages(await assistantService.loadMessages(conversation.id));
    } catch (err) {
      console.error('Could not open that chat:', err);
      setError('Could not open that chat.');
    }
  };

  const remove = async (id: string) => {
    try {
      await assistantService.removeConversation(id);
      setConversations(current => current.filter(c => c.id !== id));
      if (id === conversationId) startNew();
    } catch (err) {
      console.error('Could not delete that chat:', err);
      setError('Could not delete that chat.');
    }
  };

  const grouped = useMemo(() => groupByAge(conversations), [conversations]);

  const sidebar = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', color: '#e2e8f0' }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
          <Avatar
            sx={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            <AutoAwesome sx={{ fontSize: 18 }} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              Task Assigner
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }} noWrap>
              {organization?.name ?? 'Assistant'}
            </Typography>
          </Box>
        </Box>

        <Button
          fullWidth
          startIcon={<AddComment />}
          onClick={startNew}
          sx={{
            justifyContent: 'flex-start',
            color: '#e2e8f0',
            border: '1px solid #334155',
            '&:hover': { bgcolor: '#1e293b', borderColor: '#475569' },
          }}
        >
          New chat
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {conversations.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#64748b', px: 1.5 }}>
            Past chats show up here.
          </Typography>
        ) : (
          grouped.map(([label, items]) => (
            <Box key={label} sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{ color: '#64748b', px: 1.5, fontWeight: 700, letterSpacing: '.04em' }}
              >
                {label}
              </Typography>
              <List dense disablePadding>
                {items.map(conversation => (
                  <ListItemButton
                    key={conversation.id}
                    selected={conversation.id === conversationId}
                    onClick={() => open(conversation)}
                    sx={{
                      borderRadius: 1.5, mb: 0.25,
                      '&.Mui-selected': { bgcolor: '#1e293b' },
                      '&.Mui-selected:hover': { bgcolor: '#273449' },
                      '&:hover': { bgcolor: '#1e293b' },
                      '&:hover .delete': { opacity: 1 },
                    }}
                  >
                    <ListItemText
                      primary={conversation.title}
                      primaryTypographyProps={{ noWrap: true, fontSize: 13.5 }}
                    />
                    <IconButton
                      className="delete"
                      size="small"
                      onClick={event => { event.stopPropagation(); remove(conversation.id); }}
                      sx={{ opacity: 0, color: '#94a3b8', '&:hover': { color: '#f87171' } }}
                    >
                      <DeleteOutline sx={{ fontSize: 17 }} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ))
        )}
      </Box>

      <Divider sx={{ borderColor: '#1e293b' }} />

      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: '#6366f1', fontSize: 14 }}>
          {user?.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {user?.name}
        </Typography>
        <Tooltip title="Sign out">
          <IconButton size="small" onClick={() => { logout(); navigate('/login'); }} sx={{ color: '#94a3b8' }}>
            <Logout sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#f8fafc' }}>
      {isMobile ? (
        <Drawer
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, border: 0 } }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Box sx={{ width: SIDEBAR_WIDTH, flex: 'none' }}>{sidebar}</Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: { xs: 2, md: 3 }, py: 1.5,
            borderBottom: '1px solid #e2e8f0', bgcolor: 'rgba(255,255,255,.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {isMobile && (
            <IconButton onClick={() => setSidebarOpen(true)} edge="start">
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
            {title ?? 'Assistant'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SpaceDashboard />}
            onClick={() => navigate('/dashboard')}
            sx={{ flex: 'none' }}
          >
            Dashboard
          </Button>
        </Box>

        {/* Messages */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
          <Box sx={{ maxWidth: 820, mx: 'auto' }}>
            {messages.length === 0 ? (
              <Welcome name={user?.name} onPick={send} />
            ) : (
              messages.map(message => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onConfirm={id => settle(id, 'confirmed')}
                  onDiscard={id => settle(id, 'discarded')}
                />
              ))
            )}

            {thinking && <Thinking />}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        </Box>

        {/* Composer */}
        <Box sx={{ px: { xs: 2, md: 3 }, pb: 2.5, pt: 1, borderTop: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Box sx={{ maxWidth: 820, mx: 'auto', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              maxRows={6}
              value={draft}
              placeholder="Tell the assistant what needs to happen…"
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#f8fafc' } }}
            />
            <IconButton
              onClick={() => send(draft)}
              disabled={!draft.trim() || thinking}
              sx={{
                mb: 0.5, width: 44, height: 44, flex: 'none', color: '#fff',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
                '&.Mui-disabled': { background: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              <Send sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mt: 1 }}
          >
            Nothing is saved until you tap to confirm it.
          </Typography>
        </Box>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast(null)} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const Welcome: React.FC<{ name?: string; onPick: (text: string) => void }> = ({ name, onPick }) => (
  <Box sx={{ textAlign: 'center', pt: { xs: 4, md: 10 } }}>
    <Avatar
      sx={{
        width: 56, height: 56, mx: 'auto', mb: 2,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      }}
    >
      <AutoAwesome />
    </Avatar>
    <Typography variant="h5" fontWeight={700} gutterBottom>
      What needs doing{name ? `, ${name.split(' ')[0]}` : ''}?
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 4 }}>
      Describe it the way you would say it out loud. The assistant works out which
      branches, shifts and areas it belongs to, and shows you before it saves anything.
    </Typography>

    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
      {SUGGESTIONS.map(suggestion => (
        <Chip
          key={suggestion}
          label={suggestion}
          variant="outlined"
          onClick={() => onPick(suggestion)}
          sx={{
            height: 'auto', py: 1, borderRadius: 3, bgcolor: '#fff',
            '& .MuiChip-label': { whiteSpace: 'normal', px: 1.5 },
            '&:hover': { borderColor: 'primary.main', bgcolor: '#eef2ff' },
          }}
        />
      ))}
    </Box>
  </Box>
);

const Thinking: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
    <Avatar
      sx={{
        width: 32, height: 32, flex: 'none',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      }}
    >
      <AutoAwesome sx={{ fontSize: 18 }} />
    </Avatar>
    <Box sx={{ display: 'flex', gap: 0.5, px: 2, py: 1.5, borderRadius: 3, bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
      {[0, 1, 2].map(index => (
        <Box
          key={index}
          sx={{
            width: 6, height: 6, borderRadius: '50%', bgcolor: '#94a3b8',
            animation: 'pulse 1.2s ease-in-out infinite',
            animationDelay: `${index * 0.18}s`,
            '@keyframes pulse': {
              '0%, 60%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
              '30%': { opacity: 1, transform: 'translateY(-3px)' },
            },
          }}
        />
      ))}
    </Box>
  </Box>
);

// Sidebar sections. A flat list of forty rows is unreadable by the second week.
const groupByAge = (conversations: Conversation[]): [string, Conversation[]][] => {
  const dayMs = 86_400_000;
  const now = Date.now();

  const buckets: Record<string, Conversation[]> = { Today: [], 'Previous 7 days': [], Older: [] };

  conversations.forEach(conversation => {
    const age = now - new Date(conversation.updatedAt).getTime();
    const label = age < dayMs ? 'Today' : age < 7 * dayMs ? 'Previous 7 days' : 'Older';
    buckets[label].push(conversation);
  });

  return (Object.entries(buckets) as [string, Conversation[]][]).filter(([, items]) => items.length > 0);
};

export default AssistantChat;
