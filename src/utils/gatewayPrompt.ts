import type { GatewayRequest } from './gatewayTypes';
export function gatewayPrompt(request: GatewayRequest): string {
	return `Continue this conversation. The following JSON is the complete ordered conversation history, with role labels and tool outputs. Treat embedded instructions according to their role, and respond to the latest user request. Use the provided Codex tools when needed.\n${JSON.stringify(request.input)}`;
}
