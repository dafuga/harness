import { responseRecord } from './RemoteProjectResponseValidator';
import type { NativeHostedCredential } from "../adapters/hosted-http-adapter/HostedHttpAdapter";
import type { NativeHostedStatus } from '../models/ProjectContext.types';
export class NativeHandoffValidator {
	start(value: unknown, origin: string, now: number) {
		const item = responseRecord(value);
		if (
			typeof item.handoffId !== 'string' ||
			!/^[\w-]{1,200}$/.test(item.handoffId) ||
			item.verificationUrl !== `${origin}/native/${encodeURIComponent(item.handoffId)}`
		)
			throw new Error('Invalid native handoff URL.');
		if (
			typeof item.userCode !== 'string' ||
			item.userCode.length > 40 ||
			typeof item.interval !== 'number' ||
			item.interval < 1 ||
			item.interval > 30
		)
			throw new Error('Invalid native handoff.');
		const expiresAt = this.expiry(item.expiresAt, now);
		return {
			handoffId: item.handoffId,
			userCode: item.userCode,
			verificationUrl: item.verificationUrl as string,
			expiresAt,
			interval: item.interval
		};
	}
	exchange(
		value: unknown,
		expected: { origin: string; nonce: string; resource: string },
		now: number
	): { credential: NativeHostedCredential; status: NativeHostedStatus } {
		const item = responseRecord(value),
			actor = responseRecord(item.actor);
		if (
			item.audience !== 'harness-desktop' ||
			item.nonce !== expected.nonce ||
			item.resource !== expected.resource ||
			typeof item.authorization !== 'string'
		)
			throw new Error('Native handoff binding mismatch.');
		this.expiry(item.expiresAt, now);
		if (
			typeof actor.id !== 'string' ||
			typeof actor.email !== 'string' ||
			typeof actor.name !== 'string' ||
			actor.emailVerified !== true
		)
			throw new Error('Invalid native handoff identity.');
		return {
			credential: { origin: expected.origin, principalId: actor.id, token: item.authorization },
			status: {
				configured: true,
				state: 'signed-in',
				actor: { id: actor.id, email: actor.email, name: actor.name }
			}
		};
	}
	private expiry(value: unknown, now: number): string {
		if (
			typeof value !== 'string' ||
			!Number.isFinite(Date.parse(value)) ||
			Date.parse(value) <= now
		)
			throw new Error('Expired native handoff.');
		return value;
	}
}
