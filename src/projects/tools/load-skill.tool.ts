import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class LoadSkillTool implements Tool {
  name = 'load_skill';
  description = 'Loads a skill by name to teach the agent how to perform specific tasks. Skills contain detailed instructions and examples for common development patterns.';
  parameters = {
    type: 'object',
    properties: {
      skillName: {
        type: 'string',
        description: 'The name of the skill to load (e.g., crud_creation)',
      },
    },
    required: ['skillName'],
  };

  async execute(args: { skillName: string }): Promise<any> {
    try {
      console.log(`[LoadSkillTool] Loading skill:`, args.skillName);
      
      const skill = await this.loadSkill(args.skillName);
      
      if (!skill) {
        return {
          success: false,
          message: `Skill '${args.skillName}' not found.`,
          error: 'Skill not found',
        };
      }
      
      return {
        success: true,
        message: `Skill '${args.skillName}' loaded successfully.`,
        details: {
          skillName: skill.name,
          description: skill.description,
          category: skill.category,
          tags: skill.tags,
          content: skill.content,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[LoadSkillTool] Error:`, error);
      return {
        success: false,
        message: 'Failed to load skill.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async loadSkill(skillName: string): Promise<any> {
    // Construct the path to the skills directory
    const skillsDir = path.join(process.cwd(), 'src', 'llm', 'skills');
    
    // Try to find the skill file
    const skillFileName = `${skillName}.skill.ts`;
    const skillFilePath = path.join(skillsDir, skillFileName);
    
    if (!fs.existsSync(skillFilePath)) {
      console.error(`[LoadSkillTool] Skill file not found:`, skillFilePath);
      return null;
    }
    
    // Read and parse the skill file
    const skillContent = fs.readFileSync(skillFilePath, 'utf-8');
    
    // Extract the skill object from the file
    // The file should export a Skill object
    const skillMatch = skillContent.match(/export const \w+: Skill = ({[\s\S]*});/);
    if (!skillMatch) {
      console.error(`[LoadSkillTool] Could not parse skill object from file`);
      return null;
    }
    
    try {
      // Parse the skill object (this is a simple approach, in production you might want to use proper AST parsing)
      const skillObjectStr = skillMatch[1];
      
      // Evaluate the skill object (safe in this controlled environment)
      // In production, you might want to use a proper parser
      const skill = eval(`(${skillObjectStr})`);
      
      console.log(`[LoadSkillTool] Skill loaded:`, skill.name);
      return skill;
    } catch (error) {
      console.error(`[LoadSkillTool] Error parsing skill object:`, error);
      return null;
    }
  }
}
