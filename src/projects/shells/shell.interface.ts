export interface Shell {
  init(projectPath: string): Promise<void>;
}
