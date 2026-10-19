import { NATIVE_ACTION, NATIVE_AUDIENCE } from "../../models/HubAuth.types.ts";
import type { HubEnvironment, NativeApproveInput, NativeAuthorization, NativeExchangeInput, NativePollResult, NativeStartInput, NativeStartResult } from "../../models/HubAuth.types.ts";
import type { ExchangeStore, NativeExchangeRecord, SessionRecord } from "../../models/HubAuthStore.types.ts";
import type { SessionRepository } from "../../repositories/SessionRepository";
import { authFail } from "../../utils/authFail";
import { normalizeCode, userCode } from "./authSecrets";
import { randomToken, safeEqual, sha256Url } from "../../utils/authSecrets";
import type { AuthSecrets } from "../../utils/authSecrets";

export const HANDOFF_TTL = 5 * 60 * 1000;

export const POLL_INTERVAL = 2;

export interface NativeHandoffOptions {
	store: ExchangeStore;
	sessions: SessionRepository;
	secrets: AuthSecrets;
	origin: string;
	environment: HubEnvironment;
	now: () => number;
}

/**
 * Hands a browser sign-in to the desktop app by polling. The desktop keeps a PKCE verifier; the
 * browser only ever sees a handoff id, which is worthless without that verifier.
 */
export class NativeHandoffService {
	constructor(private readonly options: NativeHandoffOptions) {}

	async start(input: NativeStartInput): Promise<NativeStartResult> {
		const { store, secrets, origin, environment, now } = this.options;
		const handoffId = randomToken();
		const code = userCode();
		const expiresAt = now() + HANDOFF_TTL;
		await store.create({
			id: handoffId,
			challenge: input.challenge,
			nonceHash: await secrets.hash('native-nonce', input.nonce),
			codeHash: await this.codeHash(handoffId, normalizeCode(code)),
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
			verificationUrl: `${origin}/native/${handoffId}`,
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
			codeHash: await this.codeHash(input.handoffId, input.userCode),
			subject: session.actor.id,
			parentHash: session.idHash,
			now: this.options.now()
		});
		const record = approved ? await this.options.store.find(input.handoffId) : null;
		return record ? { approved: true, resource: record.resource } : authFail('handoff-invalid');
	}

	async poll(handoffId: string): Promise<NativePollResult> {
		const record = await this.options.store.find(handoffId);
		const live = record && record.status !== 'consumed' && record.expiresAt > this.options.now();
		if (!live) return { status: 'expired', resource: null };
		return {
			status: record.status === 'approved' ? 'approved' : 'pending',
			resource: record.resource
		};
	}

	/** One attempt. The handoff is consumed before any binding is compared. */
	async exchange(input: NativeExchangeInput): Promise<NativeAuthorization> {
		const { store, sessions, now } = this.options;
		const record = await store.claim(input.handoffId, now());
		if (!record || !(await this.bound(record, input))) return authFail('handoff-invalid');
		const parent = record.parentHash ? await sessions.live(record.parentHash) : null;
		if (parent?.kind !== 'browser' || parent.actor.id !== record.subject) {
			return authFail('handoff-invalid');
		}
		const grant = { actor: parent.actor, resource: record.resource, parentHash: parent.idHash };
		const issued = await sessions.issue({ kind: 'native', ...grant });
		// A sign-out may land between the check above and the insert. Looking again after the
		// insert covers both orders: an earlier sign-out is seen here, a later one revokes the row.
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

	private codeHash(handoffId: string, code: string): Promise<string> {
		return this.options.secrets.hash('native-code', `${handoffId}\n${code}`);
	}
}
