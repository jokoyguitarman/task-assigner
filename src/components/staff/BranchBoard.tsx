import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowBack,
  CameraAlt,
  CheckCircle,
  ChevronRight,
  PriorityHigh,
  Tune,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { Area, StaffProfile, Task, TaskAssignment } from '../../types';
import {
  areasAPI,
  assignmentsAPI,
  branchSetupAPI,
  staffProfilesAPI,
  tasksAPI,
} from '../../services/supabaseService';
import { deadlineOf, effectiveStatus, isDueToday } from '../../lib/assignmentStatus';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import TaskRow, { byDeadline, staffNameOf, timeToDeadline } from './TaskRow';
import RaiseTaskDialog from './RaiseTaskDialog';

// What the branch sees the moment the app opens: today's work, grouped by the
// part of the building it happens in.
//
// The operations dashboard leads with five counters and a filter panel, which is
// the wrong first thing to hand somebody standing in a kitchen mid-shift. They
// need to know what is left where they are. Everything else stays one tap away.

// Anything whose area the branch does not have configured, or whose task has not
// loaded, still has to appear somewhere rather than silently drop off the board.
const UNFILED = '__unfiled__';

interface AreaGroup {
  id: string;
  name: string;
  items: TaskAssignment[];
  done: number;
  outstanding: number;
  late: number;
}

