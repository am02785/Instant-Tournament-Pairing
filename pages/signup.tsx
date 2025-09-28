import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { signUp } from '../utils/auth';
// Layout is now handled by _app.tsx

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const handleSignup = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const result = await signUp(email, password);
      if (result.success) {
        // Reset form after successful signup
        setEmail('');
        setPassword('');
        setSuccess(true);
        // Redirect will be handled by _app.tsx after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(result.error || 'Failed to create account');
      }
    } catch (err: any) {
      setError('An unexpected error occurred');
      console.error('Error signing up: ', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Sign Up
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Account created successfully!</Alert>}
        
        <TextField
          label="Email"
          fullWidth
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Password"
          fullWidth
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button variant="contained" fullWidth onClick={handleSignup} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Sign Up'}
        </Button>
      </Box>
  );
};

export default SignUp;