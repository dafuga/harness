import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubMetadata } from '../../src/utils/development-tooling/hub-metadata/hubMetadata';

const state = 'reuses-metadata-or-skips-when-raw-loading-is-unavailable';

test('Reuses metadata or skips when raw loading is unavailable', async () => {
	const existing = new Map([['contract.json', new TextEncoder().encode('{}')]]);
	const withMetadata = {
		source: {},
		metadata: existing
	} as Parameters<typeof hubMetadata>[0];
	const withoutRawMany = { source: {} } as Parameters<typeof hubMetadata>[0];

	const results = await Promise.all([hubMetadata(withMetadata), hubMetadata(withoutRawMany)]);
	expect(results).toEqual([undefined, undefined]);
	expect(withMetadata.metadata).toBe(existing);
	const cases = [
		{
			name: 'existing pinned metadata is reused',
			input: { metadataPaths: ['contract.json'], rawMany: true },
			output: { resolved: true, paths: ['contract.json'] }
		},
		{
			name: 'missing raw loader skips metadata loading',
			input: { metadataPaths: [], rawMany: false },
			output: { resolved: true, metadata: null }
		}
	];
	recordExampleCases(
		{
			unitId: 'hub.function.hub-metadata',
			symbol: 'hubMetadata',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
});
