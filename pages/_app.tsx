import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { getAuthStatus, User } from '../utils/auth';
import Layout from '../components/Layout';

const darkTheme = createTheme({
  palette: { mode: 'dark' },
});

const publicRoutes = ['/login', '/signup'];
const isPublicRoute = (path: string) => publicRoutes.includes(path);

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [user, setUser] = useState<null | User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await getAuthStatus();
        setUser(authStatus.authenticated ? authStatus.user : null);
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (loading) return;

    const path = router.pathname;
    console.log('App redirect check:', { path, user: !!user, loading });

    // Don't redirect if we're on the signout page - let it handle its own redirect
    if (path === '/signout') {
      console.log('On signout page - skipping redirect logic');
      return;
    }

    if (user && isPublicRoute(path)) {
      // Logged-in user trying to access login/signup → redirect to home
      console.log('Redirecting logged-in user from public route to home');
      router.replace('/');
    }

    if (!user && !isPublicRoute(path)) {
      // Not logged in and trying to access a protected page → redirect to login
      console.log('Redirecting unauthenticated user to login');
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
      <Layout user={user}>
        <Component {...pageProps} user={user} />
      </Layout>
    </ThemeProvider>
  );
}

export default App;