import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, Inbox } from 'lucide-react';
import { ItemCard } from './ItemCard.js';
import type { Item } from '../types.js';

interface ItemListProps {
  items: Item[];
  onDelete: (id: number) => Promise<void>;
  refreshItems: () => Promise<void>;
}

export const ItemList: React.FC<ItemListProps> = ({ items, onDelete, refreshItems }) => {
  const [filterText, setFilterText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollCountRef = useRef(0);

  // Polling lifecycle: Poll every 3 seconds if any item is 'processing', capped at 30 iterations (90s)
  useEffect(() => {
    const hasProcessing = items.some((item) => item.status === 'processing');

    if (!hasProcessing) {
      pollCountRef.current = 0;
      return;
    }

    if (pollCountRef.current >= 30) {
      return; // Cap reached
    }

    const interval = setInterval(() => {
      pollCountRef.current += 1;
      refreshItems();
      if (pollCountRef.current >= 30) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [items, refreshItems]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshItems();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = filterText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.sourceUrl && item.sourceUrl.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Saved Items ({items.length})
        </h2>

        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors p-1"
          title="Refresh items list"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search saved items by title or URL..."
            className="w-full text-xs rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
            <Inbox className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-medium text-gray-900">Your inbox is empty</h3>
          <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto">
            Save a plain note or a web link using the form above to start building your knowledge base.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-xs text-gray-500">
          No items match "{filterText}".
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
};
