"use client";
import { useEffect, useRef, useState } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatUI() {
    const [isClient, setIsClient] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [localInput, setLocalInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const sendMessage = async (content: string) => {
        if (!content.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim()
        };

        // Add user message immediately
        setMessages(prev => [...prev, userMessage]);
        setLocalInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [...messages, userMessage]
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            let assistantMessage = '';
            const assistantId = Date.now().toString() + '_assistant';

            // Add assistant message placeholder
            setMessages(prev => [...prev, {
                id: assistantId,
                role: 'assistant',
                content: ''
            }]);

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    assistantMessage += chunk;

                    // Update the assistant message with accumulated content
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantId
                            ? { ...msg, content: assistantMessage }
                            : msg
                    ));
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            console.error('Error sending message:', error);
            // Add error message
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_error',
                role: 'assistant',
                content: 'Sorry, there was an error processing your message. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const currentHandleInputChange = (e: any) => setLocalInput(e.target.value);
    const currentHandleSubmit = async (e: any) => {
        e.preventDefault();
        await sendMessage(localInput);
    };

    useEffect(() => {
        if (isClient) {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        }
    }, [messages, isLoading, isClient]);

    if (!isClient) {
        return <div className="flex items-center justify-center h-96">Loading...</div>;
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b px-4 py-3">
                <h1 className="text-lg font-semibold tracking-tight text-orange-700">Simple Chatbot</h1>
                <p className="text-sm text-gray-500">Powered by Gemini + Qdrant</p>
            </header>

            <div className="px-4">
                <div ref={listRef} className="mt-4 h-[66vh] overflow-y-auto rounded-lg border bg-white p-4">
                    {messages.length === 0 && (
                        <div className="text-gray-400 text-sm">Ask a question to get started.</div>
                    )}
                    {messages.map((m) => (
                        <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] shadow-sm ${m.role === 'user'
                                    ? 'border border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border border-blue-200 bg-blue-50 text-blue-700'
                                }`}>
                                {m.content || (m.role === 'assistant' ? 'Thinking...' : '')}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] shadow-sm border border-gray-200 bg-gray-50 text-gray-500">
                                Assistant is thinking…
                            </div>
                        </div>
                    )}
                </div>

                <form
                    onSubmit={currentHandleSubmit}
                    className="sticky bottom-4 mt-4 flex items-end gap-2"
                >
                    <textarea
                        value={localInput}
                        onChange={currentHandleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                            }
                        }}
                        placeholder="Ask anything…"
                        rows={1}
                        className="min-h-[44px] max-h-40 flex-1 resize-y rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 text-gray-900 placeholder-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !localInput.trim()}
                        className="h-11 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {isLoading ? 'Sending…' : 'Send'}
                    </button>
                </form>

                <div className="mt-2 flex items-center justify-between px-1 text-xs text-gray-400">
                    <button
                        type="button"
                        onClick={() => setLocalInput('')}
                        className="hover:text-gray-500"
                    >
                        Clear input
                    </button>
                </div>
            </div>
        </div>
    );
}


