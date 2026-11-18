import React, { useState } from 'react';
import { validateCredentials, setStoredAuth } from '../lib/auth.js';

export interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('Please enter both username and password.');
      return;
    }

    if (validateCredentials(trimmedUsername, password)) {
      setStoredAuth(true);
      onLoginSuccess();
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center px-4 py-12 font-sans text-zinc-900 selection:bg-zinc-200">
      <div className="w-full max-w-sm bg-white rounded-lg border border-zinc-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono text-xs font-semibold tracking-wider mb-3">
            KI
          </div>
          <h1 className="text-base font-semibold text-zinc-900">
            Knowledge Inbox
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Sign in to continue to your library
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-[11px] font-medium text-zinc-600 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="username"
              autoFocus
              placeholder="Enter username"
              className="w-full text-xs rounded border border-zinc-300 px-2.5 py-1.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-medium text-zinc-600 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="current-password"
              placeholder="Enter password"
              className="w-full text-xs rounded border border-zinc-300 px-2.5 py-1.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center px-3 py-2 rounded text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 outline-none"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
