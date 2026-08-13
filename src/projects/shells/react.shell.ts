import { Shell } from './shell.interface';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';

export class ReactShell implements Shell {
  async init(projectPath: string): Promise<void> {
    const templatePath = path.join(process.cwd(), 'templates/admin-panel');
    const targetPath = path.join(projectPath, 'frontend');

    console.log(`ReactShell: Copying template from ${templatePath} to ${targetPath}`);

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Copy directory recursively, skipping .git and node_modules folders
    this.copyDirectory(templatePath, targetPath, ['.git', 'node_modules']);

    console.log('ReactShell: Template copied successfully');

    // Run npm install --force
    await this.runCommandAsync('npm install --force', targetPath);
    console.log('ReactShell: npm install completed');

    // Start npm run dev as independent visible Windows process
    this.startDevServer(targetPath);
  }

  private copyDirectory(src: string, dest: string, skipFolders: string[]): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip specified folders
        if (skipFolders.includes(entry.name)) {
          console.log(`ReactShell: Skipping folder ${entry.name}`);
          continue;
        }

        // Create directory and recurse
        fs.mkdirSync(destPath, { recursive: true });
        this.copyDirectory(srcPath, destPath, skipFolders);
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private runCommand(command: string, cwd: string, callback: () => void): void {
    console.log(`ReactShell: Running command "${command}" in ${cwd}`);
    
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`ReactShell: Command failed: ${error.message}`);
        if (stderr) console.error(`ReactShell: stderr: ${stderr}`);
        return;
      }
      if (stdout) console.log(`ReactShell: stdout: ${stdout}`);
      callback();
    });
  }

  private runCommandAsync(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`ReactShell: Running command "${command}" in ${cwd}`);
      
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.error(`ReactShell: Command failed: ${error.message}`);
          if (stderr) console.error(`ReactShell: stderr: ${stderr}`);
          reject(error);
          return;
        }
        if (stdout) console.log(`ReactShell: stdout: ${stdout}`);
        resolve();
      });
    });
  }

  private startDevServer(cwd: string): void {
    console.log('ReactShell: Starting dev server as independent process');
    
    // Spawn npm run dev as an independent visible Windows process
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd,
      detached: true,
      shell: true,
      windowsHide: false, // Make the window visible
    });

    serverProcess.unref(); // Allow parent to exit without waiting for this process

    serverProcess.stdout?.on('data', (data) => {
      console.log(`React dev server: ${data}`);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`React dev server error: ${data}`);
    });

    console.log('ReactShell: Dev server started successfully');
  }
}
