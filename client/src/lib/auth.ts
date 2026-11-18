export const AUTH_STORAGE_KEY = 'ki_authenticated';

/**
 * Validates provided credentials against hardcoded admin credentials.
 */
export function validateCredentials(username: string, password: string): boolean {
  return username === 'admin' && password === 'admin123';
}

/**
 * Retrieves the stored authentication state from localStorage.
 * Returns false if localStorage is unavailable or read throws.
 */
export function getStoredAuth(): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the authentication state in localStorage.
 * Removes the key when false to avoid truthy string traps.
 */
export function setStoredAuth(authenticated: boolean): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (authenticated) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Gracefully handle storage errors (quota exceeded, disabled storage, etc.)
  }
}

/**
 * Clears the stored authentication state from localStorage.
 */
export function clearStoredAuth(): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Gracefully handle storage errors
  }
}
