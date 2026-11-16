import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CpuUsageService } from '../../src/services/development-tooling/cpu-usage-service/CpuUsageService';

test('Returns an unavailable snapshot when sampling fails', async () => {
	const service = new CpuUsageService({
		sample: async () => {
			throw new Error('sample unavailable');
		}
	});
	const snapshot = await service.snapshot();
	const output = {
		status: snapshot.status,
		intervalMs: snapshot.intervalMs,
		logicalCores: snapshot.logicalCores,
		machinePercent: snapshot.machinePercent,
		trackedPercent: snapshot.trackedPercent,
		groups: snapshot.groups,
		agents: snapshot.agents
	};

	expect(output).toEqual({
		status: 'unavailable',
		intervalMs: 0,
		logicalCores: 0,
		machinePercent: null,
		trackedPercent: null,
		groups: [],
		agents: []
	});
	recordExampleCases(
		{
			unitId: 'service.cpu-usage',
			symbol: 'CpuUsageService.snapshot',
			state: 'returns-an-unavailable-snapshot-when-sampling-fails',
			evidence: 'examples-cases',
			file: 'returns-an-unavailable-snapshot-when-sampling-fails.json'
		},
		[
			{
				name: 'adapter sampling failure resolves to an unavailable snapshot',
				input: { adapter: 'sample rejects' },
				output
			}
		]
	);
});
