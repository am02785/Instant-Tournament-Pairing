import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import Layout from '../components/Layout';

const darkTheme = createTheme({
  palette: { mode: 'dark' },
});

const publicRoutes = ['/login', '/signup'];
const isPublicRoute = (path: string) => publicRoutes.includes(path);

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [user, setUser] = useState<null | {}>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const path = router.pathname;

    if (user && isPublicRoute(path)) {
      // Logged-in user trying to access login/signup → redirect to home
      router.replace('/');
    }

    if (!user && !isPublicRoute(path)) {
      // Not logged in and trying to access a protected page → redirect to login
      router.replace('/login');
    }

    if (user && path === '/404') {
      router.replace('/');
    }

    if (!user && path === '/404') {
      router.replace('/login');
    }
  }, [user, loading, router.pathname]);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading...</div>;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Layout>
          <Component {...pageProps} user={user} />
        </Layout>
    </ThemeProvider>
  );
}

export default App;