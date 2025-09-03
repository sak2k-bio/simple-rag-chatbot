"use client";
import { useRef } from 'react';

interface ChatInputProps {
    localInput: string;
    isLoading: boolean;
    isEditingResend: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onRegenerate: () => void;
    onEditLast: () => void;
    onClearInput: () => void;
    onCancelEdit: () => void;
    onStop: () => void;
    hasLastUserMessage: boolean;
}

export default function ChatInput({
    localInput,
    isLoading,
    isEditingResend,
    onInputChange,
    onSubmit,
    onRegenerate,
    onEditLast,
    onClearInput,
    onCancelEdit,
    onStop,
    hasLastUserMessage
}: ChatInputProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="mt-4">
            <form onSubmit={onSubmit} className="flex items-end gap-3">
                <textarea
                    value={localInput}
                    onChange={(e) => onInputChange(e.target.value)}
                    ref={inputRef}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                        }
                    }}
                    placeholder="Ask anything about pulmonary medicine…"
                    rows={1}
                    className="min-h-[48px] max-h-40 flex-1 resize-y rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800"
                />
                <button
                    type="submit"
                    disabled={isLoading || !localInput.trim()}
                    className="h-12 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 px-6 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? '⏳ Sending…' : (isEditingResend ? '🔄 Resend' : '📤 Send')}
                </button>
                {isLoading && (
                    <button
                        type="button"
                        onClick={onStop}
                        className="h-12 shrink-0 rounded-lg bg-red-500 hover:bg-red-600 px-4 text-sm font-semibold text-white transition-colors"
                    >
                        ⏹️ Stop
                    </button>
                )}
                {isEditingResend && !isLoading && (
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="h-12 shrink-0 rounded-lg bg-gray-200 hover:bg-gray-300 px-4 text-sm font-semibold text-gray-700 border border-gray-300 transition-colors"
                    >
                        ❌ Cancel
                    </button>
                )}
            </form>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between px-1 text-sm text-gray-500 dark:text-gray-400 gap-3">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <button
                        type="button"
                        onClick={onRegenerate}
                        disabled={isLoading || !hasLastUserMessage}
                        className="px-3 py-1 rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-800/50 font-medium text-sm"
                    >
                        🔄 Regenerate last
                    </button>
                    <button
                        type="button"
                        onClick={onEditLast}
                        disabled={isLoading || !hasLastUserMessage}
                        className="px-3 py-1 rounded-md border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-200 dark:hover:bg-purple-800/50 font-medium text-sm"
                    >
                        ✏️ Edit & Resend
                    </button>
                    <button
                        type="button"
                        onClick={onClearInput}
                        className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium text-sm"
                    >
                        🗑️ Clear input
                    </button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                    Press Enter to send, Shift+Enter for new line
                </div>
            </div>
        </div>
    );
}
