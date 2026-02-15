type Player = {
  id: string;
  name: string;
  officeDays: string[];
  seed?: number;
};

type Match = {
  player1: Player;
  player2?: Player; // optional for bye
  round: number;
  stage: 'group' | 'knockout'; // Added stage identifier
  groupId?: string; // For group stage matches
  player1GroupId?: string;
  player2GroupId?: string;
  player1GroupPlace?: 1 | 2;
  player2GroupPlace?: 1 | 2;
};

export type QualifiedWithGroupInfo = { player: Player; groupId: string; place: 1 | 2 };

type Group = {
  id: string;
  players: Player[];
  officeDays: string[];
};

type Bracket = Match[];

function getOfficeDayOverlap(a: Player, b: Player): number {
  return a.officeDays.filter(day => b.officeDays.includes(day)).length;
}

function getPlayerRank(player: Player, totalPlayers: number): number {
  // If player has a seed, use it. Otherwise, assign them to the bottom half
  return player.seed || (totalPlayers + 1);
}

function getCommonOfficeDays(players: Player[]): string[] {
  if (players.length === 0) return [];
  
  const firstPlayerDays = players[0].officeDays;
  return firstPlayerDays.filter(day => 
    players.every(player => player.officeDays.includes(day))
  );
}

function createGroups(players: Player[]): Group[] {
  const groups: Group[] = [];
  const remainingPlayers = [...players];
  let groupCounter = 1;

  // Sort players by rank for better distribution
  remainingPlayers.sort((a, b) => {
    const aRank = getPlayerRank(a, players.length);
    const bRank = getPlayerRank(b, players.length);
    return aRank - bRank;
  });

  while (remainingPlayers.length >= 4) {
    const currentGroup: Player[] = [];
    
    // Take the first player (highest ranked remaining)
    const firstPlayer = remainingPlayers.shift()!;
    currentGroup.push(firstPlayer);

    // Find up to 3 more players with maximum office day overlap
    for (let i = 0; i < 3 && remainingPlayers.length > 0; i++) {
      let bestMatchIndex = 0;
      let bestOverlap = 0;

      // Find player with best office day overlap with the group
      for (let j = 0; j < remainingPlayers.length; j++) {
        const candidate = remainingPlayers[j];
        
        // Calculate overlap with all players in current group
        let totalOverlap = 0;
        currentGroup.forEach(groupPlayer => {
          totalOverlap += getOfficeDayOverlap(candidate, groupPlayer);
        });
        
        // Prefer players with better overlap, but also consider rank balance
        const avgOverlap = totalOverlap / currentGroup.length;
        
        if (avgOverlap > bestOverlap || 
           (avgOverlap === bestOverlap && j < bestMatchIndex)) {
          bestOverlap = avgOverlap;
          bestMatchIndex = j;
        }
      }

      // Add the best matching player to the group
      currentGroup.push(remainingPlayers.splice(bestMatchIndex, 1)[0]);
    }

    // Determine the group's office days (common days if any, otherwise most frequent)
    const commonDays = getCommonOfficeDays(currentGroup);
    let groupOfficeDays: string[] = [];
    
    if (commonDays.length > 0) {
      groupOfficeDays = commonDays;
    } else {
      // Find most frequent office days across the group
      const dayCount: { [day: string]: number } = {};
      currentGroup.forEach(player => {
        player.officeDays.forEach(day => {
          dayCount[day] = (dayCount[day] || 0) + 1;
        });
      });
      
      groupOfficeDays = Object.entries(dayCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3) // Take top 3 most common days
        .map(([day]) => day);
    }

    groups.push({
      id: `group-${groupCounter++}`,
      players: currentGroup,
      officeDays: groupOfficeDays
    });
  }

  // Handle remaining players (less than 4)
  if (remainingPlayers.length > 0) {
    if (remainingPlayers.length >= 2) {
      // Create a smaller group
      const commonDays = getCommonOfficeDays(remainingPlayers);
      let groupOfficeDays: string[] = [];
      
      if (commonDays.length > 0) {
        groupOfficeDays = commonDays;
      } else {
        // Find most frequent office days
        const dayCount: { [day: string]: number } = {};
        remainingPlayers.forEach(player => {
          player.officeDays.forEach(day => {
            dayCount[day] = (dayCount[day] || 0) + 1;
          });
        });
        
        groupOfficeDays = Object.entries(dayCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([day]) => day);
      }

      groups.push({
        id: `group-${groupCounter++}`,
        players: remainingPlayers,
        officeDays: groupOfficeDays
      });
    } else {
      // Single remaining player - add to the smallest existing group
      if (groups.length > 0) {
        const smallestGroup = groups.reduce((min, group) => 
          group.players.length < min.players.length ? group : min
        );
        smallestGroup.players.push(...remainingPlayers);
      }
    }
  }

  return groups;
}

