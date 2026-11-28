// @harness-uid u_2z6ismqvvf
import type {
	DeviceApprovalAction,
	DeviceApprovalRequest,
	DeviceApprovalResult
} from '$desktop/models/development-tooling/Environment.types';
import { SealedError } from '../../../../../remote/src/models/networking-security/SealedError';
import { showApprovalNotice } from '../../networking-security/hubPushBrowser';
import { BrowserDeviceSessionService } from '../../../services/networking-security/BrowserDeviceSessionService';
import type { EnrollmentResolution } from '../../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';

export class BrowserApprovalState {
	result = $state.raw<EnrollmentResolution | null>(null);
	error = $state('');
	private attempt: AbortController | null = null;
	private reviewLifetime = new AbortController();
	private announced = new Set<string>();

	private readonly service = new BrowserDeviceSessionService();

	async check(account: string): Promise<void> {
		if (this.attempt) return;
		const attempt = new AbortController();
		this.attempt = attempt;
		try {
			const result = await this.service.resolve(account, attempt.signal);
			if (attempt.signal.aborted) return;
			this.result = result;
			this.error = '';
		} catch {
			if (attempt.signal.aborted) return;
			this.error = 'Could not check this browser’s approval. Trying again…';
		} finally {
			if (this.attempt === attempt) this.attempt = null;
		}
	}

	async review(
		account: string,
		call: DeviceApprovalAction,
		event?: MouseEvent
	): Promise<DeviceApprovalResult> {
		if (this.result?.state !== 'approved')
			throw new SealedError('This browser needs device approval.');
		if (call.action === 'approve' || call.action === 'deny') {
			// Read transient activation while handling the actual click, before any network waits.
			if (!event?.isTrusted || !navigator.userActivation?.isActive)
				throw new SealedError('Confirm this decision on this device.');
		}
		const signal = this.reviewLifetime.signal;
		const result = await this.service.review(account, signal, call);
		if ('requests' in result && !signal.aborted) this.announce(result.requests, signal);
		return result;
	}

	private announce(requests: DeviceApprovalRequest[], signal: AbortSignal): void {
		const active = new Set(requests.map(({ id }) => id));
		const fresh = [...active].filter((id) => !this.announced.has(id));
		this.announced = active;
		if (!fresh.length) return;
		void showApprovalNotice(signal).then((shown) => {
			if (shown || signal.aborted) return;
			for (const id of fresh) this.announced.delete(id);
		});
	}

	reset(): void {
		this.reviewLifetime.abort();
		this.reviewLifetime = new AbortController();
		this.service.clearReviews();
		this.announced.clear();
		this.attempt?.abort();
		this.attempt = null;
		this.result = null;
		this.error = '';
	}

	push(account: string) {
		return this.service.push(account, this.reviewLifetime.signal);
	}

	forget(account: string): Promise<void> {
		this.reset();
		return this.service.forget(account);
	}
}
