// Utility functions for safely storing user data in localStorage
// This prevents QuotaExceededError by not storing large base64 images

const MAX_STORAGE_SIZE = 100000; // 100KB - safe limit for localStorage

/**
 * Safely store user data in localStorage
 * Removes large avatar_url to prevent quota exceeded errors
 */
export function saveUserToStorage(user) {
  if (!user) return;
  
  try {
    // Create a copy without large avatar_url
    const userToStore = { ...user };
    
    // If avatar_url is too large (base64 image), remove it from storage
    // The avatar will be fetched from server when needed
    if (userToStore.avatar_url && userToStore.avatar_url.length > MAX_STORAGE_SIZE) {
      delete userToStore.avatar_url;
      // Store a flag that avatar exists but is too large
      userToStore.has_avatar = true;
    }
    
    const userJson = JSON.stringify(userToStore);
    
    // Check if the data is still too large
    if (userJson.length > MAX_STORAGE_SIZE) {
      console.warn('User data is too large for localStorage, storing minimal data');
      // Store only essential fields
      const minimalUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        has_avatar: userToStore.has_avatar || !!user.avatar_url
      };
      localStorage.setItem('user', JSON.stringify(minimalUser));
    } else {
      localStorage.setItem('user', userJson);
    }
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Storing minimal user data.');
      // Store only essential fields
      const minimalUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        has_avatar: !!user.avatar_url
      };
      try {
        localStorage.setItem('user', JSON.stringify(minimalUser));
      } catch (e) {
        console.error('Failed to store even minimal user data:', e);
        // Clear old data and try again
        localStorage.removeItem('user');
        localStorage.setItem('user', JSON.stringify(minimalUser));
      }
    } else {
      console.error('Error saving user to storage:', error);
      throw error;
    }
  }
}

/**
 * Get user data from localStorage
 */
export function getUserFromStorage() {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error reading user from storage:', error);
    return null;
  }
}

/**
 * Remove user data from localStorage
 */
export function removeUserFromStorage() {
  try {
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error removing user from storage:', error);
  }
}

