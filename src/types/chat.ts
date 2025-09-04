export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
    timestamp?: string;
    ragParams?: {
        topK?: number;
        threshold?: number;
        hydeEnabled?: boolean;
        auto?: boolean;
    };
}

export interface Source {
    pageContent: string;
    metadata: {
        source: string;
        score?: number;
        used?: boolean;
        [key: string]: unknown;
    };
}

export interface ChatSession {
    id: string;
    messageCount: number;
    lastMessage: string;
    timestamp: string;
    title?: string;
}

export interface RAGSettings {
    topK: number;
    similarityThreshold: number;
    useSystemPrompt: boolean;
    customSystemPrompt: string;
    showSystemPromptInput: boolean;
    showRagControls: boolean;
    showUnusedSources: boolean;
    showUsedSources: boolean;
    hydeEnabled: boolean;
    autoTuneEnabled: boolean;
    structuredStreamEnabled: boolean;
    cragEnabled: boolean;
    hybridEnabled?: boolean;
    mmrEnabled?: boolean;
    crossEncoderEnabled?: boolean;
}
