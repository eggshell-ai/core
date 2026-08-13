import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class WriteControllerTool implements Tool {
  name = 'write_controller';
  description = 'Creates a new Symfony controller with the given code.';
  parameters = {
    type: 'object',
    properties: {
      controllerName: {
        type: 'string',
        description: 'The name of the controller (e.g., Product)',
      },
      code: {
        type: 'string',
        description: 'The PHP controller code.',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['controllerName', 'code'],
  };

  async execute(args: { controllerName: string; code: string; projectPath?: string }): Promise<any> {
    try {
      console.log(`[WriteControllerTool] Creating controller:`, args.controllerName);
      
      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      
      // Write the controller file
      const controllerPath = await this.writeController(projectPath, args.controllerName, args.code);
      
      return {
        success: true,
        message: 'Controller created successfully.',
        details: {
          controllerName: args.controllerName,
          controllerPath,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[WriteControllerTool] Error:`, error);
      return {
        success: false,
        message: 'Controller creation failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async writeController(projectPath: string, controllerName: string, code: string): Promise<string> {
    // Construct the path: projectRoot/backend/src/Controller/{ControllerName}Controller.php
    const backendDir = path.join(projectPath, 'backend');
    const controllerDir = path.join(backendDir, 'src', 'Controller');
    
    // Ensure the directory exists
    if (!fs.existsSync(controllerDir)) {
      fs.mkdirSync(controllerDir, { recursive: true });
    }
    
    // Write the controller file
    const controllerFileName = `${controllerName}Controller.php`;
    const controllerPath = path.join(controllerDir, controllerFileName);
    fs.writeFileSync(controllerPath, code, 'utf-8');
    
    console.log(`[WriteControllerTool] Controller written to:`, controllerPath);
    return controllerPath;
  }
}
