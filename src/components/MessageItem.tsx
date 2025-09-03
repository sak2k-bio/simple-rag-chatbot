"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import SourcesPanel, { Source } from './SourcesPanel';

interface MessageItemProps {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
    ragParams?: { topK?: number; threshold?: number; hydeEnabled?: boolean; auto?: boolean; crag?: boolean };
    similarityThreshold: number;
    showUsedSources: boolean;
    setShowUsedSources: (v: boolean) => void;
    showUnusedSources: boolean;
    setShowUnusedSources: (v: boolean) => void;
}

export default function MessageItem({
    role,
    content,
    sources,
    ragParams,
    similarityThreshold,
    showUsedSources,
    setShowUsedSources,
    showUnusedSources,
    setShowUnusedSources,
}: MessageItemProps) {
    return (
        <div className={`mb-4 flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] shadow-sm ${role === 'user'
                    ? 'border border-orange-200 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-900/40'
                    : 'border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/40'
                }`}>
                {role === 'assistant' ? (
                    content ? (
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                            {content}
                        </ReactMarkdown>
                    ) : 'Thinking...'
                ) : (
                    content
                )}

                {role === 'assistant' && ragParams && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                        {typeof ragParams.topK === 'number' && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200">Top-K: {ragParams.topK}</span>
                        )}
                        {typeof ragParams.threshold === 'number' && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200">Thresh: {ragParams.threshold.toFixed(2)}</span>
                        )}
                        {ragParams.hydeEnabled && (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-700">HyDE</span>
                        )}
                        {ragParams.auto && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-700">Auto</span>
                        )}
                        {ragParams.crag && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-700">CRAG</span>
                        )}
                    </div>
                )}

                {sources && sources.length > 0 && (
                    <SourcesPanel
                        sources={sources}
                        similarityThreshold={similarityThreshold}
                        showUsedSources={showUsedSources}
                        setShowUsedSources={setShowUsedSources}
                        showUnusedSources={showUnusedSources}
                        setShowUnusedSources={setShowUnusedSources}
                    />
                )}
            </div>
        </div>
    );
}

