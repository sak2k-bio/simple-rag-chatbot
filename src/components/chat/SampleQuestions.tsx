"use client";
import { useEffect, useMemo, useState } from 'react';

interface SampleQuestionsProps {
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    onSetInput: (input: string) => void;
}

export default function SampleQuestions({ isLoading, onSendMessage, onSetInput }: SampleQuestionsProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
    const [lastSuggestionsAt, setLastSuggestionsAt] = useState<number>(0);
    const [expanded, setExpanded] = useState<boolean>(false);
    const [showTip, setShowTip] = useState<boolean>(false);

    // Small color palette for the send icon accent
    const colorClasses = useMemo(() => [
        { border: 'border-blue-300', text: 'text-blue-700', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/30', darkBorder: 'dark:border-blue-900/40', darkText: 'dark:text-blue-300' },
        { border: 'border-emerald-300', text: 'text-emerald-700', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30', darkBorder: 'dark:border-emerald-900/40', darkText: 'dark:text-emerald-300' },
        { border: 'border-amber-300', text: 'text-amber-700', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30', darkBorder: 'dark:border-amber-900/40', darkText: 'dark:text-amber-300' },
        { border: 'border-purple-300', text: 'text-purple-700', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-950/30', darkBorder: 'dark:border-purple-900/40', darkText: 'dark:text-purple-300' },
        { border: 'border-rose-300', text: 'text-rose-700', bg: 'bg-rose-50', darkBg: 'dark:bg-rose-950/30', darkBorder: 'dark:border-rose-900/40', darkText: 'dark:text-rose-300' }
    ], []);

    const colorFor = (text: string) => {
        let h = 0;
        for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
        return colorClasses[h % colorClasses.length];
    };

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

    // Auto-load suggestions on first render
    useEffect(() => {
        if (suggestions.length === 0 && !loadingSuggestions && lastSuggestionsAt === 0) {
            refreshSuggestions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // First-visit tip that teaches double-click to send
    useEffect(() => {
        try {
            const seen = localStorage.getItem('sample_questions_tip_seen');
            if (!seen) {
                setShowTip(true);
                const t = setTimeout(() => setShowTip(false), 4000);
                return () => clearTimeout(t);
            }
        } catch {}
    }, []);

    return (
        <div className="mt-4">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-2">
                <span className="font-medium">Quick questions</span>
                <button
                    type="button"
                    onClick={refreshSuggestions}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                    title="Refresh sample questions (10s cooldown)"
                    disabled={loadingSuggestions || remainingCooldown > 0}
                >
                    <span aria-hidden>↻</span>
                    <span>{loadingSuggestions ? 'Loading…' : (remainingCooldown > 0 ? `Wait ${remainingCooldown}s` : 'Refresh')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                    title={expanded ? 'Show fewer' : 'Show all'}
                >
                    <span aria-hidden>{expanded ? '▴' : '▾'}</span>
                    <span>{expanded ? 'Less' : 'More'}</span>
                </button>
                {showTip && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800">
                        Tip: click to fill, double‑click to send
                    </span>
                )}
            </div>

            <div
                className={`relative flex flex-row flex-wrap md:flex-nowrap gap-2 overflow-x-auto ${expanded ? 'max-h-none' : 'max-h-20 md:max-h-16 overflow-hidden'} py-1 pr-2`}
                style={{ scrollbarWidth: 'thin' }}
                role="list"
                aria-label="Sample questions"
            >
                {loadingSuggestions && <span className="text-xs text-gray-500">Loading…</span>}
                {!loadingSuggestions && suggestions.map((question, i) => {
                    const c = colorFor(question);
                    return (
                        <button
                            key={`sugg-${i}`}
                            type="button"
                            onClick={() => {
                                try { localStorage.setItem('sample_questions_tip_seen', '1'); } catch {}
                                setShowTip(false);
                                onSetInput(question);
                            }}
                            onDoubleClick={() => onSendMessage(question)}
                            disabled={isLoading}
                            className="group inline-flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-60 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800 text-left max-w-[28rem] sm:max-w-[26rem] md:max-w-[32rem] shrink-0"
                            title="Click to fill the input. Double‑click to send now."
                            role="listitem"
                        >
                            <span className="whitespace-normal break-words leading-snug">{question}</span>
                            <span
                                className={`ml-0.5 inline-flex items-center justify-center h-5 w-5 rounded-full border ${c.border} ${c.bg} text-[11px] ${c.text} group-hover:bg-opacity-80 ${c.darkBg} ${c.darkBorder} ${c.darkText}`}
                                aria-hidden
                            >
                                ➤
                            </span>
                        </button>
                    );
                })}

                {!expanded && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />
                )}
            </div>
        </div>
    );
}
