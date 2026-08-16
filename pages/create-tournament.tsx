import React, { useEffect, useState } from 'react';
import {
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Box,
  Paper,
  Snackbar,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
} from '@mui/material';
// Removed Firebase imports - now using API routes
import { generateOptimalTournament } from 'utils/pairingLogic';
import { buildInitialLadder } from 'utils/royaleLadder';
import { TournamentType } from 'types';

interface Player {
  id: string;
  name: string;
  officeDays: string[];
  seed?: number;
}

function cleanObject(obj: any): any {
  const cleaned: any = {};
  
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        const cleanedNested = cleanObject(obj[key]);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else {
        cleaned[key] = obj[key];
      }
    }
  });
  
  return cleaned;
}

export default function CreateTournament() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentType, setTournamentType] = useState<TournamentType>('worldcup');
  const [currentUserId, setCurrentUserId] = useState<string | null>('temp-user-id');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        const data = await response.json();
        
        if (data.success) {
          const playersData = data.players.map((player: any) => ({
            id: player.id,
            name: player.name || 'Unnamed',
            officeDays: player.officeDays || [],
            seed: player.seed,
          })) as Player[];

          setPlayers(playersData);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      }
    };

    fetchPlayers();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCreateTournament = async () => {
    // Get selected players
    const selectedPlayers = players.filter((player) =>
      selectedPlayerIds.includes(player.id)
    );

    const isRoyale = tournamentType === 'royale';
    const groupStageMatches = isRoyale ? [] : generateOptimalTournament(selectedPlayers);
    
    const cleanedMatches = groupStageMatches.map((match, index) => ({
      ...cleanObject({
        id: `match-${Date.now()}-${index}`,
        player1: cleanObject(match.player1),
        player2: match.player2 ? cleanObject(match.player2) : undefined,
        round: match.round,
        stage: match.stage,
        groupId: match.groupId,
        complete: false,
        player1Points: 0,
        player2Points: 0
      })
    })).filter(match => match.player2 || match.player1);

    try {
      const tournamentData: Record<string, unknown> = {
        name: tournamentName,
        players: selectedPlayers.map(p => cleanObject(p)),
        bracket: cleanedMatches,
        createdBy: currentUserId,
        type: tournamentType,
      };

      if (isRoyale) {
        tournamentData.initialLadder = buildInitialLadder(selectedPlayers);
      }

      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Tournament created with ID:', result.tournament.id);
        
        // Show success Snackbar
        setSnackbarMessage('Tournament created successfully!');
        setOpenSnackbar(true);
        
        // Clear the form
        setTournamentName('');
        setSelectedPlayerIds([]);
        setTournamentType('worldcup');
      } else {
        throw new Error(result.error || 'Failed to create tournament');
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      setSnackbarMessage('Error creating tournament. Please try again.');
      setOpenSnackbar(true);
    }
  };

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Create a New Tournament
      </Typography>
      <TextField
        fullWidth
        label="Tournament Name"
        variant="outlined"
        sx={{ mb: 3 }}
        value={tournamentName}
        onChange={(e) => setTournamentName(e.target.value)}
      />
      <FormControl sx={{ mb: 3 }}>
        <FormLabel>Tournament Type</FormLabel>
        <RadioGroup
          row
          value={tournamentType}
          onChange={(event) => setTournamentType(event.target.value as TournamentType)}
        >
          <FormControlLabel
            value="worldcup"
            control={<Radio />}
            label="World Cup (groups + knockout)"
          />
          <FormControlLabel
            value="royale"
            control={<Radio />}
            label="Royale (challenge ladder)"
          />
        </RadioGroup>
        {tournamentType === 'royale' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Seeded players start ranked in seed order. Unseeded players start unranked and can challenge anyone on the ladder.
          </Typography>
        )}
      </FormControl>
      <Typography variant="h6">Select Players</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {players.map((player) => (
          <FormControlLabel
            key={player.id}
            control={
              <Checkbox
                checked={selectedPlayerIds.includes(player.id)}
                onChange={() => togglePlayer(player.id)}
                disabled={player.id === currentUserId}
              />
            }
            label={`${player.name} ${player.seed ? `(Seed ${player.seed})` : ''} - Office: ${player.officeDays.join(', ')}`}
          />
        ))}
      </Box>
      <Box mt={3}>
        <Button
          variant="contained"
          onClick={handleCreateTournament}
          disabled={!tournamentName || selectedPlayerIds.length < 2}
        >
          Create Tournament ({selectedPlayerIds.length} players selected)
        </Button>
      </Box>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={snackbarMessage.includes('Error') ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
}