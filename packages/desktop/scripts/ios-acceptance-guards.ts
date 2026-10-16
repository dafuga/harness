/**
 * TEST ONLY. The guards of the native acceptance run that hold without a simulator: where it may
 * talk to, and what it may never print or write.
 */

/** The launch argument by which a Debug product, and only a Debug product, accepts a local relay. */
export const loopbackArgument = '-HarnessRemoteLoopback';

/** Plain http on this machine, by number and with a port: the only address the run talks to. */
export function localOrigin(origin: string): boolean {
	return /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(origin);
}

/** Text without the named secrets. A pairing code is also hidden without its separators. */
export function redacted(text: string, secrets: string[]): string {
	const forms = secrets
		.flatMap((secret) => [secret, secret.replace(/[^A-Za-z0-9]/g, '')])
		.filter((form) => form.length >= 4);
	return forms.reduce((value, form) => value.split(form).join('[hidden]'), text);
}

/**
 * The launch argument that tells the TEST ONLY scan fixture copy what its scans answer, and the
 * words by which a product is known to hold that scanner. No product of the real source does.
 */
export const scanMarker = 'HarnessSyntheticScans';
export const scanArgument = `-${scanMarker}`;

/** The same offer with its time passed: what a phone must refuse as expired. */
export function expiredOffer(scan: string, now = Date.now()): string {
	return scan.replace(/;exp=\d+;/, `;exp=${Math.floor(now / 1000) - 60};`);
}

/** The same offer under a version no phone knows: what a phone must refuse as unsupported. */
export function otherVersion(scan: string): string {
	return scan.replace('harness-pair:v1;', 'harness-pair:v2;');
}
