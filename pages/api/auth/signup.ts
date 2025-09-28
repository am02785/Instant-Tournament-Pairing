import { NextApiRequest, NextApiResponse } from 'next';
import { userSessions } from './status';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // For now, we'll implement a simple user creation system
    // In production, you'd want to use Firebase Admin SDK or another secure method
    
    // Simple user creation (replace with proper user management)
    const sessionId = uuidv4();
    const userData = {
      uid: `user-${Date.now()}`,
      email: email,
      displayName: displayName || 'User',
      emailVerified: true
    };
    
    // Store user session
    userSessions.set(sessionId, userData);
    
    // Set session cookie
    res.setHeader('Set-Cookie', `userSession=${sessionId}; Path=/; HttpOnly; Max-Age=86400`); // 24 hours
    
    res.status(201).json({ 
      success: true, 
      user: userData,
      sessionId: sessionId
    });
  } catch (error: any) {
    console.error('Sign up error:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to create account' 
    });
  }
}
