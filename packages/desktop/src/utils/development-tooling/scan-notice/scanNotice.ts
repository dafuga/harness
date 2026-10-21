import { remoteScanFailures } from '../../../../../remote/src/models/RemoteControl.types';
import type { RemoteScanFailure } from '../../../../../remote/src/models/RemoteControl.types';

export type ScanFailure = RemoteScanFailure;

export const scanFailures: readonly ScanFailure[] = remoteScanFailures;

export const nameNotice = 'Give this phone a name of up to 80 characters.';

/** What the page says for each way a scan ends without an offer, and how to go on. */
export const scanNotices: Record<RemoteScanFailure, string> = {
	'camera-denied': 'Camera access is off for Harness. Turn it on in Settings, then scan again.',
	'camera-unavailable': 'This device has no camera that can scan a code.',
	'scan-cancelled': 'Scanning was cancelled. Nothing was sent.',
	'offer-invalid':
		'That is not a Harness pairing code. Scan the code under Pair a phone on your computer.',
	'offer-unsupported':
		'That code is for another version of Harness. Update Harness on both, then scan again.',
	'offer-environment': 'That code is for a relay this build of Harness does not accept.',
	'offer-expired': 'That code has expired. Choose New code on your computer and scan again.'
};

/** The way a scan ended, read from the code of what the plugin rejected with, or null. */
export function scanFailure(cause: unknown): RemoteScanFailure | null {
	const code =
		typeof cause === 'object' && cause !== null ? (cause as { code?: unknown }).code : '';
	return scanFailures.find((item) => item === code) ?? null;
}

/** What the page says when a scan was rejected: the words of that ending, or the cause itself. */
export function scanNotice(cause: unknown): string {
	const failure = scanFailure(cause);
	return failure ? scanNotices[failure] : String(cause);
}

/** The name a person gave this phone, as the computer will show it, or null. */
export function phoneName(value: string): string | null {
	const name = value.trim();
	return name && name.length <= 80 ? name : null;
}
