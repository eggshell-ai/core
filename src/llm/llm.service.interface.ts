export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: any;
  tool_calls?: any[];
}

export interface LLMService {
  /**
   * Execute a prompt with the LLM service
   * @param prompt The prompt to execute
   * @param context Optional context for the prompt
   * @returns The response from the LLM
   */
  executePrompt(prompt: string, context?: Record<string, any>): Promise<string>;

  /**
   * Execute a prompt with tools available to the LLM
   * @param messages Array of messages representing the conversation history
   * @param tools Array of tools available to the LLM
   * @param context Optional context for the prompt
   * @returns The response from the LLM, potentially including tool calls
   */
  executePromptWithTools(
    messages: LLMMessage[],
    tools: Array<{ name: string; description: string; parameters: any }>,
    context?: Record<string, any>,
  ): Promise<any>;
}
