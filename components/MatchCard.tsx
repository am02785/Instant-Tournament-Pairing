import React, { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Typography } from '@mui/material';
import { Match } from '../types';
import { hasIncompleteFeeders } from '../utils/knockoutAdvancement';

const formatGroupLabel = (groupId: string): string => {
  const part = groupId.replace(/^group-/, '');
  return part ? `Group ${part}` : groupId;
};

const formatPlace = (place: 1 | 2): string => (place === 1 ? '1st' : '2nd');

const formatPlayerGroupPlace = (groupId?: string, place?: 1 | 2): string => {
  if (groupId == null || place == null) return '';
  return ` (${formatGroupLabel(groupId)} ${formatPlace(place)})`;
};

type MatchCardProps = {
  match: Match;
  onUpdateMatch: (id: string, winnerId: string, p1Points: number, p2Points: number) => void;
  canUpdate?: boolean;
  allMatches?: Match[];
};

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onUpdateMatch,
  canUpdate = true,
  allMatches = [],
}) => {
  const [player1Points, setPlayer1Points] = useState(0);
  const [player2Points, setPlayer2Points] = useState(0);
  const [showScoreInput, setShowScoreInput] = useState(false);

  useEffect(() => {
    if (match) {
      setPlayer1Points(match.player1Points || 0);
      setPlayer2Points(match.player2Points || 0);
    }
  }, [match?.player1Points, match?.player2Points]);

  const handleSubmitScore = (): void => {
    if (!match?.id || !match?.player1?.id) {
      console.error('Match has no ID or invalid player1:', match);
      return;
    }

    if (!match.player2) {
      onUpdateMatch(match.id, match.player1.id, 1, 0);
      return;
    }

    if (!match.player2.id) {
      console.error('Player2 is missing ID:', match.player2);
      return;
    }

    const winnerId = player1Points > player2Points ? match.player1.id : match.player2.id;
    onUpdateMatch(match.id, winnerId, player1Points, player2Points);
    setShowScoreInput(false);
  };

  if (!match?.player1?.id) {
    return null;
  }

  if (!match.player2) {
    const knockoutMatches = allMatches.filter((m: Match) => m && m.stage === 'knockout');
    const waitingForOpponent = match.stage === 'knockout' && hasIncompleteFeeders(match, knockoutMatches);

    if (waitingForOpponent) {
      const p1Label =
        (match.player1.name || 'Unknown Player') +
        formatPlayerGroupPlace(match.player1GroupId, match.player1GroupPlace);
      return (
        <Card variant="outlined" sx={{ mb: 1, opacity: 0.7 }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="body2" color="textSecondary">
              {p1Label} vs TBD
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Waiting for opponent...
            </Typography>
          </CardContent>
        </Card>
      );
    }

    const byeLabel =
      (match.player1.name || 'Unknown Player') +
      formatPlayerGroupPlace(match.player1GroupId, match.player1GroupPlace);
    return (
      <Card variant="outlined" sx={{ mb: 1 }}>
        <CardContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Box>
              <Typography>{byeLabel} (BYE)</Typography>
              {match.complete && match.winnerId && (
                <Typography variant="caption" color="success.main">
                  Winner: {match.player1.name} (advances automatically)
                </Typography>
              )}
            </Box>
            {!match.complete && canUpdate && (
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
                onClick={handleSubmitScore}
                disabled={!match.id}
              >
                Advance
              </button>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1 }}>
        {!canUpdate && (
          <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
            Cannot edit - future matches completed
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2">
              {(match.player1?.name || 'Unknown') +
                formatPlayerGroupPlace(match.player1GroupId, match.player1GroupPlace)}{' '}
              vs{' '}
              {(match.player2?.name || 'Unknown') +
                formatPlayerGroupPlace(match.player2GroupId, match.player2GroupPlace)}
            </Typography>
            {match.complete && (
              <Typography variant="caption" color="success.main">
                Winner:{' '}
                {match.player1?.id === match.winnerId
                  ? match.player1?.name || 'Unknown'
                  : match.player2?.name || 'Unknown'}
                {match.player1Points !== undefined && ` (${match.player1Points}-${match.player2Points})`}
              </Typography>
            )}
            {match.stage === 'knockout' && match.futureMatchId && (
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                Winner advances to next round
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {match.complete && (
              <Typography variant="body2" color="textSecondary">
                {match.player1Points}-{match.player2Points}
              </Typography>
            )}
            <button
              type="button"
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: !canUpdate ? '#f0f0f0' : match.complete ? '#f5f5f5' : 'white',
                cursor: canUpdate ? 'pointer' : 'not-allowed',
                opacity: canUpdate ? 1 : 0.6,
              }}
              onClick={() => canUpdate && setShowScoreInput(true)}
              disabled={!match.id || !canUpdate}
            >
              {match.complete ? 'Edit' : 'Enter Score'}
            </button>
          </Box>
        </Box>

        {showScoreInput && canUpdate && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2">{match.player1?.name || 'Player 1'}:</Typography>
            <input
              type="number"
              value={player1Points}
              onChange={(e) => setPlayer1Points(parseInt(e.target.value) || 0)}
              style={{ width: '60px', padding: '4px' }}
            />
            <Typography variant="body2">{match.player2?.name || 'Player 2'}:</Typography>
            <input
              type="number"
              value={player2Points}
              onChange={(e) => setPlayer2Points(parseInt(e.target.value) || 0)}
              style={{ width: '60px', padding: '4px' }}
            />
            <button
              type="button"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              onClick={handleSubmitScore}
              disabled={!match.id}
            >
              Submit
            </button>
            <button
              type="button"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              onClick={() => setShowScoreInput(false)}
            >
              Cancel
            </button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MatchCard;
