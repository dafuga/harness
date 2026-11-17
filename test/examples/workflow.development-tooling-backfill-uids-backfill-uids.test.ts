import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
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

const errorState = 'throws-error-when-loading-units-fails';

test('Throws Error when loading units fails', async () => {
	await withTempDir('backfill-uids-error-', async (directory) => {
		const input = { root: `${directory}/missing-project` };
		let failure: unknown;
		try {
			await backfillUids(input);
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);
		const error = failure instanceof Error ? { name: failure.name, message: failure.message } : {};
		recordExampleCases(
			{
				unitId,
				symbol: 'backfillUids',
				state: errorState,
				evidence: 'examples-cases',
				file: `${errorState}.json`
			},
			[{ name: 'a missing project root propagates the load failure', input, error }]
		);
	});
});
