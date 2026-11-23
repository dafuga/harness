import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { startRemoteFixture } from '../../scripts/remote-fixture-host';

vi.mock('../../scripts/remote-fixture-host', () => ({ startRemoteFixture: vi.fn() }));

type Fixture = Awaited<ReturnType<typeof startRemoteFixture>>;
type Spies = ReturnType<typeof spyProcess>;

const UNIT = 'desktop.script.remote-fixture';
const FALLBACK = 'The remote fixture failed to start.';
const fixture = {
	relayOrigin: 'http://127.0.0.1:8791',
	controlOrigin: 'http://127.0.0.1:8792',
	hostId: 'host-example',
	project: { name: 'Example project', id: 'project-example' },
	stop: async () => undefined
} as unknown as Fixture;
const okPairing = async () => new Response('{}', { status: 200 });

// Lets the script's chained promises (startup, then pairing) settle without timers.
const settle = () =>
	Array.from({ length: 10 }).reduce<Promise<void>>(
		(chain) => chain.then(() => undefined),
		Promise.resolve()
	);

function spyProcess() {
	return {
		on: vi.spyOn(process, 'on').mockImplementation((() => process) as never),
		exit: vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never),
		log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
		error: vi.spyOn(console, 'error').mockImplementation(() => undefined)
	};
}

function restore(spies: Spies) {
	for (const spy of Object.values(spies)) spy.mockRestore();
	vi.unstubAllGlobals();
}

// Imports the real entry point, which runs main() on load; the host and fetch are stubbed.
async function runScript(
	startup: () => Promise<Fixture>,
	pairing: (url: string, init?: RequestInit) => Promise<Response>
) {
	vi.mocked(startRemoteFixture).mockClear().mockImplementation(startup);
	const fetchMock = vi.fn(pairing);
	vi.stubGlobal('fetch', fetchMock);
	vi.resetModules();
	await import('../../scripts/remote-fixture');
	await settle();
	return fetchMock;
}

function meta(state: string) {
	return { unitId: UNIT, symbol: 'main', state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Starts the fixture and requests the first pairing offer', async () => {
	const spies = spyProcess();
	try {
		const fetchMock = await runScript(async () => fixture, okPairing);
		const publicDirectory = vi.mocked(startRemoteFixture).mock.calls[0]?.[0].publicDirectory ?? '';
		expect(publicDirectory.endsWith('work/mobile/remote-fixture')).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8792/pairing', { method: 'POST' });
		expect(spies.exit).not.toHaveBeenCalled();
		recordExampleCases(meta('starts-the-fixture-and-requests-the-first-pairing-offer'), [
			{
				name: 'start with the public fixture folder and one pairing offer',
				input: 'no arguments',
				output: {
					publicFolderIsWorkMobile: true,
					pairingRequest: 'POST /pairing',
					exitStatus: null
				}
			}
		]);
	} finally {
		restore(spies);
	}
});

test('Reports a startup error message and exits with status 1', async () => {
	const spies = spyProcess();
	try {
		const fetchMock = await runScript(async () => {
			throw new Error('Relay port is in use.');
		}, okPairing);
		expect(spies.error).toHaveBeenCalledWith('Relay port is in use.');
		expect(spies.exit).toHaveBeenCalledWith(1);
		expect(fetchMock).not.toHaveBeenCalled();
		recordExampleCases(meta('reports-a-startup-error-message-and-exits-with-status-1'), [
			{
				name: 'startup rejects with an Error',
				input: 'relay port 8791 already in use',
				output: { logged: 'Relay port is in use.', exitStatus: 1, pairingRequested: false }
			}
		]);
	} finally {
		restore(spies);
	}
});

test('Logs a fixed fallback when startup rejects with a non-error', async () => {
	const spies = spyProcess();
	try {
		const notAnError: unknown = 'The socket closed.';
		await runScript(async () => {
			throw notAnError;
		}, okPairing);
		expect(spies.error).toHaveBeenCalledWith(FALLBACK);
		expect(spies.exit).toHaveBeenCalledWith(1);
		recordExampleCases(meta('logs-a-fixed-fallback-when-startup-rejects-with-a-non-error'), [
			{
				name: 'startup rejects with a plain string',
				input: 'string rejection',
				output: { logged: FALLBACK, exitStatus: 1 }
			}
		]);
	} finally {
		restore(spies);
	}
});

test('Reports a pairing request that cannot reach the fixture', async () => {
	const spies = spyProcess();
	try {
		await runScript(
			async () => fixture,
			async () => {
				throw new TypeError('fetch failed');
			}
		);
		expect(spies.error).toHaveBeenCalledWith('fetch failed');
		expect(spies.exit).toHaveBeenCalledWith(1);
		recordExampleCases(meta('reports-a-pairing-request-that-cannot-reach-the-fixture'), [
			{
				name: 'first pairing POST rejects with a network TypeError',
				input: 'POST /pairing on 127.0.0.1:8792',
				output: { logged: 'fetch failed', exitStatus: 1 }
			}
		]);
	} finally {
		restore(spies);
	}
});