function generateGroupStageMatches(groups: Group[]): Match[] {
  const matches: Match[] = [];
  
  groups.forEach(group => {
    const players = group.players;
    
    if (players.length === 4) {
      // Full round-robin for 4 players = 6 matches total
      const matchPairs = [
        [0, 1], // Player 1 vs Player 2
        [0, 2], // Player 1 vs Player 3
        [0, 3], // Player 1 vs Player 4
        [1, 2], // Player 2 vs Player 3
        [1, 3], // Player 2 vs Player 4
        [2, 3], // Player 3 vs Player 4
      ];
      
      matchPairs.forEach(([i, j]) => {
        if (i < players.length && j < players.length) {
          matches.push({
            player1: players[i],
            player2: players[j],
            round: 1,
            stage: 'group',
            groupId: group.id
          });
        }
      });
    } else {
      // For groups with fewer than 4 players, create all possible matches
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          matches.push({
            player1: players[i],
            player2: players[j],
            round: 1,
            stage: 'group',
            groupId: group.id
          });
        }
      }
    }
  });

  return matches;
}

// Only generates initial group stage - knockout matches are created dynamically
export function generateOptimalTournament(players: Player[]): Bracket {
  if (players.length < 2) {
    return [];
  }

  // Create groups based on office days and experience distribution
  const groups = createGroups(players);
  
  // Generate only group stage matches
  const groupStageMatches = generateGroupStageMatches(groups);
  
  return groupStageMatches;
}

