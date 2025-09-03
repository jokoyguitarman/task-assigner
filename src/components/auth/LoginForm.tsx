import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Paper,
  Fade,
  Slide,
  Avatar,
  Divider,
  Chip,
} from '@mui/material';
import {
  Login as LoginIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for success message from signup
    const message = searchParams.get('message');
    if (message === 'admin-created') {
      setSuccess('Admin account created successfully! You can now sign in.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      // Normal email login for all users
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        },
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={800}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Slide direction="up" in timeout={1000}>
              <Card
                sx={{
                  width: '100%',
                  maxWidth: 480,
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {/* Header Section */}
                <Box
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    p: 4,
                    textAlign: 'center',
                    color: 'white',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      mx: 'auto',
                      mb: 2,
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <LoginIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
                    Task Assigner
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Welcome back! Please sign in to continue
                  </Typography>
                </Box>

                <CardContent sx={{ p: 4 }}>
                  {error && (
                    <Fade in>
                      <Alert 
                        severity="error" 
                        sx={{ 
                          mb: 3,
                          borderRadius: 2,
                          '& .MuiAlert-icon': {
                            fontSize: '1.2rem',
                          },
                        }}
                      >
                        {error}
                      </Alert>
                    </Fade>
                  )}

                  {success && (
                    <Fade in>
                      <Alert 
                        severity="success" 
                        sx={{ 
                          mb: 3,
                          borderRadius: 2,
                          '& .MuiAlert-icon': {
                            fontSize: '1.2rem',
                          },
                        }}
                      >
                        {success}
                      </Alert>
                    </Fade>
                  )}

                  <Box component="form" onSubmit={handleSubmit} noValidate>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      margin="normal"
                      required
                      helperText="Enter your email address"
                      autoComplete="email"
                      autoFocus
                      sx={{
                        '& .MuiInputLabel-root': {
                          fontWeight: 500,
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      margin="normal"
                      required
                      autoComplete="current-password"
                      sx={{
                        '& .MuiInputLabel-root': {
                          fontWeight: 500,
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      sx={{ 
                        mt: 4, 
                        mb: 3,
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        borderRadius: 2,
                      }}
                      disabled={isLoading}
                      startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                    >
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </Box>

                  <Box textAlign="center" sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Don't have an account yet?
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/admin-signup')}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                      }}
                    >
                      Create Admin Account
                    </Button>
                  </Box>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Demo Accounts
                    </Typography>
                  </Divider>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#6366f1',
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => {
                        setEmail('admin@taskassigner.com');
                        setPassword('admin123');
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#6366f1', width: 40, height: 40 }}>
                          <AdminIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Admin Account
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            admin@taskassigner.com
                          </Typography>
                        </Box>
                        <Chip 
                          label="Click to fill" 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                    </Paper>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#ec4899',
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => {
                        setEmail('staff1@taskassigner.com');
                        setPassword('staff123');
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#ec4899', width: 40, height: 40 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Staff Account
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            staff1@taskassigner.com
                          </Typography>
                        </Box>
                        <Chip 
                          label="Click to fill" 
                          size="small" 
                          color="secondary" 
                          variant="outlined"
                        />
                      </Box>
                    </Paper>
                  </Box>
                </CardContent>
              </Card>
            </Slide>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
};

export default LoginForm;
