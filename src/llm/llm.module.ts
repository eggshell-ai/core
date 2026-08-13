import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import { MockLLMService } from './mock-llm.service';
import { AgentService } from './agent.service';
import { LLM_SERVICE_TOKEN } from './llm.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    OllamaService,
    {
      provide: LLM_SERVICE_TOKEN,
      useClass: OllamaService,
    },
    AgentService,
  ],
  exports: [LLM_SERVICE_TOKEN, OllamaService, AgentService],
})
export class LLMModule {}
