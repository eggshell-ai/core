import { Injectable, Logger } from '@nestjs/common';
import { LLM_SERVICE_TOKEN } from './llm.constants';
import { LLMService } from './llm.service.interface';
import { Inject } from '@nestjs/common';
import { Tool } from '../projects/tools/tool.interface';
import { Skill } from './skill.interface';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: any;
  tool_calls?: any[];
}

export interface AgentOptions {
  maxTurns?: number;
  context?: Record<string, any>;
  onEvent?: (event: AgentEvent) => void;
  logConversation?: boolean;
  logDir?: string;
}

export interface AgentEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'complete';
  data: any;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly DEFAULT_MAX_TURNS = 10;
  private skills: Skill[] = [];

  constructor(
    @Inject(LLM_SERVICE_TOKEN) private readonly llmService: LLMService,
  ) {
    this.loadSkills();
  }

  private loadSkills(): void {
    const skillsDir = path.join(process.cwd(), 'src', 'llm', 'skills');
    
    if (!fs.existsSync(skillsDir)) {
      this.logger.log('Skills directory not found, skipping skill loading');
      return;
    }

    try {
      const skillFiles = fs.readdirSync(skillsDir).filter(file => file.endsWith('.skill.ts'));
      
      for (const skillFile of skillFiles) {
        try {
          const skillFilePath = path.join(skillsDir, skillFile);
          const skillContent = fs.readFileSync(skillFilePath, 'utf-8');
          
          // Extract the skill object from the file
          const skillMatch = skillContent.match(/export const \w+: Skill = ({[\s\S]*});/);
          if (skillMatch) {
            const skillObjectStr = skillMatch[1];
            const skill = eval(`(${skillObjectStr})`);
            this.skills.push(skill);
            this.logger.log(`Loaded skill: ${skill.name}`);
          }
        } catch (error) {
          this.logger.error(`Failed to load skill from ${skillFile}:`, error);
        }
      }
      
      this.logger.log(`Loaded ${this.skills.length} skills total`);
    } catch (error) {
      this.logger.error('Failed to load skills:', error);
    }
  }

  private getSkillsSummary(): string {
    if (this.skills.length === 0) {
      return '';
    }

    let summary = '\n\n=== AVAILABLE SKILLS ===\n';
    summary += 'You have access to the following skills that teach you how to perform specific tasks:\n\n';

    for (const skill of this.skills) {
      summary += `**${skill.name}**\n`;
      summary += `Description: ${skill.description}\n`;
      if (skill.category) {
        summary += `Category: ${skill.category}\n`;
      }
      if (skill.tags && skill.tags.length > 0) {
        summary += `Tags: ${skill.tags.join(', ')}\n`;
      }
      summary += '\n';
    }

    summary += 'To use a skill, call the load_skill tool with the skill name.\n';
    summary += 'This will provide you with detailed instructions and examples.\n';
    summary += '=== END SKILLS ===\n';

    return summary;
  }

  async runAgent(
    systemPrompt: string,
    userPrompt: string,
    tools: Tool[],
    options: AgentOptions = {},
  ): Promise<{ content: string; tool_calls: any[] }> {
    const maxTurns = options.maxTurns || this.DEFAULT_MAX_TURNS;
    const context = options.context || {};
    const onEvent = options.onEvent;
    const logConversation = options.logConversation !== false;
    const logDir = options.logDir || path.join(process.cwd(), 'logs', 'agent-conversations');

    // Attach skills summary to system prompt
    const enhancedSystemPrompt = systemPrompt + this.getSkillsSummary();

    let messages: AgentMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let turn = 0;
    let allToolCalls: any[] = [];
    const conversationLog: ConversationLogEntry[] = [];
    const startTime = new Date();
    const conversationId = `${startTime.toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).substr(2, 9)}`;

    while (turn < maxTurns) {
      turn++;
      this.logger.log(`Agent turn ${turn}/${maxTurns}`);

      // Prepare tools for LLM
      const toolsForLLM = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));

      // Call LLM with conversation history
      const llmResult = await this.llmService.executePromptWithTools(
        messages,
        toolsForLLM,
        context,
      );

      // Emit thought event
      if (onEvent) {
        onEvent({
          type: 'thought',
          data: { content: llmResult.content, turn },
        });
      }

      // Log assistant thought
      if (logConversation) {
        conversationLog.push({
          timestamp: new Date().toISOString(),
          turn,
          type: 'thought',
          content: llmResult.content,
        });
      }

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: llmResult.content,
        tool_calls: llmResult.tool_calls,
      });

      // Check if there are tool calls
      if (llmResult.tool_calls && llmResult.tool_calls.length > 0) {
        allToolCalls.push(...llmResult.tool_calls);

        // Execute each tool call
        for (const toolCall of llmResult.tool_calls) {
          const toolName = toolCall.function?.name || toolCall.name;
          let toolArgs = toolCall.function?.arguments ?? toolCall.arguments;

          if (typeof toolArgs === 'string') {
            try {
              toolArgs = JSON.parse(toolArgs);
            } catch (e) {
              // Leave as string if not JSON format
            }
          }

          const tool = tools.find(t => t.name === toolName);
          if (!tool) {
            this.logger.warn(`Tool ${toolName} not found`);
            continue;
          }

          // Emit tool call event
          if (onEvent) {
            onEvent({
              type: 'tool_call',
              data: { name: toolName, arguments: toolArgs },
            });
          }

          // Log tool call
          if (logConversation) {
            conversationLog.push({
              timestamp: new Date().toISOString(),
              turn,
              type: 'tool_call',
              toolName: toolName,
              toolArgs: toolArgs,
            });
          }

          try {
            this.logger.log(`Executing tool: ${tool.name}`);
            const toolResult = await tool.execute(toolArgs);

            // Emit tool result event
            if (onEvent) {
              onEvent({
                type: 'tool_result',
                data: { name: tool.name, result: toolResult },
              });
            }

            // Log tool result
            if (logConversation) {
              conversationLog.push({
                timestamp: new Date().toISOString(),
                turn,
                type: 'tool_result',
                toolName: tool.name,
                toolResult,
              });
            }

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
              toolCallId: toolCall.id,
              toolName: tool.name,
              toolArgs: toolArgs,
            });
          } catch (error) {
            this.logger.error(`Error executing tool ${tool.name}:`, error);
            
            // Emit tool result event with error
            if (onEvent) {
              onEvent({
                type: 'tool_result',
                data: { name: tool.name, result: { error: error.message } },
              });
            }

            // Log tool error
            if (logConversation) {
              conversationLog.push({
                timestamp: new Date().toISOString(),
                turn,
                type: 'tool_error',
                toolName: tool.name,
                error: error.message,
              });
            }

            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: error.message }),
              toolCallId: toolCall.id,
              toolName: tool.name,
              toolArgs: toolArgs,
            });
          }
        }
      } else {
        // No more tool calls, break the loop
        this.logger.log('No tool calls, ending agent loop');
        break;
      }
    }

    if (turn >= maxTurns) {
      this.logger.warn(`Agent reached max turns (${maxTurns})`);
    }

    // Emit complete event
    if (onEvent) {
      onEvent({
        type: 'complete',
        data: { content: messages[messages.length - 1].content, tool_calls: allToolCalls },
      });
    }

    // Log complete conversation to file
    if (logConversation) {
      await this.writeConversationLog(conversationId, conversationLog, {
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        systemPrompt,
        userPrompt,
        maxTurns,
        actualTurns: turn,
        context,
        finalContent: messages[messages.length - 1].content,
        allToolCalls,
      }, logDir);
    }

    return {
      content: messages[messages.length - 1].content,
      tool_calls: allToolCalls,
    };
  }

  private async writeConversationLog(
    conversationId: string,
    conversationLog: ConversationLogEntry[],
    metadata: ConversationMetadata,
    logDir: string,
  ): Promise<void> {
    try {
      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFilePath = path.join(logDir, `${conversationId}.log`);
      const jsonFilePath = path.join(logDir, `${conversationId}.json`);

      // Write human-readable log
      let logContent = '='.repeat(80) + '\n';
      logContent += `AGENT CONVERSATION LOG\n`;
      logContent += '='.repeat(80) + '\n\n';
      logContent += `Conversation ID: ${conversationId}\n`;
      logContent += `Start Time: ${metadata.startTime}\n`;
      logContent += `End Time: ${metadata.endTime}\n`;
      logContent += `Duration: ${new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime()}ms\n`;
      logContent += `Max Turns: ${metadata.maxTurns}\n`;
      logContent += `Actual Turns: ${metadata.actualTurns}\n\n`;

      logContent += '-'.repeat(80) + '\n';
      logContent += 'INITIAL PROMPTS\n';
      logContent += '-'.repeat(80) + '\n\n';
      logContent += `System Prompt:\n${metadata.systemPrompt}\n\n`;
      logContent += `User Prompt:\n${metadata.userPrompt}\n\n`;

      if (Object.keys(metadata.context).length > 0) {
        logContent += '-'.repeat(80) + '\n';
        logContent += 'CONTEXT\n';
        logContent += '-'.repeat(80) + '\n\n';
        logContent += JSON.stringify(metadata.context, null, 2) + '\n\n';
      }

      logContent += '-'.repeat(80) + '\n';
      logContent += 'CONVERSATION FLOW\n';
      logContent += '-'.repeat(80) + '\n\n';

      for (const entry of conversationLog) {
        logContent += `[${entry.timestamp}] [Turn ${entry.turn}]\n`;
        
        if (entry.type === 'thought') {
          logContent += 'TYPE: Assistant Thought\n';
          logContent += `CONTENT:\n${entry.content}\n\n`;
        } else if (entry.type === 'tool_call') {
          logContent += 'TYPE: Tool Call\n';
          logContent += `TOOL: ${entry.toolName}\n`;
          logContent += `ARGUMENTS:\n${JSON.stringify(entry.toolArgs, null, 2)}\n\n`;
        } else if (entry.type === 'tool_result') {
          logContent += 'TYPE: Tool Result\n';
          logContent += `TOOL: ${entry.toolName}\n`;
          logContent += `RESULT:\n${JSON.stringify(entry.toolResult, null, 2)}\n\n`;
        } else if (entry.type === 'tool_error') {
          logContent += 'TYPE: Tool Error\n';
          logContent += `TOOL: ${entry.toolName}\n`;
          logContent += `ERROR: ${entry.error}\n\n`;
        }
      }

      logContent += '-'.repeat(80) + '\n';
      logContent += 'SUMMARY\n';
      logContent += '-'.repeat(80) + '\n\n';
      logContent += `Total Tool Calls: ${metadata.allToolCalls.length}\n\n`;
      logContent += `Final Response:\n${metadata.finalContent}\n\n`;
      logContent += '='.repeat(80) + '\n';

      fs.writeFileSync(logFilePath, logContent, 'utf-8');

      // Write JSON log for programmatic access
      const jsonData = {
        conversationId,
        metadata,
        conversationLog,
      };
      fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');

      this.logger.log(`Conversation log written to: ${logFilePath}`);
    } catch (error) {
      this.logger.error('Failed to write conversation log:', error);
    }
  }
}

interface ConversationLogEntry {
  timestamp: string;
  turn: number;
  type: 'thought' | 'tool_call' | 'tool_result' | 'tool_error';
  content?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  error?: string;
}

interface ConversationMetadata {
  startTime: string;
  endTime: string;
  systemPrompt: string;
  userPrompt: string;
  maxTurns: number;
  actualTurns: number;
  context: Record<string, any>;
  finalContent: string;
  allToolCalls: any[];
}
