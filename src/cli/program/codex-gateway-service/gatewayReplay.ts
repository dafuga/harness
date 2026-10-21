import { createHash } from 'node:crypto';
import type { GatewayRequest } from '../../../utils/development-tooling/gatewayTypes';

export function gatewayReplay(request: GatewayRequest): string {
	return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}
