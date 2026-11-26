/**
 * TEST ONLY. Loaded before the app: its fixed Tracker address reaches the fixture Tracker, so the
 * Tracker running on this computer is never read or written.
 */
const fixed = 'http://127.0.0.1:7701/';
const fixture = process.argv[2];
const send = globalThis.fetch;

globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
	const address = input instanceof Request ? input.url : String(input);
	if (address.startsWith(fixed)) return send(`${fixture}/${address.slice(fixed.length)}`, init);
	if (new URL(address).port === '7701')
		return Promise.reject(new Error(`Unexpected Tracker address ${address}`));
	return send(input, init);
}) as typeof fetch;
