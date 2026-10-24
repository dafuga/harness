import type { HarnessApiService } from '../../../services/networking-security/HarnessApiService';
import { apiInput } from './apiInput';
import { randomUUID } from 'node:crypto';
import { fail } from '../../../core/development-tooling/errors';

export async function apiAgent(
	client: HarnessApiService,
	operation: string,
	method?: string
): Promise<unknown> {
	const input = await apiInput(client.options.input);
	if (operation === 'define') {
		if (!input.contract)
			fail('Define a plan with its category, title, goal and contract in --input.');
		return client.call('createPlan', input);
	}
	if (operation === 'call') return client.call(method!, input, client.options.requestId);
	if (typeof input.provider !== 'string' || typeof input.model !== 'string' || !input.model)
		fail('Agent input must name the exact provider and model.');
	const requestId = client.options.requestId ?? randomUUID();
	if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId))
		fail('Agent request ids must be UUIDs.');
	console.error(`Agent request id: ${requestId}. Reuse it if the start response is lost.`);
	const result = await client.call('startRun', input, requestId);
	return { ...(result.data as object), requestId };
}

export function apiEventCursor(text = '0'): number {
	const after = Number(text);
	if (!Number.isSafeInteger(after) || after < 0)
		fail('Event cursors must be nonnegative integers.');
	return after;
}
