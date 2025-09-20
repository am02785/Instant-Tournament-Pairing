import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import Layout from '../components/Layout';
import { seedDatabase } from 'utils/seedDatabase';

const Home = () => {
  const handleSeedDatabase = async () => {
    try {
      await seedDatabase(); // Call the seed function
      alert('Database seeded successfully!');
    } catch (error) {
      console.error('Error seeding database:', error);
      alert('Failed to seed the database');
    }
  };
  
  return (
    <Layout>
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Welcome to Instant Tournament Pairing
        </Typography>
        
        <Button variant="contained" color="primary" onClick={handleSeedDatabase}>
          Seed Database
        </Button>
      </Box>
    </Layout>
  );
};

export default Home;