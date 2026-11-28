// @harness-uid u_kaxmzq62j7
import { SealedEnrollmentRequestService } from '../../../../remote/src/services/networking-security/SealedEnrollmentRequestService';
import type { EnrollmentResolution } from '../../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';
import {
	keepBrowserEnrollment,
	openBrowserEnrollments,
	readBrowserEnrollment,
	resolveBrowserEnrollment
} from './browser-device-session-service/browserEnrollmentStore';

/** Browser installation state is shared by this origin's tabs and scoped to the Google subject. */
export class BrowserDeviceSessionService {
	constructor(private readonly fetcher: typeof fetch = fetch) {}

	resolve(account: string, signal: AbortSignal): Promise<EnrollmentResolution> {
		return this.withDatabase(account, signal, async (db) => {
			const { device, progress } = await resolveBrowserEnrollment(db, account);
			const flow = new SealedEnrollmentRequestService({
				account,
				device,
				signal,
				request: (path, init) =>
					this.fetcher(path, {
						...init,
						mode: 'same-origin',
						credentials: 'same-origin',
						signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)])
					})
			});
			return flow.resolve(progress, (next) =>
				keepBrowserEnrollment(db, account, {
					installation: { device, progress: next },
					accountPin: next.pin ?? next.accountPin
				})
			);
		});
	}

	forget(account: string): Promise<void> {
		return this.withDatabase(account, undefined, async (db) => {
			const { accountPin } = await readBrowserEnrollment(db, account);
			await keepBrowserEnrollment(db, account, { accountPin });
		});
	}

	private async withDatabase<T>(
		account: string,
		signal: AbortSignal | undefined,
		use: (db: IDBDatabase) => Promise<T>
	): Promise<T> {
		// Lock across tabs for the full read, protocol exchange and durable update.
		return await navigator.locks.request('harness-device-approval:' + account, { signal }, async () => {
			const db = await openBrowserEnrollments();
			try {
				signal?.throwIfAborted();
				return await use(db);
			} finally {
				db.close();
			}
		});
	}
}
