import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Match, Player, Tournament } from '../types';
import MatchCard, { UpdateMatchHandler } from './MatchCard';
import {
  computeRoyaleLadder,
  formatRematchProgress,
  getCompletedMatchesNewestFirst,
  getRematchStatus,
  getRoyaleRecords,
  getUnrankedPlayers,
  orderPlayersAsChallengerOpponent,
} from '../utils/royaleLadder';

type RoyaleTournamentProps = {
  tournament: Tournament;
  onUpdateMatch: UpdateMatchHandler;
  onCreateChallenge: (playerA: Player, playerB: Player) => Promise<void>;
  canUpdateMatch: (match: Match) => boolean;
};

const officeDaysLabel = (player: Player): string =>
  player.officeDays?.length ? player.officeDays.join(', ') : 'No office days';

const RoyaleTournament: React.FC<RoyaleTournamentProps> = ({
  tournament,
  onUpdateMatch,
  onCreateChallenge,
  canUpdateMatch,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [creating, setCreating] = useState(false);

  const players = tournament.players || [];
  const matches = tournament.bracket || [];
  const initialLadder = tournament.initialLadder || [];

  const ladder = useMemo(
    () => computeRoyaleLadder(initialLadder, matches),
    [initialLadder, matches]
  );
  const records = useMemo(() => getRoyaleRecords(matches), [matches]);
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  );
  const unranked = useMemo(() => getUnrankedPlayers(players, ladder), [players, ladder]);

  const rematchLabelFor = (status: ReturnType<typeof getRematchStatus>): string | null => {
    const cooldownName = status.cooldownPlayerId
      ? playerById.get(status.cooldownPlayerId)?.name || 'Previous challenger'
      : 'Previous challenger';
    return formatRematchProgress(status, cooldownName);
  };

  const playerA = players.find((player) => player.id === playerAId);
  const playerB = players.find((player) => player.id === playerBId);
  const pairingPreview =
    playerA && playerB && playerA.id !== playerB.id
      ? orderPlayersAsChallengerOpponent(playerA, playerB, ladder)
      : null;
  const canSubmitChallenge = Boolean(
    playerA && playerB && playerA.id !== playerB.id && !creating
  );

  const pendingMatches = matches.filter((match) => match && !match.complete && match.player2);
  const completedMatches = useMemo(
    () => getCompletedMatchesNewestFirst(matches),
    [matches]
  );

  const handleOpenDialog = () => {
    setPlayerAId('');
    setPlayerBId('');
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!playerA || !playerB || playerA.id === playerB.id) return;
    setCreating(true);
    try {
      await onCreateChallenge(playerA, playerB);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error creating challenge:', error);
    } finally {
      setCreating(false);
    }
  };

  const rankedRows = ladder
    .map((playerId, index) => {
      const player = playerById.get(playerId);
      if (!player) return null;
      const record = records.get(playerId) || { wins: 0, losses: 0 };
      return { rank: index + 1, player, record };
    })
    .filter((row): row is { rank: number; player: Player; record: { wins: number; losses: number } } =>
      Boolean(row)
    );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Royale Ladder</Typography>
        {!tournament.complete && (
          <Button variant="contained" onClick={handleOpenDialog} disabled={players.length < 2}>
            Create Match
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ranked
              </Typography>
              {rankedRows.length === 0 ? (
                <Typography color="text.secondary">No ranked players yet.</Typography>
              ) : (
                rankedRows.map((row) => (
                  <Box
                    key={row.player.id}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Typography>
                        {row.rank}. {row.player.name}
                      </Typography>
                      {row.player.seed != null && (
                        <Chip label={`Seed ${row.player.seed}`} size="small" />
                      )}
                    </Box>
                    <Typography>
                      {row.record.wins}W-{row.record.losses}L
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Unranked
              </Typography>
              {unranked.length === 0 ? (
                <Typography color="text.secondary">Everyone is ranked.</Typography>
              ) : (
                unranked.map((player) => {
                  const record = records.get(player.id) || { wins: 0, losses: 0 };
                  return (
                    <Box
                      key={player.id}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
                    >
                      <Box>
                        <Typography>{player.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {officeDaysLabel(player)}
                        </Typography>
                      </Box>
                      <Typography>
                        {record.wins}W-{record.losses}L
                      </Typography>
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Pending Matches
          </Typography>
          {pendingMatches.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              No pending matches.
            </Typography>
          ) : (
            pendingMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onUpdateMatch={onUpdateMatch}
                canUpdate={canUpdateMatch(match)}
                allMatches={matches}
              />
            ))
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Completed Matches
          </Typography>
          {completedMatches.length === 0 ? (
            <Typography color="text.secondary">No completed matches yet.</Typography>
          ) : (
            completedMatches.map((match) => {
              const rematch = match.player2
                ? getRematchStatus(match.player1.id, match.player2.id, matches)
                : null;
              const rematchLabel = rematch ? rematchLabelFor(rematch) : null;

              return (
                <Box key={match.id} sx={{ mb: 1 }}>
                  <MatchCard
                    match={match}
                    onUpdateMatch={onUpdateMatch}
                    canUpdate={canUpdateMatch(match)}
                    allMatches={matches}
                  />
                  {rematch && rematchLabel && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1, mb: 1 }}>
                      {rematch.blocked
                        ? `${rematchLabel} before rematching`
                        : rematchLabel}
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Match</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Pick the two players. The system sets the challenger as whoever was lower-ranked (or
            unranked) at the Completed at time when you enter the score.
          </Alert>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="player-a-label">Player A</InputLabel>
            <Select
              labelId="player-a-label"
              label="Player A"
              value={playerAId}
              onChange={(event) => setPlayerAId(event.target.value)}
            >
              {players.map((player) => (
                <MenuItem key={player.id} value={player.id}>
                  {player.name} — {officeDaysLabel(player)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="player-b-label">Player B</InputLabel>
            <Select
              labelId="player-b-label"
              label="Player B"
              value={playerBId}
              onChange={(event) => setPlayerBId(event.target.value)}
            >
              {players
                .filter((player) => player.id !== playerAId)
                .map((player) => (
                  <MenuItem key={player.id} value={player.id}>
                    {player.name} — {officeDaysLabel(player)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          {pairingPreview && (
            <Typography variant="body2" color="text.secondary">
              Under current standings this would be treated as{' '}
              <strong>{pairingPreview.challenger.name}</strong> challenging{' '}
              <strong>{pairingPreview.opponent.name}</strong>. Final roles use the Completed at
              ladder.
            </Typography>
          )}
          {playerA && playerB && playerA.id !== playerB.id && !pairingPreview && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Both players are currently unranked. Entering a score will only succeed if one of them
              was ranked at the Completed at time.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canSubmitChallenge}>
            {creating ? 'Creating…' : 'Create Match'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoyaleTournament;
