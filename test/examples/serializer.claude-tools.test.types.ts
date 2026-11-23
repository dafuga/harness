import type { ClaudeToolsSerializer } from '../../src/serializers/agents-providers/claude-tools-serializer/ClaudeToolsSerializer';

export type Repository = ConstructorParameters<typeof ClaudeToolsSerializer>[0];

export type Session = Parameters<ClaudeToolsSerializer['server']>[1];
