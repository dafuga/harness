import type { SyncCall } from './syncPolicy.types';
import { askAccount } from './syncAccount';
import { syncProblem } from './syncHttp';

/** The live WebSocket: pokes, sealed stream frames and sign-in notices from the account object. */
export function live(call: SyncCall): Promise<Response> | Response {
	if (call.request.headers.get('Upgrade') !== 'websocket')
		return syncProblem(426, 'upgrade-required');
	const answer = askAccount(call, `/live?device=${encodeURIComponent(call.device)}`, {
		headers: { Upgrade: 'websocket' }
	});
	return answer ?? syncProblem(503, 'unavailable');
}
