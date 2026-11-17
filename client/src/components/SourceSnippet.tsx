import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { SourceSnippet as SourceSnippetType } from '../types.js';

interface SourceSnippetProps {
  snippet: SourceSnippetType;
  index: number;
}

export const SourceSnippet: React.FC<SourceSnippetProps> = ({ snippet, index }) => {
  const [expanded, setExpanded] = useState(false);
  const matchPercentage = Math.round(snippet.similarity * 100);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 transition-all hover:bg-gray-50/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
              Source {index + 1}
            </span>
            <h4 className="text-xs font-semibold text-gray-900 truncate" title={snippet.title}>
              {snippet.title}
            </h4>
          </div>

          {snippet.sourceUrl && (
            <a
              href={snippet.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 max-w-full truncate"
            >
              <span className="truncate">{snippet.sourceUrl}</span>
              <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
            </a>
          )}
        </div>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
            matchPercentage >= 70
              ? 'bg-emerald-100 text-emerald-800'
              : matchPercentage >= 50
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {matchPercentage}% match
        </span>
      </div>

      <div className="mt-2.5">
        <p
          className={`text-[11px] text-gray-700 leading-relaxed font-mono bg-white p-2.5 rounded border border-gray-100 whitespace-pre-wrap ${
            !expanded ? 'line-clamp-3' : ''
          }`}
        >
          {snippet.content}
        </p>

        {snippet.content.length > 180 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center text-[10px] font-medium text-indigo-600 hover:text-indigo-800 mt-1.5 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-0.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-0.5" />
                Show full chunk
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
