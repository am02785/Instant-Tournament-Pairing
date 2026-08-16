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
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Match, Player, Tournament } from '../types';
import MatchCard from './MatchCard';
import {
  computeRoyaleLadder,
  formatRematchProgress,
  getOpponentEligibility,
  getRematchStatus,
  getRoyaleRecords,
  getUnrankedPlayers,
} from '../utils/royaleLadder';

type RoyaleTournamentProps = {
  tournament: Tournament;
  onUpdateMatch: (id: string, winnerId: string, p1Points: number, p2Points: number) => void;
  onCreateChallenge: (challenger: Player, opponent: Player) => Promise<void>;
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
  const [challengerId, setChallengerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
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

  const challenger = players.find((player) => player.id === challengerId);
  const opponentOptions = challenger
    ? getOpponentEligibility(challenger, players, ladder, matches)
    : [];
  const selectedOpponent = opponentOptions.find((option) => option.player.id === opponentId);
  const canSubmitChallenge = Boolean(challenger && selectedOpponent?.eligible && !creating);

  const pendingMatches = matches.filter((match) => match && !match.complete && match.player2);
  const completedMatches = matches.filter((match) => match?.complete);

  const handleOpenDialog = () => {
    setChallengerId('');
    setOpponentId('');
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!challenger || !selectedOpponent?.eligible) return;
    setCreating(true);
    try {
      await onCreateChallenge(challenger, selectedOpponent.player);
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
            Create Challenge
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
            Pending Challenges
          </Typography>
          {pendingMatches.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              No pending challenges.
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
            [...completedMatches].reverse().map((match) => {
              const rematch = match.player2
                ? getRematchStatus(match.player1.id, match.player2.id, matches)
                : null;
              const rematchLabel = rematch
                ? formatRematchProgress(
                    rematch,
                    match.player1.name || 'Player 1',
                    match.player2?.name || 'Player 2'
                  )
                : null;

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
                        ? `${rematchLabel} before they can play again`
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
        <DialogTitle>Create Challenge</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The challenger must be ranked below the opponent, or unranked. After two players meet,
            each must face 2 other opponents before they can rematch.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="challenger-label">Challenger</InputLabel>
            <Select
              labelId="challenger-label"
              label="Challenger"
              value={challengerId}
              onChange={(event) => {
                setChallengerId(event.target.value);
                setOpponentId('');
              }}
            >
              {players.map((player) => (
                <MenuItem key={player.id} value={player.id}>
                  {player.name} — {officeDaysLabel(player)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {challenger && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Opponent
              </Typography>
              {opponentOptions.length === 0 ? (
                <Alert severity="info">No other players in this tournament.</Alert>
              ) : (
                <List>
                  {opponentOptions.map((option) => {
                    const rematchLabel = formatRematchProgress(
                      option.rematch,
                      challenger.name,
                      option.player.name
                    );
                    const remaining = option.rematch.blocked
                      ? Math.max(option.rematch.remainingA, option.rematch.remainingB)
                      : 0;
                    const secondary = option.eligible
                      ? rematchLabel || 'Eligible'
                      : [option.reason, rematchLabel].filter(Boolean).join(' — ');

                    return (
                    <ListItemButton
                      key={option.player.id}
                      disabled={!option.eligible}
                      selected={opponentId === option.player.id}
                      onClick={() => option.eligible && setOpponentId(option.player.id)}
                    >
                      <ListItemText
                        primary={`${option.player.name} — ${officeDaysLabel(option.player)}`}
                        secondary={secondary}
                      />
                      {option.rematch.hasPlayed && (
                        <Chip
                          size="small"
                          color={option.rematch.blocked ? 'warning' : 'success'}
                          label={
                            option.rematch.blocked
                              ? `${remaining} left before rematch`
                              : 'Rematch ready'
                          }
                          sx={{ ml: 1 }}
                        />
                      )}
                    </ListItemButton>
                    );
                  })}
                </List>
              )}
            </>
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
