import React, { useEffect, useState } from 'react';
import { db } from '../../utils/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Box,
} from '@mui/material';
import Link from 'next/link';
import Layout from '../../components/Layout';

interface Tournament {
  id: string;
  name: string;
  createdAt: string;
}

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const fetchTournaments = async () => {
      const snapshot = await getDocs(collection(db, 'tournaments'));
      const tournamentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Tournament[];
      setTournaments(tournamentsData);
    };

    fetchTournaments();
  }, []);

  return (
    <Layout>
      <Box sx={{ p: 3, width: '100vw', maxWidth: 'none' }}>
        <Typography variant="h4" gutterBottom>
          Tournaments
        </Typography>
        <Grid container spacing={3}>
          {tournaments.map((tournament) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={tournament.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" gutterBottom>
                    {tournament.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                    Created: {new Date(tournament.createdAt).toLocaleDateString()}
                  </Typography>
                  <Box sx={{ mt: 'auto' }}>
                    <Link href={`/tournaments/${tournament.id}`} passHref>
                      <Button variant="contained" color="primary" fullWidth>
                        View Tournament
                      </Button>
                    </Link>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Layout>
  );
}