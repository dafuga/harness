import { randomBytes, createHash } from 'node:crypto';
import type { HostedHttpAdapter } from '../../adapters/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../adapters/NativeSessionAdapter';
import type { NativeHostedStatus } from '../../models/ProjectContext.types';
import { NativeHandoffValidator } from '../../validators/NativeHandoffValidator';
import { NativeAccountStatusService } from './NativeAccountStatusService';
import { responseRecord } from '../../validators/RemoteProjectResponseValidator';
interface AuthOptions {
	origin: string;
	http: HostedHttpAdapter;
	store: NativeSessionAdapter;
	open: (url: string) => Promise<void>;
	now?: () => number;
	clearCache?: () => Promise<void>;
	onDisconnect?: () => void;
}
interface Pending {
	handoffId: string;
	verifier: string;
	nonce: string;
	resource: string;
	next: number;
	status: NativeHostedStatus;
}
export class NativeAuthService {
	private pending: Pending | null = null;
	private queue: Promise<unknown> = Promise.resolve();
	private validator = new NativeHandoffValidator();
	constructor(private options: AuthOptions) {}
	connect(): Promise<NativeHostedStatus> {
		return this.serial(() => this.begin());
	}
	status(): Promise<NativeHostedStatus> {
		return this.serial(() => this.refresh());
	}
	disconnect(): Promise<NativeHostedStatus> {
		return this.serial(async () => {
			this.options.onDisconnect?.();
			this.pending = null;
			const credential = await this.options.store.read();
			try {
				if (credential)
					await this.options.http.request('/api/auth/logout', credential, {
						method: 'POST',
						body: '{}'
					});
			} finally {
				await this.options.store.clear();
				await this.options.clearCache?.();
			}
			return { configured: true, state: 'signed-out' };
		});
	}
	private serial(action: () => Promise<NativeHostedStatus>): Promise<NativeHostedStatus> {
		const next = this.queue.then(action);
		this.queue = next.catch(() => undefined);
		return next;
	}
	private async begin(): Promise<NativeHostedStatus> {
		if (!this.options.store.available())
			throw new Error('OS encryption is required for hosted sessions.');
		const verifier = randomBytes(32).toString('base64url'),
			nonce = randomBytes(24).toString('base64url'),
			resource = 'projects';
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		const result = await this.options.http.publicJson('/api/auth/native/start', {
			challenge,
			nonce,
			resource
		});
		const handoff = this.validator.start(result, this.options.origin, this.now());
		const { handoffId, ...publicHandoff } = handoff;
		const status: NativeHostedStatus = {
			configured: true,
			state: 'pending',
			handoff: publicHandoff
		};
		this.pending = {
			handoffId,
			verifier,
			nonce,
			resource,
			status,
			next: this.now() + handoff.interval * 1000
		};
		await this.options.open(handoff.verificationUrl);
		return status;
	}
	private async refresh(): Promise<NativeHostedStatus> {
		if (this.pending) return this.poll(this.pending);
		const credential = await this.options.store.read();
		if (!credential) {
			const status = responseRecord(await this.options.http.publicStatus());
			return { configured: status.configured === true, state: 'signed-out' };
		}
		return new NativeAccountStatusService(this.options).read(credential);
	}
	private async poll(pending: Pending): Promise<NativeHostedStatus> {
		if (Date.parse(pending.status.handoff!.expiresAt) <= this.now()) {
			this.pending = null;
			return { configured: true, state: 'signed-out' };
		}
		if (pending.next > this.now()) return pending.status;
		pending.next = this.now() + pending.status.handoff!.interval * 1000;
		const result = responseRecord(
			await this.options.http.publicJson('/api/auth/native/poll', { handoffId: pending.handoffId })
		);
		if (result.status === 'pending') return pending.status;
		this.pending = null;
		if (result.status !== 'approved') throw new Error('Native handoff expired or was refused.');
		const { handoffId, verifier, nonce, resource } = pending;
		const resultExchange = await this.options.http.publicJson('/api/auth/native/exchange', {
			handoffId,
			verifier,
			nonce,
			resource
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
