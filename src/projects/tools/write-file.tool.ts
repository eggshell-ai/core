import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Writes content to a file in either the frontend or backend shell within src directory.';
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
      content: {
        type: 'string',
        description: 'The file content to write.',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['shell', 'path', 'content'],
  };

  async execute(args: { shell: 'frontend' | 'backend'; path: string; content: string; projectPath?: string }): Promise<any> {
    try {
      console.log(`[WriteFileTool] Writing file for shell: ${args.shell}, relative path: ${args.path}`);

      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      const targetFilePath = path.join(projectPath, args.shell, 'src', args.path);
      const targetDir = path.dirname(targetFilePath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetFilePath, args.content, 'utf-8');

      console.log(`[WriteFileTool] File written to:`, targetFilePath);

      return {
        success: true,
        message: 'File written successfully.',
        details: {
          shell: args.shell,
          path: args.path,
          filePath: targetFilePath,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[WriteFileTool] Error:`, error);
      return {
        success: false,
        message: 'Writing file failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
