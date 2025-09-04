"use client";
import { useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import ChatHeader from './chat/ChatHeader';
import ChatInput from './chat/ChatInput';
import SessionSidebar from './chat/SessionSidebar';
import RAGControls from './chat/RAGControls';
import SampleQuestions from './chat/SampleQuestions';
import { Message, ChatSession, RAGSettings } from '@/types/chat';
import { getSupabase } from '@/lib/supabase';

export default function ChatUI() {
    const [isClient, setIsClient] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [localInput, setLocalInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Memory persistence state
    const [sessionId, setSessionId] = useState<string>('');
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [showSessionList, setShowSessionList] = useState(false);
    const [sessionQuery, setSessionQuery] = useState('');
    const [conversationContext, setConversationContext] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

    // RAG settings
    const [ragSettings, setRagSettings] = useState<RAGSettings>({
        topK: 10, // Increased from 12 to 25 for better retrieval
        similarityThreshold: 0.01, // Lowered from 0.05 to 0.01 for maximum retrieval
        useSystemPrompt: false,
        customSystemPrompt: 'You are a helpful AI assistant. Answer questions based on the provided context and be concise.',
        showSystemPromptInput: false,
        showRagControls: true,
        showUnusedSources: false,
        showUsedSources: false,
        hydeEnabled: false, // Enable HyDE for better semantic matching
        autoTuneEnabled: false,
        structuredStreamEnabled: false,
        cragEnabled: false,
        hybridEnabled: false,
        mmrEnabled: false,
        crossEncoderEnabled: false
    });

    const [isEditingResend, setIsEditingResend] = useState<boolean>(false);

    useEffect(() => {
        setIsClient(true);
        initializeChat();

        // Load settings from localStorage
        const savedPrompt = localStorage.getItem('custom_system_prompt');
        if (savedPrompt) {
            setRagSettings(prev => ({ ...prev, customSystemPrompt: savedPrompt }));
        }

        const savedThreshold = localStorage.getItem('similarity_threshold');
        if (savedThreshold) {
            setRagSettings(prev => ({ ...prev, similarityThreshold: Number(savedThreshold) }));
        }

        const savedHyde = localStorage.getItem('hyde_enabled');
        if (savedHyde) setRagSettings(prev => ({ ...prev, hydeEnabled: savedHyde === '1' }));

        const savedHybrid = localStorage.getItem('hybrid_enabled');
        if (savedHybrid) setRagSettings(prev => ({ ...prev, hybridEnabled: savedHybrid === '1' }));

        const savedMmr = localStorage.getItem('mmr_enabled');
        if (savedMmr) setRagSettings(prev => ({ ...prev, mmrEnabled: savedMmr === '1' }));

        const savedCross = localStorage.getItem('cross_encoder_enabled');
        if (savedCross) setRagSettings(prev => ({ ...prev, crossEncoderEnabled: savedCross === '1' }));
    }, []);

    const initializeChat = async () => {
        try {
            let sessionId = localStorage.getItem('chat_session_id');
            if (!sessionId) {
                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('chat_session_id', sessionId);
            }
            setSessionId(sessionId);

            try {
                const client = getSupabase();
                const table = (process.env.CHAT_SESSIONS_TABLE as string) || 'chat_sessions_ragbot';
                await client.from(table).upsert({
                    id: sessionId,
                    title: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).select('id');

                const { data: previousMessages, error } = await getSupabase()
                    .from('chat_messages_ragbot')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('timestamp', { ascending: true });

                if (!error && previousMessages && previousMessages.length > 0) {
                    const mappedMessages = previousMessages.map((msg: any) => ({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        sources: msg.sources || [],
                        timestamp: msg.timestamp
                    }));

                    setMessages(mappedMessages);
                    const context = mappedMessages.map((msg: any) => ({
                        role: msg.role,
                        content: msg.content
                    }));
                    setConversationContext(context);
                } else {
                    setMessages([]);
                }
            } catch (supabaseError) {
                console.warn('Supabase not available, starting with empty chat:', supabaseError);
                setMessages([]);
            }
        } catch (error) {
            console.error('Error initializing chat:', error);
            setMessages([]);
        }
    };

    const sendMessage = async (content: string) => {
        if (!content.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setLocalInput('');
        setIsLoading(true);

        try {
            await saveMessageToSupabase(userMessage);

            const fullConversationContext = [
                ...conversationContext,
                { role: 'user' as const, content: content.trim() }
            ];

            // Auto tuning if enabled
            let tunedTopK = ragSettings.topK;
            let tunedThreshold = ragSettings.similarityThreshold;
            if (ragSettings.autoTuneEnabled) {
                try {
                    const res = await fetch('/api/chat/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: content.trim(), limit: 20 })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (typeof data.recommendedTopK === 'number') tunedTopK = data.recommendedTopK;
                        if (typeof data.recommendedThreshold === 'number') {
                            // Ensure threshold stays in our new range (0.01-0.1)
                            tunedThreshold = Math.max(0.01, Math.min(0.1, data.recommendedThreshold));
                        }
                    }
                } catch (e) {
                    console.warn('Auto tuning failed, using manual settings');
                }
            }

            const requestBody = {
                messages: fullConversationContext,
                topK: tunedTopK,
                similarityThreshold: tunedThreshold,
                useSystemPrompt: ragSettings.useSystemPrompt,
                systemPrompt: ragSettings.customSystemPrompt,
                hydeEnabled: ragSettings.hydeEnabled,
                autoTuneEnabled: ragSettings.autoTuneEnabled,
                structuredStreamEnabled: ragSettings.structuredStreamEnabled,
                cragEnabled: ragSettings.cragEnabled,
                hybridEnabled: ragSettings.hybridEnabled,
                mmrEnabled: ragSettings.mmrEnabled,
                crossEncoderEnabled: ragSettings.crossEncoderEnabled,
            };

            const controller = new AbortController();
            (window as any).__chatAbortController = controller;
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            let assistantMessage = '';
            const assistantId = Date.now().toString() + '_assistant';

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

                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantId
                            ? { ...msg, content: assistantMessage, sources: [] }
                            : msg
                    ));
                }
            } finally {
                reader.releaseLock();
            }

            // Parse sources from response
            let parsedSources: any[] = [];
            let cleanContent = assistantMessage;
            let parsedRagParams: any = undefined;

            const sourcesMatch = assistantMessage.match(/---\s*\n(\{.*"type":"sources_metadata"[\s\S]*\})$/);
            if (sourcesMatch) {
                try {
                    const sourcesData = JSON.parse(sourcesMatch[1]);
                    if (sourcesData.type === 'sources_metadata' && sourcesData.sources) {
                        parsedSources = sourcesData.sources.map((s: any) => ({
                            pageContent: '',
                            metadata: {
                                source: s.source,
                                score: s.score,
                                used: s.used
                            }
                        }));
                        parsedRagParams = {
                            topK: typeof sourcesData.topKUsed === 'number' ? sourcesData.topKUsed : undefined,
                            threshold: typeof sourcesData.thresholdUsed === 'number' ? sourcesData.thresholdUsed : undefined,
                            hydeEnabled: typeof sourcesData.hydeEnabled === 'boolean' ? sourcesData.hydeEnabled : undefined,
                            auto: typeof sourcesData.autoTuneEnabled === 'boolean' ? sourcesData.autoTuneEnabled : undefined,
                        };
                        cleanContent = assistantMessage.replace(sourcesMatch[0], '').trim();
                    }
                } catch (parseError) {
                    console.error('Error parsing sources metadata:', parseError);
                }
            }

            const finalAssistantMessage = {
                id: assistantId,
                role: 'assistant' as const,
                content: cleanContent,
                sources: parsedSources,
                ragParams: parsedRagParams
            };

            setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                    ? { ...msg, content: cleanContent, sources: parsedSources, ragParams: parsedRagParams }
                    : msg
            ));

            await saveMessageToSupabase(finalAssistantMessage);

            const updatedContext = [
                ...fullConversationContext,
                { role: 'assistant' as const, content: cleanContent }
            ];
            setConversationContext(updatedContext);

            await loadChatSessions();

        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_error',
                role: 'assistant',
                content: 'Sorry, there was an error processing your message. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const saveMessageToSupabase = async (message: { id: string; role: 'user' | 'assistant'; content: string; sources?: any[] }) => {
        try {
            const { error } = await getSupabase()
                .from('chat_messages_ragbot')
                .insert({
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    session_id: sessionId,
                    sources: message.sources || [],
                    timestamp: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving message to Supabase:', error);
            }
        } catch (error) {
            console.warn('Supabase not available for saving message:', error);
        }
    };

    const loadChatSessions = async () => {
        try {
            const client = getSupabase();
            const table = (process.env.CHAT_SESSIONS_TABLE as string) || 'chat_sessions_ragbot';
            const { data, error } = await client
                .from(table)
                .select('id, title, updated_at')
                .order('updated_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const list = data.map((row: any) => ({
                    id: row.id,
                    title: row.title || 'New chat',
                    messageCount: 0,
                    lastMessage: '',
                    timestamp: row.updated_at || row.created_at || new Date().toISOString()
                }));
                setChatSessions(list);
            }
        } catch (error) {
            console.warn('Supabase not available for loading chat sessions:', error);
            setChatSessions([]);
        }
    };

    const switchToSession = async (newSessionId: string) => {
        try {
            setSessionId(newSessionId);
            localStorage.setItem('chat_session_id', newSessionId);

            const { data: sessionMessages, error } = await getSupabase()
                .from('chat_messages_ragbot')
                .select('*')
                .eq('session_id', newSessionId)
                .order('timestamp', { ascending: true });

            if (!error && sessionMessages && sessionMessages.length > 0) {
                const mappedMessages = sessionMessages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                    sources: msg.sources || [],
                    timestamp: msg.timestamp
                }));
                setMessages(mappedMessages);

                const context = mappedMessages.map((msg: any) => ({
                    role: msg.role,
                    content: msg.content
                }));
                setConversationContext(context);
            } else {
                setMessages([]);
                setConversationContext([]);
            }

            setShowSessionList(false);
        } catch (error) {
            console.error('Error switching sessions:', error);
        }
    };

    const clearChatSession = async () => {
        try {
            const { error } = await getSupabase()
                .from('chat_messages_ragbot')
                .delete()
                .eq('session_id', sessionId);

            if (!error) {
                setMessages([]);
                setConversationContext([]);

                const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                setSessionId(newSessionId);
                localStorage.setItem('chat_session_id', newSessionId);
                await loadChatSessions();
            }
        } catch (error) {
            console.warn('Supabase not available for clearing session:', error);
            setMessages([]);
            setConversationContext([]);
        }
    };

    const resetAllSettings = () => {
        const defaultSettings: RAGSettings = {
            topK: 12,
            similarityThreshold: 0.05, // Changed default to 0.05 (within 0.01-0.1 range)
            useSystemPrompt: true,
            customSystemPrompt: 'You are a helpful AI assistant. Answer questions based on the provided context and be concise.',
            showSystemPromptInput: false,
            showRagControls: true,
            showUnusedSources: false,
            showUsedSources: false,
            hydeEnabled: false,
            autoTuneEnabled: false,
            structuredStreamEnabled: false,
            cragEnabled: false
        };

        setRagSettings(defaultSettings);
        localStorage.setItem('similarity_threshold', '0.05');
        localStorage.setItem('custom_system_prompt', defaultSettings.customSystemPrompt);
        localStorage.setItem('hyde_enabled', '0');
    };

    const getLastUserMessageContent = (): string | null => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') return messages[i].content;
        }
        return null;
    };

    const handleRegenerate = async () => {
        const lastUser = getLastUserMessageContent();
        if (lastUser) {
            await sendMessage(lastUser);
        }
    };

    const handleEditLast = () => {
        const lastUser = getLastUserMessageContent();
        if (lastUser) {
            setLocalInput(lastUser);
            setIsEditingResend(true);
        }
    };

    useEffect(() => {
        loadChatSessions();
    }, []);

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
        <>
            <div className="mx-auto w-full max-w-6xl">
                {/* Hero Chatbox Section */}
                <div className="mb-6">
                    <ChatHeader
                        sessionId={sessionId}
                        contextLength={conversationContext.length}
                        showSessionList={showSessionList}
                        onToggleSessionList={() => setShowSessionList(!showSessionList)}
                        onClearSession={clearChatSession}
                    />

                    {/* Chat Messages Area */}
                    <div className="h-[60vh] md:h-[70vh] overflow-hidden border-x border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 rounded-b-lg">
                        <Virtuoso
                            data={messages}
                            className="h-full p-4"
                            itemContent={(index, m) => (
                                <MessageItem
                                    key={m.id}
                                    id={m.id}
                                    role={m.role}
                                    content={m.content}
                                    sources={m.sources as any}
                                    ragParams={m.ragParams}
                                    similarityThreshold={ragSettings.similarityThreshold}
                                    showUsedSources={ragSettings.showUsedSources}
                                    setShowUsedSources={(show) => setRagSettings(prev => ({ ...prev, showUsedSources: show }))}
                                    showUnusedSources={ragSettings.showUnusedSources}
                                    setShowUnusedSources={(show) => setRagSettings(prev => ({ ...prev, showUnusedSources: show }))}
                                />
                            )}
                        />
                    </div>
                    {/* Quick Sample Questions near the chatbox for fast selection */}
                    <div className="mt-3 px-2">
                        <SampleQuestions
                            isLoading={isLoading}
                            onSendMessage={sendMessage}
                            onSetInput={setLocalInput}
                        />
                    </div>

                    <ChatInput
                        localInput={localInput}
                        isLoading={isLoading}
                        isEditingResend={isEditingResend}
                        onInputChange={setLocalInput}
                        onSubmit={async (e) => {
                            e.preventDefault();
                            await sendMessage(localInput);
                            setIsEditingResend(false);
                        }}
                        onRegenerate={handleRegenerate}
                        onEditLast={handleEditLast}
                        onClearInput={() => setLocalInput('')}
                        onCancelEdit={() => setIsEditingResend(false)}
                        onStop={() => {
                            try { (window as any).__chatAbortController?.abort(); } catch { }
                        }}
                        hasLastUserMessage={!!getLastUserMessageContent()}
                    />
                </div>

                {/* Controls Section */}
                <div className="flex flex-col lg:flex-row gap-4">
                    <SessionSidebar
                        currentSessionId={sessionId}
                        sessions={chatSessions}
                        sessionQuery={sessionQuery}
                        onSessionQueryChange={setSessionQuery}
                        onSwitchSession={switchToSession}
                        onCreateNewSession={async () => {
                            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            setSessionId(newSessionId);
                            localStorage.setItem('chat_session_id', newSessionId);
                            setMessages([]);
                            setConversationContext([]);
                            await loadChatSessions();
                        }}
                        onRenameSession={async (sessionId, newTitle) => {
                            try {
                                const client = getSupabase();
                                const table = (process.env.CHAT_SESSIONS_TABLE as string) || 'chat_sessions_ragbot';
                                await client.from(table).update({
                                    title: newTitle,
                                    updated_at: new Date().toISOString()
                                }).eq('id', sessionId);
                                await loadChatSessions();
                            } catch (error) {
                                console.error('Error renaming session:', error);
                            }
                        }}
                        onDeleteSession={async (sessionId) => {
                            try {
                                await getSupabase().from('chat_messages_ragbot').delete().eq('session_id', sessionId);
                                const client = getSupabase();
                                const table = (process.env.CHAT_SESSIONS_TABLE as string) || 'chat_sessions_ragbot';
                                await client.from(table).delete().eq('id', sessionId);
                                await loadChatSessions();

                                if (sessionId === sessionId) {
                                    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                    setSessionId(newSessionId);
                                    localStorage.setItem('chat_session_id', newSessionId);
                                    setMessages([]);
                                    setConversationContext([]);
                                }
                            } catch (error) {
                                console.error('Error deleting session:', error);
                            }
                        }}
                        onRefreshSessions={loadChatSessions}
                    />

                    {/* Active Settings Chips and Controls */}
                    <div className="flex-1 min-w-0">
                        <div className="mb-4">
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="px-3 py-1 rounded-md border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200 font-medium" title="Max results to retrieve">
                                    📊 Top-K: {ragSettings.topK}
                                </span>
                                <span className="px-3 py-1 rounded-md border bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-200 font-medium" title="Cosine similarity threshold">
                                    🎯 Thresh: {ragSettings.similarityThreshold.toFixed(2)}
                                </span>
                                <span className={`px-3 py-1 rounded-md border font-medium ${ragSettings.useSystemPrompt ? 'bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-200' : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`} title="System prompt enabled">
                                    🧠 System: {ragSettings.useSystemPrompt ? 'On' : 'Off'}
                                </span>
                                <span className={`px-3 py-1 rounded-md border font-medium ${ragSettings.hydeEnabled ? 'bg-indigo-100 border-indigo-200 text-indigo-800 dark:bg-indigo-900/50 dark:border-indigo-700 dark:text-indigo-200' : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`} title="HyDE retrieval">
                                    🔍 HyDE: {ragSettings.hydeEnabled ? 'On' : 'Off'}
                                </span>
                                <span className={`px-3 py-1 rounded-md border font-medium ${ragSettings.autoTuneEnabled ? 'bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-200' : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`} title="Auto retrieval tuning">
                                    ⚡ Auto: {ragSettings.autoTuneEnabled ? 'On' : 'Off'}
                                </span>
                            </div>

                            {/* Quick Presets */}
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRagSettings(prev => ({ ...prev, topK: 15, similarityThreshold: 0.01 }))}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${ragSettings.similarityThreshold === 0.01 && ragSettings.topK === 15
                                        ? 'bg-green-500 text-white border-green-500'
                                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900/40 dark:text-green-300'
                                        }`}
                                    title="Broader: Top-K 15, Threshold 0.01"
                                >
                                    Broader (15 / 0.01)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRagSettings(prev => ({ ...prev, topK: 12, similarityThreshold: 0.05 }))}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${ragSettings.similarityThreshold === 0.05 && ragSettings.topK === 12
                                        ? 'bg-yellow-500 text-white border-yellow-500'
                                        : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:border-yellow-900/40 dark:text-yellow-300'
                                        }`}
                                    title="Balanced: Top-K 12, Threshold 0.05"
                                >
                                    Balanced (12 / 0.05)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRagSettings(prev => ({ ...prev, topK: 8, similarityThreshold: 0.1 }))}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${ragSettings.similarityThreshold === 0.1 && ragSettings.topK === 8
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300'
                                        }`}
                                    title="Very Precise: Top-K 8, Threshold 0.1"
                                >
                                    Very Precise (8 / 0.1)
                                </button>
                            </div>
                        </div>

                        <RAGControls
                            settings={ragSettings}
                            onUpdateSettings={(updates) => setRagSettings(prev => ({ ...prev, ...updates }))}
                            onResetSettings={resetAllSettings}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}