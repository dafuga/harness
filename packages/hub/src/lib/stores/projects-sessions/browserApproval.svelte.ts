// @harness-uid u_2z6ismqvvf
import type {
	DeviceApprovalAction,
	DeviceApprovalResult
} from '$desktop/models/development-tooling/Environment.types';
import { SealedError } from '../../../../../remote/src/models/networking-security/SealedError';
import { BrowserDeviceSessionService } from '../../../services/networking-security/BrowserDeviceSessionService';
import type { EnrollmentResolution } from '../../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';

export class BrowserApprovalState {
	result = $state.raw<EnrollmentResolution | null>(null);
	error = $state('');
	private attempt: AbortController | null = null;
	private reviewLifetime = new AbortController();

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

	review(
		account: string,
		call: DeviceApprovalAction,
		event?: MouseEvent
	): Promise<DeviceApprovalResult> {
		if (this.result?.state !== 'approved')
			return Promise.reject(new SealedError('This browser needs device approval.'));
		if (call.action === 'approve' || call.action === 'deny') {
			// Read transient activation while handling the actual click, before any network waits.
			if (!event?.isTrusted || !navigator.userActivation?.isActive)
				return Promise.reject(new SealedError('Confirm this decision on this device.'));
		}
		return this.service.review(account, this.reviewLifetime.signal, call);
	}

	reset(): void {
		this.reviewLifetime.abort();
		this.reviewLifetime = new AbortController();
		this.service.clearReviews();
		this.attempt?.abort();
		this.attempt = null;
		this.result = null;
		this.error = '';
	}

	forget(account: string): Promise<void> {
		this.reset();
		return this.service.forget(account);
	}
}
