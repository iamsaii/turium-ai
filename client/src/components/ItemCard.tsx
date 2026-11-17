import React, { useState } from 'react';
import { ExternalLink, Trash2, Loader2 } from 'lucide-react';
import type { Item } from '../types.js';

interface ItemCardProps {
  item: Item;
  onDelete: (id: number) => Promise<void>;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onDelete }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  };

  const domain = item.sourceUrl
    ? (() => {
        try {
          return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
        } catch {
          return item.sourceUrl;
        }
      })()
    : null;

  return (
    <div className="group border border-zinc-200 bg-white rounded-lg p-3 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                item.status === 'ready'
                  ? 'bg-emerald-500'
                  : item.status === 'processing'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <h3 className="text-xs font-medium text-zinc-900 truncate" title={item.title}>
              {item.title}
            </h3>
          </div>

          <div className="flex items-center space-x-2 mt-1 pl-3.5 text-[11px] text-zinc-500 font-mono">
            {domain ? (
              <a
                href={item.sourceUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-zinc-600 hover:text-zinc-900 hover:underline truncate"
              >
                <span className="truncate">{domain}</span>
                <ExternalLink className="w-2.5 h-2.5 ml-1 flex-shrink-0 text-zinc-400" />
              </a>
            ) : (
              <span>Note</span>
            )}

            <span>&middot;</span>

            {item.status === 'ready' && (
              <span>{item.chunkCount} {item.chunkCount === 1 ? 'chunk' : 'chunks'}</span>
            )}

            {item.status === 'processing' && (
              <span className="text-amber-600 inline-flex items-center">
                <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />
                processing
              </span>
            )}

            {item.status === 'failed' && (
              <span className="text-red-600">failed</span>
            )}
          </div>

          {item.status === 'failed' && item.errorMessage && (
            <p className="mt-1.5 pl-3.5 text-[11px] text-red-600 font-mono leading-relaxed">
              {item.errorMessage}
            </p>
          )}
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-red-600 p-1 rounded transition-opacity"
          title="Delete item"
        >
          {deleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
};
