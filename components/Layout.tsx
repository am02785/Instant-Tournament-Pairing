import { useRouter } from 'next/router';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Box,
  Typography,
} from '@mui/material';
import { ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

const drawerWidth = 240;

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user] = useAuthState(auth);

  const navItems = user
    ? [
        { label: 'Home', path: '/' },
        { label: 'Tournaments', path: '/tournaments' },
        { label: 'Create Tournament', path: '/create-tournament' },
        { label: 'Create Player', path: '/create-player' },
        { label: 'Sign Out', path: '/signout' },
      ]
    : [
        { label: 'Login', path: '/login' },
        { label: 'Sign Up', path: '/signup' },
      ];

  const handleNavigation = (path: string) => {
    if (router.pathname !== path) {
      router.push(path);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#0D47A1',
            color: 'white',
          },
        }}
      >
        <List>
          {navItems.map(({ label, path }) => (
            <ListItemButton
              key={path}
              onClick={() => handleNavigation(path)}
              selected={router.pathname === path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: '#1976D2',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: '#1565C0',
                },
                '&:hover': {
                  backgroundColor: '#1565C0',
                },
                color: 'white',
              }}
            >
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box 
        component="main" 
        sx={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'center', // centers horizontally
          alignItems: 'center',     // centers vertically
          p: 4,
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}