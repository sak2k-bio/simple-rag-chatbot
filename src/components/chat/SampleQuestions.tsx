"use client";
import { useState } from 'react';

interface SampleQuestionsProps {
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onSetInput: (input: string) => void;
}

export default function SampleQuestions({ isLoading, onSendMessage, onSetInput }: SampleQuestionsProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
    const [lastSuggestionsAt, setLastSuggestionsAt] = useState<number>(0);

    const refreshSuggestions = async () => {
        const cooldownMs = 10000;
        const now = Date.now();
        if (now - lastSuggestionsAt < cooldownMs) return;
        
        try {
            setLoadingSuggestions(true);
            const res = await fetch('/api/chat/suggestions?count=5');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.questions)) {
                    setSuggestions(data.questions);
                    setLastSuggestionsAt(now);
                }
            }
        } catch (e) {
            console.warn('Failed to load suggestions:', e);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const remainingCooldown = Math.max(0, 10 - Math.floor((Date.now() - lastSuggestionsAt) / 1000));

    return (
        <div className="mt-4">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span>Sample questions</span>
                <button
                    type="button"
                    onClick={refreshSuggestions}
                    className="px-2 py-0.5 border border-gray-300 rounded text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                    title="Refresh sample questions (10s cooldown)"
                    disabled={loadingSuggestions || remainingCooldown > 0}
                >
                    {loadingSuggestions ? 'Loading…' : (remainingCooldown > 0 ? `Wait ${remainingCooldown}s` : 'Refresh')}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {loadingSuggestions && <span className="text-xs text-gray-500">Loading…</span>}
                {!loadingSuggestions && suggestions.map((question, i) => (
                    <div key={`sugg-${i}`} className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onSetInput(question)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
                            title="Click to paste into the input"
                        >
                            {question}
                        </button>
                        <button
                            type="button"
                            onClick={() => onSendMessage(question)}
                            disabled={isLoading}
                            className="text-[11px] px-1.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-300"
                            title="Ask this question now"
                        >
                            Ask
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
