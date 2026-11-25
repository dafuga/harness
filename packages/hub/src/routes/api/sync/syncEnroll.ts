import type { SyncCall } from './syncPolicy.types';
import { askAccount } from './syncAccount';
import { readSyncText, syncProblem } from './syncHttp';

const stepBytes = 4 * 1024;

/** Passes a sign-in mailbox call to the account object. The steps are opaque; only their size is checked. */
export async function enroll(call: SyncCall): Promise<Response> {
	const id = call.parts[1];
	if (id !== undefined && !/^[0-9a-f]{32}$/.test(id)) return syncProblem(400, 'invalid-input');
	const path = id === undefined ? '/enroll' : `/enroll/${id}`;
	if (call.request.method === 'GET') return forward(call, path);
	const text = await readSyncText(call.request, stepBytes);
	if (text === null || !isObject(text)) return syncProblem(400, 'invalid-input');
	return forward(call, path, {
		method: 'POST',
		body: JSON.stringify({ by: call.device, body: text })
	});
}

function isObject(text: string): boolean {
	try {
		const value: unknown = JSON.parse(text);
		return !!value && typeof value === 'object' && !Array.isArray(value);
	} catch {
		return false;
	}
}

async function forward(call: SyncCall, path: string, init?: RequestInit): Promise<Response> {
	const answer = askAccount(call, path, init);
	if (!answer) return syncProblem(503, 'unavailable');
	const response = await answer;
	const body = await response.text();
	return new Response(body, {
		status: response.status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
	});
}