// World Cup style: 1st of group i vs 2nd of group (i+1)%N. No same-group matches. Office-day sort for ordering.
export function generateKnockoutFirstRoundWorldCup(
  qualified: QualifiedWithGroupInfo[],
  roundNumber: number
): Match[] {
  if (qualified.length === 0) return [];
  if (qualified.length === 1) {
    const q = qualified[0];
    return [{
      player1: q.player,
      round: roundNumber,
      stage: 'knockout',
      player1GroupId: q.groupId,
      player1GroupPlace: 1
    }];
  }

  const byGroup: Record<string, { first?: Player; second?: Player }> = {};
  for (const q of qualified) {
    if (!byGroup[q.groupId]) byGroup[q.groupId] = {};
    if (q.place === 1) byGroup[q.groupId].first = q.player;
    else byGroup[q.groupId].second = q.player;
  }
  const groupIds = Object.keys(byGroup).sort();
  const fullGroupIds = groupIds.filter(gid => {
    const g = byGroup[gid];
    return g.first != null && g.second != null;
  });

  let byePlayer: QualifiedWithGroupInfo | null = null;
  if (qualified.length % 2 === 1) {
    const singleGroupId = groupIds.find(gid => {
      const g = byGroup[gid];
      return ((g.first != null ? 1 : 0) + (g.second != null ? 1 : 0)) === 1;
    });
    if (singleGroupId != null) {
      const g = byGroup[singleGroupId];
      const p = g.first ?? g.second!;
      byePlayer = { player: p, groupId: singleGroupId, place: g.first ? 1 : 2 };
    }
  }

  const matches: Match[] = [];

  if (fullGroupIds.length === 1) {
    const gid = fullGroupIds[0];
    const g = byGroup[gid];
    matches.push({
      player1: g.first!,
      player2: g.second!,
      round: roundNumber,
      stage: 'knockout',
      player1GroupId: gid,
      player2GroupId: gid,
      player1GroupPlace: 1,
      player2GroupPlace: 2
    });
  } else if (fullGroupIds.length > 1) {
    for (let i = 0; i < fullGroupIds.length; i++) {
      const gidA = fullGroupIds[i];
      const gidB = fullGroupIds[(i + 1) % fullGroupIds.length];
      const firstA = byGroup[gidA].first!;
      const secondB = byGroup[gidB].second!;
      matches.push({
        player1: firstA,
        player2: secondB,
        round: roundNumber,
        stage: 'knockout',
        player1GroupId: gidA,
        player2GroupId: gidB,
        player1GroupPlace: 1,
        player2GroupPlace: 2
      });
    }
  } else if (qualified.length >= 2) {
    // No full groups (e.g. each group has only 1 qualifier) – pair in order
    for (let i = 0; i < qualified.length; i += 2) {
      if (i + 1 < qualified.length) {
        const a = qualified[i];
        const b = qualified[i + 1];
        matches.push({
          player1: a.player,
          player2: b.player,
          round: roundNumber,
          stage: 'knockout',
          player1GroupId: a.groupId,
          player2GroupId: b.groupId,
          player1GroupPlace: a.place,
          player2GroupPlace: b.place
        });
      } else {
        matches.push({
          player1: qualified[i].player,
          round: roundNumber,
          stage: 'knockout',
          player1GroupId: qualified[i].groupId,
          player1GroupPlace: qualified[i].place
        });
      }
    }
  }

  if (byePlayer) {
    matches.push({
      player1: byePlayer.player,
      round: roundNumber,
      stage: 'knockout',
      player1GroupId: byePlayer.groupId,
      player1GroupPlace: byePlayer.place
    });
  }

  // Sort by office day overlap (higher first); bye matches last
  matches.sort((a, b) => {
    if (!a.player2) return 1;
    if (!b.player2) return -1;
    const overlapA = getOfficeDayOverlap(a.player1, a.player2);
    const overlapB = getOfficeDayOverlap(b.player1, b.player2);
    return overlapB - overlapA;
  });

  return matches;
}

// Simple knockout pairing function - pairs players optimally for knockout stage (fallback when no group structure)
export function generateKnockoutPairs(players: Player[], roundNumber: number): Match[] {
  if (players.length <= 1) return [];

  const matches: Match[] = [];
  const playersByOfficeDays: { [key: string]: Player[] } = {};
  
  // Group players by their office days for optimal pairing
  players.forEach(player => {
    const key = player.officeDays.sort().join(',');
    if (!playersByOfficeDays[key]) {
      playersByOfficeDays[key] = [];
    }
    playersByOfficeDays[key].push(player);
  });

  let remainingPlayers: Player[] = [];

  // Create matches within same office day groups first
  Object.values(playersByOfficeDays).forEach(playersGroup => {
    const sorted = [...playersGroup].sort((a, b) => {
      const aRank = getPlayerRank(a, players.length);
      const bRank = getPlayerRank(b, players.length);
      return aRank - bRank;
    });
    
    for (let i = 0; i < sorted.length; i += 2) {
      if (i + 1 < sorted.length) {
        matches.push({
          player1: sorted[i],
          player2: sorted[i + 1],
          round: roundNumber,
          stage: 'knockout'
        });
      } else {
        remainingPlayers.push(sorted[i]);
      }
    }
  });

  // Handle remaining players (byes or cross-office-day matches)
  for (let i = 0; i < remainingPlayers.length; i += 2) {
    if (i + 1 < remainingPlayers.length) {
      matches.push({
        player1: remainingPlayers[i],
        player2: remainingPlayers[i + 1],
        round: roundNumber,
        stage: 'knockout'
      });
    } else {
      // Bye
      matches.push({
        player1: remainingPlayers[i],
        round: roundNumber,
        stage: 'knockout'
      });
    }
  }

  return matches;
}