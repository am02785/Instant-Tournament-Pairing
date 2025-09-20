import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBY4l60IsFre9If0gqohMRkfddvg9yfn4Q',
  authDomain: 'instant-tournament-pairing.firebaseapp.com',
  projectId: 'instant-tournament-pairing',
  storageBucket: 'instant-tournament-pairing.firebasestorage.app',
  messagingSenderId: '169358417783',
  appId: '1:169358417783:web:2d60825e69c7c959fc0b72',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };