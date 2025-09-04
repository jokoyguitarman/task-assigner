import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Alert,
  Fade,
  Slide,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { staffProfilesAPI, staffPositionsAPI, outletsAPI, usersAPI } from '../../services/supabaseService';
import { StaffProfile, StaffPosition, Outlet, StaffEnrollmentFormData } from '../../types';

const StaffEnrollment: React.FC = () => {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [positions, setPositions] = useState<StaffPosition[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [showCustomPosition, setShowCustomPosition] = useState(false);
  const [formData, setFormData] = useState<StaffEnrollmentFormData>({
    name: '',
    email: '',
    phone: '',
    positionId: '',
    customPositionName: '',
    customPositionDescription: '',
    employeeId: '',
    hireDate: new Date(),
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [staffData, positionsData, outletsData] = await Promise.all([
        staffProfilesAPI.getAll(),
        staffPositionsAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      setStaffProfiles(staffData);
      setPositions(positionsData);
      setOutlets(outletsData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (staff?: StaffProfile) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.user?.name || '',
        email: staff.user?.email || '',
        phone: '',
        positionId: staff.positionId,
        customPositionName: '',
        customPositionDescription: '',
        employeeId: staff.employeeId,
        hireDate: staff.hireDate,
        username: staff.username || '',
        password: staff.password || '',
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        positionId: '',
        customPositionName: '',
        customPositionDescription: '',
        employeeId: '',
        hireDate: new Date(),
        username: '',
        password: '',
      });
    }
    setShowCustomPosition(false);
    setError(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingStaff(null);
    setShowCustomPosition(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      positionId: '',
      customPositionName: '',
      customPositionDescription: '',
      employeeId: '',
      hireDate: new Date(),
      username: '',
      password: '',
    });
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      
      if (!formData.name.trim()) {
        setError('Staff name is required');
        return;
      }



      if (!formData.positionId) {
        setError('Position is required');
        return;
      }

      if (showCustomPosition && !formData.customPositionName?.trim()) {
        setError('Custom position name is required');
        return;
      }

      // Generate employee ID if not provided
      const employeeId = formData.employeeId || `EMP${String(staffProfiles.length + 1).padStart(3, '0')}`;

      if (editingStaff) {
        // Update existing staff
        await staffProfilesAPI.update(editingStaff.id, {
          positionId: formData.positionId,
          employeeId,
          hireDate: formData.hireDate,
        });
      } else {
        // Create new staff - first create user, then staff profile
        try {
          // Create user first
          const newUser = await usersAPI.create({
            email: formData.email || `${employeeId}@company.com`, // Use employee ID if no email
            name: formData.name,
            role: 'staff',
            currentStreak: 0,
            longestStreak: 0,
          });

          // Then create staff profile
          await staffProfilesAPI.create({
            userId: newUser.id,
            positionId: formData.positionId,
            employeeId,
            hireDate: formData.hireDate,
            isActive: true,
          });
        } catch (error) {
          console.error('Error creating staff member:', error);
          throw error;
        }
      }

      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Failed to save staff member');
    }
  };

  const handleDelete = async (staff: StaffProfile) => {
    if (window.confirm(`Are you sure you want to deactivate "${staff.user?.name}"?`)) {
      try {
        await staffProfilesAPI.delete(staff.id);
        await loadData();
      } catch (err) {
        setError('Failed to deactivate staff member');
      }
    }
  };

  const handleInputChange = (field: keyof StaffEnrollmentFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = event.target ? event.target.value : event;
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePositionChange = (event: any) => {
    const positionId = event.target.value;
    setFormData(prev => ({
      ...prev,
      positionId,
    }));
    
    // Show custom position form if "Other" is selected
    setShowCustomPosition(positionId === 'other');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading staff data...</Typography>
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
                    👥 Staff Enrollment
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Manage your team members and their positions
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.3)',
                    },
                  }}
                >
                  Enroll Staff
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

        <Slide direction="up" in timeout={600}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                All Staff Members ({staffProfiles.length})
              </Typography>
              
              {staffProfiles.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No staff members found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Get started by enrolling your first staff member
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                  >
                    Enroll First Staff
                  </Button>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                        <TableCell><strong>Staff Member</strong></TableCell>
                        <TableCell><strong>Position</strong></TableCell>
                        <TableCell><strong>Employee ID</strong></TableCell>
                        <TableCell><strong>Hire Date</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell align="center"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {staffProfiles.map((staff, index) => (
                        <Slide key={staff.id} direction="up" in timeout={300 + index * 100}>
                          <TableRow hover>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    {staff.user?.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {staff.user?.email}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <WorkIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                                <Typography variant="body2">
                                  {staff.position?.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {staff.employeeId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <CalendarIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                                <Typography variant="body2">
                                  {new Date(staff.hireDate).toLocaleDateString()}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={staff.isActive ? 'Active' : 'Inactive'}
                                color={staff.isActive ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(staff)}
                                sx={{ mr: 1 }}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(staff)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
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

        {/* Add/Edit Staff Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingStaff ? 'Edit Staff Member' : 'Enroll New Staff Member'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email (Optional)"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone (Optional)"
                  value={formData.phone}
                  onChange={handleInputChange('phone')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Employee ID"
                  value={formData.employeeId}
                  onChange={handleInputChange('employeeId')}
                  placeholder="Auto-generated if empty"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={formData.positionId}
                    onChange={handlePositionChange}
                    label="Position"
                  >
                    {positions.map((position) => (
                      <MenuItem key={position.id} value={position.id}>
                        {position.name}
                      </MenuItem>
                    ))}
                    <MenuItem value="other">➕ Add Custom Position</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Hire Date"
                  value={formData.hireDate}
                  onChange={(date) => handleInputChange('hireDate')(date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              
              {showCustomPosition && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Custom Position Details
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Position Name"
                      value={formData.customPositionName}
                      onChange={handleInputChange('customPositionName')}
                      required
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Description (Optional)"
                      value={formData.customPositionDescription}
                      onChange={handleInputChange('customPositionDescription')}
                      variant="outlined"
                    />
                  </Grid>
                </>
              )}

              {/* Login Credentials Section */}
  
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
              {editingStaff ? 'Update' : 'Enroll'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default StaffEnrollment;
