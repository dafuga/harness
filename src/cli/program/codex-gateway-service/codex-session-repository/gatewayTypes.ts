import type { GatewaySession } from '../../../../utils/development-tooling/gatewayTypes';

export function gatewayTypes(id: string): GatewaySession {
	return {
		id,
		controller: new globalThis.AbortController(),
		pending: new Map(),
		delivered: new Set(),
		running: false,
		replays: new Map()
	};
}
