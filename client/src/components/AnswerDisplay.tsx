import React from 'react';
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
      <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-200 rounded w-1/4 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-zinc-100 rounded w-full" />
          <div className="h-3 bg-zinc-100 rounded w-5/6" />
          <div className="h-3 bg-zinc-100 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!answer) {
    return null;
  }

  // Format citations like [Source 1] or [1] as crisp reference markers
  const renderFormattedAnswer = (rawText: string) => {
    const parts = rawText.split(/(\[Source \d+\]|\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[(?:Source )?(\d+)\]$/);
      if (match) {
        return (
          <sup
            key={index}
            className="font-mono text-[10px] font-semibold text-zinc-900 bg-zinc-100 border border-zinc-300 px-1 py-0.5 rounded ml-0.5 align-super"
            title={`Source ${match[1]}`}
          >
            [{match[1]}]
          </sup>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-zinc-900 mb-2">
          Synthesized answer
        </h3>

        <div className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap font-sans">
          {renderFormattedAnswer(answer)}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="pt-4 border-t border-zinc-100">
          <h4 className="text-xs font-semibold text-zinc-700 mb-3">
            Referenced sources ({sources.length})
          </h4>

          <div className="space-y-2.5">
            {sources.map((snippet, idx) => (
              <SourceSnippet key={snippet.id || idx} snippet={snippet} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
