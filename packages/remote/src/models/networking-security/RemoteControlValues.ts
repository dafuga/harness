/** Every way a scan ends without an offer; the plugin rejects with one of these as its code. */
export const remoteScanFailures = [
	'camera-denied',
	'camera-unavailable',
	'scan-cancelled',
	'offer-invalid',
	'offer-unsupported',
	'offer-environment',
	'offer-expired'
] as const;
