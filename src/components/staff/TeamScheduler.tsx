import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Chip,
  Alert,
  Fade,
  Slide,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  ViewWeek as WeekIcon,
  CalendarViewMonth as MonthIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  monthlySchedulesAPI, 
  staffProfilesAPI, 
  outletsAPI 
} from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MonthlySchedule, 
  StaffProfile, 
  Outlet
} from '../../types';

const TeamScheduler: React.FC = () => {
  const { user, currentOutlet, isOutletUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<MonthlySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>(() => {
    try {
      const saved = localStorage.getItem('scheduler-view-preference');
      return (saved as 'weekly' | 'monthly') || 'weekly';
    } catch (error) {
      console.warn('Failed to read localStorage preference:', error);
      return 'weekly';
    }
  });

  // Persist view preference when it changes
  useEffect(() => {
    try {
      localStorage.setItem('scheduler-view-preference', viewMode);
    } catch (error) {
      console.warn('Failed to save view preference:', error);
    }
  }, [viewMode]);

  const currentWeekStart = new Date(currentDate);
  currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay());

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        const [staffData, schedulesData, outletsData] = await Promise.all([
          staffProfilesAPI.getAll(),
          monthlySchedulesAPI.getAll(),
          outletsAPI.getAll(),
        ]);
        
        setStaffProfiles(staffData);
        setMonthlySchedules(schedulesData);
        setOutlets(outletsData);
        
        console.log('🔍 TeamScheduler - Loaded data:', {
          staffProfiles: staffData.length,
          monthlySchedules: schedulesData.length,
          outlets: outletsData.length
        });
      } catch (error) {
        console.error('Error loading team scheduler data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // For staff scheduler, show all staff profiles
  const filteredStaff = staffProfiles;

  const getStaffScheduleForDate = (staffId: string, date: Date) => {
    const targetMonth = date.getMonth() + 1;
    const targetYear = date.getFullYear();
    
    const monthlySchedule = monthlySchedules.find(s => 
      s.staffId === staffId && 
      s.month === targetMonth && 
      s.year === targetYear
    );
    
    if (!monthlySchedule) {
      return null;
    }
    
    const dailySchedule = monthlySchedule.dailySchedules?.find(ds => 
      new Date(ds.scheduleDate).toDateString() === date.toDateString()
    );
    
    return dailySchedule;
  };

  const getWeekDays = (startDate: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const endDate = new Date(lastDay);
    
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());
    
    const lastSaturday = new Date(endDate);
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    for (let d = new Date(firstSunday); d <= lastSaturday; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  };

  const formatWeekRange = (startDate: Date) => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  };

  const formatMonthRange = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getOutletName = (outletId?: string): string => {
    if (!outletId) return 'No location';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown location';
  };

  const getOutletColor = (outletId?: string): string => {
    if (!outletId) return '#9e9e9e';
    
    if (!outlets || outlets.length === 0) {
      return '#9e9e9e';
    }
    
    const outlet = outlets.find(o => o.id === outletId);
    if (!outlet) return '#9e9e9e';
    
    const colors = [
      '#1976d2', // Blue
      '#388e3c', // Green  
      '#f57c00', // Orange
      '#7b1fa2', // Purple
      '#c62828', // Red
      '#00796b', // Teal
      '#5d4037', // Brown
      '#455a64', // Blue Grey
      '#e91e63', // Pink
      '#ff5722', // Deep Orange
      '#607d8b', // Blue Grey
      '#795548'  // Brown
    ];
    
    const index = outlets.findIndex(o => o.id === outletId);
    return index >= 0 ? colors[index % colors.length] : '#9e9e9e';
  };

  const displayTime12Hour = (time?: string): string => {
    if (!time) return '--';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading schedule data...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Fade in timeout={600}>
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" component="h1" gutterBottom>
                    📅 {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Schedule
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    View your team's schedule for the {viewMode === 'weekly' ? 'week' : 'month'}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  {/* View Toggle */}
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(event, newMode) => {
                      if (newMode !== null) {
                        setViewMode(newMode);
                      }
                    }}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        color: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        },
                      },
                    }}
                  >
                    <ToggleButton value="weekly" aria-label="weekly view">
                      <WeekIcon sx={{ mr: 1 }} />
                      Weekly
                    </ToggleButton>
                    <ToggleButton value="monthly" aria-label="monthly view">
                      <MonthIcon sx={{ mr: 1 }} />
                      Monthly
                    </ToggleButton>
                  </ToggleButtonGroup>
                  
                  {/* Navigation */}
                  <IconButton onClick={viewMode === 'weekly' ? handlePreviousWeek : handlePreviousMonth} sx={{ color: 'white' }}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" sx={{ minWidth: 250, textAlign: 'center' }}>
                    {viewMode === 'weekly' ? formatWeekRange(currentWeekStart) : formatMonthRange(currentDate)}
                  </Typography>
                  <IconButton onClick={viewMode === 'weekly' ? handleNextWeek : handleNextMonth} sx={{ color: 'white' }}>
                    <ArrowForwardIcon />
                  </IconButton>
                </Box>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignItems="flex-end" gap={2} mt={2} flexWrap="wrap">
                {/* Outlet Color Legend */}
                <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" sx={{ color: 'white', opacity: 0.9, fontWeight: 'bold' }}>
                    Outlets:
                  </Typography>
                  {outlets.map((outlet, index) => (
                    <Chip
                      key={outlet.id}
                      size="small"
                      label={outlet.name}
                      sx={{
                        backgroundColor: getOutletColor(outlet.id),
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        <Slide direction="up" in timeout={600}>
          <Card>
            <CardContent>
              {filteredStaff.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No staff members found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please contact your administrator to add staff members
                  </Typography>
                </Box>
              ) : (
                <TableContainer 
                  component={Paper} 
                  id="schedule-calendar"
                  sx={{ 
                    maxHeight: '70vh',
                    overflow: 'auto',
                    '& .MuiTableHead-root': {
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }
                  }}
                >
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow sx={{ 
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        '& .MuiTableCell-root': {
                          backgroundColor: 'transparent',
                          backgroundImage: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                          backdropFilter: 'blur(10px)',
                        }
                      }}>
                        <TableCell sx={{ minWidth: 150 }}><strong>Staff Member</strong></TableCell>
                        {viewMode === 'weekly' ? (
                          // Weekly view - show all 7 days in header
                          getWeekDays(currentWeekStart).map((date, i) => (
                            <TableCell key={i} align="center" sx={{ minWidth: 120 }}>
                              <Typography variant="caption" fontWeight="bold" display="block">
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>
                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Typography>
                          </TableCell>
                          ))
                        ) : (
                          // Monthly view - show days 1-7, 8-14, 15-21, 22-28, etc. in separate rows
                          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                            <TableCell key={i} align="center" sx={{ minWidth: 80 }}>
                              <Typography variant="caption" fontWeight="bold" display="block">
                                {day}
                              </Typography>
                            </TableCell>
                          ))
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewMode === 'weekly' ? (
                        // Weekly view - one row per staff member
                        filteredStaff.map((staff, staffIndex) => (
                        <Slide key={staff.id} direction="up" in timeout={300 + staffIndex * 100}>
                          <TableRow hover>
                            <TableCell>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {staff.user?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {staff.position?.name}
                                </Typography>
                              </Box>
                            </TableCell>
                              {getWeekDays(currentWeekStart).map((date, dayIndex) => {
                              const schedule = getStaffScheduleForDate(staff.id, date);
                              
                              return (
                                  <TableCell key={dayIndex} align="center">
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <Tooltip 
                                    title={schedule ? `Scheduled` : `No schedule`}
                                    placement="top"
                                  >
                                    <IconButton
                                      size="small"
                                      disabled
                                      sx={{
                                            width: 50,
                                            height: 50,
                                            borderRadius: 2,
                                        backgroundColor: schedule?.isDayOff 
                                          ? 'error.light' 
                                              : schedule?.outletId
                                                ? getOutletColor(schedule.outletId)
                                            : 'grey.100',
                                        color: schedule?.isDayOff 
                                          ? 'error.contrastText' 
                                              : schedule?.outletId
                                                ? 'white'
                                            : 'text.secondary',
                                      }}
                                    >
                                      <ScheduleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {schedule && (
                                        <Typography variant="caption" sx={{ fontSize: '0.7rem', textAlign: 'center' }}>
                                      {schedule.isDayOff 
                                            ? (
                                              <Chip 
                                                label="OFF" 
                                                size="small" 
                                                sx={{ 
                                                  backgroundColor: 'error.main',
                                                  color: 'white',
                                                  fontSize: '0.7rem', 
                                                  height: 24,
                                                  fontWeight: 'bold'
                                                }}
                                              />
                                            ) : (
                                              <Box
                                                sx={{
                                                  backgroundColor: schedule.outletId ? getOutletColor(schedule.outletId) : 'grey.100',
                                                  color: schedule.outletId ? 'white' : 'text.secondary',
                                                  padding: '4px 8px',
                                                  borderRadius: '4px',
                                                  minWidth: '80px',
                                                  textAlign: 'center'
                                                }}
                                              >
                                                <Typography variant="caption" display="block" fontWeight="bold">
                                                  {displayTime12Hour(schedule.timeIn)}
                                                </Typography>
                                                <Typography variant="caption" display="block">
                                                  {displayTime12Hour(schedule.timeOut)}
                                                </Typography>
                                                {schedule.outletId && (
                                                  <Typography 
                                                    variant="caption" 
                                                    display="block" 
                                                    sx={{ 
                                                      fontSize: '0.6rem', 
                                                      color: 'white',
                                                      fontWeight: 'bold',
                                                      mt: 0.5,
                                                      textAlign: 'center'
                                                    }}
                                                  >
                                                    {getOutletName(schedule.outletId)}
                                                  </Typography>
                                                )}
                                              </Box>
                                            )
                                      }
                                    </Typography>
                                  )}
                                    </Box>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </Slide>
                        ))
                      ) : (
                        // Monthly view - calendar grid for each staff member
                        filteredStaff.map((staff, staffIndex) => {
                          const monthDays = getMonthDays(currentDate);
                          const weeks = [];
                          for (let i = 0; i < monthDays.length; i += 7) {
                            weeks.push(monthDays.slice(i, i + 7));
                          }
                          
                          return weeks.map((week, weekIndex) => (
                            <Slide key={`${staff.id}-${weekIndex}`} direction="up" in timeout={300 + (staffIndex * weeks.length + weekIndex) * 50}>
                              <TableRow hover>
                                <TableCell>
                                  {weekIndex === 0 && (
                                    <Box>
                                      <Typography variant="subtitle2" fontWeight="bold">
                                        {staff.user?.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {staff.position?.name}
                                      </Typography>
                                    </Box>
                                  )}
                                </TableCell>
                                {week.map((date, dayIndex) => {
                                  const schedule = getStaffScheduleForDate(staff.id, date);
                                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                                  
                                  return (
                                    <TableCell key={dayIndex} align="center" sx={{ 
                                      opacity: isCurrentMonth ? 1 : 0.3,
                                      minWidth: 80,
                                      height: 60
                                    }}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                          {date.getDate()}
                                        </Typography>
                                        {schedule && (
                                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                            {schedule.isDayOff ? (
                                              <Chip 
                                                label="OFF" 
                                                size="small" 
                                                sx={{ 
                                                  backgroundColor: 'error.main',
                                                  color: 'white',
                                                  fontSize: '0.6rem', 
                                                  height: 20,
                                                  fontWeight: 'bold'
                                                }}
                                              />
                                            ) : (
                                              <Box 
                                                sx={{ 
                                                  textAlign: 'center',
                                                  backgroundColor: schedule.outletId ? getOutletColor(schedule.outletId) : 'grey.100',
                                                  color: schedule.outletId ? 'white' : 'text.secondary',
                                                  padding: '2px 4px',
                                                  borderRadius: '3px',
                                                  minWidth: '60px'
                                                }}
                                              >
                                                <Typography variant="caption" display="block" fontWeight="bold" sx={{ fontSize: '0.6rem' }}>
                                                  {displayTime12Hour(schedule.timeIn)}
                                                </Typography>
                                                <Typography variant="caption" display="block" sx={{ fontSize: '0.6rem' }}>
                                                  {displayTime12Hour(schedule.timeOut)}
                                                </Typography>
                                                {schedule.outletId && (
                                                  <Typography 
                                                    variant="caption" 
                                                    display="block" 
                                                    sx={{ 
                                                      fontSize: '0.5rem', 
                                                      color: 'white',
                                                      fontWeight: 'bold',
                                                      mt: 0.5
                                                    }}
                                                  >
                                                    {getOutletName(schedule.outletId)}
                                                  </Typography>
                                                )}
                                              </Box>
                                            )}
                                          </Box>
                                        )}
                                      </Box>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            </Slide>
                          ));
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Slide>
      </Box>
    </LocalizationProvider>
  );
};

export default TeamScheduler;