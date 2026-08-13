import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class WritePageTool implements Tool {
  name = 'write_page';
  description = 'Creates a new page component with the given code and optionally adds it to the menu.';
  parameters = {
    type: 'object',
    properties: {
      route: {
        type: 'string',
        description: 'The route path for the page (e.g., /products)',
      },
      code: {
        type: 'string',
        description: 'The React component code for the page.',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['route', 'code'],
  };

  async execute(args: { route: string; code: string; projectPath?: string }): Promise<any> {
    try {
      console.log(`[WritePageTool] Creating page for route:`, args.route);
      
      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      
      // Break the route into pieces (e.g., /products/create -> ['products', 'create'])
      const routeSegments = this.parseRoute(args.route);
      console.log(`[WritePageTool] Route segments:`, routeSegments);
      
      // Write the page component
      const pagePath = await this.writePageComponent(projectPath, routeSegments, args.code);
      
      return {
        success: true,
        message: 'Page created successfully.',
        details: {
          route: args.route,
          pagePath,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[WritePageTool] Error:`, error);
      return {
        success: false,
        message: 'Page creation failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private parseRoute(route: string): string[] {
    // Remove leading slash and split by /
    return route.replace(/^\//, '').split('/').filter(segment => segment.length > 0);
  }

  private async writePageComponent(projectPath: string, routeSegments: string[], code: string): Promise<string> {
    // Construct the path: projectRoot/frontend/src/app/(dashboard)/<routes>/page.tsx
    const frontendDir = path.join(projectPath, 'frontend');
    const appDir = path.join(frontendDir, 'src', 'app', '(dashboard)');
    
    // Build the full directory path for the route
    const routeDir = path.join(appDir, ...routeSegments);
    
    // Ensure the directory exists
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }
    
    // Write the page.tsx file
    const pagePath = path.join(routeDir, 'page.tsx');
    fs.writeFileSync(pagePath, code, 'utf-8');
    
    console.log(`[WritePageTool] Page written to:`, pagePath);
    return pagePath;
  }
}
