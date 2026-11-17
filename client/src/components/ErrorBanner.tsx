import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between space-x-2 text-xs text-red-700 shadow-sm animate-fade-in">
      <div className="flex items-start space-x-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
        <span className="font-medium leading-relaxed">{message}</span>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-700 transition-colors p-0.5"
          title="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
