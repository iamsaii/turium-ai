import React from 'react';
import { Inbox, Sparkles } from 'lucide-react';

interface HeaderProps {
  totalItems: number;
  readyItems: number;
}

export const Header: React.FC<HeaderProps> = ({ totalItems, readyItems }) => {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                AI Knowledge Inbox
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                <Sparkles className="w-3 h-3 mr-1" />
                Gemini RAG
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Personal knowledge repository with dual-source citations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            <span className="font-semibold text-gray-900">{totalItems}</span> Total Saved
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700">
            <span className="font-semibold text-emerald-900">{readyItems}</span> Ready to Query
          </div>
        </div>
      </div>
    </header>
  );
};
