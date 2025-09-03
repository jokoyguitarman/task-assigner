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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { outletsAPI } from '../../services/supabaseService';
import { Outlet, OutletFormData } from '../../types';

const OutletManagement: React.FC = () => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [formData, setFormData] = useState<OutletFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOutlets();
  }, []);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      const data = await outletsAPI.getAll();
      setOutlets(data);
    } catch (err) {
      setError('Failed to load outlets');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (outlet?: Outlet) => {
    if (outlet) {
      setEditingOutlet(outlet);
      setFormData({
        name: outlet.name,
        address: outlet.address || '',
        phone: outlet.phone || '',
        email: outlet.email || '',
        username: outlet.username || '',
        password: outlet.password || '',
      });
    } else {
      setEditingOutlet(null);
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
      });
    }
    setError(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingOutlet(null);
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      username: '',
      password: '',
    });
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      
      if (!formData.name.trim()) {
        setError('Outlet name is required');
        return;
      }

      if (editingOutlet) {
        await outletsAPI.update(editingOutlet.id, formData);
      } else {
        await outletsAPI.create({ ...formData, isActive: true });
      }

      await loadOutlets();
      handleCloseDialog();
    } catch (err) {
      setError('Failed to save outlet');
    }
  };

  const handleDelete = async (outlet: Outlet) => {
    if (window.confirm(`Are you sure you want to delete "${outlet.name}"?`)) {
      try {
        await outletsAPI.delete(outlet.id);
        await loadOutlets();
      } catch (err) {
        setError('Failed to delete outlet');
      }
    }
  };

  const handleInputChange = (field: keyof OutletFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading outlets...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Fade in timeout={600}>
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  🏢 Outlet Management
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Manage your business locations and branches
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
                Add Outlet
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
              All Outlets ({outlets.length})
            </Typography>
            
            {outlets.length === 0 ? (
              <Box textAlign="center" py={4}>
                <LocationIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No outlets found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Get started by adding your first outlet
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Outlet
                </Button>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                      <TableCell><strong>Outlet Name</strong></TableCell>
                      <TableCell><strong>Address</strong></TableCell>
                      <TableCell><strong>Contact</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outlets.map((outlet, index) => (
                      <Slide key={outlet.id} direction="up" in timeout={300 + index * 100}>
                        <TableRow hover>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
                              <Typography variant="subtitle2" fontWeight="bold">
                                {outlet.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {outlet.address || 'No address provided'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              {outlet.phone && (
                                <Box display="flex" alignItems="center" mb={0.5}>
                                  <PhoneIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                                  <Typography variant="body2">{outlet.phone}</Typography>
                                </Box>
                              )}
                              {outlet.email && (
                                <Box display="flex" alignItems="center">
                                  <EmailIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                                  <Typography variant="body2">{outlet.email}</Typography>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={outlet.isActive ? 'Active' : 'Inactive'}
                              color={outlet.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(outlet)}
                              sx={{ mr: 1 }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(outlet)}
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

      {/* Add/Edit Outlet Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Outlet Name"
                value={formData.name}
                onChange={handleInputChange('name')}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={handleInputChange('address')}
                multiline
                rows={2}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={handleInputChange('phone')}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                variant="outlined"
              />
            </Grid>
            
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
            {editingOutlet ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OutletManagement;
