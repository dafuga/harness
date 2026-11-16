import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { cpuProcesses } from '../../src/services/development-tooling/cpu-usage-service/cpu-process-adapter/cpuProcesses';

test('Parses process rows and classifies recognized applications', () => {
	const value =
		'  4821     1 0:12.34 /usr/local/bin/codex app-server --stdio\n' +
		'  5103  4821 1-02:03:04 node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js\n' +
		'  9034  5103 0:00.50 /bin/zsh -l\n' +
		'bad row\n';
	const input = { value, monitorPid: 4821 };
	const output = cpuProcesses(input.value, input.monitorPid);
	expect(output).toEqual([
		{ pid: 4821, parentPid: 1, cpuMs: 12340, role: 'harness', label: 'Harness' },
		{ pid: 5103, parentPid: 4821, cpuMs: 93784000, role: 'agent', label: 'Claude' },
		{ pid: 9034, parentPid: 5103, cpuMs: 500 }
	]);
	recordExampleCases(
		{
			unitId: 'function.cpu-processes',
			symbol: 'cpuProcesses',
			state: 'parses-process-rows-and-classifies-recognized-applications',
			evidence: 'examples-cases',
			file: 'parses-process-rows-and-classifies-recognized-applications.json'
		},
		[{ name: 'recognized and unknown commands with malformed row skipped', input, output }]
	);
});
