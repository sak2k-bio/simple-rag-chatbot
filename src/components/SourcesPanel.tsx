"use client";

import React from 'react';

export interface Source {
    pageContent: string;
    metadata: {
        source: string;
        score?: number;
        used?: boolean;
        [key: string]: unknown;
    };
}

interface SourcesPanelProps {
    sources: Source[];
    similarityThreshold: number;
    showUsedSources: boolean;
    setShowUsedSources: (val: boolean) => void;
    showUnusedSources: boolean;
    setShowUnusedSources: (val: boolean) => void;
}

export default function SourcesPanel({
    sources,
    similarityThreshold,
    showUsedSources,
    setShowUsedSources,
    showUnusedSources,
    setShowUnusedSources
}: SourcesPanelProps) {
    const usedCount = sources.filter(s => s.metadata?.used).length;
    const unusedCount = sources.length - usedCount;

    return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-800/50">
                <div className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">📊 Sources Summary</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 bg-white/50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800/30">
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{sources.length}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Total Retrieved</div>
                    </div>
                    <div className="text-center p-2 bg-white/50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800/30">
                        <div className="text-lg font-bold text-green-700 dark:text-green-300">{usedCount}</div>
                        <div className="text-xs text-green-600 dark:text-green-400">Used in Answer</div>
                    </div>
                    <div className="text-center p-2 bg-white/50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800/30">
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{unusedCount}</div>
                        <div className="text-xs text-orange-600 dark:text-orange-400">Below Threshold</div>
                    </div>
                </div>
            </div>

            {usedCount > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                            </span>
                            Sources Used in Answer ({usedCount})
                        </div>
                        <button
                            onClick={() => setShowUsedSources(!showUsedSources)}
                            className="text-sm text-green-600 hover:text-green-700 px-3 py-1 rounded-md border border-green-200 hover:border-green-300 transition-colors dark:text-green-300 dark:border-green-800/50 dark:hover:border-green-700/50 bg-green-50 dark:bg-green-950/30"
                        >
                            {showUsedSources ? 'Show Less' : 'Show All'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {sources.filter(s => s.metadata?.used).slice(0, showUsedSources ? undefined : 5).map((source: Source, index: number) => (
                            <div key={`used-${index}`} className="text-sm rounded-lg px-4 py-3 bg-green-50 border border-green-200 flex justify-between items-center dark:bg-green-950/40 dark:border-green-800/50 shadow-sm">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-xs px-2 py-1 rounded-full bg-green-200 text-green-800 font-semibold dark:bg-green-800 dark:text-green-200">
                                        ✓ Used
                                    </span>
                                    <span className="truncate text-green-800 dark:text-green-200 font-medium">
                                        {source.metadata?.source || `Source ${index + 1}`}
                                    </span>
                                </div>
                                {typeof source.metadata?.score === 'number' && (
                                    <span className="text-sm ml-3 text-green-700 font-bold dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded">
                                        {source.metadata.score.toFixed(3)}
                                    </span>
                                )}
                            </div>
                        ))}
                        {!showUsedSources && usedCount > 5 && (
                            <div className="text-sm text-green-600 text-center py-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800/50">
                                +{usedCount - 5} more used sources
                            </div>
                        )}
                    </div>
                </div>
            )}

            {sources.filter(s => !s.metadata?.used).length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold flex items-center gap-2">
                            <span className="w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">○</span>
                            </span>
                            Sources Below Threshold ({sources.filter(s => !s.metadata?.used).length})
                        </div>
                        <button
                            onClick={() => setShowUnusedSources(!showUnusedSources)}
                            className="text-sm text-orange-600 hover:text-orange-700 px-3 py-1 rounded-md border border-orange-200 hover:border-orange-300 transition-colors dark:text-orange-300 dark:border-orange-800/50 dark:hover:border-orange-700/50 bg-orange-50 dark:bg-orange-950/30"
                        >
                            {showUnusedSources ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    {showUnusedSources && (
                        <>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {sources.filter(s => !s.metadata?.used).slice(0, showUnusedSources ? 12 : 6).map((source: Source, index: number) => (
                                    <div key={`unused-${index}`} className="text-sm rounded-lg px-4 py-3 bg-orange-50 border border-orange-200 flex justify-between items-center dark:bg-orange-950/40 dark:border-orange-800/50 shadow-sm">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-xs px-2 py-1 rounded-full bg-orange-200 text-orange-800 font-semibold dark:bg-orange-800 dark:text-orange-200">
                                                ○ Below Threshold
                                            </span>
                                            <span className="truncate text-orange-800 dark:text-orange-200 font-medium">
                                                {source.metadata?.source || `Source ${index + 1}`}
                                            </span>
                                        </div>
                                        {typeof source.metadata?.score === 'number' && (
                                            <span className="text-sm ml-3 text-orange-700 font-bold dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
                                                {source.metadata.score.toFixed(3)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {!showUnusedSources && sources.filter(s => !s.metadata?.used).length > 6 && (
                                    <div className="text-sm text-orange-600 text-center py-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800/50">
                                        +{sources.filter(s => !s.metadata?.used).length - 6} more below threshold
                                    </div>
                                )}
                                {showUnusedSources && sources.filter(s => !s.metadata?.used).length > 12 && (
                                    <div className="text-sm text-orange-600 text-center py-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800/50">
                                        +{sources.filter(s => !s.metadata?.used).length - 12} more below threshold
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-orange-700 text-center mt-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800/50">
                                <span className="font-semibold">💡 Note:</span> These sources were retrieved but didn't meet your relevance threshold of <span className="font-bold">{similarityThreshold.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-800/50">
                <div className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">📋 Legend</div>
                <div className="flex flex-wrap gap-4 text-sm text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                        </span>
                        <span className="font-medium">Green: Used in answer</span>
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">○</span>
                        </span>
                        <span className="font-medium">Orange: Below threshold</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

