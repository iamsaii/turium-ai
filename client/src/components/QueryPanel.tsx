import React, { useState } from 'react';
import { Search, Send, Loader2, HelpCircle } from 'lucide-react';

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

  const starterQuestions = [
    'What are the key technical tradeoffs in the architecture?',
    'Summarize all saved specifications.',
    'What items were saved regarding frontend and API design?',
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-4">
        <Search className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Ask Your Knowledge Base
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything across your saved notes and URLs..."
            className="w-full text-xs rounded-lg border border-gray-300 p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            disabled={isLoading}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-400 hidden sm:block">
            Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono text-[10px]">Enter</kbd> to submit
          </p>

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ml-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Ask Question
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-2">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Suggested queries:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {starterQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuestion(q)}
              className="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded-md border border-gray-200 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
