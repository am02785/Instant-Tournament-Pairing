import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase'; // adjust path as needed
import { Player, Match } from 'types';
import { generateOptimalTournament } from './pairingLogic';

// Helper to generate dummy players
function generateDummyPlayers(count: number): Player[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  
  return Array.from({ length: count }, (_, i) => {
    // Randomly decide if player gets a seed (about 40% chance)
    const hasSeeding = Math.random() < 0.4;
    
    // If seeded, assign seeds 1-8 randomly, otherwise undefined
    const seed = hasSeeding ? Math.floor(Math.random() * 8) + 1 : undefined;
    
    // Assign office days with some variety
    const numDays = Math.floor(Math.random() * 3) + 1; // 1-3 days
    const shuffledDays = [...days].sort(() => Math.random() - 0.5);
    const officeDays = shuffledDays.slice(0, numDays);
    
    const player: any = {
      id: `player-${i + 1}`,
      name: `Player ${i + 1}`,
      officeDays,
    };
    
    // Only add seed if it exists (avoid undefined)
    if (seed !== undefined) {
      player.seed = seed;
    }
    
    return player;
  });
}

// Function to clean object of undefined values
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

export async function seedDatabase() {
  const players = generateDummyPlayers(15);
  const fullBracket = generateOptimalTournament(players);

  // Only store first round initially (group stage)
  const firstRoundOnly: Match[] = fullBracket
    .filter(m => m.round === 1)
    .map(m => {
      const isBye = !m.player2;
      
      const match: any = {
        id: crypto.randomUUID(),
        player1: cleanObject(m.player1),
        round: m.round,
        stage: m.stage || 'group',
        complete: isBye,
        player1Points: isBye ? 1 : 0,
        player2Points: 0,
      };
      
      // Only add fields if they exist
      if (m.player2) {
        match.player2 = cleanObject(m.player2);
      }
      
      if (m.groupId) {
        match.groupId = m.groupId;
      }
      
      if (isBye) {
        match.winnerId = m.player1.id;
      }
      
      return match;
    });

  const tournamentData = {
    name: 'Seeded Tournament',
    players: players.map(p => cleanObject(p)),
    bracket: firstRoundOnly,
    createdAt: new Date().toISOString(),
  };

  await addDoc(collection(db, 'tournaments'), tournamentData);
}