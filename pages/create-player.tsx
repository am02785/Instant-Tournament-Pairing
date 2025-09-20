import React, { useState } from 'react';
import {
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { db } from '../utils/firebase';
import { collection, addDoc } from 'firebase/firestore';
import Layout from '../components/Layout';

const officeDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const CreatePlayer = () => {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState<number | ''>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const handleCreatePlayer = async () => {
    if (!name || selectedDays.length === 0) {
      setError('Please fill in name and select at least one office day.');
      return;
    }

    if (seed !== '' && (seed <= 0 || !Number.isInteger(seed))) {
      setError('Seed must be a positive integer.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      // Create a player document in Firestore
      const playerData: any = {
        name,
        officeDays: selectedDays,
        createdAt: new Date(),
      };

      // Only add seed if it's provided
      if (seed !== '') {
        playerData.seed = seed;
      }

      await addDoc(collection(db, 'players'), playerData);
      
      // Reset form after successful submission
      setName('');
      setSeed('');
      setSelectedDays([]);
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating player: ', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setSeed('');
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setSeed(numValue);
      }
    }
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Create New Player
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Player created successfully!</Alert>}
        
        <TextField
          label="Player Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <TextField
          label="Seed (optional)"
          fullWidth
          type="number"
          value={seed}
          onChange={handleSeedChange}
          placeholder="Enter a positive integer"
          helperText="Optional: Tournament seeding number (positive integer)"
          sx={{ mb: 2 }}
        />
        
        <FormGroup sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Select Office Days:
          </Typography>
          {officeDays.map((day) => (
            <FormControlLabel
              key={day}
              control={<Checkbox checked={selectedDays.includes(day)} onChange={() => handleDayToggle(day)} />}
              label={day}
            />
          ))}
        </FormGroup>
        
        <Button variant="contained" fullWidth onClick={handleCreatePlayer} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Player...' : 'Create Player'}
        </Button>
      </Box>
    </Layout>
  );
};

export default CreatePlayer;