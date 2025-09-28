import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../utils/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const snapshot = await getDocs(collection(db, 'players'));
      const players = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.status(200).json({ success: true, players });
    } catch (error: any) {
      console.error('Error fetching players:', error);
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, officeDays, seed } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const playerData = {
        name,
        officeDays: officeDays || [],
        seed: seed || null,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'players'), playerData);
      
      res.status(201).json({ 
        success: true, 
        player: { id: docRef.id, ...playerData }
      });
    } catch (error: any) {
      console.error('Error creating player:', error);
      res.status(500).json({ error: 'Failed to create player' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
