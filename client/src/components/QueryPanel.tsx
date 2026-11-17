import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface QueryPanelProps {
  onSubmitQuery: (question: string) => Promise<void>;
  isLoading: boolean;
}

export const QueryPanel: React.FC<QueryPanelProps> = ({ onSubmitQuery, isLoading }) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;
    await onSubmitQuery(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-zinc-900">
          Query knowledge base
        </h2>
        <p className="text-[11px] text-zinc-500">
          Ask questions across your saved documents. Answers cite verified excerpts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-3">
        <div>
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. What were the key conclusions from the architecture review?"
            className="w-full text-xs rounded border border-zinc-300 p-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 leading-relaxed resize-none"
            disabled={isLoading}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-mono">
            Enter to submit &middot; Shift+Enter for newline
          </span>

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="inline-flex items-center px-3 py-1.5 rounded text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Searching...
              </>
            ) : (
              'Query'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
