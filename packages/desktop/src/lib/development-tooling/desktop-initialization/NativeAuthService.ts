// @harness-uid u_bt6e76o6y5
import { MacDeviceApprovalError } from './MacDeviceApprovalError';
import type {
	DeviceApprovalAction,
	DeviceApprovalResult
} from '../../../models/development-tooling/Environment.types';
import type { Pending, AuthOptions } from './NativeAuthService.types';
import { NativeSignInError } from './NativeAuthService.types';
import { NativeSignInService } from '../../../services/accounts-access/NativeSignInService';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { admitMacDevice, NativeAccountStatusService } from './NativeAccountStatusService';
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
	private signedIn = false;
	private queue: Promise<unknown> = Promise.resolve();
	private readonly signIn: NativeSignInService;
	private generation = 0;
	constructor(private options: AuthOptions) {
		this.signIn = new NativeSignInService(options);
	}
	get admitted(): boolean {
		return this.signedIn;
	}

	connect(google = false): Promise<NativeHostedStatus> {
		return this.serial(() => this.begin(google));
	}
	status(): Promise<NativeHostedStatus> {
		return this.serial(() => this.refresh());
	}
	disconnect(): Promise<NativeHostedStatus> {
		this.closeDeviceApproval();
		return this.serial(async () => {
			this.options.onDisconnect?.();
			this.clearPending();
			const credential = await this.options.store.read();
			try {
				if (credential?.origin === this.options.origin)
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
	closeDeviceApproval(): void {
		this.generation++;
		this.signedIn = false;
		this.options.deviceApproval?.close();
	}
	deviceApproval(action: DeviceApprovalAction): Promise<DeviceApprovalResult> {
		if (!this.signedIn || !this.options.deviceApproval)
			throw new MacDeviceApprovalError('session-required');
		return this.options.deviceApproval.action(action);
	}
	private serial(action: () => Promise<NativeHostedStatus>): Promise<NativeHostedStatus> {
		const generation = this.generation;
		const next = this.queue
			.then(action)
			.then((status) =>
				generation === this.generation
					? admitMacDevice(status, this.options)
					: ({ configured: true, state: 'signed-out' } as const)
			)
			.then((status) => {
				if (generation === this.generation) {
					this.signedIn = status.state === 'signed-in';
					if (this.signedIn && status.actor) this.options.onSignIn?.(status.actor.id);
				}
				return status;
			});
		this.queue = next.catch(() => undefined);
		return next;
	}
	private async begin(google: boolean): Promise<NativeHostedStatus> {
		if (this.pending) return this.pending.status;
		if (this.signedIn) return this.refresh();
		const fresh = await this.signIn.prepare(google);
		this.pending = fresh;
		return fresh.status;
	}

	private clearPending() {
		this.pending?.callback?.close();
		this.pending = null;
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
			this.clearPending();
			return { configured: true, state: 'signed-out' };
		}
		if (pending.next > this.now()) return pending.status;
		pending.next = this.now() + pending.status.handoff!.interval * 1000;
		if (pending.callback) {
			const code = pending.callback.take();
			if (!code) return pending.status;
			this.pending = null;
			return this.signIn.exchange(pending, code);
		}
		const result = responseRecord(
			await this.options.http.publicJson('/api/auth/native/poll', { handoffId: pending.handoffId })
		);
		if (result.status === 'pending') return pending.status;
		this.pending = null;
		if (result.status !== 'approved')
			throw new NativeSignInError('Native handoff expired or was refused.');
		return this.signIn.exchange(pending);
	}

	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}
