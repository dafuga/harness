import { expect, test } from 'vitest';
import { RemoteRegistrationAdapter } from '../../src/adapters/RemoteRegistrationAdapter';

const origin = 'https://hub.example',
	credential = { origin, principalId: 'google:fixture-one', token: 'n'.repeat(43) },
	credentials = async () => credential;
const input = {
	hostId: 'a'.repeat(40),
	hostKey: 'K'.repeat(87),
	credentialHash: 'c'.repeat(64),
	name: 'Fixture Mac'
};
const accepted = {
	hostId: input.hostId,
	origin: 'https://relay.example',
	generation: 1,
	registeredAt: '2026-10-12T10:00:00.000Z'
};
const actor = {
	id: credential.principalId,
	email: 'owner@gmail.com',
	name: 'O',
	emailVerified: true
};
function hub(status = 201, answer: unknown = accepted) {
	const requests: { url: string; method: string; bearer: string | null; body: string | null }[] =
		[];
	const fetcher = async (target: RequestInfo | URL, init?: RequestInit) => {
		const url = String(target),
			body = typeof init?.body === 'string' ? init.body : null,
			bearer = new Headers(init?.headers).get('authorization');
		requests.push({ url, method: init?.method ?? 'GET', bearer, body });
		return url.endsWith('/api/auth/status')
			? Response.json({ actor, configured: true, clientId: 'client' })
			: Response.json(answer, { status });
	};
	return {
		requests,
		fetch: fetcher as typeof fetch,
		posts: () => requests.filter((r) => r.method === 'POST')
	};
}
const failure = (adapter: RemoteRegistrationAdapter) =>
	adapter.register(input).then(
		() => null,
		(error: Error & { signedOut?: boolean }) => error
	);

test('registration travels with the hosted session of this computer and names no owner', async () => {
	const h = hub(),
		adapter = new RemoteRegistrationAdapter({ origin, credentials, fetch: h.fetch });
	expect(await adapter.register({ ...input, owner: { id: 'forged' } } as never)).toEqual(accepted);
	const [post] = h.posts();
	expect(post.url).toBe(origin + '/api/remote/hosts');
	expect(post.bearer).toBe('Bearer ' + credential.token);
	expect(JSON.parse(post.body ?? '{}')).toEqual(input);
	expect(h.requests.map((request) => request.url).join(' ')).not.toContain(credential.token);
});
test('without a hub origin or a hosted session it is signed out, and nothing is posted', async () => {
	const configs = [
		{ origin: undefined, credentials },
		{ origin, credentials: async () => null },
		{ origin, credentials: async () => ({ ...credential, origin: 'https://other.example' }) }
	];
	for (const config of configs) {
		const h = hub(),
			error = await failure(new RemoteRegistrationAdapter({ ...config, fetch: h.fetch }));
		expect(error?.signedOut).toBe(true);
		expect(h.posts()).toEqual([]);
	}
});
test('an expired session is signed out; a refusal or a wrong answer is an error', async () => {
	const adapter = (status: number, answer: unknown) =>
		new RemoteRegistrationAdapter({ origin, credentials, fetch: hub(status, answer).fetch });
	expect((await failure(adapter(401, { error: 'session-required' })))?.signedOut).toBe(true);
	const refused = [
		adapter(403, { error: 'forbidden' }),
		adapter(503, { error: 'remote-disabled' }),
		adapter(201, { ...accepted, hostId: 'b'.repeat(40) }),
		adapter(201, { ...accepted, origin: 5 }),
		adapter(201, { ...accepted, generation: '1' }),
		adapter(201, null)
	];
	for (const item of refused) {
		const error = await failure(item);
		expect(error).toBeInstanceOf(Error);
		expect(error?.signedOut).toBeUndefined();
	}
});
