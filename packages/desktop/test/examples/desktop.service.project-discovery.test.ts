import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectDiscoveryService } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/ProjectDiscoveryService';
import type { SnapshotPort } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/ProjectDiscoveryService.types';

type Ports = ConstructorParameters<typeof ProjectDiscoveryService>;

const credential = {
	origin: 'https://hub.example.test',
	principalId: 'principal-example',
	token: 'token-example'
};
const rotated = { ...credential, token: 'token-rotated-example' };
const emptyHub: unknown[] = [];
const oneHub: unknown[] = [{ id: 'project-1', name: 'My project', kind: 'shared' }];
const twoHub: unknown[] = [
	...oneHub,
	{ id: 'project-2', name: 'Team roadmap', kind: 'shared' }
];
const authorityMessage = 'Hosted authority changed during project discovery.';

/** Discovery without a cache never reads snapshots, so this port must stay unused. */
const projection: SnapshotPort = {
	snapshot: () => Promise.reject(new Error('snapshot is not used without a cache'))
};

interface Fixture {
	list: unknown[];
	offline?: boolean;
	credentials?: () => Promise<unknown>;
}

function subject(fixture: Fixture) {
	const http = {
		json: () => Promise.resolve(fixture.list),
		authorize: () => Promise.resolve()
	} as unknown as Ports[1];
	const reads = {
		read: (
			_key: unknown,
			fetch: () => Promise<{ value: unknown }>,
			validate: (value: unknown) => unknown
		) =>
			fixture.offline
				? Promise.resolve({ value: validate(fixture.list), offline: true })
				: fetch().then((fetched) => ({ value: validate(fetched.value), offline: false }))
	} as unknown as Ports[2];
	const credentials = fixture.credentials ?? (() => Promise.resolve(credential));
	const options = { credentials } as unknown as Ports[3];
	return new ProjectDiscoveryService(projection, http, reads, options);
}

/** The credential changes between the start of a discovery and its check after the list read. */
function rotatingCredentials() {
	let calls = 0;
	return () => Promise.resolve(++calls === 1 ? credential : rotated);
}

async function failureOf(run: Promise<unknown>) {
	try {
		await run;
		return null;
	} catch (error) {
		return error instanceof Error
			? { name: error.name, message: error.message }
			: { name: 'UnknownError', message: String(error) };
	}
}

test('Lists owned and joined hosted projects', async () => {
	const empty = await subject({ list: emptyHub }).projects();
	const one = await subject({ list: oneHub }).projects();
	const two = await subject({ list: twoHub }).projects();
	expect(empty).toEqual([]);
	expect(one).toEqual(oneHub);
	expect(two).toEqual(twoHub);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-discovery',
			symbol: 'projects',
			state: 'lists-owned-and-joined-hosted-projects',
			evidence: 'examples-cases',
			file: 'lists-owned-and-joined-hosted-projects.json'
		},
		[
			{ name: 'Hub returns no projects', input: { hub: emptyHub }, output: empty },
			{ name: 'Hub returns one owned project', input: { hub: oneHub }, output: one },
			{ name: 'Hub returns two projects in hub order', input: { hub: twoHub }, output: two }
		]
	);
});

test('Returns the kept copy while the hub is away', async () => {
	const kept = await subject({ list: oneHub, offline: true }).projects();
	expect(kept).toEqual(oneHub);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-discovery',
			symbol: 'projects',
			state: 'returns-the-kept-copy-while-the-hub-is-away',
			evidence: 'examples-cases',
			file: 'returns-the-kept-copy-while-the-hub-is-away.json'
		},
		[
			{
				name: 'Offline read returns the kept project without changing anything',
				input: { hub: 'away', kept: oneHub },
				output: kept
			}
		]
	);
});

test('Rejects discovery when the hosted credential changes', async () => {
	const failure = await failureOf(
		subject({ list: oneHub, credentials: rotatingCredentials() }).projects()
	);
	expect(failure).toEqual({ name: 'HostedAuthorityChangedError', message: authorityMessage });
	recordExampleCases(
		{
			unitId: 'desktop.service.project-discovery',
			symbol: 'projects',
			state: 'rejects-discovery-when-the-hosted-credential-changes',
			evidence: 'examples-cases',
			file: 'rejects-discovery-when-the-hosted-credential-changes.json'
		},
		[
			{
				name: 'Credential rotated during the list read rejects the discovery',
				input: { hub: oneHub, credentialChange: 'token rotated after the list read' },
				error: failure
			}
		]
	);
});

test('Rejects discovery when no hosted credential is held', async () => {
	const failure = await failureOf(
		subject({ list: oneHub, credentials: () => Promise.resolve(null) }).projects()
	);
	expect(failure).toEqual({ name: 'HostedAuthorityChangedError', message: authorityMessage });
	recordExampleCases(
		{
			unitId: 'desktop.service.project-discovery',
			symbol: 'projects',
			state: 'rejects-discovery-when-no-hosted-credential-is-held',
			evidence: 'examples-cases',
			file: 'rejects-discovery-when-no-hosted-credential-is-held.json'
		},
		[
			{
				name: 'No signed-in credential at the start rejects the discovery',
				input: { hub: oneHub, credential: null },
				error: failure
			}
		]
	);
});
