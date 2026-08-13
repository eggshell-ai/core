import { App } from './app.interface';
import { Shell } from '../shells/shell.interface';
import { SymfonyShell } from '../shells/symfony.shell';
import { ReactShell } from '../shells/react.shell';
import { Tool } from '../tools/tool.interface';
import { SyncSchemaTool } from '../tools/sync-schema.tool';
import { WritePageTool } from '../tools/write-page.tool';
import { WriteMenuTool } from '../tools/write-menu.tool';
import { WriteControllerTool } from '../tools/write-controller.tool';
import { LoadSkillTool } from '../tools/load-skill.tool';
import { ReadFileTool } from '../tools/read-file.tool';
import { WriteFileTool } from '../tools/write-file.tool';

export class AdminPanelApp implements App {
  shells(): Shell[] {
    return [new SymfonyShell(), new ReactShell()];
  }

  tools(): Tool[] {
    return [
      new SyncSchemaTool(),
      new WritePageTool(),
      new WriteMenuTool(),
      new WriteControllerTool(),
      new LoadSkillTool(),
      new ReadFileTool(),
      new WriteFileTool(),
    ];
  }

  systemPrompt(): string {
    return `You are an expert full-stack developer specializing in building admin panels and CRUD applications. 
You have access to tools that can help you:
- Sync database schemas
- Write React pages
- Configure menu items
- Write PHP controllers

When the user asks you to build or modify features, use the available tools to implement the changes.
Always think step by step and use the appropriate tools for each task.
Provide clear explanations of what you're doing and why.`;
  }
}
