import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import { seedDatabase } from 'utils/seedDatabase';

const Home = () => {
  const handleSeedDatabase = async (type: 'worldcup' | 'royale') => {
    try {
      const result = await seedDatabase(15, type);
      if (result.success) {
        const label = type === 'royale' ? 'Royale' : 'World Cup';
        alert(`${label} tournament seeded successfully! Tournament ID: ${result.tournamentId}`);
      } else {
        alert(`Failed to seed database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error seeding database:', error);
      alert('Failed to seed the database');
    }
  };
  
  return (
    <Box sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h5" gutterBottom>
        Welcome to Instant Tournament Pairing
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
        <Button variant="contained" color="primary" onClick={() => handleSeedDatabase('worldcup')}>
          Seed World Cup
        </Button>
        <Button variant="contained" color="secondary" onClick={() => handleSeedDatabase('royale')}>
          Seed Royale
        </Button>
      </Box>
    </Box>
  );
};

export default Home;
