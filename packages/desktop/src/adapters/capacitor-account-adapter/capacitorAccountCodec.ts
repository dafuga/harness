import type { Query } from '../../models/BrowserApi.types';
import { browserError } from '../browser-project-adapter/browserError';
import type { AccountNativeReply, AccountNativeStatus } from '../../models/Environment.types';
import type { NativeHostedStatus } from '../../models/ProjectContext.types';

/** The most bytes of one answer; the plugin refuses a larger one before it reaches the page. */
export const replyLimit = 16 * 1024 * 1024;

/** What a refusal of the plugin is to the shared reads: the status the Hub would have answered. */
const refusals = new Map([
	['session-required', 401],
	['account-mismatch', 401],
	['superseded', 401],
	['not-configured', 401],
	['request-refused', 400],
	['too-large', 413]
]);

const states: readonly string[] = ['signed-out', 'pending', 'signed-in'];

const large = 'The answer of the Hub is too large for this phone.';

const unreadable = 'The Hub sent an answer this app cannot read.';

/** An error as the shared reads expect one: a status, a code and words a person can read. */
export function failure(status: number, code: string, message = browserError(code, status)) {
	return Object.assign(new Error(message), { status, code });
}

/** What the plugin rejects with keeps its code and its words, both written natively. */
export function refusal(cause: unknown) {
	const { code, message } = (cause ?? {}) as { code?: unknown; message?: unknown };
	const named = typeof code === 'string' && code ? code : 'failed';
	const status = refusals.get(named) ?? 0;
	return failure(status, named, typeof message === 'string' && message ? message : undefined);
}

/** The bytes of an answer, refused whole when they are not base64 or more than the limit. */
export function decoded(data: unknown, limit: number): Uint8Array {
	if (typeof data !== 'string') throw failure(0, 'unreadable', unreadable);
	if (data.length > Math.ceil(limit / 3) * 4) throw failure(413, 'too-large', large);
	let bytes: Uint8Array;
	try {
		bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
	} catch {
		throw failure(0, 'unreadable', unreadable);
	}
	if (bytes.length > limit) throw failure(413, 'too-large', large);
	return bytes;
}

export function json<T>(reply: AccountNativeReply): T {
	const text = new TextDecoder().decode(decoded(reply.data, replyLimit));
	try {
		return JSON.parse(text) as T;
	} catch {
		throw failure(0, 'unreadable', unreadable);
	}
}

/** A refusal of the Hub, by its public code only: nothing else of its body is repeated. */
export function refused(reply: AccountNativeReply) {
	let code = '';
	try {
		const head = { ...reply, data: String(reply.data).slice(0, 8192) };
		const body = json<{ error?: unknown } | null>(head);
		code = typeof body?.error === 'string' ? body.error : '';
	} catch {
		code = '';
	}
	return failure(Number(reply.status) || 0, code);
}

/** The fields of a read as text; empty ones are left out, as the hosted page leaves them out. */
export function fields(query: Query = {}): Record<string, string> {
	const kept = Object.entries(query).filter((item): item is [string, string] => Boolean(item[1]));
	return Object.fromEntries(kept);
}

/** Only plain data crosses the native bridge: no proxy, no undefined. */
export function plain(body: unknown): unknown {
	return JSON.parse(JSON.stringify(body ?? {}));
}

function publicActor(actor: NativeHostedStatus['actor']): NativeHostedStatus['actor'] {
	if (!actor) return undefined;
	return { id: String(actor.id), name: String(actor.name), email: String(actor.email) };
}

function publicHandoff(handoff: NativeHostedStatus['handoff']): NativeHostedStatus['handoff'] {
	if (!handoff) return undefined;
	const { userCode, verificationUrl, expiresAt, interval } = handoff;
	return {
		userCode: String(userCode),
		verificationUrl: String(verificationUrl),
		expiresAt: String(expiresAt),
		interval: Number(interval)
	};
}

/** Only the public fields of a status reach the page, whatever else a plugin might add. */
export function publicStatus(value: AccountNativeStatus): NativeHostedStatus {
	const named = String(value?.state);
	const state = (states.includes(named) ? named : 'signed-out') as NativeHostedStatus['state'];
	const status: NativeHostedStatus = { configured: value?.configured === true, state };
	const actor = state === 'signed-in' ? publicActor(value.actor) : undefined;
	const handoff = state === 'pending' ? publicHandoff(value.handoff) : undefined;
	if (actor) status.actor = actor;
	if (handoff) status.handoff = handoff;
	return status;
}

/** The public state and identity, without credentials or other plugin fields. */
export function accountIdentity(status: NativeHostedStatus | null): string {
	return JSON.stringify([status?.state, status?.actor?.id]);
}
/** The account whose protected views are currently shown. */
export function principal(status: NativeHostedStatus | null): string | null {
	return status?.state === 'signed-in' ? (status.actor?.id ?? '') : null;
}
