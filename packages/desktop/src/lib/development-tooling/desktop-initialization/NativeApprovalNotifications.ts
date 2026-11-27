// @harness-uid u_ixgurhnuda
import type { NativeAuthService } from './NativeAuthService';

/** Refreshes the background login and prompts once per new batch of requests for that account. */
export class NativeApprovalNotifications {
	private actor?: string;
	private seen = new Set<string>();
	private running = false;

	constructor(
		private readonly auth: Pick<NativeAuthService, 'status' | 'admitted' | 'deviceApproval'>,
		private readonly notify?: () => void
	) {}

	async refresh(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			const status = await this.auth.status();
			const actor = status.state === 'signed-in' ? status.actor?.id : undefined;
			if (actor !== this.actor) this.seen.clear();
			this.actor = actor;
			if (actor && this.auth.admitted && this.notify) await this.checkRequests(this.notify);
		} catch {
			// The next account refresh retries after an outage.
		} finally {
			this.running = false;
		}
	}

	private async checkRequests(notify: () => void): Promise<void> {
		const inbox = await this.auth.deviceApproval({ action: 'list' });
		if (!this.auth.admitted || !('requests' in inbox)) return;
		const current = new Set(inbox.requests.map((request) => request.id));
		if (inbox.requests.some((request) => !this.seen.has(request.id))) notify();
		this.seen = current;
	}
}
