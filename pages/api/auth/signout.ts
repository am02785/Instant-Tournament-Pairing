import { NextApiRequest, NextApiResponse } from 'next';
import { userSessions } from './status';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session ID from cookie or header
    const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.userSession;
    
    console.log('Signout request:', { sessionId, totalSessions: userSessions.size });
    
    // Clear the session
    if (sessionId) {
      const deleted = userSessions.delete(sessionId);
      console.log('Session deleted:', deleted, 'Remaining sessions:', userSessions.size);
    }
    
    // Clear the session cookie
    res.setHeader('Set-Cookie', 'userSession=; Path=/; HttpOnly; Max-Age=0');
    console.log('Cookie cleared');
    
    res.status(200).json({ 
      success: true, 
      message: 'Successfully signed out' 
    });
  } catch (error: any) {
    console.error('Sign out error:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to sign out' 
    });
  }
}
