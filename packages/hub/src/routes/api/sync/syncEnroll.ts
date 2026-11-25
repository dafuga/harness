import type { SyncCall } from './syncPolicy.types';
import { askAccount } from './syncAccount';
import { fromBase64Url } from './syncBase64';
import { readSyncJson, syncProblem } from './syncHttp';

const stepBytes = 4 * 1024;

/** Passes the enrollment protocol's public fields to the account mailbox. */
export async function enroll(call: SyncCall): Promise<Response> {
	const id = call.parts[1];
	if (id !== undefined && !/^[0-9a-f]{32}$/.test(id)) return syncProblem(400, 'invalid-input');
	const path = id === undefined ? '/enroll' : `/enroll/${id}`;
	if (call.request.method === 'GET') return forward(call, path);
	const value = await readSyncJson(call.request, stepBytes);
	if (!isObject(value)) return syncProblem(400, 'invalid-input');
	const valid = id === undefined ? isOpening(value) : isStep(value, call.device);
	if (!valid) return syncProblem(400, 'invalid-input');
	return forward(call, path, {
		method: 'POST',
		body: JSON.stringify({ by: call.device, body: JSON.stringify(value) })
	});
}

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOpening(value: Record<string, unknown>): boolean {
	return (
		Object.keys(value).length === 3 &&
		isPublicPoint(value.kemPublic) &&
		isPublicPoint(value.signingPublic) &&
		isHash(value.commit)
	);
}

function isStep(value: Record<string, unknown>, device: string): boolean {
	const fieldCount = Object.keys(value).length;
	const nonce = decode(value.nonce)?.length === 32;
	if (fieldCount === 1) return nonce || isHash(value.entryHash);
	return fieldCount === 2 && nonce && value.approver === device;
}

function decode(value: unknown): Uint8Array | null {
	return typeof value === 'string' ? fromBase64Url(value) : null;
}

function isPublicPoint(value: unknown): boolean {
	const bytes = decode(value);
	return bytes?.length === 65 && bytes[0] === 4;
}

function isHash(value: unknown): boolean {
	return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
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
