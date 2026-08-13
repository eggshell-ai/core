import { Shell } from '../shells/shell.interface';
import { Tool } from '../tools/tool.interface';

export interface App {
  shells(): Shell[];
  tools(): Tool[];
  systemPrompt(): string;
}
