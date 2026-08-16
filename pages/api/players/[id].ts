import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid player ID' });
  }

  if (req.method === 'PUT') {
    try {
      const { officeDays } = req.body;

      if (!Array.isArray(officeDays) || officeDays.length === 0) {
        return res.status(400).json({ error: 'Select at least one office day' });
      }

      const invalidDay = officeDays.find((day: unknown) => typeof day !== 'string' || !VALID_DAYS.includes(day));
      if (invalidDay) {
        return res.status(400).json({ error: 'Office days must be Mon–Fri' });
      }

      const playerRef = doc(db, 'players', id);
      const playerSnap = await getDoc(playerRef);

      if (!playerSnap.exists()) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const uniqueDays = VALID_DAYS.filter((day) => officeDays.includes(day));
      await updateDoc(playerRef, { officeDays: uniqueDays });

      res.status(200).json({
        success: true,
        player: { id, ...playerSnap.data(), officeDays: uniqueDays },
      });
    } catch (error: any) {
      console.error('Error updating player:', error);
      res.status(500).json({ error: 'Failed to update player' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
