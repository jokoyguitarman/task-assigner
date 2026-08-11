import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { CalendarMonth, ExpandMore, PriorityHigh, Repeat } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { UpcomingItem } from '../../types';
import { upcomingAPI } from '../../services/supabaseService';
import { toDateOnly } from '../../lib/dates';

// What is coming, before it arrives.
//
// The gap this fills: a recurring task is a rule, and until now the only way to find
// out whether a rule was right was to wait for the day it fired. Somebody setting up
// "every Monday" on a Tuesday had six days of not knowing.
//
// Most of what is listed here does not exist yet. It is the materialiser's output
// worked out ahead of time, which is why the wording avoids implying otherwise and
// why the rows that *are* real are the ones that get marked.

const HORIZONS = [7, 14, 30];

const dayLabel = (day: Date): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (toDateOnly(day) === toDateOnly(tomorrow)) return 'Tomorrow';

  return day.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const UpcomingWork: React.FC = () => {
  const { user, currentOutlet } = useAuth();
  const isOwner = user?.role === 'admin';

  const [days, setDays] = useState(14);
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [outletFilter, setOutletFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await upcomingAPI.get(days));
    } catch (err) {
      console.error('Could not load upcoming work:', err);
      setError(err instanceof Error ? err.message : 'Could not work out what is coming.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const outlets = useMemo(
    () => Array.from(new Set(items.map(i => i.outletName))).sort(),
    [items]
  );

  const visible = useMemo(
    () => (outletFilter === 'all' ? items : items.filter(i => i.outletName === outletFilter)),
    [items, outletFilter]
  );

  // One section per day. The rows arrive already ordered by the database, so this
  // only has to bucket them.
  const byDay = useMemo(() => {
    const groups = new Map<string, UpcomingItem[]>();

    visible.forEach(item => {
      const key = toDateOnly(item.businessDay);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const projectedCount = visible.filter(i => i.isProjected).length;

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Working out what is coming…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={load}>Try again</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Coming up</Typography>
        <Typography variant="body2" color="text.secondary">
          {isOwner
            ? 'Work that will land across your branches, before it does.'
            : `What ${currentOutlet?.name ?? 'this branch'} has ahead of it.`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, value) => value && setDays(value)}
        >
          {HORIZONS.map(option => (
            <ToggleButton key={option} value={option} sx={{ px: 2 }}>
              {option} days
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {isOwner && outlets.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Branch</InputLabel>
            <Select
              label="Branch"
              value={outletFilter}
              onChange={event => setOutletFilter(event.target.value)}
            >
              <MenuItem value="all">All branches</MenuItem>
              {outlets.map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Typography variant="body2" color="text.secondary">
          {visible.length} job{visible.length === 1 ? '' : 's'} over the next {days} days
        </Typography>
      </Box>

      {projectedCount > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Repeating work is shown as it <em>will be</em> created — none of it exists yet, and
          changing the task or the branch's areas changes what actually turns up. Anything
          already on a branch's list is marked.
        </Alert>
      )}

      {byDay.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CalendarMonth sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" fontWeight={600}>Nothing scheduled ahead</Typography>
          <Typography variant="body2" color="text.secondary">
            No recurring work falls in the next {days} days.
          </Typography>
        </Box>
      ) : (
        byDay.map(([key, dayItems], index) => (
          <Accordion
            key={key}
            defaultExpanded={index === 0}
            disableGutters
            sx={{
              mb: 1, borderRadius: 2, border: '1px solid #e2e8f0',
              '&::before': { display: 'none' },
              boxShadow: 'none',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {dayLabel(dayItems[0].businessDay)}
                </Typography>
                <Chip size="small" label={`${dayItems.length} job${dayItems.length === 1 ? '' : 's'}`} />
                {dayItems.some(i => i.recurrence === 'weekly' || i.recurrence === 'monthly') && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    icon={<Repeat />}
                    label="has repeating work due"
                  />
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              {groupBy(dayItems, isOwner ? i => i.outletName : i => i.areaName ?? 'Other').map(
                ([heading, group]) => (
                  <Box key={heading} sx={{ mb: 2 }}>
                    <Typography
                      variant="overline"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{ letterSpacing: '0.06em' }}
                    >
                      {heading}
                    </Typography>

                    {group.map((item, i) => (
                      <Row key={`${item.taskId}-${item.outletId}-${i}`} item={item} showArea={isOwner} />
                    ))}
                  </Box>
                )
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Box>
  );
};

const Row: React.FC<{ item: UpcomingItem; showArea: boolean }> = ({ item, showArea }) => (
  <Box
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
      py: 1, px: 1.5, mb: 0.5, borderRadius: 1.5,
      border: '1px solid',
      // Solid for work that exists, dashed for a forecast. The border carries the
      // distinction so every row does not need a chip repeating it.
      borderStyle: item.isProjected ? 'dashed' : 'solid',
      borderColor: item.isProjected ? '#cbd5e1' : '#c7d2fe',
      backgroundColor: item.isProjected ? 'transparent' : '#f5f3ff',
    }}
  >
    <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>
      {item.taskTitle}
    </Typography>

    {showArea && item.areaName && (
      <Chip size="small" variant="outlined" label={item.areaName} />
    )}
    {item.shiftName && <Chip size="small" variant="outlined" label={item.shiftName} />}

    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 74, textAlign: 'right' }}>
      {item.dueTime ? `due ${item.dueTime}` : 'end of day'}
    </Typography>

    {!item.isProjected && (
      <Chip
        size="small"
        color="primary"
        label={item.staffName ? `on ${item.staffName}` : 'already listed'}
      />
    )}
    {item.status === 'overdue' && <PriorityHigh sx={{ fontSize: 16, color: 'error.main' }} />}
  </Box>
);

const groupBy = <T,>(rows: T[], key: (row: T) => string): [string, T[]][] => {
  const groups = new Map<string, T[]>();
  rows.forEach(row => groups.set(key(row), [...(groups.get(key(row)) ?? []), row]));
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
};

export default UpcomingWork;
