import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    let dbPath = process.env.DATABASE_URL || 'dev.db';

    const adapter = new PrismaBetterSqlite3({
      url: dbPath
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
