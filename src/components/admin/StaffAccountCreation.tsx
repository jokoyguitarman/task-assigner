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
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { staffProfilesAPI, staffPositionsAPI, outletsAPI, authAPI, usersAPI } from '../../services/supabaseService';
import { StaffProfile, StaffPosition, Outlet } from '../../types';

interface StaffAccount {
  id: string;
  email: string;
  name: string;
  positionId: string;
  outletId: string;
  employeeId: string;
  hireDate: Date;
  status: 'pending' | 'confirmed' | 'active';
  confirmationSentAt?: Date;
  confirmedAt?: Date;
}

const StaffAccountCreation: React.FC = () => {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [positions, setPositions] = useState<StaffPosition[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StaffAccount | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    positionId: '',
    outletId: '',
    employeeId: '',
    hireDate: new Date(),
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [positionsData, outletsData, staffData] = await Promise.all([
        staffPositionsAPI.getAll(),
        outletsAPI.getAll(),
        staffProfilesAPI.getAll(),
      ]);
      setPositions(positionsData);
      setOutlets(outletsData);
      setStaffProfiles(staffData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account?: StaffAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        email: account.email,
        name: account.name,
        positionId: account.positionId,
        outletId: account.outletId,
        employeeId: account.employeeId,
        hireDate: account.hireDate,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        email: '',
        name: '',
        positionId: '',
        outletId: '',
        employeeId: '',
        hireDate: new Date(),
      });
    }
    setError(null);
    setSuccess(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAccount(null);
    setFormData({
      email: '',
      name: '',
      positionId: '',
      outletId: '',
      employeeId: '',
      hireDate: new Date(),
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      if (!formData.email.trim()) {
        setError('Email is required');
        return;
      }

      if (!formData.name.trim()) {
        setError('Name is required');
        return;
      }

      if (!formData.positionId) {
        setError('Position is required');
        return;
      }

      if (!formData.outletId) {
        setError('Outlet is required');
        return;
      }

      // Generate employee ID if not provided
      const employeeId = formData.employeeId || `EMP${String(staffProfiles.length + 1).padStart(3, '0')}`;

      if (editingAccount) {
        // Update existing account - TODO: Implement update functionality
        setSuccess('Staff account updated successfully');
      } else {
        // Create new staff account using Supabase
        // First create the user account
        const user = await authAPI.signup(formData.email, 'tempPassword123', formData.name, 'staff');
        
        // Then create the staff profile
        await staffProfilesAPI.create({
          userId: user.id,
          positionId: formData.positionId,
          employeeId: employeeId,
          hireDate: formData.hireDate,
          isActive: true,
        });
        
        // Reload the data to show the new staff member
        await loadData();
        setSuccess('Staff account created successfully');
      }

      setTimeout(() => {
        handleCloseDialog();
      }, 2000);
    } catch (err) {
      setError('Failed to save staff account');
    }
  };



  const handleDelete = async (staff: StaffProfile) => {
    if (window.confirm(`Are you sure you want to delete the account for "${staff.user?.name}"?`)) {
      try {
        // Delete the staff profile
        await staffProfilesAPI.delete(staff.id);
        
        // Also delete the user account if it exists
        if (staff.user?.id) {
          await usersAPI.delete(staff.user.id);
        }
        
        // Reload the data
        await loadData();
        setSuccess('Staff account deleted successfully');
      } catch (err) {
        setError('Failed to delete staff account');
      }
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = event.target ? event.target.value : event;
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };



  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading staff accounts...</Typography>
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
                    👥 Staff Account Management
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Create and manage staff accounts with email confirmation
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
                  Create Staff Account
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
              <Typography variant="h6" gutterBottom>
                Staff Accounts ({staffProfiles.length})
              </Typography>
              
              {staffProfiles.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No staff accounts found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Create your first staff account to get started
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                  >
                    Create First Staff Account
                  </Button>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                        <TableCell><strong>Staff Member</strong></TableCell>
                        <TableCell><strong>Position</strong></TableCell>
                        <TableCell><strong>Outlet</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Hire Date</strong></TableCell>
                        <TableCell align="center"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {staffProfiles.map((staff, index) => (
                        <Slide key={staff.id} direction="up" in timeout={300 + index * 100}>
                          <TableRow hover>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                                  <PersonIcon />
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    {staff.user?.name || 'Unknown Name'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {staff.user?.email || 'No email'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {staff.employeeId}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {staff.position?.name || 'Unknown Position'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                No outlet assigned
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<PersonIcon />}
                                label={staff.isActive ? 'Active' : 'Inactive'}
                                color={staff.isActive ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                Hired: {staff.hireDate ? new Date(staff.hireDate).toLocaleDateString() : 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(staff)}
                                color="error"
                                title="Delete staff account"
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

        {/* Create/Edit Staff Account Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingAccount ? 'Edit Staff Account' : 'Create New Staff Account'}
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
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  required
                  variant="outlined"
                  helperText="Staff will receive confirmation email at this address"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={formData.positionId}
                    onChange={handleInputChange('positionId')}
                    label="Position"
                  >
                    {positions.map((position) => (
                      <MenuItem key={position.id} value={position.id}>
                        {position.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
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
                <DatePicker
                  label="Hire Date"
                  value={formData.hireDate}
                  onChange={(date) => handleInputChange('hireDate')(date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}

            {/* Information Box */}
            <Box mt={3} p={2} sx={{ backgroundColor: 'rgba(102, 126, 234, 0.1)', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" />
                What happens next:
              </Typography>
              <List dense>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon>
                    <SendIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Confirmation email sent"
                    secondary="Staff will receive an email with account setup instructions"
                  />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon>
                    <CheckCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Account activation"
                    secondary="Staff must click the confirmation link and set their password"
                  />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Access granted"
                    secondary="Once confirmed, staff can access the staff portal"
                  />
                </ListItem>
              </List>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingAccount ? 'Update Account' : 'Create Account'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default StaffAccountCreation;
