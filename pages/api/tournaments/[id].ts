import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  if (req.method === 'GET') {
    try {
      const tournamentRef = doc(db, 'tournaments', id);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      const tournamentData = {
        id: tournamentSnap.id,
        ...tournamentSnap.data()
      };
      
      res.status(200).json({ success: true, tournament: tournamentData });
    } catch (error: any) {
      console.error('Error fetching tournament:', error);
      res.status(500).json({ error: 'Failed to fetch tournament' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { bracket } = req.body;
      
      if (!bracket) {
        return res.status(400).json({ error: 'Bracket data is required' });
      }
      
      const tournamentRef = doc(db, 'tournaments', id);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      // Update the tournament with new bracket data
      await updateDoc(tournamentRef, {
        bracket: bracket,
        updatedAt: new Date().toISOString()
      });
      
      res.status(200).json({ success: true, message: 'Tournament updated successfully' });
    } catch (error: any) {
      console.error('Error updating tournament:', error);
      res.status(500).json({ error: 'Failed to update tournament' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
