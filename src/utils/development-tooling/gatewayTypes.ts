export type GatewayItem = Record<string, unknown>;

export interface GatewayRequest {
	model: string;
	stream: true;
	input: GatewayItem[];
	tools: GatewayItem[];
	instructions?: string;
}

export interface GatewayCall {
	id: string;
	name: string;
	arguments: string;
	custom: boolean;
	namespace?: string;
}

export type GatewayEvent =
	| { type: 'text'; text: string }
	| { type: 'call'; call: GatewayCall }
	| { type: 'done' }
	| { type: 'error'; message: string };

export interface PendingTool {
	resolve: (value: string) => void;
	reject: (error: Error) => void;
}

export interface GatewaySession {
	id: string;
	controller: globalThis.AbortController;
	pending: Map<string, PendingTool>;
	delivered: Set<string>;
	emit?: (event: GatewayEvent) => void;
	running: boolean;
	replays: Map<string, string>;
}

export { gatewayTypes } from '../../cli/program/codex-gateway-service/codex-session-repository/gatewayTypes';
