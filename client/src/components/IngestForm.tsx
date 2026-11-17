import React, { useState } from 'react';
import { FileText, Globe, Plus, Loader2, AlertCircle } from 'lucide-react';
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
      setError(tab === 'url' ? 'Please enter a valid URL.' : 'Please enter note content.');
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
        setError('Please enter a well-formed URL (e.g. https://example.com/article)');
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

      // Clear form on success
      setTitle('');
      setContent('');
      onIngested();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Add Knowledge
        </h2>

        {/* Tab switch */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setTab('note');
              setError(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
              tab === 'note'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Plain Note</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('url');
              setError(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
              tab === 'url'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web URL</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Title <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              tab === 'note'
                ? 'e.g. Architecture Decisions for 2026'
                : 'Leave blank to use web page title'
            }
            className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {tab === 'note' ? 'Note Content' : 'Web URL'}
          </label>
          {tab === 'note' ? (
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste notes, snippets, thoughts, or specifications here..."
              className="w-full text-xs rounded-lg border border-gray-300 p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              disabled={loading}
              required
            />
          ) : (
            <input
              type="url"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
              required
            />
          )}
          {tab === 'note' && (
            <p className="text-[10px] text-gray-400 text-right mt-1">
              {content.length.toLocaleString()} / 50,000 characters
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Ingesting...
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Save to Inbox
            </>
          )}
        </button>
      </form>
    </div>
  );
};
