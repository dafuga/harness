import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { machineProfile } from '../../src/utils/development-tooling/machineProfile';

test('Machine profile returns repeatable host facts', () => {
	const first = machineProfile();
	const second = machineProfile();
	const summary = {
		id: first.id,
		platform: first.platform,
		arch: first.arch,
		cpu: first.cpu,
		cores: first.cores,
		memoryBytes: first.memoryBytes,
		runtime: first.runtime
	};

	expect(first).toEqual(second);
	expect(first.id).toMatch(/^[a-f0-9]{16}$/);
	expect(first.cores).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'function.machine-profile',
			symbol: 'machineProfile',
			state: 'machine-profile-returns-repeatable-host-facts',
			evidence: 'examples-cases',
			file: 'machine-profile-returns-repeatable-host-facts.json'
		},
		[
			{
				name: 'current host profile identifies stable hardware and runtime facts',
				input: {},
				output: summary
			}
		]
	);
});
