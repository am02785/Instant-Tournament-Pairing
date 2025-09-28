import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Server-side Firebase configuration (not exposed to browser)
const getFirebaseConfig = () => {
  return {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
};

// Initialize Firebase only on server-side
let app: any = null;
let db: any = null;
let auth: any = null;

if (typeof window === 'undefined') {
  // Server-side initialization only
  const firebaseConfig = getFirebaseConfig();
  
  // Validate that all required environment variables are present
  const requiredVars = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  // Note: auth is not initialized server-side as it doesn't work in server context
}

export { db, auth };