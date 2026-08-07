import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { invitationsAPI, outletsAPI } from '../../services/supabaseService';
import { Invitation, InvitationFormData, Outlet } from '../../types';

const InvitationManagement: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invitations only provision branch logins. Staff are enrolled onto the
  // roster and never receive one, because they never sign in.
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    role: 'outlet',
    outletId: undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invitationsData, outletsData] = await Promise.all([
        invitationsAPI.getAll(),
        outletsAPI.getAll(),
      ]);
      setInvitations(invitationsData);
      setOutlets(outletsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!formData.outletId) {
      setError('Choose which branch this login is for');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const invitation = await invitationsAPI.create({
        ...formData,
        createdBy: user.id,
      });

      setSuccess(
        `Invitation created. Send them this link: ${window.location.origin}/signup?token=${invitation.token}`
      );
      
      // Reset form
      setFormData({
        email: '',
        role: 'outlet',
        outletId: undefined,
      });
      setOpenDialog(false);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error creating invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create invitation');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invitation?')) {
      return;
    }

    try {
      await invitationsAPI.delete(id);
      await loadData();
      setSuccess('Invitation deleted successfully');
    } catch (error) {
      console.error('Error deleting invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete invitation');
    }
  };

  const getStatusChip = (invitation: Invitation) => {
    if (invitation.usedAt) {
      return <Chip label="Used" color="success" size="small" />;
    }
    
    if (new Date(invitation.expiresAt) < new Date()) {
      return <Chip label="Expired" color="error" size="small" />;
    }
    
    return <Chip label="Active" color="primary" size="small" />;
  };

  const getRoleIcon = (role: string) => {
    return role === 'outlet' ? <BusinessIcon /> : <PersonIcon />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Invitation Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Send Invitation
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Invitations
          </Typography>
          
          {invitations.length === 0 ? (
            <Typography color="text.secondary">
              No invitations sent yet. Click "Send Invitation" to get started.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Outlet</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <EmailIcon sx={{ mr: 1, fontSize: 20 }} />
                          {invitation.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {getRoleIcon(invitation.role)}
                          <Typography sx={{ ml: 1, textTransform: 'capitalize' }}>
                            {invitation.role}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {invitation.outlet?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusChip(invitation)}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(invitation.id)}
                          disabled={!!invitation.usedAt}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Send Invitation Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Invitation</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              margin="normal"
              required
              helperText="The email address to send the invitation to"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Branch</InputLabel>
              <Select
                value={formData.outletId || ''}
                onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                label="Branch"
                required
              >
                {outlets.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              You'll get a sign-up link to send them. They must use this same email
              address. The invitation expires in 7 days.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={sending}
            startIcon={sending ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            {sending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvitationManagement;
