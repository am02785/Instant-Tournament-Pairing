// Client-side authentication utilities for server-side Firebase

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  message?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: User | null;
  error?: string;
}

// Sign in with email and password
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

// Sign out
export async function signOut(): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

// Check authentication status
export async function getAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      authenticated: false,
      user: null,
      error: 'Network error occurred'
    };
  }
}
