import { Shell } from './shell.interface';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';

export class SymfonyShell implements Shell {
  async init(projectPath: string): Promise<void> {
    const templatePath = path.join(process.cwd(), 'templates/backend');
    const targetPath = path.join(projectPath, 'backend');

    console.log(`SymfonyShell: Copying template from ${templatePath} to ${targetPath}`);

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Copy directory recursively, skipping .git, vendor, var, config/jwt, and composer.lock
    this.copyDirectory(templatePath, targetPath, ['.git', 'vendor', 'var'], ['config/jwt'], ['composer.lock']);

    console.log('SymfonyShell: Template copied successfully');

    // Run composer install
    await this.runCommandAsync('composer install', targetPath);
    console.log('SymfonyShell: Composer install completed');

    // Generate JWT keypair
    await this.runCommandAsync('php bin/console lexik:jwt:generate-keypair --overwrite', targetPath);
    console.log('SymfonyShell: JWT keypair generated');

    // Initialize database and user
    await this.runCommandAsync('php bin/console app:init', targetPath);
    console.log('SymfonyShell: Database and user initialized');

    // Start Symfony as independent visible Windows process
    this.startSymfonyServer(targetPath);
  }

  private copyDirectory(
    src: string,
    dest: string,
    skipFolders: string[],
    skipPaths: string[] = [],
    skipFiles: string[] = [],
  ): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip specified folders by name
        if (skipFolders.includes(entry.name)) {
          console.log(`SymfonyShell: Skipping folder ${entry.name}`);
          continue;
        }

        // Skip specified paths (relative to template root)
        const relativePath = path.relative(path.join(process.cwd(), 'templates/backend'), srcPath);
        if (skipPaths.some(skipPath => relativePath.startsWith(skipPath))) {
          console.log(`SymfonyShell: Skipping path ${relativePath}`);
          continue;
        }

        // Create directory and recurse
        fs.mkdirSync(destPath, { recursive: true });
        this.copyDirectory(srcPath, destPath, skipFolders, skipPaths, skipFiles);
      } else {
        if (skipFiles.includes(entry.name)) {
          console.log(`SymfonyShell: Skipping file ${entry.name}`);
          continue;
        }

        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private runCommandAsync(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`SymfonyShell: Running command "${command}" in ${cwd}`);

      exec(command, {
        cwd, env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          APPDATA: process.env.APPDATA,
          COMPOSER_HOME: process.env.COMPOSER_HOME,
          USERPROFILE: process.env.USERPROFILE, // Windows
          SystemRoot: process.env.SystemRoot,   // Windows
        }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`SymfonyShell: Command failed: ${error.message}`);
          if (stderr) console.error(`SymfonyShell: stderr: ${stderr}`);
          reject(error);
          return;
        }
        if (stdout) console.log(`SymfonyShell: stdout: ${stdout}`);
        resolve();
      });
    });
  }

  private startSymfonyServer(cwd: string): void {
    console.log('SymfonyShell: Starting Symfony server as independent process');
    console.log(`SymfonyShell: Working directory: ${cwd}`);

    // Spawn symfony:start as an independent visible Windows process
    let serverProcess;
    try {
      serverProcess = spawn('symfony', ['server:start'], {
        cwd,
        detached: true,
        shell: true,
        windowsHide: false, // Make the window visible
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          APPDATA: process.env.APPDATA,
          COMPOSER_HOME: process.env.COMPOSER_HOME,
          USERPROFILE: process.env.USERPROFILE, // Windows
          SystemRoot: process.env.SystemRoot,   // Windows
        }
      });
      console.log('SymfonyShell: Process spawned successfully, PID:', serverProcess.pid);
    } catch (error) {
      console.error('SymfonyShell: Failed to spawn process:', error);
      return;
    }

    serverProcess.on('error', (error) => {
      console.error('SymfonyShell: Process error event:', error);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`SymfonyShell: Process exited with code ${code}, signal ${signal}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`SymfonyShell: Process closed with code ${code}`);
    });

    serverProcess.stdout?.on('data', (data) => {
      console.log(`Symfony server stdout: ${data}`);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`Symfony server stderr: ${data}`);
    });

    serverProcess.unref(); // Allow parent to exit without waiting for this process

    console.log('SymfonyShell: Symfony server start command initiated');
  }
}
