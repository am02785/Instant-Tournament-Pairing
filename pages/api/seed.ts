import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../utils/firebase';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';
import { generateOptimalTournament } from '../../utils/pairingLogic';

// Helper to generate dummy players
function generateDummyPlayers(count: number): any[] {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerCount = 15 } = req.body;
    
    // First, check if there are existing players in the database
    const playersQuery = query(collection(db, 'players'));
    const playersSnapshot = await getDocs(playersQuery);
    const existingPlayers = playersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
    
    let savedPlayers: any[] = [];
    
    // If we have enough existing players, use those
    if (existingPlayers.length >= playerCount) {
      // Use the first playerCount existing players
      savedPlayers = existingPlayers.slice(0, playerCount);
    } else {
      // Use all existing players
      savedPlayers = [...existingPlayers];
      
      // Calculate how many new players we need to create
      const playersNeeded = playerCount - existingPlayers.length;
      
      // Generate only the needed number of new players
      const newDummyPlayers = generateDummyPlayers(playersNeeded);
      
      // Create the new players
      const newPlayers = await Promise.all(
        newDummyPlayers.map(async (player) => {
          const playerData = {
            name: player.name,
            officeDays: player.officeDays,
            seed: player.seed || null,
            createdAt: new Date().toISOString()
          };
          
          const playerDocRef = await addDoc(collection(db, 'players'), playerData);
          
          // Return player with the Firestore ID
          return {
            id: playerDocRef.id,
            ...playerData
          };
        })
      );
      
      // Add the new players to the saved players list
      savedPlayers = [...savedPlayers, ...newPlayers];
    }
    
    const fullBracket = generateOptimalTournament(savedPlayers);

    // Only store first round initially (group stage)
    const firstRoundOnly = fullBracket
      .filter(m => m.round === 1)
      .map(m => {
        const isBye = !m.player2;
        
        const match: any = {
          id: `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      players: savedPlayers.map(p => cleanObject(p)),
      bracket: firstRoundOnly,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Database seeded successfully',
      tournamentId: docRef.id
    });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to seed database' 
    });
  }
}

