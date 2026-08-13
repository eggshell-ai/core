import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Reads the content of a file from either the frontend or backend shell within src directory.';
  parameters = {
    type: 'object',
    properties: {
      shell: {
        type: 'string',
        enum: ['frontend', 'backend'],
        description: 'Target shell directory (frontend or backend).',
      },
      path: {
        type: 'string',
        description: 'Relative file path inside the src directory (e.g. views/dashboard/default.jsx).',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['shell', 'path'],
  };

  async execute(args: { shell: 'frontend' | 'backend'; path: string; projectPath?: string }): Promise<any> {
    try {
      console.log(`[ReadFileTool] Reading file for shell: ${args.shell}, relative path: ${args.path}`);

      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      const targetFilePath = path.join(projectPath, args.shell, 'src', args.path);

      if (!fs.existsSync(targetFilePath)) {
        return {
          success: false,
          message: `File not found at path: ${targetFilePath}`,
        };
      }

      const content = fs.readFileSync(targetFilePath, 'utf-8');

      return {
        success: true,
        message: 'File read successfully.',
        details: {
          shell: args.shell,
          path: args.path,
          filePath: targetFilePath,
          content,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[ReadFileTool] Error:`, error);
      return {
        success: false,
        message: 'Reading file failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
