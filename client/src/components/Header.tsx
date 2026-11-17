import React from 'react';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  totalItems: number;
  readyItems: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalItems,
  readyItems,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono text-xs font-semibold tracking-wider">
            KI
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 leading-none">
              Knowledge Inbox
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Personal reference library &amp; verified search
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-zinc-600">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-100 text-zinc-700 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{readyItems} ready</span>
            <span className="text-zinc-400">/</span>
            <span>{totalItems} total</span>
          </span>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
