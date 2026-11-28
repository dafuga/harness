import { BrowserDeviceSessionService } from '../../../services/networking-security/BrowserDeviceSessionService';
import type { EnrollmentResolution } from '../../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';

export class BrowserApprovalState {
	result = $state.raw<EnrollmentResolution | null>(null);
	error = $state('');
	private attempt: AbortController | null = null;

	constructor(private readonly service = new BrowserDeviceSessionService()) {}

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

	reset(): void {
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
