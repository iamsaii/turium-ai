import React, { useState } from 'react';
import {
  FileText,
  Globe,
  ExternalLink,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
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

  const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-all shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3 min-w-0">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${
              item.type === 'url'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            {item.type === 'url' ? (
              <Globe className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-gray-900 truncate" title={item.title}>
              {item.title}
            </h3>

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 max-w-full truncate"
              >
                <span className="truncate">{item.sourceUrl}</span>
                <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
              </a>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Status Badge */}
              {item.status === 'processing' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin text-amber-600" />
                  Processing
                </span>
              )}

              {item.status === 'ready' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Ready ({item.chunkCount} {item.chunkCount === 1 ? 'chunk' : 'chunks'})
                </span>
              )}

              {item.status === 'failed' && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200"
                  title={item.errorMessage || 'Unknown error'}
                >
                  <AlertTriangle className="w-3 h-3 mr-1 text-red-600" />
                  Failed
                </span>
              )}

              <span className="text-[10px] text-gray-400">{formattedDate}</span>
            </div>

            {item.status === 'failed' && item.errorMessage && (
              <p className="text-[11px] text-red-600 mt-1.5 bg-red-50 p-2 rounded border border-red-100">
                {item.errorMessage}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-50 flex-shrink-0"
          title="Delete item"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};
