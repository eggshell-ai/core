export interface Skill {
  name: string;
  description: string;
  content: string;
  category?: string;
  tags?: string[];
}

export interface SkillLoadResult {
  success: boolean;
  skill?: Skill;
  error?: string;
}
