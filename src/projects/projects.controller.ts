import { Controller, Get, Post, Body, NotFoundException, Param, Sse, MessageEvent, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AdminPanelApp } from './apps/admin-panel.app';
import { AgentService } from '../llm/agent.service';
import { Observable } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly agentService: AgentService,
  ) {}

  @Get()
  async getProjects() {
    return this.projectsService.getAllProjects();
  }

  @Sse(':slug/prompt')
  executePrompt(@Param('slug') slug: string, @Query('prompt') prompt: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      const rootDir = path.resolve(process.cwd());
      const projectPath = path.join(rootDir, 'content', slug);
      
      if (!fs.existsSync(projectPath)) {
        observer.error(new NotFoundException(`Project '${slug}' not found`));
        return;
      }
      
      const adminPanelApp = new AdminPanelApp();
      const tools = adminPanelApp.tools();
      const systemPrompt = adminPanelApp.systemPrompt();
      
      this.agentService.runAgent(
        systemPrompt,
        prompt,
        tools,
        { 
          maxTurns: 10,
          context: { projectPath, slug },
          onEvent: (event) => {
            observer.next({ data: JSON.stringify(event) });
          }
        }
      ).then(() => {
        observer.complete();
      }).catch((error) => {
        console.error('Error executing prompt:', error);
        observer.error(new Error(`Failed to execute prompt: ${error.message}`));
      });
    });
  }

  @Sse('create')
  createProject(@Query('prompt') prompt: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      const rootDir = path.resolve(process.cwd());
      const contentDir = path.join(rootDir, 'content');
      
      if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
      }
      
      const projectDir = path.join(contentDir, 'dummy-project');
      
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      
      const adminPanelApp = new AdminPanelApp();
      const shells = adminPanelApp.shells();
      const tools = adminPanelApp.tools();
      const systemPrompt = adminPanelApp.systemPrompt();
      
      // Initialize shells
      Promise.all(shells.map(shell => shell.init(projectDir)))
        .then(() => {
          // Emit initialization event
          observer.next({ 
            data: JSON.stringify({ 
              type: 'init', 
              data: { projectPath: projectDir, shellsCount: shells.length } 
            }) 
          });
          
          // Run agent with the prompt
          return this.agentService.runAgent(
            systemPrompt,
            prompt,
            tools,
            { 
              maxTurns: 10,
              context: { projectPath: projectDir, slug: 'dummy-project' },
              onEvent: (event) => {
                observer.next({ data: JSON.stringify(event) });
              }
            }
          );
        })
        .then(() => {
          observer.complete();
        })
        .catch((error) => {
          console.error('Error creating project:', error);
          observer.error(new Error(`Failed to create project: ${error.message}`));
        });
    });
  }
}
