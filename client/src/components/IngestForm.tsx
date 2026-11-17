import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ingestItem } from '../api/client.js';
import type { IngestTab } from '../types.js';

interface IngestFormProps {
  onIngested: () => void;
}

export const IngestForm: React.FC<IngestFormProps> = ({ onIngested }) => {
  const [tab, setTab] = useState<IngestTab>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError(tab === 'url' ? 'Enter a URL to fetch.' : 'Note text cannot be empty.');
      return;
    }

    if (tab === 'url') {
      try {
        const parsed = new URL(trimmedContent);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setError('URL must start with http:// or https://');
          return;
        }
      } catch {
        setError('Enter a valid URL (e.g., https://example.com/spec)');
        return;
      }
    }

    setLoading(true);
    try {
      await ingestItem({
        type: tab,
        content: trimmedContent,
        title: title.trim() || undefined,
      });

      setTitle('');
      setContent('');
      onIngested();
    } catch (err: any) {
      setError(err?.message || 'Failed to save item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-zinc-900">
          Save to inbox
        </h2>

        {/* Tab switcher */}
        <div className="inline-flex rounded bg-zinc-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setTab('note');
              setError(null);
            }}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tab === 'note'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Note
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('url');
              setError(null);
            }}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              tab === 'url'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Web link
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
            Title <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              tab === 'note'
                ? 'Descriptive title'
                : 'Leave blank to use web page title'
            }
            className="w-full text-xs rounded border border-zinc-300 px-2.5 py-1.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
            {tab === 'note' ? 'Content' : 'Web address'}
          </label>
          {tab === 'note' ? (
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste raw notes, markdown, or snippets..."
              className="w-full text-xs rounded border border-zinc-300 p-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 font-mono text-[11.5px] leading-relaxed resize-y"
              disabled={loading}
              required
            />
          ) : (
            <input
              type="url"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full text-xs rounded border border-zinc-300 px-2.5 py-1.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 font-mono text-xs"
              disabled={loading}
              required
            />
          )}
          {tab === 'note' && (
            <div className="flex justify-end mt-1">
              <span className="font-mono text-[10px] text-zinc-400">
                {content.length.toLocaleString()} / 50,000 chars
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Ingesting...
            </>
          ) : (
            'Save item'
          )}
        </button>
      </form>
    </div>
  );
};
