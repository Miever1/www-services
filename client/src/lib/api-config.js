// API Configuration
// Change this to switch between local development and production
// Default: backend on 8000 (Docker or teammate's local server)
// Frontend dev server runs on 8000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// For production, you can set VITE_API_URL in .env to:
// VITE_API_URL=https://loud-starling-77.deno.dev

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  endpoints: {
    tasks: '/tasks',
    task: (id) => `/tasks/${id}`,
    auth: {
      session: '/auth/session',
      login: '/auth/login',
      logout: '/auth/logout',
      register: '/auth/registration',
      sendCode: '/auth/send-code',
      verifyCode: '/auth/verify-code'
    },
    profile: '/profile'
  }
};

// Helper function to build full URL
export function apiUrl(path) {
  // Guard against undefined or null path
  if (!path || typeof path !== 'string') {
    console.error('apiUrl: Invalid path provided:', path);
    throw new Error(`Invalid API path: ${path}`);
  }
  
  // If path already starts with http, return as is
  if (path.startsWith('http')) {
    return path;
  }
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.baseURL}${cleanPath}`;
}

