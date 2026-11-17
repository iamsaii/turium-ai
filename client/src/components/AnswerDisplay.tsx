import React from 'react';
import { Sparkles, BookOpen } from 'lucide-react';
import { SourceSnippet } from './SourceSnippet.js';
import type { SourceSnippet as SourceSnippetType } from '../types.js';

interface AnswerDisplayProps {
  answer: string | null;
  sources: SourceSnippetType[];
  isLoading: boolean;
}

export const AnswerDisplay: React.FC<AnswerDisplayProps> = ({
  answer,
  sources,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 animate-pulse">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-indigo-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-4/6" />
        </div>
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-16 bg-gray-50 rounded" />
          <div className="h-16 bg-gray-50 rounded" />
        </div>
      </div>
    );
  }

  if (!answer) {
    return null;
  }

  // Highlight [Source X] badges in answer text
  const renderFormattedAnswer = (rawText: string) => {
    const parts = rawText.split(/(\[Source \d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[Source (\d+)\]$/);
      if (match) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-700 mx-0.5"
          >
            Source {match[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1 bg-indigo-50 text-indigo-600 rounded">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
            Synthesized Answer
          </h3>
        </div>

        <div className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/50 p-4 rounded-lg border border-gray-100">
          {renderFormattedAnswer(answer)}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 mb-3">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Dual Citations ({sources.length} {sources.length === 1 ? 'source' : 'sources'})
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {sources.map((snippet, idx) => (
              <SourceSnippet key={snippet.id || idx} snippet={snippet} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
