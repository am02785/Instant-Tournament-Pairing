import { NextApiRequest, NextApiResponse } from 'next';
import { userSessions } from './status';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // For now, we'll implement a simple authentication system
    // In production, you'd want to use Firebase Admin SDK or another secure method
    
    // Simple validation (replace with proper authentication)
    // For testing, accept any email/password combination
    if (email && password && password.length >= 6) {
      // Create a session
      const sessionId = uuidv4();
      const userData = {
        uid: `user-${Date.now()}`,
        email: email,
        displayName: email.split('@')[0], // Use email prefix as display name
        emailVerified: true
      };
      
      // Store user session
      userSessions.set(sessionId, userData);
      console.log('Session created:', { sessionId, userData, totalSessions: userSessions.size });
      
      // Set session cookie
      res.setHeader('Set-Cookie', `userSession=${sessionId}; Path=/; HttpOnly; Max-Age=86400`); // 24 hours
      console.log('Cookie set:', `userSession=${sessionId}`);
      
      res.status(200).json({ 
        success: true, 
        user: userData,
        sessionId: sessionId
      });
    } else {
      res.status(400).json({ 
        error: 'Invalid email or password' 
      });
    }
  } catch (error: any) {
    console.error('Sign in error:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to sign in' 
    });
  }
}
