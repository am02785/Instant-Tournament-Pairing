// pages/signout.tsx
import { useEffect } from 'react';
import { auth } from '../utils/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/router';

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    signOut(auth).then(() => {
      router.push('/login');
    });
  }, [router]);

  return <div>Signing you out...</div>;
}