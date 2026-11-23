// @harness-uid u_f6rli7oegn
import { randomBytes, createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { GoogleBrowserCallbackService } from './GoogleBrowserCallbackService';
import { NativeSignInError } from './NativeSignInError';
import { NativeHandoffValidator } from '../../validators/development-tooling/NativeHandoffValidator';
import type {
	Pending,
	AuthOptions
} from '../../lib/development-tooling/desktop-initialization/NativeAuthService.types';
import type { NativeHostedStatus } from '../../models/projects-sessions/ProjectContext.types';

/** Creates one PKCE attempt and exchanges its browser return or typed approval for a device session. */
export class NativeSignInService {
	private readonly validator = new NativeHandoffValidator();

	constructor(private readonly options: AuthOptions) {}

	async prepare(google: boolean): Promise<Pending> {
		if (!this.options.store.available())
			throw new NativeSignInError('OS encryption is required for hosted sessions.');
		const verifier = randomBytes(32).toString('base64url'),
			nonce = randomBytes(24).toString('base64url'),
			resource = 'projects';
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		const callback = google ? new GoogleBrowserCallbackService() : undefined;
		const handoff = await this.start({ challenge, nonce, resource }, callback);
		callback?.expect(handoff.handoffId);
		const { handoffId, ...publicHandoff } = handoff;
		const status: NativeHostedStatus = {
			configured: true,
			state: 'pending',
			handoff: publicHandoff
		};
		const pending: Pending = {
			callback,
			handoffId,
			verifier,
			nonce,
			resource,
			status,
			next: this.now() + handoff.interval * 1000
		};
		try {
			await this.options.open(handoff.verificationUrl);
		} catch (error) {
			callback?.close();
			throw error;
		}
		return pending;
	}
	private async start(
		proof: { challenge: string; nonce: string; resource: string },
		callback?: GoogleBrowserCallbackService
	) {
		try {
			const port = await callback?.listen();
			const deviceName =
				hostname()
					.replace(/[\p{Cc}\p{Cf}]/gu, '')
					.trim()
					.slice(0, 80) || 'Harness desktop';
			const result = await this.options.http.publicJson('/api/auth/native/start', {
				...proof,
				...(port ? { callback: port, deviceName } : {})
			});
			return this.validator.start(result, this.options.origin, this.now(), Boolean(callback));
		} catch (error) {
			callback?.close();
			throw error;
		}
	}

	async exchange(pending: Pending, callbackCode?: string): Promise<NativeHostedStatus> {
		const { handoffId, verifier, nonce, resource } = pending;
		const resultExchange = await this.options.http.publicJson('/api/auth/native/exchange', {
			handoffId,
			verifier,
			nonce,
			resource,
			...(callbackCode ? { callbackCode } : {})
		});
		const accepted = this.validator.exchange(
			resultExchange,
			{ origin: this.options.origin, nonce, resource },
			this.now()
		);
		await this.options.store.save(accepted.credential);
		return accepted.status;
	}
	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}
