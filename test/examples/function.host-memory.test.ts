import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { hostMemory, linuxMemory, macMemory } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostMemory';

let hostPlatform = 'linux';
vi.mock('node:os', () => ({
	platform: () => hostPlatform,
	totalmem: () => 17179869184,
	freemem: () => 8589934592
}));
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(async () => 'MemTotal: 16384000 kB\nMemAvailable: 8192000 kB\n')
}));

const macText =
	'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 100.\nPages inactive: 200.\nPages speculative: 50.';
const macState = 'parses-macos-memory-counters-and-pressure';
const linuxState = 'parses-linux-memory-counters-and-pressure';

test('Parses macOS memory counters and pressure', () => {
	const normal = macMemory(macText, ' 1\n', 17179869184);
	const capped = macMemory(macText, '4', 1000000);
	const unknown = macMemory(macText, '3', 17179869184);
	expect([normal, capped.memoryAvailableBytes, unknown.memoryPressure]).toEqual([
		{
			memoryTotalBytes: 17179869184,
			memoryAvailableBytes: 5734400,
			memoryPressure: 'normal'
		},
		1000000,
		'unknown'
	]);
	recordExampleCases(
		{
			unitId: 'function.host-memory',
			symbol: 'macMemory',
			state: macState,
			evidence: 'examples-cases',
			file: `${macState}.json`
		},
		[
			{
				name: 'normal pressure from trimmed level and three page counters',
				input: { text: macText, pressure: ' 1\n', total: 17179869184 },
				output: normal
			},
			{
				name: 'available bytes are capped at supplied total',
				input: { text: macText, pressure: '4', total: 1000000 },
				output: capped
			},
			{
				name: 'unrecognized pressure level maps to unknown',
				input: { text: macText, pressure: '3', total: 17179869184 },
				output: unknown
			}
		]
	);
});

test('Parses Linux memory counters and pressure', () => {
	const normal = linuxMemory(
		'MemTotal:       16384000 kB\nMemAvailable:    8192000 kB\n'
	);
	const critical = linuxMemory(
		'MemTotal:       16384000 kB\nMemAvailable:    409600 kB\n'
	);
	expect([normal, critical.memoryPressure]).toEqual([
		{
			memoryTotalBytes: 16777216000,
			memoryAvailableBytes: 8388608000,
			memoryPressure: 'normal'
		},
		'critical'
	]);
	recordExampleCases(
		{
			unitId: 'function.host-memory',
			symbol: 'linuxMemory',
			state: linuxState,
			evidence: 'examples-cases',
			file: `${linuxState}.json`
		},
		[
			{
				name: 'available memory at half of total is normal',
				input: 'MemTotal:       16384000 kB\nMemAvailable:    8192000 kB\n',
				output: normal
			},
			{
				name: 'available memory below five percent is critical',
				input: 'MemTotal:       16384000 kB\nMemAvailable:    409600 kB\n',
				output: critical
			}
		]
	);
});

test('Throws Invalid memory counters for missing Linux counters', () => {
	const input = 'MemTotal: 0 kB\n';
	const error = () => linuxMemory(input);
	expect(error).toThrow('Cannot read Linux available memory');
	let message = '';
	try {
		linuxMemory(input);
	} catch (caught) {
		message = (caught as Error).message;
	}
	const state = 'throws-invalid-memory-counters-for-missing-linux-counters';
	recordExampleCases(
		{ unitId: 'function.host-memory', symbol: 'linuxMemory', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'missing available counter', input, error: message }]
	);
});

test('Throws Unsupported resource platform for an unknown platform', async () => {
	hostPlatform = 'freebsd';
	await expect(hostMemory()).rejects.toThrow('Unsupported resource platform');
	const state = 'throws-unsupported-resource-platform-for-an-unknown-platform';
	let message = '';
	try {
		await hostMemory();
	} catch (caught) {
		message = (caught as Error).message;
	}
	recordExampleCases(
		{ unitId: 'function.host-memory', symbol: 'hostMemory', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'unsupported platform', input: 'freebsd', error: message }]
	);
	hostPlatform = 'linux';
});

test('Throws Memory probe failure when Linux memory cannot be read', async () => {
	const fs = await import('node:fs/promises');
	vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('probe failed'));
	await expect(hostMemory()).rejects.toThrow('probe failed');
	const state = 'throws-memory-probe-failure-when-linux-memory-cannot-be-read';
	let message = '';
	try {
		await hostMemory();
	} catch (caught) {
		message = (caught as Error).message;
	}
	recordExampleCases(
		{ unitId: 'function.host-memory', symbol: 'hostMemory', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'Linux probe rejection', input: '/proc/meminfo', error: message }]
	);
});

test('Throws Error for invalid macOS memory counters', () => {
	const input = 'Pages free: 10.\n';
	expect(() => macMemory(input, '1', 1024)).toThrow('Cannot read macOS memory counters');
	const state = 'throws-error-for-invalid-macos-memory-counters';
	let message = '';
	try {
		macMemory(input, '1', 1024);
	} catch (caught) {
		message = (caught as Error).message;
	}
	recordExampleCases(
		{ unitId: 'function.host-memory', symbol: 'macMemory', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'missing page size', input: { text: input, pressure: '1', total: 1024 }, error: message }]
	);
});
