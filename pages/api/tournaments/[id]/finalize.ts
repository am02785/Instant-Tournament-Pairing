import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../utils/firebase';
import { doc, getDoc, updateDoc, collection, query, getDocs, writeBatch } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rankings } = req.body;
    
    if (!rankings || !Array.isArray(rankings)) {
      return res.status(400).json({ error: 'Rankings data is required' });
    }

    // Get all existing players to understand the current seeding landscape
    const playersQuery = query(collection(db, 'players'));
    const playersSnapshot = await getDocs(playersQuery);
    const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // Separate tournament players from non-tournament players
    const tournamentPlayerIds = new Set(rankings.map((r: any) => r.player.id));
    const nonTournamentPlayers = allPlayers.filter((p: any) => !tournamentPlayerIds.has(p.id));
    const tournamentPlayers = allPlayers.filter((p: any) => tournamentPlayerIds.has(p.id));
    
    // Create a new global ranking system
    const newGlobalRankings: Array<{ id: string; seed: number; fromTournament: boolean }> = [];
    
    // Add tournament results in order of their performance
    rankings.forEach((ranking: any, index: number) => {
      newGlobalRankings.push({
        id: ranking.player.id,
        seed: index + 1,
        fromTournament: true
      });
    });
    
    // Add non-tournament players, maintaining their relative order but placing them after tournament players
    let currentRank = rankings.length + 1;
    nonTournamentPlayers
      .sort((a: any, b: any) => (a.seed || 999) - (b.seed || 999))
      .forEach((player: any) => {
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
        const oldSeed = currentData?.seed;
        
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
    
    // Commit the batch
    await batch.commit();
    
    res.status(200).json({ 
      success: true, 
      message: `Tournament finalized successfully. Updated ${updatedCount} player seeds.`,
      updatedCount 
    });
  } catch (error: any) {
    console.error('Error finalizing tournament:', error);
    res.status(500).json({ error: 'Failed to finalize tournament' });
  }
}