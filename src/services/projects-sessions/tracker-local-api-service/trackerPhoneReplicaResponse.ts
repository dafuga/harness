// @harness-uid u_g7kdpz7bel
import type { TrackerPhoneReplicaService } from '../TrackerPhoneReplicaService';
import { readItemBody } from './trackerLocalItemMutation';
import type { Respond } from './trackerPhoneReplicaResponse.types';

export function phoneReplicaResponse(
	request: Request,
	url: URL,
	{ replica, respond }: { replica?: TrackerPhoneReplicaService; respond: Respond }
) {
	if (!replica) return undefined;
	if (request.method === 'GET' && url.pathname === '/phone-replica/v1')
		return replica.pull(url.searchParams);
	if (request.method === 'POST' && url.pathname === '/phone-replica/v1/write')
		return phoneWrite(request, replica, respond);
	return undefined;
}

async function phoneWrite(
	request: Request,
	replica: TrackerPhoneReplicaService,
	respond: Respond
): Promise<Response> {
	const { writer } = replica;
	const scope = writer?.scope(request.headers);
	if (!writer || !scope) return respond(403, { status: 'denied' });
	const body = await readItemBody(request, 4096);
	request.signal.throwIfAborted();
	return respond(200, writer.push(scope, body));
}
