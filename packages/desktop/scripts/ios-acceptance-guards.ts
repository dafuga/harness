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

/** The public fields of a pairing link, as the native plugin takes them. Never the code. */
export function linkFields(link: string): { origin: string; hostId: string; pairingId: string } {
	const fields = new URL(link).searchParams;
	return {
		origin: fields.get('origin') ?? '',
		hostId: fields.get('host') ?? '',
		pairingId: fields.get('pairing') ?? ''
	};
}
