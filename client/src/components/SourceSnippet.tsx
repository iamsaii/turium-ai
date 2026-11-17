import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SourceSnippet as SourceSnippetType } from '../types.js';

interface SourceSnippetProps {
  snippet: SourceSnippetType;
  index: number;
}

export const SourceSnippet: React.FC<SourceSnippetProps> = ({ snippet, index }) => {
  const [expanded, setExpanded] = useState(false);
  const matchPercentage = Math.round(snippet.similarity * 100);

  const domain = snippet.sourceUrl
    ? (() => {
        try {
          return new URL(snippet.sourceUrl).hostname.replace(/^www\./, '');
        } catch {
          return snippet.sourceUrl;
        }
      })()
    : null;

  return (
    <div className="border border-zinc-200 bg-zinc-50/50 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-zinc-900 bg-zinc-200 px-1.5 py-0.5 rounded">
            [{index + 1}]
          </span>
          <h4 className="font-medium text-zinc-900 truncate" title={snippet.title}>
            {snippet.title}
          </h4>
          {domain && (
            <a
              href={snippet.sourceUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[11px] text-zinc-500 hover:text-zinc-900 font-mono truncate"
            >
              <span>{domain}</span>
              <ExternalLink className="w-2.5 h-2.5 ml-0.5 flex-shrink-0 text-zinc-400" />
            </a>
          )}
        </div>

        <span className="font-mono text-[11px] text-zinc-500 flex-shrink-0">
          {matchPercentage}% match
        </span>
      </div>

      <div className="mt-2 text-zinc-700 bg-white border border-zinc-200 rounded p-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
        <p className={!expanded && snippet.content.length > 200 ? 'line-clamp-3' : ''}>
          {snippet.content}
        </p>

        {snippet.content.length > 200 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-sans font-medium text-zinc-500 hover:text-zinc-900 mt-2 block transition-colors"
          >
            {expanded ? 'Collapse excerpt' : 'Expand full excerpt'}
          </button>
        )}
      </div>
    </div>
  );
};
