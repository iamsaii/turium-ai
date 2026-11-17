import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ItemCard } from './ItemCard.js';
import type { Item } from '../types.js';

interface ItemListProps {
  items: Item[];
  onDelete: (id: number) => Promise<void>;
  refreshItems: () => Promise<void>;
}

export const ItemList: React.FC<ItemListProps> = ({ items, onDelete, refreshItems }) => {
  const [filterText, setFilterText] = useState('');
  const pollCountRef = useRef(0);

  // Poll every 3s if any item is 'processing', capped at 30 iterations (90s)
  useEffect(() => {
    const hasProcessing = items.some((item) => item.status === 'processing');

    if (!hasProcessing) {
      pollCountRef.current = 0;
      return;
    }

    if (pollCountRef.current >= 30) {
      return;
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

  const filteredItems = items.filter((item) => {
    const q = filterText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.sourceUrl && item.sourceUrl.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-900">
          Saved items ({items.length})
        </h2>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by title or domain..."
            className="w-full text-xs rounded border border-zinc-200 pl-8 pr-2.5 py-1.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 bg-white"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-zinc-200 bg-white rounded-lg p-6 text-center text-xs text-zinc-500">
          No items saved yet. Use the form above to add notes or links.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="border border-zinc-200 bg-white rounded-lg p-4 text-center text-xs text-zinc-500">
          No items match "{filterText}".
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
};
