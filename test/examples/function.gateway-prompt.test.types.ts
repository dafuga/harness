import type { gatewayPrompt } from '../../src/cli/program/codex-gateway-service/claude-query-service/gatewayPrompt';

export type GatewayRequestInput = Parameters<typeof gatewayPrompt>[0];
