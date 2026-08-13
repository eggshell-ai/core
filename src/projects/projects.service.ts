import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async getAllProjects() {
    return this.prisma.project.findMany();
  }

  async createProject(prompt: string) {
    if (typeof prompt !== 'string') {
      throw new BadRequestException('Prompt must be a string');
    }

    const rawName = prompt.substring(0, 50);
    const name = rawName;
    const slug = rawName.toLowerCase().replace(/\s+/g, '-');

    return this.prisma.project.create({
      data: {
        name,
        slug,
        path: '/dashbaord',
      },
    });
  }
}
