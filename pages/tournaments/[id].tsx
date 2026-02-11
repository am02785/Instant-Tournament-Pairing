import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Firebase db import removed - now using API routes
// Firebase imports removed - now using API routes
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
      const response = await fetch(`/api/tournaments/${id}`);
      const data = await response.json();

      if (data.success) {
        const tournamentData = data.tournament as Tournament;
        
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
        console.log('Tournament not found:', data.error);
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
    fetchTournament();
    }
  }, [id, fetchTournament]);

  // Get matches by stage and round
  const getGroupStageMatches = useCallback((): Match[] => {
    return tournament?.bracket?.filter(match => match && match.stage === 'group') || [];
  }, [tournament?.bracket]);

  const getKnockoutMatches = useCallback((): Match[] => {
    return tournament?.bracket?.filter(match => match && match.stage === 'knockout') || [];
  }, [tournament?.bracket]);

  // Check if knockout stage has started
  const hasKnockoutStarted = useCallback((): boolean => {
    const knockoutMatches = getKnockoutMatches();
    return knockoutMatches.length > 0;
  }, [getKnockoutMatches]);

  // Check if a match can be updated (no future completed matches depend on it)
  const canUpdateMatch = useCallback((matchToUpdate: Match): boolean => {
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
  }, [tournament?.complete, hasKnockoutStarted, getKnockoutMatches]);

  // Get group standings
  const getGroupStandings = useCallback((): { [groupId: string]: GroupStanding[] } => {
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
  }, [getGroupStageMatches]);

  // Get top 2 players from each group for knockout qualification
  const getQualifiedKnockoutPlayers = useCallback((): Player[] => {
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
  }, [getGroupStandings]);

  // Helper function to update tournament bracket
  const updateTournament = useCallback(async (bracket: Match[]) => {
    if (!id || typeof id !== 'string') {
      console.error('Invalid tournament ID');
      return;
    }
    
    try {
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bracket }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update tournament');
      }
    } catch (error) {
      console.error('Error updating tournament:', error);
      throw error;
    }
  }, [id]);

  // Generate initial knockout matches when button is pressed
  const generateKnockoutMatches = useCallback(async (): Promise<void> => {
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

      await updateTournament(cleanedBracket);

      // Update local state instead of refetching
      setTournament(prev => prev ? { ...prev, bracket: cleanedBracket } : null);
    } catch (error) {
      console.error('Error generating knockout matches:', error);
      alert('Error generating knockout matches. Please try again.');
    }
  }, [tournament?.bracket, id, getQualifiedKnockoutPlayers, updateTournament]);

  // Check if tournament finals are complete
  const isTournamentFinalsComplete = useCallback((): boolean => {
    const knockoutMatches = getKnockoutMatches();
    if (knockoutMatches.length === 0) return false;
    
    // Find the final match (highest round number)
    const finalRound = Math.max(...knockoutMatches.map(m => m?.round || 0));
    const finalMatch = knockoutMatches.find(m => m?.round === finalRound);
    
    return finalMatch?.complete === true && finalMatch?.winnerId != null;
  }, [getKnockoutMatches]);

  // Calculate final tournament rankings
  const calculateTournamentRankings = useCallback((): { player: Player; rank: number; points: number; adjustedSeed?: number }[] => {
    const rankings: { player: Player; rank: number; points: number; adjustedSeed?: number }[] = [];
    const knockoutMatches = getKnockoutMatches();
    const groupStandings = getGroupStandings();
    
    // Seed adjustment values based on tournament position
    // Lower seed numbers are better, so good performance = negative adjustment (improves seed)
    const seedAdjustments: { [rank: number]: number } = {
      1: -5,   // Winner: improve seed by 5
      2: -2,   // Runner-up: improve seed by 2
      3: 0,    // Semi-final losers: no change
      4: +2,   // Quarter-final losers: worsen seed by 2
      5: +4,   // Earlier knockout eliminations: worsen seed by 4
      6: +6,   // Group stage 3rd place: worsen seed by 6
      7: +8,   // Group stage 4th place: worsen seed by 8
    };
    
    // Calculate adjustment for ranks beyond 7 (progressive worsening)
    const getAdjustment = (rank: number): number => {
      if (seedAdjustments[rank] !== undefined) {
        return seedAdjustments[rank];
      }
      // For ranks beyond 7, add 2 more for each additional rank
      return 8 + (rank - 7) * 2;
    };
    
    // Base seed assignment for players without seeds, based on tournament position
    const getBaseSeedForRank = (rank: number): number => {
      const baseSeeds: { [rank: number]: number } = {
        1: 1,   // Winner
        2: 2,   // Runner-up
        3: 3,   // Semi-final losers
        4: 5,   // Quarter-final losers
        5: 7,   // Earlier knockout eliminations
        6: 10,  // Group stage 3rd place
        7: 12,  // Group stage 4th place (worst possible group stage position)
      };
      
      // Group stage players should only get ranks 6 or 7, so we should never need ranks beyond 7
      // However, keep the fallback for edge cases in knockout-only tournaments
      if (baseSeeds[rank] !== undefined) {
        return baseSeeds[rank];
      }
      // Fallback for ranks beyond 7 (should only occur in knockout rounds beyond rank 5)
      return 12 + (rank - 7) * 2;
    };
    
    if (knockoutMatches.length === 0) {
      // If no knockout stage, rank by group stage performance
      const allPlayers: { player: Player; points: number; wins: number }[] = [];
      Object.values(groupStandings).forEach(standings => {
        standings.forEach(standing => {
          allPlayers.push({ 
            player: standing.player, 
            points: standing.points,
            wins: standing.wins
          });
        });
      });
      
      // Use the same sorting logic as qualification: points first, then wins as tiebreaker
      allPlayers.sort((a, b) => {
        // First sort by points (descending)
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        // Then by wins as tiebreaker (descending)
        return b.wins - a.wins;
      });
      
      // Assign ranks and calculate adjusted seeds for group stage only tournament
      return allPlayers.map((item, index) => {
        const tournamentRank = index + 1;
        
        // If player has no seed, assign one based on tournament position
        if (item.player.seed === null || item.player.seed === undefined) {
          const baseSeed = getBaseSeedForRank(tournamentRank);
          return {
            player: item.player,
            rank: tournamentRank,
            points: item.points,
            adjustedSeed: baseSeed
          };
        } else {
          // If player has a seed, apply adjustment
          const adjustment = getAdjustment(tournamentRank);
          const adjustedSeed = item.player.seed + adjustment;
          return {
            player: item.player,
            rank: tournamentRank,
            points: item.points,
            adjustedSeed: adjustedSeed
          };
        }
      });
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

    // 3rd/4th place: Losers of semi-finals (both get rank 3 - same rank since eliminated at same stage)
    // But sort by existing seed to maintain global ranking
    if (finalRound > 1) {
      const semiMatches = knockoutMatches.filter(m => m?.round === finalRound - 1 && m?.complete);
      const semiLosers: Player[] = [];
      semiMatches.forEach(match => {
        if (match.winnerId) {
          const loser = match.player1?.id === match.winnerId ? match.player2 : match.player1;
          if (loser && !playerRankings.has(loser.id)) {
            semiLosers.push(loser);
          }
        }
      });
      
      // Sort by existing seed (better seed = better rank within this tier)
      semiLosers.sort((a, b) => {
        const aSeed = a.seed || 999;
        const bSeed = b.seed || 999;
        return aSeed - bSeed; // Lower seed number = better
      });
      
      // All get rank 3, but order matters for final ranking
      const rankForSemiLosers = 3;
      semiLosers.forEach(loser => {
        playerRankings.set(loser.id, { player: loser, rank: rankForSemiLosers, points: 50 });
      });
    }

    // Remaining players: Based on elimination round
    // Group by round and sort by existing seed within each round
    let currentRank = playerRankings.size + 1;
    for (let round = finalRound - 2; round >= 1; round--) {
      const roundMatches = knockoutMatches.filter(m => m?.round === round && m?.complete);
      const roundLosers: Player[] = [];
      
      roundMatches.forEach(match => {
        if (match.winnerId) {
          const loser = match.player1?.id === match.winnerId ? match.player2 : match.player1;
          if (loser && !playerRankings.has(loser.id)) {
            roundLosers.push(loser);
          }
        }
      });
      
      // Sort by existing seed (better seed = better rank within this round)
      roundLosers.sort((a, b) => {
        const aSeed = a.seed || 999;
        const bSeed = b.seed || 999;
        return aSeed - bSeed; // Lower seed number = better
      });
      
      // All players eliminated in this round get the same rank
      const rankForThisRound = currentRank;
      roundLosers.forEach(loser => {
        const points = Math.max(25 - (finalRound - round) * 5, 5);
        playerRankings.set(loser.id, { player: loser, rank: rankForThisRound, points });
      });
      
      currentRank = playerRankings.size + 1;
    }

    // Add any remaining qualified players who didn't advance far
    const qualifiedPlayers = getQualifiedKnockoutPlayers();
    const remainingQualified = qualifiedPlayers.filter(player => !playerRankings.has(player.id));
    
    // Sort by existing seed
    remainingQualified.sort((a, b) => {
      const aSeed = a.seed || 999;
      const bSeed = b.seed || 999;
      return aSeed - bSeed;
    });
    
    // All get the same rank
    const rankForQualified = currentRank;
    remainingQualified.forEach(player => {
      playerRankings.set(player.id, { player, rank: rankForQualified, points: 10 });
    });

    // Add ALL tournament players who didn't make it to knockout stages
    // These players should be ranked based on their group stage performance
    // 3rd place finishers get a better rank than 4th place finishers
    if (tournament?.players) {
      const knockoutPlayerIds = new Set(playerRankings.keys());
      const thirdPlacePlayers: { player: Player; points: number; wins: number }[] = [];
      const fourthPlacePlayers: { player: Player; points: number; wins: number }[] = [];
      
      // Determine each player's position in their group and categorize them
      Object.entries(groupStandings).forEach(([groupId, standings]) => {
        // Sort standings by points and wins (same logic as qualification)
        const sortedStandings = [...standings].sort((a, b) => 
          b.points - a.points || b.wins - a.wins
        );
        
        // Get players who didn't qualify for knockout (positions 3 and 4 in 4-player groups)
        sortedStandings.forEach((standing, index) => {
          const position = index + 1; // 1st, 2nd, 3rd, or 4th
          const player = standing.player;
          
          // Only process players who didn't make it to knockout
        if (!knockoutPlayerIds.has(player.id)) {
            if (position === 3) {
              thirdPlacePlayers.push({ 
                player, 
                points: standing.points, 
                wins: standing.wins 
              });
            } else if (position === 4) {
              fourthPlacePlayers.push({ 
                player, 
                points: standing.points, 
                wins: standing.wins 
              });
            }
            // Handle groups with fewer than 4 players - treat as 3rd place
            else if (position > 2 && sortedStandings.length < 4) {
              thirdPlacePlayers.push({ 
                player, 
                points: standing.points, 
                wins: standing.wins 
              });
            }
          }
        });
      });
      
      // Sort 3rd place players: first by existing seed (better seed = better rank), then by performance
      thirdPlacePlayers.sort((a, b) => {
        const aSeed = a.player.seed || 999;
        const bSeed = b.player.seed || 999;
        if (aSeed !== bSeed) {
          return aSeed - bSeed; // Lower seed number = better
        }
        // If same seed, sort by performance
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.wins - a.wins;
      });
      
      // Sort 4th place players: first by existing seed (better seed = better rank), then by performance
      fourthPlacePlayers.sort((a, b) => {
        const aSeed = a.player.seed || 999;
        const bSeed = b.player.seed || 999;
        if (aSeed !== bSeed) {
          return aSeed - bSeed; // Lower seed number = better
        }
        // If same seed, sort by performance
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.wins - a.wins;
      });
      
      // Add 3rd place players to rankings first (they all get rank 6 - fixed for group stage 3rd place)
      const rankForThirdPlace = 6;
      thirdPlacePlayers.forEach((item) => {
        playerRankings.set(item.player.id, { 
          player: item.player, 
          rank: rankForThirdPlace, 
          points: item.points 
        });
      });
      
      // Add 4th place players to rankings after 3rd place players
      // They all get rank 7 (fixed for group stage 4th place - worst possible group stage position)
      const rankForFourthPlace = 7;
      fourthPlacePlayers.forEach((item) => {
        playerRankings.set(item.player.id, { 
          player: item.player, 
          rank: rankForFourthPlace, 
          points: item.points 
        });
      });
    }

    // Calculate adjusted seeds for all tournament players based on their tournament performance
    // The rank represents tournament performance position, adjustedSeed is used for global ranking
    const tournamentRankingsWithAdjustedSeeds: Array<{ player: Player; rank: number; points: number; adjustedSeed: number }> = [];
    
    // Convert playerRankings to array with adjusted seeds
    Array.from(playerRankings.values()).forEach(ranking => {
      const tournamentRank = ranking.rank; // This is the tournament performance rank (1st, 2nd, 3rd, etc.)
      
      // If player has no seed, assign one based on tournament position
      if (ranking.player.seed === null || ranking.player.seed === undefined) {
        const baseSeed = getBaseSeedForRank(tournamentRank);
        tournamentRankingsWithAdjustedSeeds.push({
          player: ranking.player,
          rank: tournamentRank,
          points: ranking.points,
          adjustedSeed: baseSeed
        });
      } else {
        // If player has a seed, apply adjustment
        const adjustment = getAdjustment(tournamentRank);
        const adjustedSeed = ranking.player.seed + adjustment;
        
        tournamentRankingsWithAdjustedSeeds.push({
          player: ranking.player,
          rank: tournamentRank, // Keep the tournament performance rank
          points: ranking.points,
          adjustedSeed: adjustedSeed // This will be used for global ranking in finalize API
        });
      }
    });
    
    // Sort by adjusted seed (lower is better) to determine order
    // This ensures players with better adjusted seeds come first in the rankings
    tournamentRankingsWithAdjustedSeeds.sort((a, b) => {
      if (a.adjustedSeed !== b.adjustedSeed) {
        return a.adjustedSeed - b.adjustedSeed;
      }
      // If same adjusted seed, sort by tournament rank (better performance first)
      return a.rank - b.rank;
    });
    
    // Return rankings with tournament performance ranks and adjusted seeds
    return tournamentRankingsWithAdjustedSeeds;
  }, [getKnockoutMatches, getGroupStandings, getQualifiedKnockoutPlayers, tournament]);

  // Finalize tournament and update player rankings
  const finalizeTournament = useCallback(async (): Promise<void> => {
    if (!tournament || !id || typeof id !== 'string') return;
    
    try {
      const rankings = calculateTournamentRankings();
      
      // Call the API to finalize the tournament
      const response = await fetch(`/api/tournaments/${id}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rankings }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to finalize tournament');
      }
      
      alert(`Tournament finalized! Global rankings updated. ${data.updatedCount || 0} player seeds were updated.`);
      // Update local state to mark tournament as complete
      setTournament(prev => prev ? { ...prev, complete: true, finalRankings: rankings } : null);
      
    } catch (error) {
      console.error('Error finalizing tournament:', error);
      alert('Error finalizing tournament. Please try again.');
    }
  }, [tournament, id, calculateTournamentRankings]);

  // Update future matches when a knockout winner changes
  const updateFutureMatchesForWinnerChange = async (changedMatchId: string, newWinnerId: string, oldWinnerId: string, currentBracket: Match[]): Promise<Match[]> => {
    console.log('=== updateFutureMatchesForWinnerChange START ===', { changedMatchId, newWinnerId, oldWinnerId });
    
    if (!currentBracket || !id || typeof id !== 'string') {
      console.log('Invalid parameters for future match update');
      return currentBracket;
    }

    try {
      console.log(`Updating future matches for winner change: ${oldWinnerId} -> ${newWinnerId}`);
      
      const updatedBracket = currentBracket.map(match => {
        if (!match || match.stage !== 'knockout') return match;
        
        // Check if this match is fed by the changed match
        const changedMatch = currentBracket.find(m => m?.id === changedMatchId);
        if (!changedMatch?.futureMatchId || changedMatch.futureMatchId !== match.id) {
          return match;
        }
        
        console.log(`Updating future match ${match.id} for winner change`);
        
        // Find the new winner player object
        const newWinner = changedMatch.player1?.id === newWinnerId 
          ? changedMatch.player1 
          : changedMatch.player2;
        
        if (!newWinner?.id) {
          console.log('New winner not found, skipping match');
          return match;
        }
        
        // Update the match with the new winner
        let updatedMatch = { ...match };
        
        // Replace the old winner with the new winner
        if (updatedMatch.player1?.id === oldWinnerId) {
          console.log(`Replacing player1 ${oldWinnerId} with ${newWinnerId} in match ${match.id}`);
          updatedMatch.player1 = newWinner;
          // Reset match completion if it was completed with the old winner
          if (updatedMatch.complete && updatedMatch.winnerId === oldWinnerId) {
            updatedMatch.complete = false;
            updatedMatch.winnerId = undefined;
            updatedMatch.player1Points = 0;
            updatedMatch.player2Points = 0;
          }
        } else if (updatedMatch.player2?.id === oldWinnerId) {
          console.log(`Replacing player2 ${oldWinnerId} with ${newWinnerId} in match ${match.id}`);
          updatedMatch.player2 = newWinner;
          // Reset match completion if it was completed with the old winner
          if (updatedMatch.complete && updatedMatch.winnerId === oldWinnerId) {
            updatedMatch.complete = false;
            updatedMatch.winnerId = undefined;
            updatedMatch.player1Points = 0;
            updatedMatch.player2Points = 0;
          }
        }
        
        return updatedMatch;
      });
      
      console.log('Updated bracket for future matches, length:', updatedBracket.length);
      
      // Clean up and validate the bracket before returning
      const cleanedBracket = cleanupAndValidateBracket(updatedBracket);
      console.log('Cleaned bracket for future matches, length:', cleanedBracket.length);
      
      // Update the tournament with the cleaned bracket
      await updateTournament(cleanedBracket);
      console.log('Future matches updated for winner change');
      console.log('=== updateFutureMatchesForWinnerChange END ===');
      
      return cleanedBracket;
      
    } catch (error) {
      console.error('Error updating future matches for winner change:', error);
      return currentBracket;
    }
  };

  // Clean up duplicate players and validate match integrity
  const cleanupAndValidateBracket = (bracket: Match[]): Match[] => {
    const cleanedBracket = bracket.map(match => {
      if (!match) return match;
      
      // Check for duplicate players in the same match (both group and knockout)
      if (match.player1?.id && match.player2?.id && match.player1.id === match.player2.id) {
        return {
          ...match,
          player2: undefined,
          complete: false,
          winnerId: undefined,
          player1Points: 0,
          player2Points: 0
        };
      }
      
      return match;
    });
    
    // Check for players appearing in multiple matches at the same round (only for knockout)
    const roundGroups: { [round: number]: Match[] } = {};
    cleanedBracket.forEach(match => {
      if (match?.stage === 'knockout' && match.round) {
        if (!roundGroups[match.round]) roundGroups[match.round] = [];
        roundGroups[match.round].push(match);
      }
    });
    
    Object.entries(roundGroups).forEach(([round, matches]) => {
      const playerCounts: { [playerId: string]: number } = {};
      
      matches.forEach(match => {
        [match.player1, match.player2].forEach(player => {
          if (player?.id) {
            playerCounts[player.id] = (playerCounts[player.id] || 0) + 1;
          }
        });
      });
      
      // If a player appears in multiple matches at the same round, clear them from all but the first
      Object.entries(playerCounts).forEach(([playerId, count]) => {
        if (count > 1) {
          let firstMatch = true;
          matches.forEach(match => {
            if (match.player1?.id === playerId) {
              if (firstMatch) {
                firstMatch = false;
              } else {
                Object.assign(match, {
                  player1: undefined,
                  complete: false,
                  winnerId: undefined,
                  player1Points: 0,
                  player2Points: 0
                });
              }
            }
            if (match.player2?.id === playerId) {
              if (firstMatch) {
                firstMatch = false;
              } else {
                Object.assign(match, {
                  player2: undefined,
                  complete: false,
                  winnerId: undefined,
                  player1Points: 0,
                  player2Points: 0
                });
              }
            }
          });
        }
      });
    });
    
    return cleanedBracket;
  };

  // Add a new player into an existing group (creates matches vs all current group members)
  const handleAddPlayerToGroup = useCallback(async (groupId: string): Promise<void> => {
    if (!tournament || !tournament.bracket) return;

    // Do not allow structural changes once knockout has started or the tournament is complete
    if (hasKnockoutStarted() || tournament.complete) {
      alert('Cannot add players once the knockout stage has started or the tournament has been finalized.');
      return;
    }

    const name = window.prompt('Enter the name of the player to add to this group:');
    if (!name) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Create a lightweight player that exists only within this tournament's bracket
    const newPlayer: Player = {
      id: generateUUID(),
      name: trimmedName,
      officeDays: [],
    };

    // Find existing group matches
    const groupMatches = tournament.bracket.filter(
      (m) => m && m.stage === 'group' && m.groupId === groupId
    );

    if (groupMatches.length === 0) {
      alert('No existing matches found for this group. Cannot add a player here.');
      return;
    }

    // Collect unique existing players in this group from current matches
    const existingPlayersMap = new Map<string, Player>();
    groupMatches.forEach((match) => {
      if (match.player1?.id && !existingPlayersMap.has(match.player1.id)) {
        existingPlayersMap.set(match.player1.id, match.player1);
      }
      if (match.player2?.id && !existingPlayersMap.has(match.player2.id)) {
        existingPlayersMap.set(match.player2.id, match.player2);
      }
    });

    const existingPlayers = Array.from(existingPlayersMap.values());

    if (existingPlayers.length === 0) {
      alert('No existing players found in this group.');
      return;
    }

    // Use the first match's round as a sensible default; standings logic does not depend on round
    const baseRound = groupMatches[0]?.round || 1;

    // Create new matches: new player vs every current group member
    const newMatches: Match[] = existingPlayers.map((player) => ({
      id: generateUUID(),
      player1: player,
      player2: newPlayer,
      player1Points: 0,
      player2Points: 0,
      winnerId: undefined,
      round: baseRound,
      complete: false,
      stage: 'group',
      groupId,
      futureMatchId: undefined,
    }));

    const updatedBracket = cleanupAndValidateBracket([
      ...tournament.bracket,
      ...newMatches,
    ]);

    try {
      await updateTournament(updatedBracket);
      setTournament((prev) => (prev ? { ...prev, bracket: updatedBracket } : prev));
    } catch (error) {
      console.error('Error adding player to group:', error);
      alert('Error adding player to group. Please try again.');
    }
  }, [tournament, hasKnockoutStarted, updateTournament]);

  // Auto-advance to next knockout round when current round is complete
  const autoAdvanceKnockoutRound = async (tournamentData?: Tournament): Promise<Match[] | null> => {
    const currentTournament = tournamentData || tournament;
    if (!currentTournament?.bracket || !id || typeof id !== 'string') {
      return null;
    }

    try {
      const knockoutMatches = currentTournament.bracket.filter(match => match && match.stage === 'knockout') || [];
      
      if (knockoutMatches.length === 0) {
        return null;
      }

      // Find completed matches that have winners and future matches
      const completedMatches = knockoutMatches.filter(m => 
        m?.complete && m?.winnerId && m?.futureMatchId
      );

      if (completedMatches.length === 0) {
        return null;
      }

      // Find matches that need players (empty slots that should be filled)
      const matchesNeedingPlayers = knockoutMatches.filter(match => 
        match && 
        match.stage === 'knockout' && 
        (!match.player1 || !match.player2) && // Has empty slots
        completedMatches.some(cm => cm.futureMatchId === match.id) // Has completed feeders
      );

      if (matchesNeedingPlayers.length === 0) {
        // No matches need advancement
        return null;
      }

      let hasUpdates = false;
      const updatedBracket = currentTournament.bracket.map(match => {
        if (!match || match.stage !== 'knockout') return match;

        // Only process matches that need players
        if (!matchesNeedingPlayers.some(m => m.id === match.id)) {
          return match;
        }

        // Find completed matches that feed into this match
        const feedingMatches = completedMatches.filter(cm => cm.futureMatchId === match.id);
        
        if (feedingMatches.length === 0) return match;

        let updatedMatch = { ...match };
        let matchChanged = false;

        // Clear existing players if we have feeding matches (to avoid conflicts)
        if (feedingMatches.length > 0) {
          Object.assign(updatedMatch, {
            player1: undefined,
            player2: undefined,
            complete: false,
            winnerId: undefined,
            player1Points: 0,
            player2Points: 0
          });
          matchChanged = true;
        }

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
            return;
          }

          // Determine which slot to place the winner in
          if (!updatedMatch.player1) {
            updatedMatch.player1 = winner;
            matchChanged = true;
          } else if (!updatedMatch.player2) {
            updatedMatch.player2 = winner;
            matchChanged = true;
          }
        });

        if (matchChanged) {
          hasUpdates = true;
          return updatedMatch;
        }

        return match;
      });

      // Clean up and validate the bracket before updating
      const cleanedBracket = cleanupAndValidateBracket(updatedBracket);

      // Only update if there were changes
      if (hasUpdates) {
        await updateTournament(cleanedBracket);
        return cleanedBracket;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error in autoAdvanceKnockoutRound:', error);
      return null;
    }
  };  
  
  const handleUpdateMatch = useCallback(async (matchId: string, winnerId: string, player1Points: number, player2Points: number): Promise<void> => {
    if (!tournament?.bracket || !matchId || !id || typeof id !== 'string') {
      console.error('Invalid parameters for match update');
      return;
    }

    // Find the match being updated
    const matchToUpdate = tournament.bracket.find(m => m?.id === matchId);
    if (!matchToUpdate) {
      console.error('Match not found for ID:', matchId);
      return;
    }

    // Check if match can be updated
    if (!canUpdateMatch(matchToUpdate)) {
      alert('Cannot update this match because future matches have already been completed with players from this match.');
      return;
    }

    try {
      // Check if this is a knockout match and if the winner is changing
      const oldWinnerId = matchToUpdate.winnerId;
      const isWinnerChanging = matchToUpdate.stage === 'knockout' && oldWinnerId && oldWinnerId !== winnerId;
      
      const updatedBracket = tournament.bracket.map((m: Match) =>
        m?.id === matchId ? {
          ...m,
          player1Points,
          player2Points,
          winnerId,
          complete: true,
        } : m
      ).filter(Boolean);

      // Clean up and validate the bracket before updating
      const cleanedBracket = cleanupAndValidateBracket(updatedBracket);

      // Update the database first
      await updateTournament(cleanedBracket);
      
      // For knockout matches, handle winner changes and advancement
      if (matchToUpdate.stage === 'knockout') {
        console.log('Processing knockout match update');
        let finalBracket = cleanedBracket;
        
        // If winner is changing, update future matches first
        if (isWinnerChanging) {
          console.log('Winner is changing, updating future matches...');
          finalBracket = await updateFutureMatchesForWinnerChange(matchId, winnerId, oldWinnerId, cleanedBracket);
          console.log('Future matches updated, final bracket length:', finalBracket.length);
        } else {
          console.log('No winner change detected');
        }
        
        // Create a temporary tournament object with the updated bracket
        const tempTournament: Tournament = {
          ...tournament,
          bracket: finalBracket
        };
        
        // Call auto-advancement with the fresh data
        console.log('Calling auto-advancement...');
        const advancementResult = await autoAdvanceKnockoutRound(tempTournament);
        console.log('Auto-advancement result:', advancementResult ? 'Updated bracket returned' : 'No changes');
        
        // Update local state with the final bracket (use advancement result if available)
        const finalStateBracket = advancementResult || finalBracket;
        console.log('Final state bracket length:', finalStateBracket?.length);
        
        // Force a state update by creating a new tournament object
        setTournament(prev => {
          if (!prev) return null;
          const newTournament = { ...prev, bracket: finalStateBracket };
          console.log('Setting new tournament state, bracket length:', newTournament.bracket?.length);
          return newTournament;
        });
      } else {
        // Update local state for non-knockout matches
        setTournament(prev => prev ? { ...prev, bracket: cleanedBracket } : null);
      }
      
    } catch (error) {
      console.error('Error updating match:', error);
    }
  }, [tournament?.bracket, id, canUpdateMatch, updateTournament]);

  const renderGroupStage = useMemo(() => {
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                  {groupId.replace('-', ' ').toUpperCase()}
                </Typography>
                {!knockoutStarted && !tournament.complete && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleAddPlayerToGroup(groupId)}
                  >
                    Add Player
                  </Button>
                )}
              </Box>
              
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
  }, [getGroupStageMatches, getGroupStandings, hasKnockoutStarted, handleUpdateMatch, canUpdateMatch, handleAddPlayerToGroup, tournament]);
  
  const renderKnockoutStage = useMemo(() => {
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
  }, [getKnockoutMatches, getQualifiedKnockoutPlayers, tournament?.complete, handleUpdateMatch, canUpdateMatch, tournament?.bracket]);

  if (!id || typeof id !== 'string') {
    return null;
  }

  if (loading) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
    );
  }

  if (!tournament) {
    return (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" color="error">
            Tournament not found
          </Typography>
        </Paper>
    );
  }

  return (
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
        {tournament.complete && (() => {
          const rankings = tournament.finalRankings || calculateTournamentRankings();
          // Sort by tournament position (rank) - 1st, 2nd, 3rd, etc.
          const sortedRankings = [...rankings].sort((a: any, b: any) => {
            return a.rank - b.rank;
          });
          
          // Seed adjustment values for display (matching calculation logic)
          const seedAdjustments: { [rank: number]: number } = {
            1: -5, 2: -2, 3: 0, 4: +2, 5: +4, 6: +6, 7: +8
          };
          const getAdjustmentForDisplay = (rank: number): number => {
            if (seedAdjustments[rank] !== undefined) {
              return seedAdjustments[rank];
            }
            return 8 + (rank - 7) * 2;
          };
          
          // Base seed assignment for players without seeds
          const getBaseSeedForRankDisplay = (rank: number): number => {
            const baseSeeds: { [rank: number]: number } = {
              1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 10, 7: 12
            };
            if (baseSeeds[rank] !== undefined) {
              return baseSeeds[rank];
            }
            return 12 + (rank - 7) * 2;
          };
          
          return (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Final Rankings
              </Typography>
                {sortedRankings.map((ranking: any, index: number) => {
                  const oldSeed = ranking.player.seed ?? null;
                  const tournamentRank = ranking.rank; // Tournament performance rank (1st, 2nd, 3rd, etc.)
                  const adjustedSeed = ranking.adjustedSeed ?? (oldSeed !== null ? oldSeed + getAdjustmentForDisplay(tournamentRank) : getBaseSeedForRankDisplay(tournamentRank));
                  // Only show adjustment if player had an existing seed
                  const adjustment = oldSeed !== null ? getAdjustmentForDisplay(tournamentRank) : null;
                  
                  return (
                    <Box 
                      key={ranking.player.id} 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        py: 1,
                        borderBottom: index < sortedRankings.length - 1 ? '1px solid #eee' : 'none'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ minWidth: '50px' }}>
                          #{index + 1}
                        </Typography>
                        <Typography variant="body1">
                          {ranking.player.name}
                        </Typography>
                        {tournamentRank === 1 && <Chip label="Champion" color="primary" size="small" />}
                        {tournamentRank === 2 && <Chip label="Runner-up" color="secondary" size="small" />}
                        {tournamentRank === 3 && <Chip label="3rd Place" color="default" size="small" />}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {oldSeed !== null && (
                          <>
                            <Typography variant="body2" color="textSecondary">
                              Seed: {oldSeed}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              →
                            </Typography>
                          </>
                        )}
                        <Typography variant="body2" color="textSecondary">
                          {adjustedSeed}
                        </Typography>
                        {adjustment !== null && adjustment !== 0 && (
                          <Chip 
                            label={`${adjustment > 0 ? '+' : ''}${adjustment}`}
                            size="small"
                            color={(adjustment as number) < 0 ? 'success' : 'error'}
                            sx={{ minWidth: '50px' }}
                          />
                        )}
                        {oldSeed === null && (
                          <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                            (assigned)
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
            </CardContent>
          </Card>
          );
        })()}

        <Grid container spacing={4}>
          {/* Group Stage Section */}
          <Grid item xs={12} lg={6}>
            {renderGroupStage}
          </Grid>

          {/* Knockout Stage Section */}
          <Grid item xs={12} lg={6}>
            {renderKnockoutStage}
          </Grid>
        </Grid>
      </Paper>
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