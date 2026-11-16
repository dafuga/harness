import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { backfillUids } from '../../src/workflows/development-tooling/backfill-uids/backfillUids';

const unitId = 'workflow.development-tooling-backfill-uids-backfill-uids';
const state = 'plans-uid-assignments-without-writing';

test('Plans UID assignments without writing', async () => {
	const input = {};
	const report = await backfillUids(input);
	const output = {
		units: report.units,
		assigned: report.assigned.slice(0, 3),
		annotated: report.annotated.slice(0, 3),
		registryOnly: report.registryOnly.slice(0, 3),
		conflicts: report.conflicts.slice(0, 3),
		written: report.written
	};
	expect(report.units).toBeGreaterThan(0);
	expect(report.written).toBe(0);
	recordExampleCases(
		{
			unitId,
			symbol: 'backfillUids',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'active repository units are planned without modification', input, output }]
	);
});
