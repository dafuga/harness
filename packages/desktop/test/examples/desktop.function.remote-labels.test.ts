import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	relayName,
	hostLine
} from '../../src/components/networking-security/remote-host-panel/remoteLabels';
import { lockNote, awakeNote } from '../../src/utils/networking-security/remoteLabels';
import * as publicEntry from '../../src/utils/remoteLabels';
import type { RemoteHostStatus } from '../../src/models/development-tooling/Environment.types';

const UNIT = 'desktop.function.remote-labels';

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: UNIT,
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const hostStatus = (state: string, origin: string | null = 'https://relay.example:8443/relay') =>
	({
		supported: true,
		enabled: true,
		state,
		reason: null,
		host: null,
		origin,
		pairing: null,
		requests: [],
		devices: [],
		projects: []
	}) as unknown as RemoteHostStatus;

test('Shows only the relay host and port, or nothing for null or invalid input', () => {
	const withPort = relayName('https://relay.example:8443/relay');
	const withoutPort = relayName('https://relay.example/path?token=1');
	const absent = relayName(null);
	const invalid = relayName('not a url');
	expect(withPort).toBe('relay.example:8443');
	expect(withoutPort).toBe('relay.example');
	expect(absent).toBe('');
	expect(invalid).toBe('');
	recordCases('relayName', 'shows-only-the-relay-host-and-port', [
		{
			name: 'absolute URL with port keeps host and port',
			input: { origin: 'https://relay.example:8443/relay' },
			output: withPort
		},
		{
			name: 'path and query are dropped without a port',
			input: { origin: 'https://relay.example/path?token=1' },
			output: withoutPort
		},
		{ name: 'null origin yields empty text', input: { origin: null }, output: absent },
		{ name: 'invalid URL yields empty text', input: { origin: 'not a url' }, output: invalid }
	]);
});

test('Adds a suffix only for registering, connecting and offline host states', () => {
	const registering = hostLine(hostStatus('registering'));
	const connecting = hostLine(hostStatus('connecting'));
	const offline = hostLine(hostStatus('offline'));
	const online = hostLine(hostStatus('online'));
	const noOrigin = hostLine(hostStatus('online', null));
	expect(registering).toBe('This Mac is linked · relay.example:8443 · registering…');
	expect(connecting).toBe('This Mac is linked · relay.example:8443 · connecting…');
	expect(offline).toBe('This Mac is linked · relay.example:8443 · relay unreachable');
	expect(online).toBe('This Mac is linked · relay.example:8443');
	expect(noOrigin).toBe('This Mac is linked · ');
	recordCases('hostLine', 'adds-a-suffix-only-for-registering-connecting-and-offline', [
		{ name: 'registering state', input: { state: 'registering' }, output: registering },
		{ name: 'connecting state', input: { state: 'connecting' }, output: connecting },
		{ name: 'offline state', input: { state: 'offline' }, output: offline },
		{ name: 'online state has no suffix', input: { state: 'online' }, output: online },
		{
			name: 'null origin leaves the host empty',
			input: { state: 'online', origin: null },
			output: noOrigin
		}
	]);
});

test('Uses fixed lock and awake wording for the computer', () => {
	expect(lockNote).toBe(
		'Linked devices keep working while this Mac is locked and awake. A sleeping Mac is offline.'
	);
	expect(awakeNote).toBe('Computer awake · works while its screen is locked');
	expect(publicEntry.lockNote).toBe(lockNote);
	expect(publicEntry.awakeNote).toBe(awakeNote);
	recordCases('lockNote', 'uses-fixed-lock-and-awake-wording', [
		{ name: 'lock guidance text', input: { export: 'lockNote' }, output: lockNote },
		{
			name: 'awake wording when lock state is unreported',
			input: { export: 'awakeNote' },
			output: awakeNote
		},
		{
			name: 'public entry repeats lock guidance',
			input: { export: 'publicEntry.lockNote' },
			output: publicEntry.lockNote
		}
	]);
});
