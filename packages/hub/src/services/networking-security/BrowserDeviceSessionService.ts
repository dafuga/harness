// @harness-uid u_kaxmzq62j7
import type {
	DeviceApprovalAction,
	DeviceApprovalRequest,
	DeviceApprovalResult
} from '$desktop/models/development-tooling/Environment.types';
import type { EnrollmentView } from '../../../../relay/src/lib/networking-security/sync/SyncEnrollments.types';
import { SealedError } from '../../../../remote/src/models/networking-security/SealedError';
import type { SealedDeviceKeys } from '../../../../remote/src/models/networking-security/Sealed.types';
import { SealedEnrollmentReviewService } from '../../../../remote/src/services/networking-security/SealedEnrollmentReviewService';
import type { EnrollmentTransportOptions } from '../../../../remote/src/services/networking-security/SealedEnrollmentReviewService.types';
import { readEnrollment } from '../../../../remote/src/services/networking-security/sealed-enrollment-review-service/reviewTransport';
import { SealedEnrollmentRequestService } from '../../../../remote/src/services/networking-security/SealedEnrollmentRequestService';
import type { EnrollmentResolution } from '../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';
import type { ApprovalPushRequest } from '../../lib/networking-security/hubPush.types';
import {
	keepBrowserEnrollment,
	openBrowserEnrollments,
	readBrowserEnrollment,
	resolveBrowserEnrollment
} from './browser-device-session-service/browserEnrollmentStore';

/** Browser installation state is shared by this origin's tabs and scoped to the Google subject. */
export class BrowserDeviceSessionService {
	private readonly reviews = new Map<string, SealedEnrollmentReviewService>();

	constructor(private readonly fetcher: typeof fetch = fetch) {}

	resolve(account: string, signal: AbortSignal): Promise<EnrollmentResolution> {
		return withDatabase(account, signal, async (db) => {
			const { device, progress } = await resolveBrowserEnrollment(db, account);
			const flow = new SealedEnrollmentRequestService(this.transport(account, device, signal));
			return flow.resolve(progress, (next) =>
				keepBrowserEnrollment(db, account, {
					installation: { device, progress: next },
					accountPin: next.pin ?? next.accountPin
				})
			);
		});
	}

	review(
		account: string,
		signal: AbortSignal,
		call: DeviceApprovalAction
	): Promise<DeviceApprovalResult> {
		return withDatabase(account, signal, async (db) => {
			const { installation } = await readBrowserEnrollment(db, account);
			signal.throwIfAborted();
			const pin = installation?.progress.pin;
			if (!installation || !pin) throw new SealedError('This browser needs device approval.');
			const options = { ...this.transport(account, installation.device, signal), pin };
			if (call.action === 'list') return this.list(options);
			const review =
				this.reviews.get(call.id) ?? new SealedEnrollmentReviewService(options, call.id);
			if (call.action === 'review') {
				this.reviews.set(call.id, review);
				await review.claim();
				const code = await review.comparison();
				return code ? { state: 'compare', code } : { state: 'waiting' };
			}
			if (call.action === 'deny') {
				await review.deny();
				this.reviews.delete(call.id);
				return { state: 'denied' };
			}
			if (!('code' in call)) throw new SealedError('Compare the codes before approving.');
			const confirmed = await review.approve(call.code, async () => !signal.aborted);
			if (!confirmed) return { state: 'waiting' };
			signal.throwIfAborted();
			await keepBrowserEnrollment(db, account, {
				installation: { ...installation, progress: { ...installation.progress, pin: confirmed } },
				accountPin: confirmed
			});
			this.reviews.delete(call.id);
			return { state: 'approved' };
		});
	}

	private async list(options: EnrollmentTransportOptions): Promise<DeviceApprovalResult> {
		const { requests } = await readEnrollment<{ requests: EnrollmentView[] }>(options, 'enroll');
		return {
			requests: requests.map(
				({ id, createdAt, display }): DeviceApprovalRequest => ({
					id,
					createdAt,
					platform: display?.platform,
					country: display?.country
				})
			)
		};
	}

	clearReviews(): void {
		this.reviews.clear();
	}

	push(account: string, signal: AbortSignal): ApprovalPushRequest {
		return (method, subscription) =>
			withDatabase(account, signal, async (db) => {
				const { installation } = await readBrowserEnrollment(db, account);
				if (!installation?.progress.pin)
					throw new SealedError('This browser needs device approval.');
				const { device } = installation;
				return this.transport(account, device, signal).request('/api/sync/v1/approval-push', {
					method,
					redirect: 'error',
					cache: 'no-store',
					headers: { 'X-Harness-Device': device.deviceId, 'Content-Type': 'application/json' },
					body: subscription === undefined ? undefined : JSON.stringify(subscription)
				});
			});
	}

	private transport(account: string, device: SealedDeviceKeys, signal: AbortSignal) {
		return {
			account,
			device,
			signal,
			request: (path: string, init: RequestInit) =>
				this.fetcher(path, {
					...init,
					mode: 'same-origin',
					credentials: 'same-origin',
					signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)])
				})
		};
	}

	forget(account: string): Promise<void> {
		return withDatabase(account, undefined, async (db) => {
			const { accountPin } = await readBrowserEnrollment(db, account);
			await keepBrowserEnrollment(db, account, { accountPin });
		});
	}
}

async function withDatabase<T>(
	account: string,
	signal: AbortSignal | undefined,
	use: (db: IDBDatabase) => Promise<T>
): Promise<T> {
	// Lock across tabs for the full read, protocol exchange and durable update.
	return await navigator.locks.request(
		'harness-device-approval:' + account,
		{ signal },
		async () => {
			const db = await openBrowserEnrollments();
			try {
				signal?.throwIfAborted();
				return await use(db);
			} finally {
				db.close();
			}
		}
	);
}
