import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';
import { auth } from '../utils/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Layout from '../components/Layout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSignIn = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      console.error('Error signing in: ', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Sign In
        </Typography>
        {error && <Typography color="error">{error}</Typography>}
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
        <Button variant="contained" fullWidth onClick={handleSignIn} disabled={isSubmitting}>
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </Button>
      </Box>
    </Layout>
  );
};

export default Login;
