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
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Edit as EditIcon,
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as JpegIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  monthlySchedulesAPI, 
  dailySchedulesAPI, 
  staffProfilesAPI, 
  outletsAPI 
} from '../../services/supabaseService';
import { 
  MonthlySchedule, 
  DailySchedule, 
  StaffProfile, 
  Outlet,
  DailyScheduleFormData 
} from '../../types';
import { exportService, ScheduleExportData } from '../../services/exportService';

const MonthlyScheduler: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    loadData();
  }, [currentMonth, currentYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [staffData, outletsData, schedulesData] = await Promise.all([
        staffProfilesAPI.getAll(),
        outletsAPI.getAll(),
        monthlySchedulesAPI.getByMonth(currentMonth, currentYear),
      ]);
      setStaffProfiles(staffData);
      setOutlets(outletsData);
      setMonthlySchedules(schedulesData);
    } catch (err) {
      setError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
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

  const handleOpenDialog = (staff: StaffProfile, date: Date) => {
    setSelectedStaff(staff);
    setSelectedDate(date);
    setFormData({
      scheduleDate: date,
      outletId: '',
      timeIn: '',
      timeOut: '',
      isDayOff: false,
      dayOffType: '',
      notes: '',
    });
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

      // Find or create monthly schedule for the staff
      let monthlySchedule = monthlySchedules.find(s => s.staffId === selectedStaff!.id);
      
      if (!monthlySchedule) {
        monthlySchedule = await monthlySchedulesAPI.create({
          staffId: selectedStaff!.id,
          month: currentMonth,
          year: currentYear,
          createdBy: '1', // Mock admin user ID
        });
      }

      // Create daily schedule
      await dailySchedulesAPI.create({
        monthlyScheduleId: monthlySchedule.id,
        scheduleDate: formData.scheduleDate,
        outletId: formData.outletId,
        timeIn: formData.timeIn,
        timeOut: formData.timeOut,
        isDayOff: formData.isDayOff,
        dayOffType: formData.dayOffType as 'vacation' | 'sick' | 'personal' | 'other' | undefined,
        notes: formData.notes,
      });

      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Failed to save schedule');
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
          filename: `schedule_${currentDate.toLocaleDateString('en-US', { month: 'long' })}_${currentDate.getFullYear()}.pdf`,
        });
      } else {
        // For JPEG, we'll export the calendar view
        const calendarElement = document.getElementById('schedule-calendar');
        if (calendarElement) {
          await exportService.exportToJPEG(calendarElement, {
            format: 'jpeg',
            filename: `schedule_${currentDate.toLocaleDateString('en-US', { month: 'long' })}_${currentDate.getFullYear()}.jpg`,
          });
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
    const monthlySchedule = monthlySchedules.find(s => s.staffId === staffId);
    if (!monthlySchedule) return null;
    
    return monthlySchedule.dailySchedules?.find(ds => 
      new Date(ds.scheduleDate).toDateString() === date.toDateString()
    );
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
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
                    📅 Monthly Schedule Builder
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Plan your staff schedules for the month
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <IconButton onClick={handlePreviousMonth} sx={{ color: 'white' }}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Typography>
                  <IconButton onClick={handleNextMonth} sx={{ color: 'white' }}>
                    <ArrowForwardIcon />
                  </IconButton>
                </Box>
              </Box>
              
              <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
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
                <TableContainer component={Paper} id="schedule-calendar">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                        <TableCell><strong>Staff Member</strong></TableCell>
                        {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => (
                          <TableCell key={i + 1} align="center">
                            <Typography variant="caption" fontWeight="bold">
                              {i + 1}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {staffProfiles.map((staff, staffIndex) => (
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
                            {Array.from({ length: getDaysInMonth(currentDate) }, (_, dayIndex) => {
                              const day = dayIndex + 1;
                              const date = new Date(currentYear, currentMonth - 1, day);
                              const schedule = getStaffScheduleForDate(staff.id, date);
                              
                              return (
                                <TableCell key={day} align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(staff, date)}
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 1,
                                      backgroundColor: schedule?.isDayOff 
                                        ? 'error.light' 
                                        : schedule 
                                          ? 'success.light' 
                                          : 'grey.100',
                                      color: schedule?.isDayOff 
                                        ? 'error.contrastText' 
                                        : schedule 
                                          ? 'success.contrastText' 
                                          : 'text.secondary',
                                      '&:hover': {
                                        backgroundColor: schedule?.isDayOff 
                                          ? 'error.main' 
                                          : schedule 
                                            ? 'success.main' 
                                            : 'grey.300',
                                      },
                                    }}
                                  >
                                    <ScheduleIcon fontSize="small" />
                                  </IconButton>
                                  {schedule && (
                                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                      {schedule.isDayOff 
                                        ? 'OFF' 
                                        : `${schedule.timeIn}-${schedule.timeOut}`
                                      }
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </Slide>
                      ))}
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
            Schedule Entry - {selectedStaff?.user?.name}
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
                      onChange={(e) => handleInputChange('isDayOff')(e.target.checked)}
                    />
                  }
                  label="Day Off"
                />
              </Grid>

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
                    <FormControl fullWidth required>
                      <InputLabel>Time In</InputLabel>
                      <Select
                        value={formData.timeIn}
                        onChange={handleInputChange('timeIn')}
                        label="Time In"
                      >
                        {generateTimeOptions().map((time) => (
                          <MenuItem key={time} value={time}>
                            {time}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Time Out</InputLabel>
                      <Select
                        value={formData.timeOut}
                        onChange={handleInputChange('timeOut')}
                        label="Time Out"
                      >
                        {generateTimeOptions().map((time) => (
                          <MenuItem key={time} value={time}>
                            {time}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
