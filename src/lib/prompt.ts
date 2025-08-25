export const SYSTEM_PROMPT = `You are a concise, helpful assistant. Answer based on the provided context. If the context is insufficient, say you don't know.`;

export function buildRagPrompt(context: string, userInput: string): string {
  return [
    'Context:',
    context || '(no relevant context found)',
    '',
    'User:',
    userInput,
  ].join('\n');
}


