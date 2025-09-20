import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Modal,
  Paper
} from '@mui/material';
import { Match } from '../types';

interface BracketProps {
  bracket: Match[];
  handleUpdateMatch: (
    matchId: string,
    winnerId: string,
    player1Points: number,
    player2Points: number
  ) => void;
}

const Bracket: React.FC<BracketProps> = ({ bracket, handleUpdateMatch }) => {
  const [open, setOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [player1Points, setPlayer1Points] = useState<number>(0);
  const [player2Points, setPlayer2Points] = useState<number>(0);
  const [winner, setWinner] = useState<string | null>(null);

  const handleOpen = (match: Match) => {
    setSelectedMatch(match);
    setPlayer1Points(match.player1Points || 0);
    setPlayer2Points(match.player2Points || 0);
    setWinner(match.winnerId || null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedMatch(null);
    setWinner(null);
  };

  const handleSubmit = () => {
    if (!selectedMatch?.id || !winner) {
      console.error('Missing match ID or winner selection');
      return;
    }

    handleUpdateMatch(selectedMatch.id, winner, player1Points, player2Points);
    handleClose();
  };

  // Filter out invalid matches and group by round
  const validMatches = bracket.filter(match => match && match.player1 && match.id);
  
  const rounds = validMatches.reduce((acc: any, match: Match) => {
    const round = match.round;
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(match);
    return acc;
  }, {});

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      {Object.keys(rounds)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((roundKey) => {
          const roundMatches = rounds[roundKey];
          return (
            <Box key={roundKey} sx={{ display: 'flex', flexDirection: 'column', mb: 4 }}>
              <Typography variant="h6" sx={{ marginBottom: 2 }}>
                Round {roundKey} ({roundMatches[0]?.stage || 'Unknown'})
              </Typography>
              <Box sx={{ display: 'flex', gap: 4 }}>
                {roundMatches.map((match: Match, index: number) => (
                  <Box key={match.id || index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200 }}>
                    <Paper sx={{ p: 2, width: '100%', textAlign: 'center' }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {match.player1?.name || 'Unknown Player'}
                        {match.player1?.seed && ` (Seed ${match.player1.seed})`}
                      </Typography>
                      
                      {match.complete && (
                        <Typography variant="caption" color="textSecondary">
                          {match.player1Points || 0} points
                        </Typography>
                      )}
                      
                      <Divider sx={{ my: 1 }} />
                      
                      {match.player2 ? (
                        <>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {match.player2.name}
                            {match.player2.seed && ` (Seed ${match.player2.seed})`}
                          </Typography>
                          {match.complete && (
                            <Typography variant="caption" color="textSecondary">
                              {match.player2Points || 0} points
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="body1" color="textSecondary">
                          BYE
                        </Typography>
                      )}
                      
                      {match.complete && match.winnerId && (
                        <Box sx={{ mt: 1, p: 1, backgroundColor: '#e8f5e8', borderRadius: 1 }}>
                          <Typography variant="caption" color="success.main">
                            Winner: {match.player1?.id === match.winnerId ? match.player1?.name : match.player2?.name}
                          </Typography>
                        </Box>
                      )}
                      
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ mt: 2 }}
                        onClick={() => handleOpen(match)}
                        disabled={!match.player2 || !match.id}
                      >
                        {match.complete ? 'Edit Match' : 'Enter Score'}
                      </Button>
                    </Paper>
                    
                    {index < roundMatches.length - 1 && (
                      <Box sx={{ height: 40, width: 2, backgroundColor: 'grey', mt: 4 }} />
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}

      {/* Modal for match update */}
      <Modal
        open={open}
        onClose={handleClose}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper sx={{ width: 400, padding: 4, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Update Match: {selectedMatch?.player1?.name || 'Unknown'} vs {selectedMatch?.player2?.name || 'Bye'}
          </Typography>
          
          <TextField
            label={`${selectedMatch?.player1?.name || 'Player 1'} Points`}
            type="number"
            fullWidth
            value={player1Points}
            onChange={(e) => setPlayer1Points(Number(e.target.value))}
            sx={{ mb: 2 }}
            inputProps={{ min: 0 }}
          />
          
          <TextField
            label={`${selectedMatch?.player2?.name || 'Player 2'} Points`}
            type="number"
            fullWidth
            value={player2Points}
            onChange={(e) => setPlayer2Points(Number(e.target.value))}
            sx={{ mb: 2 }}
            disabled={!selectedMatch?.player2}
            inputProps={{ min: 0 }}
          />
          
          {/* Winner Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Winner</InputLabel>
            <Select
              value={winner || ''}
              onChange={(e) => setWinner(e.target.value)}
              label="Winner"
              disabled={!selectedMatch?.player2}
            >
              {selectedMatch?.player1?.id && (
                <MenuItem value={selectedMatch.player1.id}>
                  {selectedMatch.player1.name}
                </MenuItem>
              )}
              {selectedMatch?.player2?.id && (
                <MenuItem value={selectedMatch.player2.id}>
                  {selectedMatch.player2.name}
                </MenuItem>
              )}
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={handleClose} variant="outlined" color="error">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              color="primary"
              disabled={!winner || !selectedMatch?.id}
            >
              Submit
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default Bracket;