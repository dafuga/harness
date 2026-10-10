import type { UnitRuntime } from '../core/runtimeTypes';
import { runtimeReply } from './runtimeReply';

/**
 * Serves a unit from a fetch handler, for a Worker or any platform that speaks Request and
 * Response. The wire contract is the one the Node runtime server speaks.
 */
export function runtimeFetch(runtime: UnitRuntime): (request: Request) => Promise<Response> {
	return async (request) => {
		const reply = await runtimeReply(runtime, request.method, () => request.text());
		return new Response(JSON.stringify(reply.value), {
			status: reply.status,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
		});
	};
}
