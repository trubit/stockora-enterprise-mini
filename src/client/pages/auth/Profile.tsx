import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Avatar,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { useForm, useWatch } from 'react-hook-form';
import { useAuthStore } from '../../store/auth.ts';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const textFieldStyle = {};

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const avatar = user?.avatarUrl || null;

  const { register, handleSubmit, control, setValue } = useForm({
    values: {
      preferredLanguage: user?.preferredLanguage || 'en',
      timeZone: user?.timeZone || 'UTC',
      themePreference: user?.themePreference || 'dark',
    },
  });

  const preferredLanguage = useWatch({ control, name: 'preferredLanguage' });
  const timeZone = useWatch({ control, name: 'timeZone' });
  const themePreference = useWatch({ control, name: 'themePreference' });

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onSubmit = async (data: any) => {
    try {
      const res = await apiClient.put('/users/profile', data);
      updateUser(res.data);
      toast.success('Profile preferences updated successfully!');
    } catch {
      toast.error('Failed to update profile preferences.');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiClient.post('/users/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      updateUser({ avatarUrl: res.data.avatarUrl });
      toast.success('Avatar updated successfully!');
    } catch {
      toast.error('Failed to upload avatar.');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1,
            background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          User Profile Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
          Manage your personal workspace preferences, local timezone configurations, and profile
          pictures.
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card
              className="glass-panel"
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background:
                  'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                },
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  py: 5,
                }}
              >
                <Avatar
                  src={avatar || undefined}
                  sx={{
                    width: 130,
                    height: 130,
                    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.25)',
                    border: '2px solid rgba(139, 92, 246, 0.3)',
                  }}
                />
                <Button
                  variant="outlined"
                  component="label"
                  htmlFor="avatar-upload-input"
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    fontWeight: 600,
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                    color: 'primary.light',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(139, 92, 246, 0.08)',
                    },
                  }}
                >
                  Upload New Image
                  <input
                    id="avatar-upload-input"
                    name="avatarFile"
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </Button>
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {user?.username || 'Guest User'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 500,
                      letterSpacing: '0.05em',
                      mt: 0.5,
                    }}
                  >
                    {user?.roleName || 'Employee'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card
              className="glass-panel"
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background:
                  'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3.5 }}>
                  Preferences Configurations
                </Typography>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                  <TextField
                    select
                    label="Preferred Language"
                    fullWidth
                    value={preferredLanguage || 'en'}
                    {...register('preferredLanguage')}
                    onChange={(e) =>
                      setValue('preferredLanguage', e.target.value as 'en' | 'es' | 'fr')
                    }
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="es">Español</MenuItem>
                    <MenuItem value="fr">Français</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Time Zone"
                    fullWidth
                    value={timeZone || 'UTC'}
                    {...register('timeZone')}
                    onChange={(e) => setValue('timeZone', e.target.value as 'UTC' | 'EST' | 'WAT')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="UTC">UTC (Coordinated Universal Time)</MenuItem>
                    <MenuItem value="EST">EST (Eastern Standard Time)</MenuItem>
                    <MenuItem value="WAT">WAT (West Africa Time)</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Interface Theme"
                    fullWidth
                    value={themePreference || 'dark'}
                    {...register('themePreference')}
                    onChange={(e) =>
                      setValue('themePreference', e.target.value as 'light' | 'dark')
                    }
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="light">Light Mode</MenuItem>
                    <MenuItem value="dark">Dark Mode</MenuItem>
                  </TextField>
                  <Button
                    variant="contained"
                    type="submit"
                    sx={{
                      alignSelf: 'flex-start',
                      px: 5,
                      py: 1.4,
                      fontWeight: 700,
                      borderRadius: 2.5,
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                      boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
                        boxShadow: '0 6px 20px rgba(139, 92, 246, 0.45)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Save Preferences
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <ChangePasswordCard />
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
}

function ChangePasswordCard() {
  const [loading, setLoading] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to change password. Please verify your current password.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className="glass-panel"
      sx={{
        mt: 4,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Security & Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, fontWeight: 500 }}>
          Ensure your account is using a secure, strong password with numbers and special
          characters.
        </Typography>

        <form
          onSubmit={handleChangePassword}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <TextField
            label="Current Password"
            type="password"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="New Password"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="At least 8 characters with uppercase, lowercase, numbers, and symbols"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Confirm New Password"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Button
            variant="contained"
            type="submit"
            disabled={loading}
            sx={{
              alignSelf: 'flex-start',
              px: 5,
              py: 1.4,
              fontWeight: 700,
              borderRadius: 2.5,
              textTransform: 'none',
              fontSize: '0.95rem',
              background: 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(90deg, #db2777 0%, #7c3aed 100%)',
                boxShadow: '0 6px 20px rgba(236, 72, 153, 0.45)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
