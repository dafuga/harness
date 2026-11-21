// @harness-uid u_bt6e76o6y5
import type { Pending, AuthOptions } from './NativeAuthService.types';
import { randomBytes, createHash } from 'node:crypto';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { NativeHandoffValidator } from '../../../validators/development-tooling/NativeHandoffValidator';
import { NativeAccountStatusService } from './NativeAccountStatusService';
import { responseRecord } from '../../../validators/projects-sessions/RemoteProjectResponseValidator';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';

/** The owner-only Hub overview; only the verified native account of this device may read it. */
const overviewPath = '/api/tracker-overview';
const unavailableOverview: OverviewSnapshot = { status: 'unavailable' };

/** Only a complete overview is shown; any other answer reads as unavailable, with no rows. */
function readableOverview(value: unknown): OverviewSnapshot {
	const snapshot = value as { status?: unknown; projects?: unknown; machines?: unknown } | null;
	if (snapshot?.status !== 'ready' || !Array.isArray(snapshot.projects)) return unavailableOverview;
	if (!Array.isArray(snapshot.machines)) return unavailableOverview;
	return snapshot as OverviewSnapshot;
}

/**
 * The owner's overview, read with this device's own account: one exact GET, no query or body.
 * Signed out, refused, unreachable, malformed, or answered after the session changed reads as
 * unavailable. Nothing falls back to the local tracker, and no earlier snapshot is kept.
 */
async function readOverview(options: AuthOptions): Promise<OverviewSnapshot> {
	const generation = options.store.generation;
	try {
		const value = await options.http.json(overviewPath);
		return options.store.generation === generation ? readableOverview(value) : unavailableOverview;
	} catch {
		return unavailableOverview;
	}
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
	overview(): Promise<OverviewSnapshot> {
		return readOverview(this.options);
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
