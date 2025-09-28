import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../utils/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const snapshot = await getDocs(collection(db, 'tournaments'));
      const tournaments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.status(200).json({ success: true, tournaments });
    } catch (error: any) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, players, bracket, createdBy } = req.body;
      
      if (!name || !players || !bracket) {
        return res.status(400).json({ error: 'Name, players, and bracket are required' });
      }
      
      const tournamentData = {
        name,
        players,
        bracket,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || null
      };
      
      const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
      
      res.status(201).json({ 
        success: true, 
        tournament: { id: docRef.id, ...tournamentData }
      });
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      res.status(500).json({ error: 'Failed to create tournament' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
