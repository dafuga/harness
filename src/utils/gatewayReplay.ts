import { createHash } from 'node:crypto';
import type { GatewayRequest } from './gatewayTypes';
export function gatewayReplay(request: GatewayRequest): string {
	return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}
