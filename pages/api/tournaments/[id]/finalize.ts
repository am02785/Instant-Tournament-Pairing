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

    // Create batch for database updates
    const batch = writeBatch(db);
    
    // Update tournament as complete
    const tournamentRef = doc(db, 'tournaments', id);
    batch.update(tournamentRef, { 
      complete: true,
      finalRankings: rankings
    });
    
    // Update seeds for tournament players only
    // Use adjustedSeed from rankings as the new seed (already calculated in calculateTournamentRankings)
    // Non-tournament players keep their existing seeds - we don't update them
    let updatedCount = 0;
    for (const ranking of rankings) {
      const playerRef = doc(db, 'players', ranking.player.id);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        const currentData = playerDoc.data();
        const oldSeed = currentData?.seed;
        // Use adjustedSeed as the new seed (this is the seed after adjustment)
        const newSeed = ranking.adjustedSeed ?? ranking.rank;
        
        if (oldSeed !== newSeed) {
          batch.update(playerRef, {
            ...currentData,
            seed: newSeed
          });
          updatedCount++;
        }
      }
    }
    
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