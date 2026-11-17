import React from 'react';
import { X } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700">
      <span className="font-medium">{message}</span>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-700 transition-colors p-0.5 ml-2"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
