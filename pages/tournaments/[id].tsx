import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../utils/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Card, 
  CardContent,
  Grid,
  Chip,
  Alert,
  Button
} from '@mui/material';
import { useRouter } from 'next/router';
import { generateKnockoutPairs } from 'utils/pairingLogic';
import { Match, Player, Tournament } from 'types';
import Layout from '@components/Layout';

interface GroupStanding {
  player: Player;
  wins: number;
  losses: number;
  points: number;
}

// Simple UUID generator for browsers that don't support crypto.randomUUID
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const TournamentDetails = () => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const router = useRouter();
  const { id } = router.query;

  const fetchTournament = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setLoading(false);
      return;
    }

    try {
      const tournamentRef = doc(db, 'tournaments', id);
      const tournamentSnapshot = await getDoc(tournamentRef);

      if (tournamentSnapshot.exists()) {
        const tournamentData = tournamentSnapshot.data() as Tournament;
        
        // Ensure all matches have IDs
        if (tournamentData.bracket) {
          tournamentData.bracket = tournamentData.bracket
            .map(match => ({
              ...match,
              id: match.id || generateUUID(), // Add ID if missing
              player1Points: match.player1Points || 0,
              player2Points: match.player2Points || 0,
              complete: match.complete || false,
              futureMatchId: match.futureMatchId || null // Ensure futureMatchId is properly set
            }));
        }
        
        setTournament(tournamentData);
      } else {
        console.log('No such tournament!');
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  // Get matches by stage and round
  const getGroupStageMatches = (): Match[] => {
    return tournament?.bracket?.filter(match => match && match.stage === 'group') || [];
  };

  const getKnockoutMatches = (): Match[] => {
    return tournament?.bracket?.filter(match => match && match.stage === 'knockout') || [];
  };

  // Check if knockout stage has started
  const hasKnockoutStarted = (): boolean => {
    const knockoutMatches = getKnockoutMatches();
    return knockoutMatches.length > 0;
  };

  // Check if a match can be updated (no future completed matches depend on it)
  const canUpdateMatch = (matchToUpdate: Match): boolean => {
    if (!matchToUpdate?.id) return false;
    
    // If tournament is finalized, no edits allowed
    if (tournament?.complete) return false;
    
    // If knockout has started, group stage matches cannot be updated
    if (matchToUpdate.stage === 'group' && hasKnockoutStarted()) {
      return false;
    }
    
    // Group matches can be updated if knockout hasn't started
    if (matchToUpdate.stage === 'group') {
      return true;
    }

    const knockoutMatches = getKnockoutMatches();
    const currentRound = matchToUpdate.round;
    
    // Check if there are any completed matches in future rounds that depend on this match
    const futureMatches = knockoutMatches.filter(m => m && m.round > currentRound && m.complete);
    
    // If any future match includes a player from this match, we can't update
    for (const futureMatch of futureMatches) {
      const playersInCurrentMatch = [matchToUpdate.player1?.id, matchToUpdate.player2?.id].filter(Boolean);
      const playersInFutureMatch = [futureMatch.player1?.id, futureMatch.player2?.id].filter(Boolean);
      
      // Check if any player from current match is in a completed future match
      if (playersInCurrentMatch.some(playerId => playersInFutureMatch.includes(playerId))) {
        return false;
      }
    }
    
    return true;
  };

  // Get group standings
  const getGroupStandings = (): { [groupId: string]: GroupStanding[] } => {
    const groupMatches = getGroupStageMatches();
    const groups: { [groupId: string]: GroupStanding[] } = {};

    groupMatches.forEach(match => {
      if (!match?.groupId) return;
      
      const groupId = match.groupId;
      
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      // Initialize players in standings if not already present
      [match.player1, match.player2].forEach(player => {
        if (!player?.id) return;
        if (!groups[groupId].find(s => s.player.id === player.id)) {
          groups[groupId].push({
            player,
            wins: 0,
            losses: 0,
            points: 0
          });
        }
      });

      // Update standings based on completed matches
      if (match.complete && match.winnerId && match.player2) {
        const winner = match.player1?.id === match.winnerId ? match.player1 : match.player2;
        const loser = match.player1?.id === match.winnerId ? match.player2 : match.player1;

        if (winner?.id && loser?.id) {
          const winnerStanding = groups[groupId].find(s => s.player.id === winner.id);
          const loserStanding = groups[groupId].find(s => s.player.id === loser.id);

          if (winnerStanding) {
            winnerStanding.wins++;
            winnerStanding.points += 3;
          }
          if (loserStanding) {
            loserStanding.losses++;
          }
        }
      }
    });

    return groups;
  };

  // Get top 2 players from each group for knockout qualification
  const getQualifiedKnockoutPlayers = (): Player[] => {
    const groupStandings = getGroupStandings();
    const qualifiedPlayers: Player[] = [];
    
    Object.entries(groupStandings).forEach(([, standings]) => {
      if (standings.length >= 2) {
        const sortedStandings = standings.sort((a, b) => b.points - a.points || b.wins - a.wins);
        // Take top 2 from each group
        if (sortedStandings[0]?.player) {
          qualifiedPlayers.push(sortedStandings[0].player);
        }
        if (sortedStandings[1]?.player) {
          qualifiedPlayers.push(sortedStandings[1].player);
        }
      } else if (standings.length === 1) {
        // If only 1 player in group, they qualify
        qualifiedPlayers.push(standings[0].player);
      }
    });
    
    return qualifiedPlayers;
  };

  // Generate initial knockout matches when button is pressed
  const generateKnockoutMatches = async (): Promise<void> => {
    if (!tournament?.bracket || !id || typeof id !== 'string') return;

    try {
      const qualifiedPlayers = getQualifiedKnockoutPlayers();
      
      if (qualifiedPlayers.length < 2) {
        alert('Need at least 2 qualified players to start knockout stage');
        return;
      }

      // Clean function to remove undefined values
      const cleanObject = (obj: any): any => {
        const cleaned: any = {};
        
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined && obj[key] !== null) {
            if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
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
      };

      // Calculate total rounds needed
      const totalRounds = Math.ceil(Math.log2(qualifiedPlayers.length));
      let allKnockoutMatches: any[] = [];
      
      // First, generate all matches with their IDs
      let playersInCurrentRound = qualifiedPlayers.length;
      const matchesByRound: { [round: number]: any[] } = {};
      
      for (let round = 1; round <= totalRounds; round++) {
        const matchesInThisRound = Math.ceil(playersInCurrentRound / 2);
        matchesByRound[round] = [];
        
        for (let matchIndex = 0; matchIndex < matchesInThisRound; matchIndex++) {
          const baseMatch: any = {
            id: generateUUID(),
            round: round,
            stage: 'knockout',
            complete: false,
            player1Points: 0,
            player2Points: 0,
            player1: null,
            player2: null,
            winnerId: null,
            futureMatchId: null // Will be set below
          };

          matchesByRound[round].push(baseMatch);
        }
        
        // Next round will have half the players (winners from current round)
        playersInCurrentRound = matchesInThisRound;
      }

      // Now assign futureMatchId for each match (except final)
      for (let round = 1; round < totalRounds; round++) {
        const currentRoundMatches = matchesByRound[round];
        const nextRoundMatches = matchesByRound[round + 1];
        
        currentRoundMatches.forEach((match, index) => {
          // Each pair of matches in current round feeds into one match in next round
          const futureMatchIndex = Math.floor(index / 2);
          if (nextRoundMatches[futureMatchIndex]) {
            match.futureMatchId = nextRoundMatches[futureMatchIndex].id;
          }
        });
      }

      // Populate first round with actual players
      const firstRoundMatches = generateKnockoutPairs(qualifiedPlayers, 1);
      matchesByRound[1].forEach((baseMatch, matchIndex) => {
        if (matchIndex < firstRoundMatches.length) {
          const match = firstRoundMatches[matchIndex];
          baseMatch.player1 = match.player1 ? cleanObject(match.player1) : null;
          baseMatch.player2 = match.player2 ? cleanObject(match.player2) : null;
          
          // Handle bye situation
          if (!match.player2 && match.player1?.id) {
            baseMatch.winnerId = match.player1.id;
            baseMatch.complete = true;
            baseMatch.player1Points = 1;
          }
        }
      });

      // Flatten all matches into a single array
      Object.values(matchesByRound).forEach(roundMatches => {
        allKnockoutMatches.push(...roundMatches);
      });

      console.log(`Generated ${allKnockoutMatches.length} knockout matches across ${totalRounds} rounds`);

      // Clean the entire bracket before updating
      const cleanedBracket = [...tournament.bracket.map(cleanObject), ...allKnockoutMatches];

      await updateDoc(doc(db, 'tournaments', id), {
        bracket: cleanedBracket
      });

      await fetchTournament();
    } catch (error) {
      console.error('Error generating knockout matches:', error);
      alert('Error generating knockout matches. Please try again.');
    }
  };

  // Check if tournament finals are complete
  const isTournamentFinalsComplete = (): boolean => {
    const knockoutMatches = getKnockoutMatches();
    if (knockoutMatches.length === 0) return false;
    
    // Find the final match (highest round number)
    const finalRound = Math.max(...knockoutMatches.map(m => m?.round || 0));
    const finalMatch = knockoutMatches.find(m => m?.round === finalRound);
    
    return finalMatch?.complete === true && finalMatch?.winnerId != null;
  };

  // Calculate final tournament rankings
  const calculateTournamentRankings = (): { player: Player; rank: number; points: number }[] => {
    const rankings: { player: Player; rank: number; points: number }[] = [];
    const knockoutMatches = getKnockoutMatches();
    const groupStandings = getGroupStandings();
    
    if (knockoutMatches.length === 0) {
      // If no knockout stage, rank by group stage performance
      const allPlayers: { player: Player; points: number }[] = [];
      Object.values(groupStandings).forEach(standings => {
        standings.forEach(standing => {
          allPlayers.push({ player: standing.player, points: standing.points });
        });
      });
      
      allPlayers.sort((a, b) => b.points - a.points);
      return allPlayers.map((item, index) => ({
        player: item.player,
        rank: index + 1,
        points: item.points
      }));
    }

    // Calculate knockout rankings
    const finalRound = Math.max(...knockoutMatches.map(m => m?.round || 0));
    const playerRankings: Map<string, { player: Player; rank: number; points: number }> = new Map();
    
    // 1st place: Winner of final
    const finalMatch = knockoutMatches.find(m => m?.round === finalRound && m?.complete);
    if (finalMatch?.winnerId) {
      const winner = finalMatch.player1?.id === finalMatch.winnerId ? finalMatch.player1 : finalMatch.player2;
      if (winner) {
        playerRankings.set(winner.id, { player: winner, rank: 1, points: 100 });
      }
    }

    // 2nd place: Loser of final
    if (finalMatch?.winnerId) {
      const loser = finalMatch.player1?.id === finalMatch.winnerId ? finalMatch.player2 : finalMatch.player1;
      if (loser) {
        playerRankings.set(loser.id, { player: loser, rank: 2, points: 75 });
      }
    }

    // 3rd/4th place: Losers of semi-finals
    if (finalRound > 1) {
      const semiMatches = knockoutMatches.filter(m => m?.round === finalRound - 1 && m?.complete);
      let rank3and4 = 3;
      semiMatches.forEach(match => {
        if (match.winnerId) {
          const loser = match.player1?.id === match.winnerId ? match.player2 : match.player1;
          if (loser && !playerRankings.has(loser.id)) {
            playerRankings.set(loser.id, { player: loser, rank: rank3and4, points: 50 });
            rank3and4++;
          }
        }
      });
    }

    // Remaining players: Based on elimination round
    let currentRank = playerRankings.size + 1;
    for (let round = finalRound - 2; round >= 1; round--) {
      const roundMatches = knockoutMatches.filter(m => m?.round === round && m?.complete);
      roundMatches.forEach(match => {
        if (match.winnerId) {
          const loser = match.player1?.id === match.winnerId ? match.player2 : match.player1;
          if (loser && !playerRankings.has(loser.id)) {
            const points = Math.max(25 - (finalRound - round) * 5, 5);
            playerRankings.set(loser.id, { player: loser, rank: currentRank, points });
          }
        }
      });
      currentRank = playerRankings.size + 1;
    }

    // Add any remaining qualified players who didn't advance far
    const qualifiedPlayers = getQualifiedKnockoutPlayers();
    qualifiedPlayers.forEach(player => {
      if (!playerRankings.has(player.id)) {
        playerRankings.set(player.id, { player, rank: currentRank, points: 10 });
        currentRank++;
      }
    });

    return Array.from(playerRankings.values()).sort((a, b) => a.rank - b.rank);
  };

  // Finalize tournament and update player rankings
  const finalizeTournament = async (): Promise<void> => {
    if (!tournament || !id || typeof id !== 'string') return;
    
    try {
      const rankings = calculateTournamentRankings();
      
      // Get all existing players to understand the current seeding landscape
      const playersQuery = query(collection(db, 'players'));
      const playersSnapshot = await getDocs(playersQuery);
      const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player & { id: string }));
      
      // Separate tournament players from non-tournament players
      const tournamentPlayerIds = new Set(rankings.map(r => r.player.id));
      const nonTournamentPlayers = allPlayers.filter(p => !tournamentPlayerIds.has(p.id));
      const tournamentPlayers = allPlayers.filter(p => tournamentPlayerIds.has(p.id));
      
      // Create a new global ranking system
      const newGlobalRankings: Array<{ id: string; seed: number; fromTournament: boolean }> = [];
      
      // Add tournament results in order of their performance
      rankings.forEach((ranking, index) => {
        newGlobalRankings.push({
          id: ranking.player.id,
          seed: index + 1,
          fromTournament: true
        });
      });
      
      // Add non-tournament players, preserving their relative order but adjusting positions
      const sortedNonTournamentPlayers = nonTournamentPlayers
        .filter(p => typeof p.seed === 'number')
        .sort((a, b) => (a.seed || 0) - (b.seed || 0));
      
      // Merge non-tournament players into the rankings
      // For simplicity, place them after tournament players, but maintain their relative order
      let currentRank = rankings.length + 1;
      sortedNonTournamentPlayers.forEach(player => {
        newGlobalRankings.push({
          id: player.id,
          seed: currentRank,
          fromTournament: false
        });
        currentRank++;
      });
      
      // Add non-seeded non-tournament players at the end
      const unseededNonTournamentPlayers = nonTournamentPlayers.filter(p => typeof p.seed !== 'number');
      unseededNonTournamentPlayers.forEach(player => {
        newGlobalRankings.push({
          id: player.id,
          seed: currentRank,
          fromTournament: false
        });
        currentRank++;
      });
      
      // Create a batch for updating multiple documents
      const batch = writeBatch(db);
      
      // Update tournament as complete with final rankings
      const tournamentRef = doc(db, 'tournaments', id);
      batch.update(tournamentRef, { 
        complete: true,
        finalRankings: rankings
      });
      
      // Update all player seeds based on new global rankings
      let updatedCount = 0;
      for (const globalRanking of newGlobalRankings) {
        const playerRef = doc(db, 'players', globalRanking.id);
        const playerDoc = await getDoc(playerRef);
        
        if (playerDoc.exists()) {
          const currentData = playerDoc.data();
          const oldSeed = currentData.seed;
          
          // Only update if the seed actually changed
          if (oldSeed !== globalRanking.seed) {
            batch.update(playerRef, {
              ...currentData,
              seed: globalRanking.seed
            });
            updatedCount++;
          }
        }
      }
      
      // Commit all updates
      await batch.commit();
      
      const tournamentPlayerCount = rankings.length;
      const totalPlayerCount = newGlobalRankings.length;
      
      alert(`Tournament finalized! Global rankings updated:\n- ${tournamentPlayerCount} tournament players ranked 1-${tournamentPlayerCount}\n- ${totalPlayerCount - tournamentPlayerCount} other players re-ranked\n- ${updatedCount} total seed changes made`);
      await fetchTournament();
      
    } catch (error) {
      console.error('Error finalizing tournament:', error);
      alert('Error finalizing tournament. Please try again.');
    }
  };

  // Auto-advance to next knockout round when current round is complete
  const autoAdvanceKnockoutRound = async (tournamentData?: Tournament): Promise<void> => {
    const currentTournament = tournamentData || tournament;
    if (!currentTournament?.bracket || !id || typeof id !== 'string') return;

    try {
      const knockoutMatches = currentTournament.bracket.filter(match => match && match.stage === 'knockout') || [];
      
      if (knockoutMatches.length === 0) return;

      // Find completed matches that have winners and future matches
      const completedMatches = knockoutMatches.filter(m => 
        m?.complete && m?.winnerId && m?.futureMatchId
      );

      if (completedMatches.length === 0) return;

      console.log('Found completed matches for advancement:', completedMatches.length);

      let hasUpdates = false;
      const updatedBracket = currentTournament.bracket.map(match => {
        if (!match || match.stage !== 'knockout') return match;

        // Find ALL completed matches that feed into this match
        const feedingMatches = completedMatches.filter(cm => cm.futureMatchId === match.id);
        
        if (feedingMatches.length === 0) return match;

        console.log(`Processing match ${match.id}, found ${feedingMatches.length} feeding matches`);

        let updatedMatch = { ...match };
        let matchChanged = false;

        feedingMatches.forEach(completedMatch => {
          if (!completedMatch.winnerId) return;

          // Find the winner player object
          const winner = completedMatch.player1?.id === completedMatch.winnerId 
            ? completedMatch.player1 
            : completedMatch.player2;

          if (!winner?.id) return;

          // Check if this winner is already assigned to this match
          const winnerAlreadyAssigned = updatedMatch.player1?.id === winner.id || updatedMatch.player2?.id === winner.id;
          
          if (winnerAlreadyAssigned) {
            console.log(`Winner ${winner.name} already assigned to match ${match.id}`);
            return;
          }

          // Determine which slot to place the winner in
          if (!updatedMatch.player1) {
            console.log(`Assigning ${winner.name} to player1 slot in match ${match.id}`);
            updatedMatch.player1 = winner;
            matchChanged = true;
          } else if (!updatedMatch.player2) {
            console.log(`Assigning ${winner.name} to player2 slot in match ${match.id}`);
            updatedMatch.player2 = winner;
            matchChanged = true;
          } else {
            console.log(`Both slots filled in match ${match.id}, cannot assign ${winner.name}`);
          }
        });

        if (matchChanged) {
          hasUpdates = true;
          return updatedMatch;
        }

        return match;
      });

      // Only update if there were changes
      if (hasUpdates) {
        console.log('Updating bracket with advanced players');
        await updateDoc(doc(db, 'tournaments', id), {
          bracket: updatedBracket
        });

        // Fetch updated tournament data
        await fetchTournament();
        
        // Recursively check if more advancements are possible with a delay
        setTimeout(() => {
          void autoAdvanceKnockoutRound();
        }, 300);
      } else {
        console.log('No updates needed for knockout advancement');
      }
    } catch (error) {
      console.error('Error in autoAdvanceKnockoutRound:', error);
    }
  };  
  
  const handleUpdateMatch = async (matchId: string, winnerId: string, player1Points: number, player2Points: number): Promise<void> => {
    if (!tournament?.bracket || !matchId || !id || typeof id !== 'string') return;

    // Find the match being updated
    const matchToUpdate = tournament.bracket.find(m => m?.id === matchId);
    if (!matchToUpdate) {
      console.error('Match not found');
      return;
    }

    // Check if match can be updated
    if (!canUpdateMatch(matchToUpdate)) {
      console.error('Cannot update match - future matches depend on this result');
      alert('Cannot update this match because future matches have already been completed with players from this match.');
      return;
    }

    try {
      console.log(`Updating match ${matchId} with winner ${winnerId}`);
      
      const updatedBracket = tournament.bracket.map((m: Match) =>
        m?.id === matchId ? {
          ...m,
          player1Points,
          player2Points,
          winnerId,
          complete: true,
        } : m
      ).filter(Boolean);

      // Update the database first
      await updateDoc(doc(db, 'tournaments', id), {
        bracket: updatedBracket
      });
      
      console.log('Match updated successfully');
      
      // For knockout matches, check advancement immediately with fresh data
      if (matchToUpdate.stage === 'knockout') {
        console.log('Starting auto-advancement for knockout match');
        
        // Create a temporary tournament object with the updated bracket
        const tempTournament: Tournament = {
          ...tournament,
          bracket: updatedBracket
        };
        
        // Call auto-advancement with the fresh data
        await autoAdvanceKnockoutRound(tempTournament);
      }
      
      // Finally, refresh the UI
      await fetchTournament();
      
    } catch (error) {
      console.error('Error updating match:', error);
    }
  };

  const renderGroupStage = () => {
    const groupMatches = getGroupStageMatches();
    const groupStandings = getGroupStandings();
    const knockoutStarted = hasKnockoutStarted();

    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          Group Stage
        </Typography>
        
        {knockoutStarted && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Group stage editing is disabled because the knockout stage has started.
          </Alert>
        )}
        
        {Object.entries(groupStandings).map(([groupId, standings]) => (
          <Card key={groupId} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {groupId.replace('-', ' ').toUpperCase()}
              </Typography>
              
              {/* Group Standings */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Standings:</Typography>
                {standings
                  .sort((a, b) => b.points - a.points || b.wins - a.wins)
                  .map((standing, index) => (
                    <Box key={standing.player.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography>{index + 1}. {standing.player.name}</Typography>
                        {standing.player.seed && (
                          <Chip label={`Seed ${standing.player.seed}`} size="small" sx={{ ml: 1 }} />
                        )}
                        {index < 2 && (
                          <Chip label="Qualified" color="success" size="small" sx={{ ml: 1 }} />
                        )}
                      </Box>
                      <Typography>{standing.wins}W-{standing.losses}L ({standing.points}pts)</Typography>
                    </Box>
                  ))}
              </Box>

              {/* Group Matches */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Matches:</Typography>
                {groupMatches
                  .filter(match => match?.groupId === groupId)
                  .map(match => (
                    <MatchCard 
                      key={match?.id || Math.random()} 
                      match={match} 
                      onUpdateMatch={handleUpdateMatch}
                      canUpdate={canUpdateMatch(match)}
                      allMatches={tournament?.bracket || []}
                    />
                  ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };
  
  const renderKnockoutStage = () => {
    const knockoutMatches = getKnockoutMatches();
    const qualifiedPlayers = getQualifiedKnockoutPlayers();

    // Group knockout matches by round
    const matchesByRound: { [round: number]: Match[] } = {};
    knockoutMatches.forEach(match => {
      if (!match?.round) return;
      if (!matchesByRound[match.round]) {
        matchesByRound[match.round] = [];
      }
      matchesByRound[match.round].push(match);
    });

    // Calculate tournament structure
    const totalPlayers = qualifiedPlayers.length;
    const totalRounds = totalPlayers > 1 ? Math.ceil(Math.log2(totalPlayers)) : 0;
    
    // Get actual rounds from the database
    const allRounds = Object.keys(matchesByRound)
      .map(Number)
      .sort((a, b) => a - b);

    const getRoundName = (round: number): string => {
      if (round === totalRounds) return 'Final';
      if (round === totalRounds - 1) return 'Semi-Final';
      if (round === totalRounds - 2) return 'Quarter-Final';
      return `Round ${round}`;
    };

    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          Knockout Stage
        </Typography>
        
        {knockoutMatches.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Knockout stage not started
            </Typography>
            <Typography variant="body1" color="textPrimary" sx={{ mb: 2 }}>
              Top 2 players from each group qualify for knockout
            </Typography>
            
            {qualifiedPlayers.length >= 2 ? (
              <>
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'blue', borderRadius: 1 }}>
                  <Typography variant="body1" color="textPrimary" gutterBottom>
                    <strong>Qualified players ({qualifiedPlayers.length}):</strong>
                  </Typography>
                  <Typography variant="body1" color="textPrimary">
                    {qualifiedPlayers.map(p => p.name).join(', ')}
                  </Typography>
                </Box>
                
                {/* Show tournament structure preview */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'blue', borderRadius: 1 }}>
                  <Typography variant="body1" color="textPrimary" gutterBottom>
                    <strong>Tournament Structure ({totalRounds} rounds):</strong>
                  </Typography>
                  {Array.from({length: totalRounds}, (_, i) => i + 1).map(round => (
                    <Typography key={round} variant="body2" color="textPrimary">
                      {getRoundName(round)}: {Math.ceil(totalPlayers / Math.pow(2, round))} match{Math.ceil(totalPlayers / Math.pow(2, round)) !== 1 ? 'es' : ''}
                    </Typography>
                  ))}
                </Box>
                
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="large"
                  onClick={generateKnockoutMatches}
                >
                  Start Knockout Stage ({qualifiedPlayers.length} players)
                </Button>
              </>
            ) : (
              <Typography variant="body1" color="textPrimary">
                Need at least 2 qualified players to start knockout stage
              </Typography>
            )}
          </Box>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              All Knockout Matches
            </Typography>
            
            {tournament?.complete && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Knockout stage editing is disabled because the tournament has been finalized.
              </Alert>
            )}
            
            {knockoutMatches.map(match => {
              // Show placeholder for matches without players
              if (!match?.player1 && !match?.player2) {
                return (
                  <Card key={match?.id || Math.random()} variant="outlined" sx={{ mb: 1, opacity: 0.5 }}>
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                        Round {match?.round}: Waiting for players...
                      </Typography>
                    </CardContent>
                  </Card>
                );
              }
              
              return (
                <Box key={match?.id || Math.random()} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Round {match?.round}
                  </Typography>
                  <MatchCard 
                    match={match} 
                    onUpdateMatch={handleUpdateMatch}
                    canUpdate={canUpdateMatch(match)}
                    allMatches={tournament?.bracket || []}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    );
  };

  if (!id || typeof id !== 'string') {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!tournament) {
    return (
      <Layout>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" color="error">
            Tournament not found
          </Typography>
        </Paper>
      </Layout>
    );
  }

  return (
    <Layout>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            {tournament.name || 'Tournament Details'}
          </Typography>
          
          {/* Finalize Tournament Button */}
          {!tournament.complete && (
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={finalizeTournament}
              disabled={!isTournamentFinalsComplete()}
              sx={{ ml: 2 }}
            >
              {isTournamentFinalsComplete() ? 'Finalize Tournament' : 'Complete Finals to Finalize'}
            </Button>
          )}
          
          {tournament.complete && (
            <Chip 
              label="Tournament Complete" 
              color="success" 
              variant="filled" 
              size="medium"
            />
          )}
        </Box>

        {/* Tournament Complete Alert */}
        {tournament.complete && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body1">
              This tournament has been completed and global player rankings have been updated. Tournament participants are now ranked 1-{calculateTournamentRankings().length}, with other players re-ranked accordingly.
            </Typography>
          </Alert>
        )}

        {/* Final Rankings Display */}
        {tournament.complete && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Final Rankings
              </Typography>
              {(tournament.finalRankings || calculateTournamentRankings()).map((ranking, index) => (
                <Box 
                  key={ranking.player.id} 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    py: 1,
                    borderBottom: index < (tournament.finalRankings || calculateTournamentRankings()).length - 1 ? '1px solid #eee' : 'none'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ mr: 2, minWidth: '40px' }}>
                      #{ranking.rank}
                    </Typography>
                    <Typography variant="body1" sx={{ mr: 2 }}>
                      {ranking.player.name}
                    </Typography>
                    {ranking.rank === 1 && <Chip label="Champion" color="primary" size="small" />}
                    {ranking.rank === 2 && <Chip label="Runner-up" color="secondary" size="small" />}
                    {ranking.rank === 3 && <Chip label="3rd Place" color="default" size="small" />}
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    New Seed: {ranking.rank}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        )}

        <Grid container spacing={4}>
          {/* Group Stage Section */}
          <Grid item xs={12} lg={6}>
            {renderGroupStage()}
          </Grid>

          {/* Knockout Stage Section */}
          <Grid item xs={12} lg={6}>
            {renderKnockoutStage()}
          </Grid>
        </Grid>
      </Paper>
    </Layout>
  );
};
// Match Card Component
const MatchCard: React.FC<{ 
  match: Match; 
  onUpdateMatch: (id: string, winnerId: string, p1Points: number, p2Points: number) => void;
  canUpdate?: boolean;
  allMatches?: Match[]; // Add this prop to access all matches for checking feeder matches
}> = ({ match, onUpdateMatch, canUpdate = true, allMatches = [] }) => {
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
  // Don't render if match is invalid
  if (!match?.player1?.id) {
    return null;
  }

  if (!match.player2) {
    // Check if this is a knockout match that's waiting for a player to advance
    // This happens when it's a knockout match in round > 1 AND there are other matches that should feed into this one
    const isWaitingForAdvancement = match.stage === 'knockout' && match.round > 1 && match.futureMatchId === null;
    
    // Additionally, check if there are any matches that have this match as their futureMatchId
    const knockoutMatches = allMatches.filter((m: Match) => m && m.stage === 'knockout');
    const hasFeederMatches = knockoutMatches.some((m: Match) => m.futureMatchId === match.id && !m.complete);
    
    if (isWaitingForAdvancement || (match.stage === 'knockout' && hasFeederMatches)) {
      return (
        <Card variant="outlined" sx={{ mb: 1, opacity: 0.7 }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="body2" color="textSecondary">
              {match.player1.name || 'Unknown Player'} vs TBD
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Waiting for opponent...
            </Typography>
          </CardContent>
        </Card>
      );
    }
    
    // This is a true bye (first round with odd number of players)
    return (
      <Card variant="outlined" sx={{ mb: 1 }}>
        <CardContent sx={{ py: 1 }}>
          <Typography>
            {match.player1.name || 'Unknown Player'} (BYE)
          </Typography>
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
              {match.player1?.name || 'Unknown'} vs {match.player2?.name || 'Unknown'}
            </Typography>
            {match.complete && (
              <Typography variant="caption" color="success.main">
                Winner: {match.player1?.id === match.winnerId ? (match.player1?.name || 'Unknown') : (match.player2?.name || 'Unknown')}
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
                opacity: canUpdate ? 1 : 0.6
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

export default TournamentDetails;