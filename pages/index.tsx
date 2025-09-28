import React from 'react';
import { Typography, Box, Button } from '@mui/material';
// Layout is now handled by _app.tsx
import { seedDatabase } from 'utils/seedDatabase';

const Home = () => {
  const handleSeedDatabase = async () => {
    try {
      const result = await seedDatabase(); // Call the seed function
      if (result.success) {
        alert(`Database seeded successfully! Tournament ID: ${result.tournamentId}`);
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
      
      <Button variant="contained" color="primary" onClick={handleSeedDatabase}>
        Seed Database
      </Button>
    </Box>
  );
};

export default Home;