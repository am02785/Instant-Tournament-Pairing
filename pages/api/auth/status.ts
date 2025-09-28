import { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory session store (in production, use Redis or database)
const userSessions = new Map<string, any>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if there's a user session
    const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.userSession;
    
    console.log('Auth status check:', { sessionId, hasSession: sessionId ? userSessions.has(sessionId) : false, totalSessions: userSessions.size });
    
    if (sessionId && userSessions.has(sessionId)) {
      const user = userSessions.get(sessionId);
      console.log('User found:', user);
      res.status(200).json({ 
        authenticated: true,
        user: user
      });
    } else {
      console.log('No valid session found');
      res.status(200).json({ 
        authenticated: false,
        user: null
      });
    }
  } catch (error: any) {
    console.error('Auth status error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to check auth status' 
    });
  }
}

// Export the session store so other API routes can use it
export { userSessions };
