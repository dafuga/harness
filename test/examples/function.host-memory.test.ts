import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { linuxMemory, macMemory } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/hostMemory';

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