const BranchBoard: React.FC = () => {
  const { currentOutlet } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roster, setRoster] = useState<StaffProfile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openAreaId, setOpenAreaId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskAssignment | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOutlet) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const [tasksData, allAssignments, rosterData, allAreas, branchAreaIds] = await Promise.all([
        tasksAPI.getAll(),
        assignmentsAPI.getAll(),
        staffProfilesAPI.getAll(),
        areasAPI.getAll(),
        branchSetupAPI.getAreaIds(currentOutlet.id),
      ]);

      const now = new Date();

      // Today's work, plus anything still outstanding from before. A job that
      // went late overnight is the first thing the morning shift needs to see,
      // and filtering strictly on today's date would hide it.
      setAssignments(
        allAssignments.filter(
          a =>
            a.outletId === currentOutlet.id &&
            (isDueToday(a, now) || (a.status !== 'completed' && deadlineOf(a) < now))
        )
      );

      setTasks(tasksData);
      setRoster(rosterData.filter(s => s.isActive));

      // The branch's own areas, in the order the owner arranged them. Kept even
      // when empty, so a clear station reads as cleared rather than as missing.
      const configured = new Set(branchAreaIds);
      setAreas(allAreas.filter(a => configured.has(a.id)).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      console.error('Error loading the branch board:', err);
      setError(err instanceof Error ? err.message : 'Could not load today\'s work.');
    } finally {
      setLoading(false);
    }
  }, [currentOutlet]);

  // useAutoRefresh runs the loader on mount as well as on every realtime event,
  // so there is deliberately no separate effect doing the first load.
  useAutoRefresh({ refreshFunction: loadData });

  // The rows count down to their deadlines, so the board keeps its own clock
  // rather than reading whatever the last render happened to be.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const taskOf = useCallback(
    (assignment: TaskAssignment) => tasks.find(t => t.id === assignment.taskId),
    [tasks]
  );

  const groups: AreaGroup[] = useMemo(() => {
    const bucket = new Map<string, TaskAssignment[]>();

    assignments.forEach(assignment => {
      const areaId = tasks.find(t => t.id === assignment.taskId)?.areaId;
      const key = areaId && areas.some(a => a.id === areaId) ? areaId : UNFILED;
      bucket.set(key, [...(bucket.get(key) ?? []), assignment]);
    });

    const build = (id: string, name: string): AreaGroup => {
      const items = [...(bucket.get(id) ?? [])].sort(byDeadline);
      const statuses = items.map(a => effectiveStatus(a, now));

      return {
        id,
        name,
        items,
        done: statuses.filter(s => s === 'completed').length,
        outstanding: statuses.filter(s => s !== 'completed').length,
        late: statuses.filter(s => s === 'overdue').length,
      };
    };

    const configured = areas.map(area => build(area.id, area.name));
    const unfiled = build(UNFILED, 'Everything else');

    return unfiled.items.length > 0 ? [...configured, unfiled] : configured;
  }, [assignments, tasks, areas, now]);

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, g) => ({
          done: acc.done + g.done,
          outstanding: acc.outstanding + g.outstanding,
          late: acc.late + g.late,
        }),
        { done: 0, outstanding: 0, late: 0 }
      ),
    [groups]
  );

  const total = totals.done + totals.outstanding;
  const openGroup = groups.find(g => g.id === openAreaId) ?? null;

  const handleComplete = (assignmentId: string) => {
    setDetail(null);
    navigate(`/tasks/${assignmentId}/complete`);
  };

  // Only unclaimed work offers Take, so this never has to collect a reason. Taking
  // a job off somebody who already owns it is a reassignment, which the database
  // requires an explanation for, and that lives on the operations dashboard.
  const handleClaim = async (staffId: string) => {
    if (!claiming) return;

    try {
      setClaimError(null);
      await assignmentsAPI.update(claiming, { staffId });
      setClaiming(null);
      await loadData();
    } catch (err) {
      console.error('Error claiming task:', err);
      setClaimError(err instanceof Error ? err.message : 'Could not take this task.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading today's work…
        </Typography>
      </Box>
    );
  }

  if (!currentOutlet) {
    return (
      <Alert severity="warning">
        This account is not linked to a branch yet, so there is no board to show.
      </Alert>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={loadData}>Try again</Button>
      </Box>
    );
  }

  const detailTask = detail ? taskOf(detail) : undefined;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 2, flexWrap: 'wrap', mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {openGroup ? openGroup.name : 'Today'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {openGroup
              ? `${openGroup.done} of ${openGroup.items.length} done · ${currentOutlet.name}`
              : `${currentOutlet.name} · ${new Date().toLocaleDateString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}`}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Tune />}
          onClick={() => navigate('/dashboard')}
          sx={{ flex: 'none' }}
        >
          Operations
        </Button>
      </Box>

      {/* Progress across the whole branch, so the board answers "are we on top of
          it" before anyone reads a single task. */}
      {!openGroup && total > 0 && (
        <Card sx={{ mb: 3, '&:hover': { transform: 'none' } }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {totals.outstanding === 0
                  ? 'Everything is done'
                  : `${totals.outstanding} left to do`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totals.done} of {total}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(totals.done / total) * 100}
              sx={{
                height: 8, borderRadius: 4, bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                },
              }}
            />
            {totals.late > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                <Warning sx={{ fontSize: 18, color: 'error.main' }} />
                <Typography variant="body2" color="error.main" fontWeight={600}>
                  {totals.late} past its deadline
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {openGroup ? (
        /* One area, every job in it, closest deadline first. */
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => setOpenAreaId(null)} sx={{ mb: 2 }}>
            All areas
          </Button>

          {openGroup.items.length === 0 ? (
            <EmptyArea />
          ) : (
            openGroup.items.map(assignment => (
              <TaskRow
                key={assignment.id}
                assignment={assignment}
                task={taskOf(assignment)}
                ownerName={staffNameOf(roster, assignment.staffId)}
                now={now}
                onOpen={setDetail}
                onClaim={id => { setClaimError(null); setClaiming(id); }}
                onComplete={handleComplete}
              />
            ))
          )}
        </Box>
      ) : (
        <>
          {groups.length === 0 ? (
            <Alert severity="info">
              No areas are set up for this branch yet. The owner configures them under
              Shifts &amp; Areas.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {groups.map(group => (
                <Grid item xs={12} sm={6} lg={4} key={group.id}>
                  <AreaCard
                    group={group}
                    tasks={tasks}
                    now={now}
                    onOpen={() => setOpenAreaId(group.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          <Button
            fullWidth
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setRaiseOpen(true)}
            sx={{ mt: 3, borderRadius: 2, borderStyle: 'dashed', py: 1.5 }}
          >
            Something needs doing
          </Button>
        </>
      )}

      {/* Task detail */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {detailTask?.title ?? 'Task'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {detail && effectiveStatus(detail, now) === 'overdue' && (
              <Chip size="small" color="error" label={`${timeToDeadline(detail, now)}`} />
            )}
            {detailTask?.isHighPriority && (
              <Chip size="small" color="warning" icon={<PriorityHigh />} label="High priority" />
            )}
            {detailTask?.area && <Chip size="small" variant="outlined" label={detailTask.area.name} />}
            {detailTask?.requiresPhoto && (
              <Chip size="small" variant="outlined" icon={<CameraAlt />} label="Photo required" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailTask?.description && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {detailTask.description}
            </Typography>
          )}
          {detailTask?.answerPrompt && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {detailTask.answerPrompt}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            {detail?.dueTime ? `Due at ${detail.dueTime.slice(0, 5)}` : 'Due by end of day'}
            {detailTask?.estimatedMinutes ? ` · about ${detailTask.estimatedMinutes} min` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {staffNameOf(roster, detail?.staffId)
              ? `On ${staffNameOf(roster, detail?.staffId)}`
              : 'Nobody has taken this yet'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)} color="inherit">Close</Button>
          {detail && !detail.staffId && (
            <Button
              onClick={() => { setClaimError(null); setClaiming(detail.id); setDetail(null); }}
            >
              Take it
            </Button>
          )}
          {detail && effectiveStatus(detail, now) !== 'completed' && (
            <Button variant="contained" onClick={() => handleComplete(detail.id)}>
              Mark done
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Who is taking it */}
      <Dialog open={Boolean(claiming)} onClose={() => setClaiming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>Who is taking this?</Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {claimError && <Alert severity="error" sx={{ m: 2 }}>{claimError}</Alert>}
          {roster.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              Nobody is on this branch's roster yet.
            </Typography>
          ) : (
            <List disablePadding>
              {roster.map(person => (
                <ListItemButton key={person.id} onClick={() => handleClaim(person.id)} sx={{ py: 1.5 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>{person.name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={person.name} secondary={person.position?.name} />
                  <ChevronRight color="disabled" />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClaiming(null)} color="inherit">Cancel</Button>
        </DialogActions>
      </Dialog>

      <RaiseTaskDialog
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        onRaised={loadData}
      />
    </Box>
  );
};

const EmptyArea: React.FC = () => (
  <Box sx={{ textAlign: 'center', py: 6 }}>
    <Avatar sx={{ bgcolor: 'success.main', width: 64, height: 64, mx: 'auto', mb: 2 }}>
      <CheckCircle sx={{ fontSize: 32 }} />
    </Avatar>
    <Typography variant="h6" fontWeight={600}>Nothing here today</Typography>
    <Typography variant="body2" color="text.secondary">
      This area is clear.
    </Typography>
  </Box>
);

// The preview the owner asked for: enough of the area's work to know whether it
// is worth walking over, without opening it.
const PREVIEW_COUNT = 3;

const AreaCard: React.FC<{
  group: AreaGroup;
  tasks: Task[];
  now: Date;
  onOpen: () => void;
}> = ({ group, tasks, now, onOpen }) => {
  const preview = group.items.filter(a => effectiveStatus(a, now) !== 'completed').slice(0, PREVIEW_COUNT);
  const hidden = group.outstanding - preview.length;
  const clear = group.outstanding === 0;

  return (
    <Card
      sx={{
        height: '100%',
        borderColor: group.late > 0 ? '#fecaca' : undefined,
        backgroundColor: group.late > 0 ? '#fffbfb' : undefined,
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={600} noWrap>
              {group.name}
            </Typography>
            {group.late > 0 ? (
              <Chip size="small" color="error" label={`${group.late} late`} sx={{ flex: 'none' }} />
            ) : clear ? (
              <CheckCircle sx={{ color: 'success.main', flex: 'none' }} />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label={`${group.outstanding} left`}
                sx={{ flex: 'none' }}
              />
            )}
          </Box>

          <Typography variant="caption" color="text.secondary">
            {group.items.length === 0
              ? 'Nothing scheduled'
              : `${group.done} of ${group.items.length} done`}
          </Typography>

          {group.items.length > 0 && (
            <LinearProgress
              variant="determinate"
              value={(group.done / group.items.length) * 100}
              sx={{
                mt: 1, height: 6, borderRadius: 3, bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: group.late > 0 ? '#ef4444' : '#10b981',
                },
              }}
            />
          )}

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ flex: 1 }}>
            {clear ? (
              <Typography variant="body2" color="text.secondary">
                {group.items.length === 0 ? 'No jobs here today.' : 'All clear.'}
              </Typography>
            ) : (
              preview.map(assignment => {
                const task = tasks.find(t => t.id === assignment.taskId);
                const late = effectiveStatus(assignment, now) === 'overdue';

                return (
                  <Box
                    key={assignment.id}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75 }}
                  >
                    <Box
                      sx={{
                        width: 6, height: 6, borderRadius: '50%', flex: 'none',
                        backgroundColor: late ? 'error.main' : 'grey.400',
                      }}
                    />
                    <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {task?.title ?? 'Unknown task'}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={late ? 'error.main' : 'text.secondary'}
                      fontWeight={late ? 700 : 400}
                      sx={{ flex: 'none' }}
                    >
                      {assignment.dueTime ? assignment.dueTime.slice(0, 5) : 'end of day'}
                    </Typography>
                  </Box>
                );
              })
            )}

            {hidden > 0 && (
              <Typography variant="caption" color="primary.main" fontWeight={600}>
                +{hidden} more
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5, color: 'primary.main' }}>
            <Typography variant="caption" fontWeight={600}>
              Open area
            </Typography>
            <ChevronRight sx={{ fontSize: 16 }} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default BranchBoard;
