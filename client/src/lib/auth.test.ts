import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateCredentials,
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  AUTH_STORAGE_KEY,
} from './auth.js';

// Polyfill localStorage for node-based test environments where window/DOM is not present
if (typeof localStorage === 'undefined' || !localStorage.clear) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

describe('auth utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('validates correct hardcoded credentials', () => {
    expect(validateCredentials('turium', 'afd09c24')).toBe(true);
  });

  it('rejects incorrect credentials', () => {
    expect(validateCredentials('turium', 'wrongpass')).toBe(false);
    expect(validateCredentials('wronguser', 'afd09c24')).toBe(false);
    expect(validateCredentials('', '')).toBe(false);
    expect(validateCredentials('Turium', 'afd09c24')).toBe(false);
    expect(validateCredentials('turium', 'Afd09c24')).toBe(false);
    expect(validateCredentials(' turium ', 'afd09c24')).toBe(false);
    expect(validateCredentials('turium', 'afd09c24 ')).toBe(false);
  });

  it('handles stored auth state in localStorage', () => {
    expect(getStoredAuth()).toBe(false);
    setStoredAuth(true);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('true');
    expect(getStoredAuth()).toBe(true);

    clearStoredAuth();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(getStoredAuth()).toBe(false);
  });

  it('handles setStoredAuth(false) by removing the storage entry', () => {
    setStoredAuth(true);
    expect(getStoredAuth()).toBe(true);

    setStoredAuth(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(getStoredAuth()).toBe(false);
  });

  it('returns false when localStorage has invalid or non-true values', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'false');
    expect(getStoredAuth()).toBe(false);

    localStorage.setItem(AUTH_STORAGE_KEY, 'random_string');
    expect(getStoredAuth()).toBe(false);

    localStorage.setItem(AUTH_STORAGE_KEY, '');
    expect(getStoredAuth()).toBe(false);
  });

  it('handles localStorage errors gracefully without throwing', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });

    expect(() => getStoredAuth()).not.toThrow();
    expect(getStoredAuth()).toBe(false);

    expect(() => setStoredAuth(true)).not.toThrow();
    expect(() => setStoredAuth(false)).not.toThrow();
    expect(() => clearStoredAuth()).not.toThrow();
  });
});
