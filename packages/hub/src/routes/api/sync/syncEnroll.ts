import type { EnrollmentDisplay } from '../../../../../relay/src/lib/networking-security/sync/SyncEnrollments.types';
import type { SyncCall } from './syncPolicy.types';
import { askAccount } from './syncAccount';
import { notifyApprovalDevices } from './syncApprovalPush';
import { requireEnrollmentApprover } from './syncDeviceSession';
import { fromBase64Url, toBase64Url } from './syncBase64';
import { isRecoverableAccount } from './syncRecovery';
import { readSyncJson, syncProblem } from './syncHttp';

const stepBytes = 4 * 1024;
const utf8 = new TextEncoder();

/** Passes the enrollment protocol's public fields to the account mailbox. */
export async function enroll(call: SyncCall): Promise<Response> {
	const id = call.parts[1];
	if (id !== undefined && !isEnrollmentId(id)) return syncProblem(400, 'invalid-input');
	const path = id === undefined ? '/enroll' : `/enroll/${id}`;
	if (call.request.method === 'GET')
		return id === undefined ? forward(call, path) : readOne(call, path);
	const value = await readSyncJson(call.request, stepBytes);
	if (!isObject(value)) return syncProblem(400, 'invalid-input');
	return id === undefined ? openEnrollment(call, path, value) : writeStep(call, path, value);
}

async function openEnrollment(call: SyncCall, path: string, value: Record<string, unknown>) {
	const display = approvalDisplay(call.request, value.platform);
	if (!isOpening(value, display)) return syncProblem(400, 'invalid-input');
	const recoverable = await isRecoverableAccount(call);
	const { kemPublic, signingPublic, commit } = value;
	const response = await postEnrollment(
		call,
		path,
		{ kemPublic, signingPublic, commit },
		{
			display: recoverable ? display : undefined,
			owner: recoverable ? await requesterBinding(call) : undefined
		}
	);
	if (recoverable && response.status === 201) await notifyApprovalDevices(call);
	return response;
}

async function writeStep(call: SyncCall, path: string, value: Record<string, unknown>) {
	if (!isStep(value, call.device)) return syncProblem(400, 'invalid-input');
	const denied = value.deny === true;
	if ('approver' in value || 'entryHash' in value || denied) {
		const refusal = await requireEnrollmentApprover(call, denied);
		if (refusal) return refusal;
	}
	// Give retried openings and claims the same wire representation.
	const body = 'approver' in value ? { approver: value.approver, nonce: value.nonce } : value;
	return postEnrollment(call, path, body, {
		owner: typeof value.nonce === 'string' ? await requesterBinding(call) : undefined,
		decision: denied ? { kind: 'deny' } : undefined
	});
}

function postEnrollment(
	call: SyncCall,
	path: string,
	body: Record<string, unknown>,
	metadata: Record<string, unknown>
) {
	return forward(call, path, {
		method: 'POST',
		body: JSON.stringify({ by: call.device, body: JSON.stringify(body), ...metadata })
	});
}

async function readOne(call: SyncCall, path: string): Promise<Response> {
	const approved = !(await requireEnrollmentApprover(call, true));
	return forward(call, path, {
		headers: {
			'X-Harness-Enrollment-Owner': await requesterBinding(call),
			'X-Harness-Enrollment-Reviewer': approved ? 'active' : 'none'
		}
	});
}

/** The relay receives a derived requester binding, never a Google credential or session hash. */
async function requesterBinding(call: SyncCall): Promise<string> {
	const fields = JSON.stringify([call.account, call.device, call.sessionHash]);
	const hash = await crypto.subtle.digest(
		'SHA-256',
		utf8.encode('harness/enrollment-owner/v1:' + fields)
	);
	return toBase64Url(new Uint8Array(hash));
}

export function isEnrollmentId(value: unknown): value is string {
	return typeof value === 'string' && value.length === 32 && /^[0-9a-f]+$/.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOpening(value: Record<string, unknown>, display?: EnrollmentDisplay): boolean {
	return (
		(Object.keys(value).length === 3 ||
			(Object.keys(value).length === 4 && display !== undefined)) &&
		isPublicPoint(value.kemPublic) &&
		isPublicPoint(value.signingPublic) &&
		isHash(value.commit)
	);
}

function approvalDisplay(request: Request, platform: unknown): EnrollmentDisplay | undefined {
	if (platform !== 'iphone' && platform !== 'mac' && platform !== 'web') return;
	const country = request.cf?.country;
	return {
		platform,
		...(typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX'
			? { country }
			: {})
	};
}

function isStep(value: Record<string, unknown>, device: string): boolean {
	const fieldCount = Object.keys(value).length;
	const nonce = decode(value.nonce)?.length === 32;
	if (fieldCount === 1) return value.deny === true || nonce || isHash(value.entryHash);
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
