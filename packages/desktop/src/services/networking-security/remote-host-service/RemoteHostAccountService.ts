// @harness-uid u_k6dohe6btd
import type { RemoteHostRecordService } from './RemoteHostRecordService';
import type { RemoteHostSwitchService } from './remote-host-switch-service/RemoteHostSwitchService';

/** Reconciles the verified native login with the encrypted record and the relay registration. */
export class RemoteHostAccountService {
	ownerId: string | undefined;
	private pending: Promise<void> | undefined;

	constructor(
		private readonly record: RemoteHostRecordService,
		private readonly turns: RemoteHostSwitchService,
		private readonly changed: () => void,
		private readonly unregister?: (hostId: string, ownerId: string) => Promise<void>
	) {}

	link(ownerId: string, running: boolean): void {
		if (this.ownerId === ownerId && (running || this.pending)) return;
		if (this.ownerId !== ownerId) this.end();
		this.ownerId = ownerId;
		const work = this.reconcile(ownerId);
		this.pending = work;
		void work
			.catch(() => undefined)
			.finally(() => {
				if (this.pending === work) this.pending = undefined;
			});
	}

	end(): void {
		this.ownerId = undefined;
		this.pending = undefined;
		void this.turns.stop().then(this.changed, () => undefined);
	}

	async unlink(): Promise<void> {
		const { ownerId } = this;
		const state = this.record.value;
		if (!state || !ownerId || state.ownerId !== ownerId) return;
		await this.unregister?.(state.hostId, ownerId);
		state.devices = [];
		state.revoked = [];
	}

	private async reconcile(ownerId: string): Promise<void> {
		if (!this.record.available()) return;
		const stored = await this.record.load();
		if (this.ownerId !== ownerId) return;
		if (stored?.ownerId === ownerId) await this.turns.start();
		else await this.turns.enable(ownerId);
		this.changed();
	}
}
