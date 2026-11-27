// @harness-uid u_73fwfvcdca
/** Google, Apple, Mozilla and Microsoft. Nothing else is ever stored or contacted. */
const pushHosts =
	/^(?:fcm\.googleapis\.com|android\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)*notify\.windows\.com)$/;

/** @pure True for an HTTPS address on a known browser push service, on the default port. */
export function isWebPushEndpoint(value: string): boolean {
	if (value.length > 2048 || !URL.canParse(value)) return false;
	const url = new URL(value);
	const clean = !url.username && !url.password && !url.port && !url.hash;
	return url.protocol === 'https:' && clean && pushHosts.test(url.hostname);
}
