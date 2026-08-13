import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService, LLMMessage } from './llm.service.interface';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class OllamaService implements LLMService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('OLLAMA_API_URL', 'https://ollama.com/api');
    this.apiKey = this.configService.get<string>('OLLAMA_API_KEY', '');
    this.model = this.configService.get<string>('OLLAMA_MODEL', 'llama3.2');

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
    });
  }

  async executePrompt(prompt: string, context?: Record<string, any>): Promise<string> {
    try {
      this.logger.log(`Executing prompt with Ollama model: ${this.model}`);
      
      const response = await this.axiosInstance.post('/generate', {
        model: this.model,
        prompt: this.buildPrompt(prompt, context),
        stream: false,
      });

      return response.data.response || response.data.message?.content || '';
    } catch (error) {
      this.logger.error('Error executing prompt with Ollama', error);
      throw new Error(`Failed to execute prompt: ${error.message}`);
    }
  }

  async executePromptWithTools(
    messages: LLMMessage[],
    tools: Array<{ name: string; description: string; parameters: any }>,
    context?: Record<string, any>,
  ): Promise<any> {
    try {
      this.logger.log(`Executing prompt with tools using Ollama model: ${this.model}`);
      
      const systemPrompt = this.buildSystemPrompt(tools);
      
      // Convert LLMMessage format to Ollama chat format
      const ollamaMessages = messages.map(msg => {
        const ollamaMsg: any = {
          role: msg.role,
          content: msg.content,
        };
        
        if (msg.role === 'tool' && msg.toolName) {
          ollamaMsg.role = 'tool';
          // Ollama doesn't support tool_call_id or name as separate parameters
          // Include them in the content instead
          const toolInfo = {
            tool_call_id: msg.toolCallId,
            name: msg.toolName,
            result: msg.content,
          };
          ollamaMsg.content = JSON.stringify(toolInfo);
        }
        
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
          ollamaMsg.tool_calls = msg.tool_calls.map((tc: any) => {
            const fnName = tc.function?.name || tc.name || '';
            let fnArgs = tc.function?.arguments ?? tc.arguments ?? {};
            if (typeof fnArgs === 'string') {
              try {
                fnArgs = JSON.parse(fnArgs);
              } catch (e) {
                // Keep as string if parsing fails
              }
            }
            return {
              ...(tc.id ? { id: tc.id } : {}),
              type: tc.type || 'function',
              function: {
                name: fnName,
                arguments: fnArgs,
              },
            };
          });
        }
        
        return ollamaMsg;
      });

      // Add system prompt at the beginning if not already present
      if (ollamaMessages.length === 0 || ollamaMessages[0].role !== 'system') {
        ollamaMessages.unshift({ role: 'system', content: systemPrompt });
      } else {
        // Merge with existing system prompt
        ollamaMessages[0].content = systemPrompt + '\n\n' + ollamaMessages[0].content;
      }

      const response = await this.axiosInstance.post('/chat', {
        model: this.model,
        messages: ollamaMessages,
        stream: false,
        tools: tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });

      // Parse the response to check if tool calls were made
      const responseData = response.data;
      
      this.logger.log(`Full Ollama response: ${JSON.stringify(responseData, null, 2)}`);
      
      const message = responseData.message;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const normalizedToolCalls = message.tool_calls.map((tc: any, index: number) => {
          const fnName = tc.function?.name || tc.name || '';
          let fnArgs = tc.function?.arguments ?? tc.arguments ?? {};
          if (typeof fnArgs !== 'string') {
            fnArgs = JSON.stringify(fnArgs);
          }
          return {
            id: tc.id || `call_ollama_${Date.now()}_${index}`,
            type: 'function',
            function: {
              name: fnName,
              arguments: fnArgs,
            },
          };
        });

        return {
          content: message.content || '',
          tool_calls: normalizedToolCalls,
        };
      }

      const content = message?.content || '';
      this.logger.warn(`No tool calls found. Content: "${content}"`);
      
      return {
        content,
        tool_calls: [],
      };
    } catch (error) {
      this.logger.error('Error executing prompt with tools using Ollama', error);
      throw new Error(`Failed to execute prompt with tools: ${error.message}`);
    }
  }

  private buildPrompt(prompt: string, context?: Record<string, any>): string {
    if (!context || Object.keys(context).length === 0) {
      return prompt;
    }

    const contextString = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    return `Context:\n${contextString}\n\n${prompt}`;
  }

  private buildSystemPrompt(tools: Array<{ name: string; description: string; parameters: any }>): string {
    const toolsDescription = tools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    return `You are an AI assistant with access to the following tools:\n${toolsDescription}\n\nUse these tools when appropriate to help accomplish the user's request. When you need to use a tool, respond with a tool call in the format expected by the system.`;
  }
}
