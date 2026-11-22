import type { ClaudeQueryService } from '../../src/cli/program/codex-gateway-service/claude-query-service/ClaudeQueryService';

export type Request = Parameters<ClaudeQueryService['run']>[0];

export type Session = Parameters<ClaudeQueryService['run']>[1];
