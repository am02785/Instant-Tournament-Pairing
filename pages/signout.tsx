// pages/signout.tsx
import { useEffect } from 'react';
import { signOut } from '../utils/auth';
import { useRouter } from 'next/router';

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        console.log('Starting signout process...');
        const result = await signOut();
        console.log('Signout result:', result);
        
        // Use hard redirect to ensure we get to login page
        setTimeout(() => {
          console.log('Redirecting to login...');
          window.location.href = '/login';
        }, 500);
      } catch (error) {
        console.error('Error signing out:', error);
        // Still redirect even if there's an error
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    };

    handleSignOut();
  }, []);

  return <div>Signing you out...</div>;
}