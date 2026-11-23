// @harness-uid u_aj2wo3ceaq
import type { NativeHandoffOptions } from './NativeHandoffService.types';
import {
	NATIVE_ACTION,
	NATIVE_AUDIENCE
} from '../../../../../models/accounts-access/HubAuth.types';
import type {
	NativeApproveInput,
	NativeCallback,
	NativeAuthorization,
	NativeExchangeInput,
	NativePollResult,
	NativeStartInput,
	NativeStartResult
} from '../../../../../models/accounts-access/HubAuth.types';
import type {
	NativeExchangeRecord,
	SessionRecord
} from '../../../../../models/accounts-access/HubAuthStore.types';
import { authFail } from '../../../../../utils/accounts-access/authFail';
import { normalizeCode, userCode } from './authSecrets';
import {
	randomToken,
	safeEqual,
	sha256Url
} from '../../../../../utils/verification-evidence/authSecrets';

export const HANDOFF_TTL = 5 * 60 * 1000;

export const POLL_INTERVAL = 2;

const CALLBACK_TTL = 60_000;

function codeHash(options: NativeHandoffOptions, handoffId: string, code: string) {
	return options.secrets.hash('native-code', `${handoffId}\n${code}`);
}

function callbackAddress(callback: NativeCallback, handoffId: string, code: string): string {
	const target =
		callback === 'ios'
			? new URL('harness-account://callback/sign-in')
			: new URL(`http://127.0.0.1:${callback}/harness-account`);
	target.searchParams.set('state', handoffId);
	target.searchParams.set('code', code);
	return target.href;
}

async function authorizeBrowser(
	options: NativeHandoffOptions,
	session: SessionRecord,
	handoffId: string
): Promise<{ callbackUrl: string }> {
	const { store, now } = options;
	const record = await store.find(handoffId);
	if (
		record?.callback === undefined ||
		record.origin !== options.origin ||
		record.environment !== options.environment
	)
		return authFail('handoff-invalid');
	const code = randomToken();
	const time = now();
	const approved = await store.approve({
		id: handoffId,
		codeHash: record.codeHash,
		callbackCodeHash: await codeHash(options, handoffId, code),
		callbackExpiresAt: time + CALLBACK_TTL,
		subject: session.actor.id,
		parentHash: session.idHash,
		now: time
	});
	if (!approved) return authFail('handoff-invalid');
	return { callbackUrl: callbackAddress(record.callback, handoffId, code) };
}

async function validReturn(
	options: NativeHandoffOptions,
	record: NativeExchangeRecord,
	code: string | undefined
): Promise<boolean> {
	if (record.callback === undefined) return code === undefined;
	return Boolean(code && safeEqual(record.codeHash, await codeHash(options, record.id, code)));
}

/** Binds the system-browser return or typed-code recovery to the initiating device's PKCE proof. */
export class NativeHandoffService {
	constructor(private readonly options: NativeHandoffOptions) {}

	async start(input: NativeStartInput): Promise<NativeStartResult> {
		const { store, secrets, origin, environment, now } = this.options;
		const handoffId = randomToken();
		const code = input.callback === undefined ? userCode() : '';
		const expiresAt = now() + HANDOFF_TTL;
		await store.create({
			id: handoffId,
			challenge: input.challenge,
			nonceHash: await secrets.hash('native-nonce', input.nonce),
			codeHash: code ? await codeHash(this.options, handoffId, normalizeCode(code)) : randomToken(),
			callback: input.callback,
			deviceName: input.deviceName,
			resource: input.resource,
			audience: NATIVE_AUDIENCE,
			action: NATIVE_ACTION,
			environment,
			origin,
			status: 'pending',
			subject: null,
			parentHash: null,
			expiresAt
		});
		return {
			handoffId,
			userCode: code,
			verificationUrl: `${origin}/native/${handoffId}${code ? '' : '?return=1'}`,
			expiresAt: new Date(expiresAt).toISOString(),
			interval: POLL_INTERVAL
		};
	}

	/** `session` must be the approver's own browser session; it becomes the handoff's subject. */
	async approve(
		session: SessionRecord,
		input: NativeApproveInput
	): Promise<{ approved: true; resource: string }> {
		const approved = await this.options.store.approve({
			id: input.handoffId,
			codeHash: await codeHash(this.options, input.handoffId, input.userCode),
			subject: session.actor.id,
			parentHash: session.idHash,
			now: this.options.now()
		});
		const record = approved ? await this.options.store.find(input.handoffId) : null;
		return record ? { approved: true, resource: record.resource } : authFail('handoff-invalid');
	}

	authorizeBrowser(session: SessionRecord, handoffId: string) {
		return authorizeBrowser(this.options, session, handoffId);
	}

	async poll(handoffId: string): Promise<NativePollResult> {
		const record = await this.options.store.find(handoffId);
		const live =
			record &&
			record.callback === undefined &&
			record.status !== 'consumed' &&
			record.expiresAt > this.options.now();
		if (!live) return { status: 'expired', resource: null };
		return {
			status: record.status === 'approved' ? 'approved' : 'pending',
			resource: record.resource
		};
	}

	/** The browser return code admits one attempt. The device must also prove the PKCE bindings. */
	async exchange(input: NativeExchangeInput): Promise<NativeAuthorization> {
		const { store, sessions, now } = this.options;
		const pending = await store.find(input.handoffId);
		if (!pending || !(await validReturn(this.options, pending, input.callbackCode)))
			return authFail('handoff-invalid');
		const record = await store.claim(input.handoffId, now());
		if (!record || !(await this.bound(record, input))) return authFail('handoff-invalid');
		const parent = record.parentHash ? await sessions.live(record.parentHash) : null;
		if (parent?.kind !== 'browser' || parent.actor.id !== record.subject) {
			return authFail('handoff-invalid');
		}
		const grant = {
			actor: parent.actor,
			resource: record.resource,
			parentHash: record.callback === undefined ? parent.idHash : null,
			deviceName: record.deviceName
		};
		const issued = await sessions.issue({ kind: 'native', ...grant });
		// Refuse a browser sign-out that raced with device enrollment.
		if (!(await sessions.live(parent.idHash))) {
			await sessions.revoke(issued.record);
			return authFail('handoff-invalid');
		}
		return {
			authorization: issued.credential,
			actor: parent.actor,
			audience: NATIVE_AUDIENCE,
			resource: record.resource,
			nonce: input.nonce,
			expiresAt: new Date(issued.record.expiresAt).toISOString()
		};
	}

	/** Verifier, nonce, resource, audience, action, environment and origin must all match. */
	private async bound(record: NativeExchangeRecord, input: NativeExchangeInput): Promise<boolean> {
		const { secrets, environment, origin } = this.options;
		const checks = [
			safeEqual(record.challenge, await sha256Url(input.verifier)),
			safeEqual(record.nonceHash, await secrets.hash('native-nonce', input.nonce)),
			record.resource === input.resource,
			record.audience === NATIVE_AUDIENCE,
			record.action === NATIVE_ACTION,
			record.environment === environment,
			record.origin === origin
		];
		return checks.every(Boolean);
	}
}

export type { NativeHandoffOptions } from './NativeHandoffService.types';
