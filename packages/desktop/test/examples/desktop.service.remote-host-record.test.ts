import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RemoteHostRecordService } from '../../src/services/networking-security/remote-host-service/RemoteHostRecordService';
import type { RemoteHostEnrolment } from '../../src/services/networking-security/remote-host-service/RemoteHostRecordService.types';

const record = () => ({
	enabled: false,
	origin: null,
	hostId: '82e46ba75b60c48047e3346598f1c15eb0b2bcac',
	keys: {
		d: '-Dd9cJ1VPPwxCad8-m3HoF2qsLxzyihsV1zkofs2BVc',
		publicKey:
			'BAcAYFfwZRv7DZel5szuy0DFrGhw903EJQrWbQj6ankCBmyjb8Gh-QXmHLRSTmLIJOpjURrLplLLShIwVETNfPY'
	},
	credential: 'bkkDe31iUaI8oUZ4a0sF_60U-n1awKCjOUP7pmQLiL8',
	generation: 0,
	devices: [],
	revoked: []
});

function tempDirectory() {
	return mkdtempSync(join(tmpdir(), 'remote-host-record-'));
}

function recordState(details: {
	state: string;
	symbol: string;
	name: string;
	input: unknown;
	output: unknown;
}) {
	recordExampleCases(
		{
			unitId: 'desktop.service.remote-host-record',
			symbol: details.symbol,
			state: details.state,
			evidence: 'examples-cases',
			file: `${details.state}.json`
		},
		[{ name: details.name, input: details.input, output: details.output }]
	);
}

test('Loads the stored remote host record', async () => {
	const directory = tempDirectory();
	try {
		const source = record();
		let reads = 0;
		const service = new RemoteHostRecordService({
			available: () => true,
			read: async () => {
				reads += 1;
				return source;
			},
			save: async () => undefined
		} as unknown as ConstructorParameters<typeof RemoteHostRecordService>[0]);
		const [first, second] = await Promise.all([service.load(), service.load()]);
		const output = {
			available: service.available(),
			hostId: first?.hostId,
			shared: first === second,
			reads
		};
		expect(output).toEqual({ available: true, hostId: source.hostId, shared: true, reads: 1 });
		recordState({
			state: 'loads-the-stored-remote-host-record',
			symbol: 'load',
			name: 'A stored record is read once and shared',
			input: { record: source },
			output
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Enrols a remote host and turns access off', async () => {
	const directory = tempDirectory();
	try {
		const state = record();
		const writes: Array<{ enabled: boolean; origin: string | null; generation: number }> = [];
		const store = {
			available: () => false,
			read: async () => null,
			save: async (value: typeof state) =>
				writes.push({
					enabled: value.enabled,
					origin: value.origin,
					generation: value.generation
				})
		};
		const service = new RemoteHostRecordService(
			store as unknown as ConstructorParameters<typeof RemoteHostRecordService>[0]
		);
		service.value = state;
		const registration: RemoteHostEnrolment = {
			enabled: true,
			origin: 'https://relay.example.com',
			generation: 1
		};
		const enrolled = await service.enrol(state, registration, () => true);
		await service.save();
		await service.off();
		await service.settled();
		const output = {
			enrolled,
			available: service.available(),
			final: { enabled: state.enabled, origin: state.origin, generation: state.generation },
			writes
		};
		expect(output).toEqual({
			enrolled: true,
			available: false,
			final: { enabled: false, origin: 'https://relay.example.com', generation: 1 },
			writes: [
				{ enabled: true, origin: 'https://relay.example.com', generation: 1 },
				{ enabled: true, origin: 'https://relay.example.com', generation: 1 },
				{ enabled: false, origin: 'https://relay.example.com', generation: 1 }
			]
		});
		recordState({
			state: 'enrols-a-remote-host-and-turns-access-off',
			symbol: 'enrol',
			name: 'Registration is saved and remote access is disabled',
			input: { state: record(), registration, wanted: true },
			output
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Skips an unwanted remote host enrolment', async () => {
	const directory = tempDirectory();
	try {
		const state = record();
		let saves = 0;
		const service = new RemoteHostRecordService({
			available: () => true,
			read: async () => null,
			save: async () => {
				saves += 1;
			}
		} as unknown as ConstructorParameters<typeof RemoteHostRecordService>[0]);
		const registration: RemoteHostEnrolment = {
			enabled: true,
			origin: 'https://relay.example.com',
			generation: 1
		};
		const applied = await service.enrol(state, registration, () => false);
		const output = { applied, value: service.value, saves };
		expect(output).toEqual({ applied: false, value: null, saves: 0 });
		recordState({
			state: 'skips-an-unwanted-remote-host-enrolment',
			symbol: 'enrol',
			name: 'A stale registration makes no changes',
			input: { state, registration, wanted: false },
			output
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
