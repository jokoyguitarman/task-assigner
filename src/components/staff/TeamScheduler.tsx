import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  Chip,
  Paper,
  LinearProgress,
  Fade,
  Slide,
} from '@mui/material';
import {
  Schedule,
  Person,
  AccessTime,
  Business,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { StaffProfile, MonthlySchedule, DailySchedule, Outlet } from '../../types';
import { staffProfilesAPI, monthlySchedulesAPI, outletsAPI } from '../../services/supabaseService';

const TeamScheduler: React.FC = () => {
  const { user, currentOutlet, isOutletUser } = useAuth();
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<MonthlySchedule[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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
        
        // Debug logging for outlets
        console.log('🔍 TeamScheduler - Loaded outlets:', outletsData.map(o => ({
          id: o.id,
          name: o.name,
          index: outletsData.indexOf(o)
        })));
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

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getStaffScheduleForDate = (staffId: string, date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const schedule = monthlySchedules.find(ms => 
      ms.staffId === staffId && 
      ms.month === month && 
      ms.year === year
    );
    
    if (!schedule) return null;
    
    return schedule.dailySchedules?.find(s => 
      s.scheduleDate.getDate() === date.getDate()
    );
  };

  const getOutletName = (outletId?: string): string => {
    if (!outletId) return 'No location';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown location';
  };

  const getOutletColor = (outletId?: string): string => {
    if (!outletId) return '#9e9e9e';
    
    // Safety check: if outlets haven't loaded yet, return default color
    if (!outlets || outlets.length === 0) {
      console.log(`🎨 TeamScheduler - Outlets not loaded yet, using default color for ${outletId}`);
      return '#9e9e9e';
    }
    
    const outlet = outlets.find(o => o.id === outletId);
    if (!outlet) return '#9e9e9e';
    
    // Use consistent color palette with MonthlyScheduler
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
    
    // Use findIndex for consistent indexing across components
    const index = outlets.findIndex(o => o.id === outletId);
    const color = index >= 0 ? colors[index % colors.length] : '#9e9e9e';
    
    // Debug logging to help identify color assignment issues
    console.log(`🎨 TeamScheduler - Color for outlet ${outlet.name} (${outletId}): ${color} (index: ${index})`);
    
    return color;
  };

  const displayTime12Hour = (time?: string): string => {
    if (!time) return '--';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Filter staff for outlet users
  const filteredStaff = isOutletUser && currentOutlet 
    ? staffProfiles.filter(staff => {
        // Show staff who have schedules for this outlet
        return monthlySchedules.some(ms => 
          ms.staffId === staff.id && 
          ms.dailySchedules?.some(s => s.outletId === currentOutlet.id)
        );
      })
    : staffProfiles;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Loading team schedules...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
              <Schedule />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700} color="text.primary">
                Team Schedules
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {isOutletUser && currentOutlet 
                  ? `Schedule overview for ${currentOutlet.name} team`
                  : 'Schedule overview for all team members'
                }
              </Typography>
            </Box>
          </Box>
        </Box>
      </Fade>

      {/* Week Navigation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>
              Week of {getWeekDays()[0].toLocaleDateString()} - {getWeekDays()[6].toLocaleDateString()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label="Previous Week"
                variant="outlined"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(currentDate.getDate() - 7);
                  setCurrentDate(newDate);
                }}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Next Week"
                variant="outlined"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(currentDate.getDate() + 7);
                  setCurrentDate(newDate);
                }}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Schedule Table */}
      <Card>
        <CardContent>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 800 }}>
              {/* Header Row */}
              <Box sx={{ display: 'flex', borderBottom: '2px solid #e0e0e0', mb: 2 }}>
                <Box sx={{ width: 200, p: 2, fontWeight: 600 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Team Member
                  </Typography>
                </Box>
                {getWeekDays().map((date, index) => (
                  <Box key={index} sx={{ flex: 1, p: 2, textAlign: 'center', borderLeft: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {date.getDate()}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Staff Rows */}
              {filteredStaff.map((staff, staffIndex) => (
                <Slide direction="up" in timeout={800 + staffIndex * 100} key={staff.id}>
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #f0f0f0', py: 1 }}>
                    {/* Staff Name */}
                    <Box sx={{ width: 200, p: 2, display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mr: 2 }}>
                        {staff.employeeId?.charAt(0) || staff.id.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {staff.employeeId || `Staff ${staff.id.slice(0, 8)}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {typeof staff.position === 'string' ? staff.position : staff.position?.name || 'Staff Member'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Schedule Days */}
                    {getWeekDays().map((date, dayIndex) => {
                      const schedule = getStaffScheduleForDate(staff.id, date);
                      
                      // Debug logging for schedule data
                      if (schedule && schedule.outletId) {
                        console.log(`🔍 TeamScheduler - Schedule for ${staff.employeeId} on ${date.toDateString()}:`, {
                          outletId: schedule.outletId,
                          outletName: getOutletName(schedule.outletId),
                          isDayOff: schedule.isDayOff,
                          timeIn: schedule.timeIn,
                          timeOut: schedule.timeOut
                        });
                      }
                      
                      return (
                        <Box key={dayIndex} sx={{ flex: 1, p: 2, textAlign: 'center', borderLeft: '1px solid #f0f0f0' }}>
                          {schedule ? (
                            schedule.isDayOff ? (
                              <Chip
                                label="Day Off"
                                size="small"
                                variant="outlined"
                                color="default"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            ) : (
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                  <Avatar
                                    sx={{
                                      bgcolor: getOutletColor(schedule.outletId),
                                      width: 24,
                                      height: 24,
                                      mr: 1,
                                    }}
                                  >
                                    <AccessTime sx={{ fontSize: 14 }} />
                                  </Avatar>
                                  <Typography variant="caption" fontWeight={600}>
                                    {getOutletName(schedule.outletId)}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  {displayTime12Hour(schedule.timeIn)} - {displayTime12Hour(schedule.timeOut)}
                                </Typography>
                              </Box>
                            )
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No schedule
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Slide>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamScheduler;
