import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { auth } from '../utils/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Layout from '../components/Layout';

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
      // Create user account with Firebase Authentication
      await createUserWithEmailAndPassword(auth, email, password);
      
      // Reset form after successful signup
      setEmail('');
      setPassword('');
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message);
      console.error('Error signing up: ', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
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
    </Layout>
  );
};

export default SignUp;