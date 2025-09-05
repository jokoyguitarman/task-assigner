import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
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
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  PictureAsPdf as PdfIcon,
  Image as JpegIcon,
  ViewWeek as WeekIcon,
  CalendarViewMonth as MonthIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  monthlySchedulesAPI, 
  dailySchedulesAPI, 
  staffProfilesAPI, 
  outletsAPI 
} from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MonthlySchedule, 
  StaffProfile, 
  Outlet,
  DailyScheduleFormData 
} from '../../types';
import { exportService, ScheduleExportData } from '../../services/exportService';

const MonthlyScheduler: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<MonthlySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState<DailyScheduleFormData>({
    scheduleDate: new Date(),
    outletId: '',
    timeIn: '',
    timeOut: '',
    isDayOff: false,
    dayOffType: '',
    notes: '',
  });
  const [applyToEntireWeek, setApplyToEntireWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>(() => {
    // Try to get preference from localStorage with fallback
    try {
      const saved = localStorage.getItem('scheduler-view-preference');
      return (saved as 'weekly' | 'monthly') || 'weekly';
    } catch (error) {
      console.warn('Failed to read localStorage preference:', error);
      return 'weekly';
    }
  });
  const [isExporting, setIsExporting] = useState(false);
  
  // Persist view preference when it changes
  useEffect(() => {
    try {
      localStorage.setItem('scheduler-view-preference', viewMode);
    } catch (error) {
      console.warn('Failed to save localStorage preference:', error);
    }
  }, [viewMode]);
  
  // Also persist on page unload as a backup
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem('scheduler-view-preference', viewMode);
      } catch (error) {
        console.warn('Failed to save preference on unload:', error);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [viewMode]);

  // Force re-check localStorage on component mount (handles refresh case)
  useEffect(() => {
    const recheckPreference = () => {
      try {
        const saved = localStorage.getItem('scheduler-view-preference');
        if (saved && saved !== viewMode) {
          setViewMode(saved as 'weekly' | 'monthly');
        }
      } catch (error) {
        console.warn('Failed to re-check localStorage preference:', error);
      }
    };

    // Check immediately and after a short delay to handle timing issues
    recheckPreference();
    const timeoutId = setTimeout(recheckPreference, 100);
    
    return () => clearTimeout(timeoutId);
  }, []); // Only run on mount

  // Get the start of the current week (Sunday)
  const getStartOfWeek = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = start.getDate() - day;
    const weekStart = new Date(start.setDate(diff));
    return weekStart;
  };

  const currentWeekStart = getStartOfWeek(currentDate);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear, viewMode, currentWeekStart.toDateString()]);


  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get all months/years that need to be loaded for the current view
      let monthsToLoad: Array<{month: number, year: number}> = [];
      
      if (viewMode === 'weekly') {
        // For weekly view, check if the week spans multiple months
        const weekDays = getWeekDays(currentWeekStart);
        const uniqueMonths = new Set();
        weekDays.forEach(date => {
          const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
          uniqueMonths.add(monthYear);
        });
        
        monthsToLoad = Array.from(uniqueMonths).map(monthYear => {
          const [month, year] = (monthYear as string).split('-');
          return { month: parseInt(month), year: parseInt(year) };
        });
      } else {
        // For monthly view, check if we need to load adjacent months for the calendar grid
        const monthDays = getMonthDays(currentDate);
        const uniqueMonths = new Set();
        monthDays.forEach(date => {
          const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
          uniqueMonths.add(monthYear);
        });
        
        monthsToLoad = Array.from(uniqueMonths).map(monthYear => {
          const [month, year] = (monthYear as string).split('-');
          return { month: parseInt(month), year: parseInt(year) };
        });
      }
      
      // Load staff and outlets once, then load all required monthly schedules
      const [staffData, outletsData] = await Promise.all([
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      
      // Load schedules for all required months
      const allSchedulesData = await Promise.all(
        monthsToLoad.map(({month, year}) => monthlySchedulesAPI.getByMonth(month, year))
      );
      
      // Flatten all schedule data
      const schedulesData = allSchedulesData.flat();
      
      
      setStaffProfiles(staffData);
      setOutlets(outletsData);
      setMonthlySchedules(schedulesData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const formatMonthRange = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleOpenDialog = (staff: StaffProfile, date: Date) => {
    setSelectedStaff(staff);
    setSelectedDate(date);
    
    // Check if there's an existing schedule for this staff and date
    const existingSchedule = getStaffScheduleForDate(staff.id, date);
    
    if (existingSchedule) {
      // Load existing schedule data for editing (convert times to 12-hour format for display)
      setFormData({
        scheduleDate: date,
        outletId: existingSchedule.outletId || '',
        timeIn: displayTime12Hour(existingSchedule.timeIn || ''),
        timeOut: displayTime12Hour(existingSchedule.timeOut || ''),
        isDayOff: existingSchedule.isDayOff || false,
        dayOffType: existingSchedule.dayOffType || '',
        notes: existingSchedule.notes || '',
      });
    } else {
      // No existing schedule, start with empty form
    setFormData({
      scheduleDate: date,
      outletId: '',
      timeIn: '',
      timeOut: '',
      isDayOff: false,
      dayOffType: '',
      notes: '',
    });
    }
    
    setError(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedStaff(null);
    setSelectedDate(null);
    setFormData({
      scheduleDate: new Date(),
      outletId: '',
      timeIn: '',
      timeOut: '',
      isDayOff: false,
      dayOffType: '',
      notes: '',
    });
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      
      if (!formData.outletId && !formData.isDayOff) {
        setError('Please select an outlet or mark as day off');
        return;
      }

      if (!formData.isDayOff && (!formData.timeIn || !formData.timeOut)) {
        setError('Please provide both time in and time out');
        return;
      }

      // Find or create monthly schedule for the staff for the specific month/year of the selected date
      const selectedDateMonth = formData.scheduleDate.getMonth() + 1;
      const selectedDateYear = formData.scheduleDate.getFullYear();
      
      let monthlySchedule = monthlySchedules.find(s => 
        s.staffId === selectedStaff!.id && 
        s.month === selectedDateMonth && 
        s.year === selectedDateYear
      );
      
      if (!monthlySchedule) {
        if (!user?.id) {
          setError('User not authenticated');
          return;
        }
        
        monthlySchedule = await monthlySchedulesAPI.create({
          staffId: selectedStaff!.id,
          month: selectedDateMonth,
          year: selectedDateYear,
          createdBy: user.id,
        });
      }

      // Check if we're editing an existing schedule
      const existingSchedule = getStaffScheduleForDate(selectedStaff!.id, formData.scheduleDate);
      
      // Prepare daily schedule data
      // Fix timezone issue by creating a date at noon to avoid day shift
      const normalizedScheduleDate = new Date(formData.scheduleDate);
      normalizedScheduleDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      const dailyScheduleData: any = {
        monthlyScheduleId: monthlySchedule.id,
        scheduleDate: normalizedScheduleDate,
        isDayOff: formData.isDayOff,
        notes: formData.notes,
      };
      

      if (formData.isDayOff) {
        // For day off, include dayOffType but no outlet or times
        if (formData.dayOffType) {
          dailyScheduleData.dayOffType = formData.dayOffType as 'vacation' | 'sick' | 'personal' | 'other';
        }
      } else {
        // For work day, include outlet and times but no dayOffType
        dailyScheduleData.outletId = formData.outletId;
        dailyScheduleData.timeIn = formData.timeIn;
        dailyScheduleData.timeOut = formData.timeOut;
      }

      if (existingSchedule) {
        // Update existing schedule
        await dailySchedulesAPI.update(existingSchedule.id, dailyScheduleData);
      } else {
        // Create new schedule
        await dailySchedulesAPI.create(dailyScheduleData);
      }

      // Set success message for single schedule save
      let successMessage = existingSchedule ? 'Schedule updated successfully!' : 'Schedule created successfully!';

      // If "Apply to Entire Week" is checked, create schedules for all days of the week
      if (applyToEntireWeek && !formData.isDayOff) {
        // Get the week that contains the selected date, not the current display week
        const selectedDateWeekStart = getStartOfWeek(formData.scheduleDate);
        const weekDays = getWeekDays(selectedDateWeekStart);
        let appliedCount = 0;
        
        
        for (let i = 0; i < weekDays.length; i++) {
          const weekDay = weekDays[i];
          const existingSchedule = getStaffScheduleForDate(selectedStaff!.id, weekDay);
            
          // Only skip if it's a day-off, otherwise overwrite regular schedules
          if (!existingSchedule || !existingSchedule.isDayOff) {
            // Find or create monthly schedule for this month/year
            const weekDayMonth = weekDay.getMonth() + 1;
            const weekDayYear = weekDay.getFullYear();
            let monthlyScheduleForWeekDay = monthlySchedules.find(s => 
              s.staffId === selectedStaff!.id && 
              s.month === weekDayMonth && 
              s.year === weekDayYear
            );
            
            if (!monthlyScheduleForWeekDay) {
              try {
                monthlyScheduleForWeekDay = await monthlySchedulesAPI.create({
                  staffId: selectedStaff!.id,
                  month: weekDayMonth,
                  year: weekDayYear,
                  createdBy: user!.id,
                });
              } catch (err) {
                console.error(`Failed to create monthly schedule:`, err);
                continue; // Skip this day if monthly schedule creation fails
              }
            }
            
            // Create the same schedule for this day
            // Fix timezone issue by creating a date at noon to avoid day shift
            const normalizedWeekDay = new Date(weekDay);
            normalizedWeekDay.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
            
            const weeklyScheduleData: any = {
              monthlyScheduleId: monthlyScheduleForWeekDay.id,
              scheduleDate: normalizedWeekDay,
              isDayOff: false,
              outletId: dailyScheduleData.outletId,
              timeIn: dailyScheduleData.timeIn,
              timeOut: dailyScheduleData.timeOut,
              notes: `Auto-applied from ${formData.scheduleDate.toLocaleDateString()}`,
            };
            
            try {
              if (existingSchedule) {
                // Update existing schedule (overwrite)
                await dailySchedulesAPI.update(existingSchedule.id, weeklyScheduleData);
              } else {
                // Create new schedule
                await dailySchedulesAPI.create(weeklyScheduleData);
              }
              appliedCount++;
            } catch (err) {
              console.error(`Could not create/update schedule for ${weekDay.toLocaleDateString()}:`, err);
            }
          }
        }
        
        if (appliedCount > 0) {
          successMessage = `${successMessage.replace('!', '')} and applied to ${appliedCount} additional days this week!`;
          // Reload data to show the changes immediately
          await loadData();
        }
      }

      setSuccess(successMessage);
      setApplyToEntireWeek(false); // Reset the checkbox after successful save
      
      // Only reload data if we didn't apply to entire week (to see debugging logs)
      if (!applyToEntireWeek || formData.isDayOff) {
        await loadData();
      }
      
      handleCloseDialog();
    } catch (err) {
      console.error('Schedule save error:', err);
      setError(`Failed to save schedule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportSchedule = async (format: 'pdf' | 'jpeg') => {
    try {
      setError(null);
      
      // Prepare schedule data for export
      const scheduleData: ScheduleExportData = {
        month: currentDate.toLocaleDateString('en-US', { month: 'long' }),
        year: currentDate.getFullYear(),
        staffSchedules: staffProfiles.map(staff => {
          const monthlySchedule = monthlySchedules.find(s => s.staffId === staff.id);
          const position = staff.position?.name || 'Unknown Position';
          const outlet = 'Main Outlet'; // TODO: Add outlet assignment to StaffProfile
          
          return {
            staffName: staff.user?.name || 'Unknown Staff',
            position,
            outlet,
            dailySchedules: monthlySchedule?.dailySchedules?.map(ds => ({
              date: ds.scheduleDate.toISOString().split('T')[0],
              timeIn: ds.timeIn,
              timeOut: ds.timeOut,
              isDayOff: ds.isDayOff,
              dayOffType: ds.dayOffType,
              notes: ds.notes,
            })) || [],
          };
        }),
      };

      if (format === 'pdf') {
        await exportService.exportScheduleToPDF(scheduleData, {
          format: 'pdf',
          filename: `schedule_${viewMode}_${currentDate.toLocaleDateString('en-US', { month: 'long' })}_${currentDate.getFullYear()}.pdf`,
        });
      } else {
        // For JPEG, we'll export the calendar view
        const calendarElement = document.getElementById('schedule-calendar');
        if (calendarElement) {
          // Enable export mode to remove scroll restrictions
          setIsExporting(true);
          
          // Wait for the UI to update and show all content
          await new Promise(resolve => setTimeout(resolve, 200));
          
          try {
          await exportService.exportToJPEG(calendarElement, {
            format: 'jpeg',
              filename: `schedule_${viewMode}_${currentDate.toLocaleDateString('en-US', { month: 'long' })}_${currentDate.getFullYear()}.jpg`,
          });
          } finally {
            // Restore normal view mode
            setIsExporting(false);
          }
        } else {
          setError('Calendar view not found for export');
          return;
        }
      }
      
      setSuccess(`Schedule exported to ${format.toUpperCase()} successfully`);
    } catch (err) {
      setError(`Failed to export schedule to ${format.toUpperCase()}`);
    }
  };

  const handleInputChange = (field: keyof DailyScheduleFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = event.target ? event.target.value : event;
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const getStaffScheduleForDate = (staffId: string, date: Date) => {
    // Find the monthly schedule for the specific month and year
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
    
    // Start from the Sunday of the week containing the first day
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());
    
    // End on the Saturday of the week containing the last day
    const lastSaturday = new Date(endDate);
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    for (let d = new Date(firstSunday); d <= lastSaturday; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  };

  // const getCurrentViewDays = () => {
  //   return viewMode === 'weekly' ? getWeekDays(currentWeekStart) : getMonthDays(currentDate);
  // };

  const formatWeekRange = (startDate: Date) => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = startDate.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDate.getDate()}-${endDate.getDate()}, ${year}`;
    } else {
      return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${year}`;
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const minuteStr = minute === 0 ? '00' : minute.toString();
        const timeString = `${hour12}:${minuteStr} ${ampm}`;
        options.push(timeString);
      }
    }
    return options;
  };

  // Convert 24-hour format to 12-hour format with AM/PM
  const formatTo12Hour = (hour24: number, minute: number): string => {
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    const minuteStr = minute === 0 ? '00' : minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  // Convert time string to 12-hour format for display
  const displayTime12Hour = (timeString: string | undefined): string => {
    if (!timeString) return '';
    
    // If already in 12-hour format, return as is
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString;
    }
    
    // Convert from HH:MM format to 12-hour
    const timeParts = timeString.split(':');
    if (timeParts.length === 2) {
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);
      if (!isNaN(hour) && !isNaN(minute)) {
        return formatTo12Hour(hour, minute);
      }
    }
    
    return timeString;
  };

  // Get outlet color for visual differentiation
  const getOutletColor = (outletId: string): string => {
    // Safety check: if outlets haven't loaded yet, return default color
    if (!outlets || outlets.length === 0) {
      return '#9e9e9e';
    }
    
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
    
    const index = outlets.findIndex(outlet => outlet.id === outletId);
    return index >= 0 ? colors[index % colors.length] : '#9e9e9e'; // Default grey
  };

  // Get outlet name by ID
  const getOutletName = (outletId: string): string => {
    const outlet = outlets.find(o => o.id === outletId);
    return outlet ? outlet.name : 'Unknown Outlet';
  };

  // Parse various time formats and convert to 24-hour format for storage
  const parseTimeInput = (input: string): string => {
    if (!input) return '';
    
    // Remove extra spaces and convert to lowercase
    const cleaned = input.replace(/\s+/g, ' ').toLowerCase().trim();
    
    // Handle various formats
    let timeRegex;
    let match;
    
    // Format: 9am, 10pm, 9:30am, 10:30pm (12-hour format with AM/PM)
    timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/;
    match = cleaned.match(timeRegex);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      const period = match[3];
      
      // Validate hour for 12-hour format
      if (hour < 1 || hour > 12) return input;
      if (minute < 0 || minute > 59) return input;
      
      // Convert to 24-hour format for storage
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
    
    // Format: 9, 10, 13, 14 (assume 24-hour format)
    timeRegex = /^(\d{1,2})$/;
    match = cleaned.match(timeRegex);
    if (match) {
      const hour = parseInt(match[1]);
      if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }
    
    // Format: 9:30, 10:45, 13:30, 23:45 (24-hour format)
    timeRegex = /^(\d{1,2}):(\d{2})$/;
    match = cleaned.match(timeRegex);
    if (match) {
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    }
    
    // Format: 930, 1045, 1330 (without colon)
    timeRegex = /^(\d{3,4})$/;
    match = cleaned.match(timeRegex);
    if (match) {
      const timeStr = match[1];
      let hour, minute;
      
      if (timeStr.length === 3) {
        hour = parseInt(timeStr.substring(0, 1));
        minute = parseInt(timeStr.substring(1, 3));
      } else {
        hour = parseInt(timeStr.substring(0, 2));
        minute = parseInt(timeStr.substring(2, 4));
      }
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    }
    
    // If no pattern matches, return original input
    return input;
  };

  const copyFromPreviousWeek = async () => {
    try {
      setError(null);
      const previousWeek = new Date(currentWeekStart);
      previousWeek.setDate(previousWeek.getDate() - 7);
      
      const previousWeekDays = getWeekDays(previousWeek);
      let copiedCount = 0;
      
      for (const staff of staffProfiles) {
        for (const previousDate of previousWeekDays) {
          const previousSchedule = getStaffScheduleForDate(staff.id, previousDate);
          if (previousSchedule) {
            // Calculate corresponding day in current week
            const dayOffset = previousWeekDays.indexOf(previousDate);
            const currentWeekDays = getWeekDays(currentWeekStart);
            const newDate = currentWeekDays[dayOffset];
            
            // Check if schedule already exists for this day
            const existingSchedule = getStaffScheduleForDate(staff.id, newDate);
            if (!existingSchedule) {
              // Find or create monthly schedule
              let monthlySchedule = monthlySchedules.find(s => s.staffId === staff.id);
              if (!monthlySchedule) {
                monthlySchedule = await monthlySchedulesAPI.create({
                  staffId: staff.id,
                  month: newDate.getMonth() + 1,
                  year: newDate.getFullYear(),
                  createdBy: user!.id,
                });
              }
              
              // Create the copied schedule
              const scheduleData: any = {
                monthlyScheduleId: monthlySchedule.id,
                scheduleDate: newDate,
                isDayOff: previousSchedule.isDayOff,
                notes: previousSchedule.notes,
              };
              
              if (previousSchedule.isDayOff && previousSchedule.dayOffType) {
                scheduleData.dayOffType = previousSchedule.dayOffType;
              } else if (!previousSchedule.isDayOff) {
                scheduleData.outletId = previousSchedule.outletId;
                scheduleData.timeIn = previousSchedule.timeIn;
                scheduleData.timeOut = previousSchedule.timeOut;
              }
              
              await dailySchedulesAPI.create(scheduleData);
              copiedCount++;
            }
          }
        }
      }
      
      await loadData();
      setSuccess(`Copied ${copiedCount} schedules from previous week`);
    } catch (err) {
      console.error('Error copying from previous week:', err);
      setError('Failed to copy schedules from previous week');
    }
  };

  const shiftDayOffsForward = async () => {
    try {
      setError(null);
      const previousWeek = new Date(currentWeekStart);
      previousWeek.setDate(previousWeek.getDate() - 7);
      
      const previousWeekDays = getWeekDays(previousWeek);
      const currentWeekDays = getWeekDays(currentWeekStart);
      let shiftedCount = 0;
      
      for (const staff of staffProfiles) {
        // Find day-offs from previous week
        const previousDayOffs = [];
        for (const previousDate of previousWeekDays) {
          const previousSchedule = getStaffScheduleForDate(staff.id, previousDate);
          if (previousSchedule?.isDayOff) {
            const dayIndex = previousWeekDays.indexOf(previousDate);
            previousDayOffs.push({ dayIndex, schedule: previousSchedule });
          }
        }
        
        // Shift each day-off forward by one day
        for (const dayOff of previousDayOffs) {
          const newDayIndex = (dayOff.dayIndex + 1) % 7; // Wrap around week
          const newDate = currentWeekDays[newDayIndex];
          
          // Check if schedule already exists
          const existingSchedule = getStaffScheduleForDate(staff.id, newDate);
          if (!existingSchedule) {
            // Find or create monthly schedule
            let monthlySchedule = monthlySchedules.find(s => s.staffId === staff.id);
            if (!monthlySchedule) {
              monthlySchedule = await monthlySchedulesAPI.create({
                staffId: staff.id,
                month: newDate.getMonth() + 1,
                year: newDate.getFullYear(),
                createdBy: user!.id,
              });
            }
            
            // Create the shifted day-off
            const scheduleData: any = {
              monthlyScheduleId: monthlySchedule.id,
              scheduleDate: newDate,
              isDayOff: true,
              notes: `Shifted from ${previousWeekDays[dayOff.dayIndex].toLocaleDateString()}`,
            };
            
            if (dayOff.schedule.dayOffType) {
              scheduleData.dayOffType = dayOff.schedule.dayOffType;
            }
            
            await dailySchedulesAPI.create(scheduleData);
            shiftedCount++;
          }
        }
      }
      
      await loadData();
      setSuccess(`Shifted ${shiftedCount} day-offs forward by one day`);
    } catch (err) {
      console.error('Error shifting day-offs:', err);
      setError('Failed to shift day-offs forward');
    }
  };

  const resetScheduleForDay = async (staffId: string, date: Date) => {
    try {
      setError(null);
      const existingSchedule = getStaffScheduleForDate(staffId, date);
      
      if (existingSchedule) {
        await dailySchedulesAPI.delete(existingSchedule.id);
        await loadData();
        setSuccess(`Schedule cleared for ${date.toLocaleDateString()}`);
      } else {
        setError('No schedule found for this day');
      }
    } catch (err) {
      console.error('Error resetting schedule:', err);
      setError('Failed to reset schedule');
    }
  };

  const resetScheduleForWeek = async () => {
    try {
      setError(null);
      const weekDays = getWeekDays(currentWeekStart);
      let clearedCount = 0;
      
      for (const staff of staffProfiles) {
        for (const date of weekDays) {
          const existingSchedule = getStaffScheduleForDate(staff.id, date);
          if (existingSchedule) {
            await dailySchedulesAPI.delete(existingSchedule.id);
            clearedCount++;
          }
        }
      }
      
      await loadData();
      setSuccess(`Cleared ${clearedCount} schedules for the current week`);
    } catch (err) {
      console.error('Error resetting week schedules:', err);
      setError('Failed to reset week schedules');
    }
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
                    📅 {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Schedule Builder
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Plan your staff schedules for the {viewMode === 'weekly' ? 'week' : 'month'}
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

                {/* Action Buttons */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    variant="contained"
                    startIcon={<CalendarIcon />}
                    onClick={copyFromPreviousWeek}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                    }}
                  >
                    Copy Previous Week
                  </Button>
                <Button
                  variant="contained"
                  startIcon={<PdfIcon />}
                  onClick={() => handleExportSchedule('pdf')}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                  }}
                >
                  Export PDF
                </Button>
                <Button
                  variant="contained"
                  startIcon={<JpegIcon />}
                  onClick={() => handleExportSchedule('jpeg')}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                  }}
                >
                  Export JPEG
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CalendarIcon />}
                  onClick={resetScheduleForWeek}
                  sx={{
                    background: 'rgba(255, 193, 7, 0.2)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { background: 'rgba(255, 193, 7, 0.3)' },
                  }}
                >
                  Reset Week
                </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {error && (
          <Slide direction="down" in timeout={300}>
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </Slide>
        )}

        {success && (
          <Slide direction="down" in timeout={300}>
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Slide>
        )}

        <Slide direction="up" in timeout={600}>
          <Card>
            <CardContent>
              {staffProfiles.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No staff members found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please enroll staff members first to create schedules
                  </Typography>
                </Box>
              ) : (
                <TableContainer 
                  component={Paper} 
                  id="schedule-calendar"
                  sx={{ 
                    maxHeight: isExporting ? 'none' : '70vh',
                    overflow: isExporting ? 'visible' : 'auto',
                    '& .MuiTableHead-root': {
                      position: isExporting ? 'static' : 'sticky',
                      top: 0,
                      zIndex: 1,
                    }
                  }}
                >
                  <Table stickyHeader={!isExporting}>
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
                        staffProfiles.map((staff, staffIndex) => (
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
                                    title={schedule ? `Right-click to clear schedule` : `Click to add schedule`}
                                    placement="top"
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenDialog(staff, date)}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (schedule) {
                                          if (window.confirm(`Clear schedule for ${staff.user?.name} on ${date.toLocaleDateString()}?`)) {
                                            resetScheduleForDay(staff.id, date);
                                          }
                                        }
                                      }}
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
                                        '&:hover': {
                                          backgroundColor: schedule?.isDayOff 
                                            ? 'error.main' 
                                                : schedule?.outletId
                                                  ? `${getOutletColor(schedule.outletId)}dd` // Slightly darker on hover
                                              : 'grey.300',
                                        },
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
                                                color="error" 
                                                variant="outlined"
                                                sx={{ fontSize: '0.6rem', height: 20 }}
                                              />
                                            ) : (
                                              <Box>
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
                                                      color: getOutletColor(schedule.outletId),
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
                        staffProfiles.map((staff, staffIndex) => {
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
                                      backgroundColor: isCurrentMonth ? 'transparent' : 'grey.50'
                                    }}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" fontWeight="bold" display="block">
                                          {date.getDate()}
                                        </Typography>
                                        {isCurrentMonth && (
                                          <Tooltip 
                                            title={schedule ? `Right-click to clear schedule` : `Click to add schedule`}
                                            placement="top"
                                          >
                                            <IconButton
                                              size="small"
                                              onClick={() => handleOpenDialog(staff, date)}
                                              onContextMenu={(e) => {
                                                e.preventDefault();
                                                if (schedule) {
                                                  if (window.confirm(`Clear schedule for ${staff.user?.name} on ${date.toLocaleDateString()}?`)) {
                                                    resetScheduleForDay(staff.id, date);
                                                  }
                                                }
                                              }}
                                              sx={{
                                                width: 35,
                                                height: 35,
                                                borderRadius: 1,
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
                                                '&:hover': {
                                                  backgroundColor: schedule?.isDayOff 
                                                    ? 'error.main' 
                                                    : schedule?.outletId
                                                      ? `${getOutletColor(schedule.outletId)}dd`
                                                      : 'grey.300',
                                                },
                                              }}
                                            >
                                              <ScheduleIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
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

        {/* Schedule Entry Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {getStaffScheduleForDate(selectedStaff?.id || '', selectedDate || new Date()) ? 'Edit' : 'Create'} Schedule - {selectedStaff?.user?.name}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Date: {selectedDate?.toLocaleDateString()}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.isDayOff}
                      onChange={(e) => {
                        handleInputChange('isDayOff')(e.target.checked);
                        if (e.target.checked) {
                          setApplyToEntireWeek(false); // Can't apply day-off to entire week
                        }
                      }}
                    />
                  }
                  label="Day Off"
                />
              </Grid>

              {!formData.isDayOff && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <input
                        type="checkbox"
                        checked={applyToEntireWeek}
                        onChange={(e) => setApplyToEntireWeek(e.target.checked)}
                      />
                    }
                    label="Apply this shift to entire week (skip days that already have schedules)"
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.9rem',
                        color: 'primary.main',
                        fontWeight: 500,
                      }
                    }}
                  />
                </Grid>
              )}

              {!formData.isDayOff && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth required>
                      <InputLabel>Outlet</InputLabel>
                      <Select
                        value={formData.outletId}
                        onChange={handleInputChange('outletId')}
                        label="Outlet"
                      >
                        {outlets.map((outlet) => (
                          <MenuItem key={outlet.id} value={outlet.id}>
                            {outlet.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Autocomplete
                      freeSolo
                      options={generateTimeOptions()}
                        value={formData.timeIn}
                      onChange={(event, newValue) => {
                        if (newValue) {
                          const parsedTime = parseTimeInput(newValue);
                          handleInputChange('timeIn')({ target: { value: parsedTime } });
                        }
                      }}
                      onInputChange={(event, newInputValue) => {
                        // Only update the form data directly without parsing during typing
                        handleInputChange('timeIn')({ target: { value: newInputValue } });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                        label="Time In"
                          placeholder="Type or select time"
                          helperText="Type: 9am, 9:30am, 9, 17, 1330"
                          required
                          variant="outlined"
                          onBlur={(e) => {
                            const parsedTime = parseTimeInput(e.target.value);
                            handleInputChange('timeIn')({ target: { value: parsedTime } });
                          }}
                        />
                      )}
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Autocomplete
                      freeSolo
                      options={generateTimeOptions()}
                        value={formData.timeOut}
                      onChange={(event, newValue) => {
                        if (newValue) {
                          const parsedTime = parseTimeInput(newValue);
                          handleInputChange('timeOut')({ target: { value: parsedTime } });
                        }
                      }}
                      onInputChange={(event, newInputValue) => {
                        // Only update the form data directly without parsing during typing
                        handleInputChange('timeOut')({ target: { value: newInputValue } });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                        label="Time Out"
                          placeholder="Type or select time"
                          helperText="Type: 5pm, 5:30pm, 17, 1730"
                          required
                          variant="outlined"
                          onBlur={(e) => {
                            const parsedTime = parseTimeInput(e.target.value);
                            handleInputChange('timeOut')({ target: { value: parsedTime } });
                          }}
                        />
                      )}
                    />
                  </Grid>
                </>
              )}

              {formData.isDayOff && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Day Off Type</InputLabel>
                    <Select
                      value={formData.dayOffType}
                      onChange={handleInputChange('dayOffType')}
                      label="Day Off Type"
                    >
                      <MenuItem value="vacation">Vacation</MenuItem>
                      <MenuItem value="sick">Sick Leave</MenuItem>
                      <MenuItem value="personal">Personal</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  value={formData.notes}
                  onChange={handleInputChange('notes')}
                  multiline
                  rows={2}
                  variant="outlined"
                />
              </Grid>
            </Grid>
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              Save Schedule
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MonthlyScheduler;
