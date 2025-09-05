import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import {
  People,
  Business,
  AdminPanelSettings,
  TrendingUp,
  Upgrade,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface UsageStats {
  admins_used: number;
  admins_max: number;
  restaurants_used: number;
  restaurants_max: number;
  employees_used: number;
  employees_max: number;
  subscription_tier: string;
}

const UsageStats: React.FC = () => {
  const { user } = useAuth();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.organizationId) {
      loadUsageStats();
    }
  }, [user?.organizationId]);

  const loadUsageStats = async () => {
    if (!user?.organizationId) return;

    try {
      const { data, error } = await supabase
        .rpc('get_organization_usage_stats', { org_id: user.organizationId });

      if (error) {
        console.error('Error loading usage stats:', error);
        return;
      }

      if (data && data.length > 0) {
        setUsageStats(data[0]);
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'default';
      case 'standard': return 'primary';
      case 'professional': return 'secondary';
      default: return 'default';
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'free': return 'Free';
      case 'standard': return 'Standard';
      case 'professional': return 'Professional';
      default: return 'Unknown';
    }
  };

  const getUsagePercentage = (used: number, max: number) => {
    return Math.min((used / max) * 100, 100);
  };

  const getUsageColor = (used: number, max: number) => {
    const percentage = getUsagePercentage(used, max);
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'primary';
  };

  const isNearLimit = (used: number, max: number) => {
    return used >= max * 0.9;
  };

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Usage Statistics
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (!usageStats) {
    return null;
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Usage Statistics
            </Typography>
            <Chip
              label={getTierName(usageStats.subscription_tier)}
              color={getTierColor(usageStats.subscription_tier)}
              size="small"
            />
          </Box>

          {/* Admin Accounts */}
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <AdminPanelSettings fontSize="small" color="primary" />
                <Typography variant="body2">
                  Admin Accounts
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {usageStats.admins_used}/{usageStats.admins_max}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getUsagePercentage(usageStats.admins_used, usageStats.admins_max)}
              color={getUsageColor(usageStats.admins_used, usageStats.admins_max)}
            />
            {isNearLimit(usageStats.admins_used, usageStats.admins_max) && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem' }}>
                Near admin limit
              </Alert>
            )}
          </Box>

          {/* Restaurants */}
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <Business fontSize="small" color="primary" />
                <Typography variant="body2">
                  Locations
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {usageStats.restaurants_used}/{usageStats.restaurants_max}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getUsagePercentage(usageStats.restaurants_used, usageStats.restaurants_max)}
              color={getUsageColor(usageStats.restaurants_used, usageStats.restaurants_max)}
            />
            {isNearLimit(usageStats.restaurants_used, usageStats.restaurants_max) && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem' }}>
                Near location limit
              </Alert>
            )}
          </Box>

          {/* Employees */}
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <People fontSize="small" color="primary" />
                <Typography variant="body2">
                  Employees
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {usageStats.employees_used}/{usageStats.employees_max}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getUsagePercentage(usageStats.employees_used, usageStats.employees_max)}
              color={getUsageColor(usageStats.employees_used, usageStats.employees_max)}
            />
            {isNearLimit(usageStats.employees_used, usageStats.employees_max) && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem' }}>
                Near employee limit
              </Alert>
            )}
          </Box>

          {usageStats.subscription_tier === 'free' && (
            <Button
              variant="contained"
              size="small"
              fullWidth
              startIcon={<Upgrade />}
              onClick={() => setUpgradeDialogOpen(true)}
              sx={{ mt: 1 }}
            >
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onClose={() => setUpgradeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TrendingUp color="primary" />
            Upgrade Your Plan
          </Box>
        </DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Plan</TableCell>
                  <TableCell align="center">Admin Accounts</TableCell>
                  <TableCell align="center">Locations</TableCell>
                  <TableCell align="center">Employees</TableCell>
                  <TableCell align="center">Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">Free</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Current Plan
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">1</TableCell>
                  <TableCell align="center">1</TableCell>
                  <TableCell align="center">10</TableCell>
                  <TableCell align="center">
                    <Typography variant="h6" color="success.main">
                      Free
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Standard</Typography>
                  </TableCell>
                  <TableCell align="center">2</TableCell>
                  <TableCell align="center">3</TableCell>
                  <TableCell align="center">30</TableCell>
                  <TableCell align="center">
                    <Typography variant="h6">
                      $29/month
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Professional</Typography>
                  </TableCell>
                  <TableCell align="center">5</TableCell>
                  <TableCell align="center">7</TableCell>
                  <TableCell align="center">70</TableCell>
                  <TableCell align="center">
                    <Typography variant="h6">
                      $79/month
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            Contact us to upgrade your plan. We'll help you choose the right plan for your restaurant.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)}>
            Close
          </Button>
          <Button variant="contained" onClick={() => {
            // TODO: Implement upgrade flow
            window.open('mailto:support@taskassigner.com?subject=Plan Upgrade Request', '_blank');
          }}>
            Contact Us
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UsageStats;
